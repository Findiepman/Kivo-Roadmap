const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const auth = require('../middleware/auth');
const { isAdmin } = require('../permissions');
const { signToken } = require('./auth');
const { LIMITS, validUsername, validPassword } = require('../validate');
const rateLimits = require('../rateLimits');
const { checkPassword, sendBusy, markPasswordFailed } = require('../passwordCheck');

const router = express.Router();

const SALT_ROUNDS = 12;

const USERNAME_RULE = `Username must be ${LIMITS.USERNAME_MIN} to ${LIMITS.USERNAME_MAX} characters`;
const PASSWORD_RULE = `Password must be at least ${LIMITS.PASSWORD_MIN} characters (and at most ${LIMITS.PASSWORD_MAX} bytes)`;

router.use(auth);

// Every admin route requires the caller to have admin status in the database.
router.use((req, res, next) => {
  if (!isAdmin(req.user.userId)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
});

function isUniqueClash(err) {
  return err && err.code === 'SQLITE_CONSTRAINT_UNIQUE';
}

// "#1B6FB8" -> "#1b6fb8". null / "" clear the colour (back to automatic).
// Returns undefined for anything that isn't a 6-digit hex colour.
function normalizeColor(color) {
  if (color === null || color === '') return null;
  if (typeof color !== 'string') return undefined;
  const c = color.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(c) ? c : undefined;
}

function serializeUser(u) {
  return {
    id: u.id,
    username: u.username,
    color: u.color || null,
    isAdmin: !!u.is_admin,
    createdAt: u.created_at,
  };
}

// GET /api/admin/users — every account (admins first), each with the roadmaps
// it owns or has been added to.
router.get('/users', (req, res) => {
  const rows = db
    .prepare(
      'SELECT id, username, color, is_admin, created_at FROM users ORDER BY is_admin DESC, created_at ASC, id ASC'
    )
    .all();

  const memberships = db
    .prepare(
      `SELECT r.owner_id AS user_id, r.id, r.title, 'owner' AS role FROM roadmaps r
       UNION ALL
       SELECT ra.user_id, r.id, r.title, ra.role FROM roadmap_access ra
       JOIN roadmaps r ON r.id = ra.roadmap_id
       ORDER BY title COLLATE NOCASE ASC`
    )
    .all();
  const byUser = new Map();
  for (const m of memberships) {
    if (!byUser.has(m.user_id)) byUser.set(m.user_id, []);
    byUser.get(m.user_id).push({ id: m.id, title: m.title, role: m.role });
  }

  res.json(rows.map((u) => ({ ...serializeUser(u), roadmaps: byUser.get(u.id) || [] })));
});

// POST /api/admin/users — create an account.
router.post('/users', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};

    if (!validUsername(username)) {
      return res.status(400).json({ error: USERNAME_RULE });
    }
    if (!validPassword(password)) {
      return res.status(400).json({ error: PASSWORD_RULE });
    }

    const name = username.trim();
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(name);
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    // Async hash: hashing at cost 12 must not block other requests.
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    let result;
    try {
      result = db
        .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
        .run(name, hash);
    } catch (err) {
      // Same name created by a parallel request while hashing.
      if (isUniqueClash(err)) return res.status(409).json({ error: 'Username already taken' });
      throw err;
    }

    const user = db
      .prepare('SELECT id, username, color, is_admin, created_at FROM users WHERE id = ?')
      .get(result.lastInsertRowid);

    res.status(201).json(serializeUser(user));
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/users/:id — change username, password and/or avatar colour of
// any account, including the admin's own. A password change ends every session of that
// account; when admins change their own password they get a fresh token back
// so they stay logged in on this device. Editing your own account or any
// other admin account needs the caller's current password, so a copied admin
// login token alone cannot take admin accounts over or rename them away.
// Wrong current passwords share the login rate limit; edits of regular
// accounts are not rate limited by it. Only the avatar colour can be changed
// without it (harmless, and admins set colours for everyone).
function needsCallerPassword(req, target) {
  return target.id === req.user.userId || !!target.is_admin;
}

// Does this request touch the login (name / password) or delete the account?
function touchesLogin(req) {
  if (req.method === 'DELETE') return true;
  const body = req.body || {};
  return body.username !== undefined || body.password !== undefined;
}

function limitPasswordGuesses(req, res, next) {
  const target = db.prepare('SELECT id, is_admin FROM users WHERE id = ?').get(Number(req.params.id));
  if (target && touchesLogin(req) && needsCallerPassword(req, target)) {
    return rateLimits.loginPerIp(req, res, next);
  }
  next();
}

// Checks the caller's own password. Returns true when it is right; otherwise
// it has already sent the 403 / busy reply and returns false.
async function confirmCallerPassword(req, res, currentPassword) {
  if (typeof currentPassword !== 'string' || !currentPassword) {
    markPasswordFailed(res);
    res.status(403).json({ error: 'Enter your own current password to change an admin account' });
    return false;
  }
  if (currentPassword.length > 1024) {
    markPasswordFailed(res);
    res.status(403).json({ error: 'Your current password is not correct' });
    return false;
  }
  // Always the caller's own password, also when acting on another admin.
  const caller = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.userId);
  const ok = caller ? await checkPassword(currentPassword, caller.password_hash) : false;
  if (ok === null) {
    sendBusy(res);
    return false;
  }
  if (!ok) {
    markPasswordFailed(res);
    res.status(403).json({ error: 'Your current password is not correct' });
    return false;
  }
  return true;
}

