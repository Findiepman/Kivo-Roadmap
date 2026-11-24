const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const auth = require('../middleware/auth');
const { isAdmin } = require('../permissions');
const rateLimits = require('../rateLimits');
const { checkPassword, sendBusy, markPasswordFailed } = require('../passwordCheck');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRY = '7d';

// Compared against when the username does not exist, so a wrong username takes
// as long as a wrong password and response times do not reveal which accounts exist.
const DUMMY_HASH = bcrypt.hashSync('kivo-timing-equaliser', 12);

// tv = the account's token_version; bumping it in the database revokes the token.
function signToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username, tv: user.token_version },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY, algorithm: 'HS256' }
  );
}

// POST /api/auth/login
// There is no self-service registration: accounts are created by an admin
// in the admin panel (see routes/admin.js).
router.post('/login', rateLimits.loginPerIp, async (req, res, next) => {
  try {
    const { username, password } = req.body || {};

    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    if (username.length > 256 || password.length > 1024) {
      markPasswordFailed(res);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
    // Async compare runs in chunks, so a burst of logins cannot freeze the server.
    const valid = await checkPassword(password, user ? user.password_hash : DUMMY_HASH);
    if (valid === null) return sendBusy(res);
    if (!user || !valid) {
      markPasswordFailed(res);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, username: user.username, color: user.color || null, isAdmin: !!user.is_admin },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout — ends every session of this account (all devices).
router.post('/logout', auth, (req, res) => {
  db.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?').run(req.user.userId);
  res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', auth, (req, res) => {
  const user = db
    .prepare('SELECT id, username, color, is_admin FROM users WHERE id = ?')
    .get(req.user.userId);

  if (!user) {
    return res.status(401).json({ error: 'User no longer exists' });
  }

  res.json({
    id: user.id,
    username: user.username,
    color: user.color || null,
    isAdmin: !!user.is_admin,
    canCreateRoadmaps: isAdmin(user.id),
  });
});

module.exports = router;
module.exports.signToken = signToken;
