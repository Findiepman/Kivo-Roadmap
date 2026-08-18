const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const auth = require('../middleware/auth');
const { isAdmin } = require('../permissions');

const router = express.Router();

const SALT_ROUNDS = 12;

router.use(auth);

// Every admin route requires the caller to have admin status in the database.
router.use((req, res, next) => {
  if (!isAdmin(req.user.userId)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
});

function validUsername(username) {
  return typeof username === 'string' && username.trim().length >= 3;
}

function validPassword(password) {
  return typeof password === 'string' && password.length >= 6;
}

function serializeUser(u) {
  return {
    id: u.id,
    username: u.username,
    isAdmin: !!u.is_admin,
    createdAt: u.created_at,
  };
}

// GET /api/admin/users — every account.
router.get('/users', (req, res) => {
  const rows = db
    .prepare('SELECT id, username, is_admin, created_at FROM users ORDER BY created_at ASC, id ASC')
    .all();
  res.json(rows.map(serializeUser));
});

// POST /api/admin/users — create an account.
router.post('/users', (req, res) => {
  const { username, password } = req.body || {};

  if (!validUsername(username)) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }
  if (!validPassword(password)) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const name = username.trim();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(name);
  if (existing) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  const hash = bcrypt.hashSync(password, SALT_ROUNDS);
  const result = db
    .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
    .run(name, hash);

  const user = db
    .prepare('SELECT id, username, is_admin, created_at FROM users WHERE id = ?')
    .get(result.lastInsertRowid);

  res.status(201).json(serializeUser(user));
});

// PUT /api/admin/users/:id — change username and/or password of any account,
// including the admin's own.
router.put('/users/:id', (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { username, password } = req.body || {};
  if (username === undefined && password === undefined) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  let newUsername = user.username;
  if (username !== undefined) {
    if (!validUsername(username)) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    newUsername = username.trim();
    const clash = db
      .prepare('SELECT id FROM users WHERE username = ? AND id != ?')
      .get(newUsername, id);
    if (clash) {
      return res.status(409).json({ error: 'Username already taken' });
    }
  }

  let newHash = user.password_hash;
  if (password !== undefined) {
    if (!validPassword(password)) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    newHash = bcrypt.hashSync(password, SALT_ROUNDS);
  }

  db.prepare('UPDATE users SET username = ?, password_hash = ? WHERE id = ?').run(
    newUsername,
    newHash,
    id
  );

  const updated = db
    .prepare('SELECT id, username, is_admin, created_at FROM users WHERE id = ?')
    .get(id);
  res.json(serializeUser(updated));
});

// DELETE /api/admin/users/:id — remove an account. Their owned roadmaps go
// with them (tasks and access rows cascade) and they are unassigned from tasks.
router.delete('/users/:id', (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.is_admin) {
    const adminCount = db
      .prepare('SELECT COUNT(*) AS c FROM users WHERE is_admin = 1')
      .get().c;
    if (adminCount <= 1) {
      return res.status(400).json({ error: 'Cannot delete the only admin account' });
    }
  }

  const removeUser = db.transaction(() => {
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
  });

  removeUser();
  res.json({ success: true });
});

module.exports = router;
