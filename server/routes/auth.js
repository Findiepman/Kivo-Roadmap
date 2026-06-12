const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const auth = require('../middleware/auth');
const { isAdmin } = require('../permissions');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRY = '30d';
const SALT_ROUNDS = 12;

// Self-service registration is OFF unless ALLOW_REGISTRATION=true.
function registrationAllowed() {
  return String(process.env.ALLOW_REGISTRATION || '').toLowerCase() === 'true';
}

// GET /api/auth/config — public flags the login page reads (no auth).
router.get('/config', (req, res) => {
  res.json({ allowRegistration: registrationAllowed() });
});

function signToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

// POST /api/auth/register
router.post('/register', (req, res) => {
  if (!registrationAllowed()) {
    return res.status(403).json({ error: 'Registration is disabled' });
  }

  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Username and password must be strings' });
  }
  if (username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);
  const result = db
    .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
    .run(username, passwordHash);

  const user = { id: result.lastInsertRowid, username };
  const token = signToken(user);

  res.status(201).json({ token, user: { id: user.id, username: user.username } });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = signToken(user);
  res.json({ token, user: { id: user.id, username: user.username } });
});

// GET /api/auth/me
router.get('/me', auth, (req, res) => {
  const user = db
    .prepare('SELECT id, username FROM users WHERE id = ?')
    .get(req.user.userId);

  if (!user) {
    return res.status(401).json({ error: 'User no longer exists' });
  }

  res.json({
    id: user.id,
    username: user.username,
    canCreateRoadmaps: isAdmin(user.username),
  });
});

module.exports = router;
