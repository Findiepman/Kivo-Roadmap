const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET;

const getUser = db.prepare('SELECT id, username, token_version FROM users WHERE id = ?');

// Verifies the Authorization: Bearer <token> header and attaches req.user.
// The token's version must match the account's current token_version, so a
// password change or logout invalidates every token issued before it, and a
// deleted account's tokens stop working immediately.
function auth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const parts = header.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  let payload;
  try {
    payload = jwt.verify(parts[1], JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const user = Number.isInteger(payload.userId) ? getUser.get(payload.userId) : null;
  if (!user || payload.tv !== user.token_version) {
    return res.status(401).json({ error: 'Your session has ended. Log in again.' });
  }

  req.user = { userId: user.id, username: user.username };
  next();
}

module.exports = auth;
