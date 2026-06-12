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
    column TEXT NOT NULL CHECK(column IN ('planned', 'in_progress', 'testing', 'released')),
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

// --- Migrations ---
// public_token: when set, the roadmap is viewable read-only by anyone holding
// the token (no login). NULL = not publicly shared.
const roadmapCols = db.prepare("PRAGMA table_info(roadmaps)").all();
if (!roadmapCols.some((c) => c.name === 'public_token')) {
  db.exec('ALTER TABLE roadmaps ADD COLUMN public_token TEXT');
}
db.exec('CREATE INDEX IF NOT EXISTS idx_roadmaps_public ON roadmaps(public_token)');

// Column-model migration: the board used to be todo/doing/done. It is now
// planned/in_progress/testing/released. SQLite can't ALTER a CHECK constraint,
// so if an old-style tasks table is detected, rebuild it and remap values.
const tasksSchema = db
  .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks'")
  .get();

if (tasksSchema && /'todo'/.test(tasksSchema.sql)) {
  db.pragma('foreign_keys = OFF');
  const migrateColumns = db.transaction(() => {
    db.exec(`
      CREATE TABLE tasks_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        roadmap_id INTEGER NOT NULL REFERENCES roadmaps(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        column TEXT NOT NULL CHECK(column IN ('planned', 'in_progress', 'testing', 'released')),
        position INTEGER DEFAULT 0,
        tags TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    db.exec(`
      INSERT INTO tasks_new (id, roadmap_id, title, description, "column", position, tags, created_at)
      SELECT id, roadmap_id, title, description,
        CASE "column"
          WHEN 'todo' THEN 'planned'
          WHEN 'doing' THEN 'in_progress'
          WHEN 'done' THEN 'released'
          ELSE "column"
        END,
        position, tags, created_at
      FROM tasks;
    `);
    db.exec('DROP TABLE tasks;');
    db.exec('ALTER TABLE tasks_new RENAME TO tasks;');
  });
  migrateColumns();
  db.pragma('foreign_keys = ON');
  db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_roadmap ON tasks(roadmap_id)');
}

module.exports = db;
