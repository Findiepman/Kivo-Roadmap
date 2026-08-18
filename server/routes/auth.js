const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const auth = require('../middleware/auth');
const { isAdmin } = require('../permissions');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRY = '30d';

function signToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

// POST /api/auth/login
// There is no self-service registration: accounts are created by an admin
// in the admin panel (see routes/admin.js).
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
  res.json({
    token,
    user: { id: user.id, username: user.username, isAdmin: !!user.is_admin },
  });
});

// GET /api/auth/me
router.get('/me', auth, (req, res) => {
  const user = db
    .prepare('SELECT id, username, is_admin FROM users WHERE id = ?')
    .get(req.user.userId);

  if (!user) {
    return res.status(401).json({ error: 'User no longer exists' });
  }

  res.json({
    id: user.id,
    username: user.username,
    isAdmin: !!user.is_admin,
    canCreateRoadmaps: isAdmin(user.id),
  });
});

module.exports = router;
