require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set.');
  process.exit(1);
}

// Initialising db creates the SQLite file and tables on first run.
require('./db');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const roadmapRoutes = require('./routes/roadmaps');
const taskRoutes = require('./routes/tasks');
const accessRoutes = require('./routes/access');
const publicRoutes = require('./routes/public');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- API routes ---
app.use('/api/auth', authRoutes);
// Admin-only account management.
app.use('/api/admin', adminRoutes);
// Public, no-auth read-only access by share token.
app.use('/api/public', publicRoutes);
// Nested resources mounted before the bare /api/roadmaps so the longer
// paths resolve to their own routers.
app.use('/api/roadmaps/:id/tasks', taskRoutes);
app.use('/api/roadmaps/:id/access', accessRoutes);
app.use('/api/roadmaps', roadmapRoutes);

// Unknown API route -> JSON 404 (never fall through to static / index.html).
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// --- Static frontend ---
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// Anything else: serve the login page (index.html). Keeps deep links working.
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// JSON error handler — all errors return { error }.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Kivo server listening on http://localhost:${PORT}`);
});