router.put('/users/:id', limitPasswordGuesses, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { username, password, color, currentPassword } = req.body || {};
    if (username === undefined && password === undefined && color === undefined) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    let newColor;
    if (color !== undefined) {
      newColor = normalizeColor(color);
      if (newColor === undefined) {
        return res.status(400).json({ error: 'Color must look like #1b6fb8' });
      }
    }

    if (
      touchesLogin(req) &&
      needsCallerPassword(req, user) &&
      !(await confirmCallerPassword(req, res, currentPassword))
    ) {
      return;
    }

    let newUsername = user.username;
    if (username !== undefined) {
      if (!validUsername(username)) {
        return res.status(400).json({ error: USERNAME_RULE });
      }
      newUsername = username.trim();
      const clash = db
        .prepare('SELECT id FROM users WHERE username = ? AND id != ?')
        .get(newUsername, id);
      if (clash) {
        return res.status(409).json({ error: 'Username already taken' });
      }
    }

    let newHash = null;
    if (password !== undefined) {
      if (!validPassword(password)) {
        return res.status(400).json({ error: PASSWORD_RULE });
      }
      newHash = await bcrypt.hash(password, SALT_ROUNDS);
    }

    // Only write the fields that were sent: the row read above is from before
    // the password was hashed, so writing its values back could undo a change
    // made in the meantime. Column names here are fixed strings, never input.
    const sets = [];
    const params = [];
    if (username !== undefined) {
      sets.push('username = ?');
      params.push(newUsername);
    }
    if (newHash) {
      sets.push('password_hash = ?', 'token_version = token_version + 1');
      params.push(newHash);
    }
    if (color !== undefined) {
      sets.push('color = ?');
      params.push(newColor);
    }
    let result;
    try {
      result = db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...params, id);
    } catch (err) {
      if (isUniqueClash(err)) return res.status(409).json({ error: 'Username already taken' });
      throw err;
    }
    // Deleted by a parallel request while the password was hashing.
    if (result.changes === 0) return res.status(404).json({ error: 'User not found' });

    const updated = db
      .prepare('SELECT id, username, color, is_admin, token_version, created_at FROM users WHERE id = ?')
      .get(id);
    const body = serializeUser(updated);
    if (newHash && id === req.user.userId) {
      body.token = signToken(updated);
    }
    res.json(body);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/users/:id — remove an account. Their owned roadmaps go
// with them (tasks and access rows cascade) and they are unassigned from tasks.
// Deleting your own or another admin account needs the caller's password.
router.delete('/users/:id', limitPasswordGuesses, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { currentPassword } = req.body || {};
    if (needsCallerPassword(req, user) && !(await confirmCallerPassword(req, res, currentPassword))) {
      return;
    }

    // Everything below runs in one transaction, after the password check, so
    // two deletes running at the same time can never remove the last admin.
    const removeUser = db.transaction(() => {
      const current = db.prepare('SELECT id, is_admin FROM users WHERE id = ?').get(id);
      if (!current) return 'gone';
      if (current.is_admin) {
        const adminCount = db
          .prepare('SELECT COUNT(*) AS c FROM users WHERE is_admin = 1')
          .get().c;
        if (adminCount <= 1) return 'last-admin';
      }

      // Unassign the user from every task that references them.
      const taskRows = db
        .prepare("SELECT id, assignees FROM tasks WHERE assignees != '[]'")
        .all();
      const updateAssignees = db.prepare('UPDATE tasks SET assignees = ? WHERE id = ?');
      for (const t of taskRows) {
        let ids = [];
        try {
          const parsed = JSON.parse(t.assignees);
          if (Array.isArray(parsed)) ids = parsed;
        } catch (_) {
          ids = [];
        }
        const filtered = ids.filter((uid) => Number(uid) !== id);
        if (filtered.length !== ids.length) {
          updateAssignees.run(JSON.stringify(filtered), t.id);
        }
      }

      db.prepare('DELETE FROM roadmaps WHERE owner_id = ?').run(id);
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
      return 'deleted';
    });

    const outcome = removeUser();
    if (outcome === 'gone') return res.status(404).json({ error: 'User not found' });
    if (outcome === 'last-admin') {
      return res.status(400).json({ error: 'Cannot delete the only admin account' });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
