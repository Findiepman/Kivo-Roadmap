const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

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
    column TEXT NOT NULL CHECK(column IN ('todo', 'doing', 'done')),
    position INTEGER DEFAULT 0,
    tags TEXT DEFAULT '[]',
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

module.exports = db;
