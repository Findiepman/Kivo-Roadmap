const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const { getRole, canWrite } = require('../permissions');

// mergeParams so we can read :id (the roadmap id) from the parent mount path.
const router = express.Router({ mergeParams: true });

router.use(auth);

const COLUMNS = ['todo', 'doing', 'done'];

// Serialize a DB row into the API shape, parsing tags from JSON.
function serializeTask(row) {
  let tags = [];
  try {
    const parsed = JSON.parse(row.tags);
    if (Array.isArray(parsed)) tags = parsed;
  } catch (_) {
    tags = [];
  }
  return {
    id: row.id,
    roadmap_id: row.roadmap_id,
    title: row.title,
    description: row.description,
    column: row.column,
    position: row.position,
    tags,
    created_at: row.created_at,
  };
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return '[]';
  // Keep only string entries, trimmed and non-empty.
  const clean = tags
    .filter((t) => typeof t === 'string')
    .map((t) => t.trim())
    .filter(Boolean);
  return JSON.stringify(clean);
}

// GET /api/roadmaps/:id/tasks — any access level may read.
router.get('/', (req, res) => {
  const roadmapId = Number(req.params.id);
  const role = getRole(roadmapId, req.user.userId);
  if (!role) return res.status(404).json({ error: 'Roadmap not found' });

  const rows = db
    .prepare(
      'SELECT id, roadmap_id, title, description, "column", position, tags, created_at ' +
        'FROM tasks WHERE roadmap_id = ? ORDER BY "column", position ASC, id ASC'
    )
    .all(roadmapId);

  res.json(rows.map(serializeTask));
});

// POST /api/roadmaps/:id/tasks — owner or editor.
router.post('/', (req, res) => {
  const roadmapId = Number(req.params.id);
  const role = getRole(roadmapId, req.user.userId);
  if (!role) return res.status(404).json({ error: 'Roadmap not found' });
  if (!canWrite(role)) {
    return res.status(403).json({ error: 'You do not have permission to add tasks' });
  }

  const { title, description, column, tags } = req.body || {};

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Task title is required' });
  }
  const col = COLUMNS.includes(column) ? column : 'todo';

  // New task goes to the bottom of its column.
  const maxRow = db
    .prepare('SELECT MAX(position) AS maxPos FROM tasks WHERE roadmap_id = ? AND "column" = ?')
    .get(roadmapId, col);
  const position = (maxRow && maxRow.maxPos != null ? maxRow.maxPos : -1) + 1;

  const result = db
    .prepare(
      'INSERT INTO tasks (roadmap_id, title, description, "column", position, tags) ' +
        'VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(roadmapId, title.trim(), (description || '').toString(), col, position, normalizeTags(tags));

  const row = db
    .prepare(
      'SELECT id, roadmap_id, title, description, "column", position, tags, created_at FROM tasks WHERE id = ?'
    )
    .get(result.lastInsertRowid);

  res.status(201).json(serializeTask(row));
});

// PUT /api/roadmaps/:id/tasks/reorder — bulk position/column update after drag & drop.
// Declared BEFORE /:taskId so "reorder" isn't captured as a task id.
router.put('/reorder', (req, res) => {
  const roadmapId = Number(req.params.id);
  const role = getRole(roadmapId, req.user.userId);
  if (!role) return res.status(404).json({ error: 'Roadmap not found' });
  if (!canWrite(role)) {
    return res.status(403).json({ error: 'You do not have permission to reorder tasks' });
  }

  const { tasks } = req.body || {};
  if (!Array.isArray(tasks)) {
    return res.status(400).json({ error: 'tasks must be an array' });
  }

  const update = db.prepare(
    'UPDATE tasks SET "column" = ?, position = ? WHERE id = ? AND roadmap_id = ?'
  );

  const applyAll = db.transaction((items) => {
    for (const t of items) {
      if (!t || typeof t.id === 'undefined') continue;
      if (!COLUMNS.includes(t.column)) continue;
      update.run(t.column, Number(t.position) || 0, Number(t.id), roadmapId);
    }
  });

  applyAll(tasks);

  const rows = db
    .prepare(
      'SELECT id, roadmap_id, title, description, "column", position, tags, created_at ' +
        'FROM tasks WHERE roadmap_id = ? ORDER BY "column", position ASC, id ASC'
    )
    .all(roadmapId);

  res.json(rows.map(serializeTask));
});

// PUT /api/roadmaps/:id/tasks/:taskId — owner or editor.
router.put('/:taskId', (req, res) => {
  const roadmapId = Number(req.params.id);
  const taskId = Number(req.params.taskId);
  const role = getRole(roadmapId, req.user.userId);
  if (!role) return res.status(404).json({ error: 'Roadmap not found' });
  if (!canWrite(role)) {
    return res.status(403).json({ error: 'You do not have permission to edit tasks' });
  }

  const existing = db
    .prepare('SELECT * FROM tasks WHERE id = ? AND roadmap_id = ?')
    .get(taskId, roadmapId);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const { title, description, column, position, tags } = req.body || {};

  const newTitle =
    typeof title === 'string' && title.trim() ? title.trim() : existing.title;
  const newDesc =
    typeof description === 'string' ? description : existing.description;
  const newColumn = COLUMNS.includes(column) ? column : existing.column;
  const newPosition =
    typeof position === 'number' ? position : existing.position;
  const newTags = Array.isArray(tags) ? normalizeTags(tags) : existing.tags;

  db.prepare(
    'UPDATE tasks SET title = ?, description = ?, "column" = ?, position = ?, tags = ? WHERE id = ?'
  ).run(newTitle, newDesc, newColumn, newPosition, newTags, taskId);

  const row = db
    .prepare(
      'SELECT id, roadmap_id, title, description, "column", position, tags, created_at FROM tasks WHERE id = ?'
    )
    .get(taskId);

  res.json(serializeTask(row));
});

// DELETE /api/roadmaps/:id/tasks/:taskId — owner or editor.
router.delete('/:taskId', (req, res) => {
  const roadmapId = Number(req.params.id);
  const taskId = Number(req.params.taskId);
  const role = getRole(roadmapId, req.user.userId);
  if (!role) return res.status(404).json({ error: 'Roadmap not found' });
  if (!canWrite(role)) {
    return res.status(403).json({ error: 'You do not have permission to delete tasks' });
  }

  const result = db
    .prepare('DELETE FROM tasks WHERE id = ? AND roadmap_id = ?')
    .run(taskId, roadmapId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json({ success: true });
});

module.exports = router;
