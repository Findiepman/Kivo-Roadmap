require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET must be set to a random string of at least 32 characters.');
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
const rateLimits = require('./rateLimits');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');

// Security headers. The frontend only loads its own scripts; styles also come
// from Google Fonts, and the pages use a few inline style="" attributes, hence
// 'unsafe-inline' for styles only (never for scripts).
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:'],
        'connect-src': ["'self'"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
      },
    },
    // Fonts come from Google, which does not send CORP headers.
    crossOriginEmbedderPolicy: false,
    strictTransportSecurity: { maxAge: 31536000, includeSubDomains: false },
  })
);

// No CORS middleware: the frontend is served by this same server, so the API
// never needs to answer other origins.

app.use('/api', rateLimits.api);
app.use(express.json({ limit: '100kb' }));

// --- API routes ---
app.use('/api/auth', authRoutes);
// Admin-only account management.
app.use('/api/admin', adminRoutes);
// Public, no-auth read-only access by share token.
app.use('/api/public', rateLimits.publicView, publicRoutes);
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
// The HTML pages live at the repo root; assets live in public/ and are
// referenced as "public/..." from the pages.
// Only the pages are exposed from the root — never server code or the db.
const rootDir = path.join(__dirname, '..');
app.use('/public', express.static(path.join(rootDir, 'public')));

const PAGES = [
  'index.html', 'dashboard.html', 'roadmap.html',
  'settings.html', 'view.html', 'landing.html', '404.html',
];
app.get('/', (req, res) => res.sendFile(path.join(rootDir, 'index.html')));
for (const page of PAGES) {
  app.get(`/${page}`, (req, res) => res.sendFile(path.join(rootDir, page)));
}

// Anything else: serve the login page (index.html). Keeps deep links working.
app.get('*', (req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});

// JSON error handler — all errors return { error }. Client errors from the
// body parser (bad JSON, body too large) keep their 4xx status.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode;
  if (status >= 400 && status < 500) {
    return res.status(status).json({ error: status === 413 ? 'Request too large' : 'Bad request' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Kivo server listening on http://localhost:${PORT}`);
});
