const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

// Resolve the data directory relative to the project root (one level up from /server)
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'kivo.db');
const db = new Database(dbPath);

// Enforce foreign keys (off by default in SQLite) so ON DELETE CASCADE works.
db.pragma('foreign_keys = ON');
// Better concurrency for multiple browser tabs / requests.
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS roadmaps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roadmap_id INTEGER NOT NULL REFERENCES roadmaps(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT NOT NULL CHECK(status IN ('planned', 'in_progress', 'finished')),
    position INTEGER DEFAULT 0,
    tags TEXT DEFAULT '[]',
    assignees TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS roadmap_access (
    roadmap_id INTEGER NOT NULL REFERENCES roadmaps(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('editor', 'viewer')),
    PRIMARY KEY (roadmap_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_roadmap ON tasks(roadmap_id);
  CREATE INDEX IF NOT EXISTS idx_access_user ON roadmap_access(user_id);
`);

// --- Migrations ---

// users.is_admin: admin status now lives in the database instead of an env var.
const userCols = db.prepare('PRAGMA table_info(users)').all();
if (!userCols.some((c) => c.name === 'is_admin')) {
  db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0');
}

// public_token: when set, the roadmap is viewable read-only by anyone holding
// the token (no login). NULL = not publicly shared.
const roadmapCols = db.prepare('PRAGMA table_info(roadmaps)').all();
if (!roadmapCols.some((c) => c.name === 'public_token')) {
  db.exec('ALTER TABLE roadmaps ADD COLUMN public_token TEXT');
}
if (!roadmapCols.some((c) => c.name === 'view_count')) {
  db.exec('ALTER TABLE roadmaps ADD COLUMN view_count INTEGER DEFAULT 0');
}
if (!roadmapCols.some((c) => c.name === 'last_viewed_at')) {
  db.exec('ALTER TABLE roadmaps ADD COLUMN last_viewed_at DATETIME');
}
db.exec('CREATE INDEX IF NOT EXISTS idx_roadmaps_public ON roadmaps(public_token)');

// Status-model migration: the board used to be a kanban with a "column" field
// (todo/doing/done, later planned/in_progress/testing/released). Tasks now have
// a plain status: planned, in_progress or finished. SQLite can't ALTER a CHECK
// constraint, so an old-style table is rebuilt and its values remapped.
const taskCols = db.prepare('PRAGMA table_info(tasks)').all();
if (taskCols.length && !taskCols.some((c) => c.name === 'status')) {
  db.pragma('foreign_keys = OFF');
  const migrateStatus = db.transaction(() => {
    db.exec(`
      CREATE TABLE tasks_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        roadmap_id INTEGER NOT NULL REFERENCES roadmaps(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        status TEXT NOT NULL CHECK(status IN ('planned', 'in_progress', 'finished')),
        position INTEGER DEFAULT 0,
        tags TEXT DEFAULT '[]',
        assignees TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    db.exec(`
      INSERT INTO tasks_new (id, roadmap_id, title, description, status, position, tags, assignees, created_at)
      SELECT id, roadmap_id, title, description,
        CASE "column"
          WHEN 'todo' THEN 'planned'
          WHEN 'planned' THEN 'planned'
          WHEN 'doing' THEN 'in_progress'
          WHEN 'in_progress' THEN 'in_progress'
          WHEN 'testing' THEN 'in_progress'
          ELSE 'finished'
        END,
        position, tags, '[]', created_at
      FROM tasks;
    `);
    db.exec('DROP TABLE tasks;');
    db.exec('ALTER TABLE tasks_new RENAME TO tasks;');
  });
  migrateStatus();
  db.pragma('foreign_keys = ON');
  db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_roadmap ON tasks(roadmap_id)');
} else if (taskCols.length && !taskCols.some((c) => c.name === 'assignees')) {
  db.exec("ALTER TABLE tasks ADD COLUMN assignees TEXT DEFAULT '[]'");
}

// --- Admin seeding ---
// Grant admin status to the usernames in ADMIN_USERNAMES (default: 81hp_).
const seedAdmins = (process.env.ADMIN_USERNAMES || '81hp_')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const grantAdmin = db.prepare(
  'UPDATE users SET is_admin = 1 WHERE lower(username) = lower(?)'
);
for (const name of seedAdmins) {
  grantAdmin.run(name);
}

// Bootstrap: a fresh database has no accounts and sign-up does not exist, so
// create the first admin account. Password comes from BOOTSTRAP_ADMIN_PASSWORD.
const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
if (userCount === 0) {
  const username = seedAdmins[0] || '81hp_';
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'change-me-now';
  const hash = bcrypt.hashSync(password, 12);
  db.prepare(
    'INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)'
  ).run(username, hash);
  console.log(
    `Created bootstrap admin account "${username}". Log in and change the password right away.`
  );
}

module.exports = db;
