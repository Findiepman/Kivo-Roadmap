const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const { getRole, canWrite } = require('../permissions');

// mergeParams so we can read :id (the roadmap id) from the parent mount path.
const router = express.Router({ mergeParams: true });

router.use(auth);

const STATUSES = ['planned', 'in_progress', 'finished'];

// Serialize a DB row into the API shape, parsing tags and resolving assignee
// user ids to usernames.
function serializeTask(row, usersById) {
  let tags = [];
  try {
    const parsed = JSON.parse(row.tags);
    if (Array.isArray(parsed)) tags = parsed;
  } catch (_) {
    tags = [];
  }

  let assigneeIds = [];
  try {
    const parsed = JSON.parse(row.assignees);
    if (Array.isArray(parsed)) assigneeIds = parsed;
  } catch (_) {
    assigneeIds = [];
  }

  const assignees = assigneeIds
    .map((uid) => usersById.get(Number(uid)))
    .filter(Boolean);

  return {
    id: row.id,
    roadmap_id: row.roadmap_id,
    title: row.title,
    description: row.description,
    status: row.status,
    position: row.position,
    tags,
    assignees, // [{ id, username }]
    created_at: row.created_at,
  };
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return '[]';
  const clean = tags
    .filter((t) => typeof t === 'string')
    .map((t) => t.trim())
    .filter(Boolean);
  return JSON.stringify(clean);
}

// Roadmap members = owner + everyone with an access row. Assignees are
// validated against this set so a task can only be assigned to members.
function getMemberMap(roadmapId) {
  const rows = db
    .prepare(
      `SELECT u.id, u.username FROM users u
       JOIN roadmaps r ON r.owner_id = u.id AND r.id = @roadmapId
       UNION
       SELECT u.id, u.username FROM users u
       JOIN roadmap_access ra ON ra.user_id = u.id AND ra.roadmap_id = @roadmapId`
    )
    .all({ roadmapId });
  return new Map(rows.map((r) => [r.id, { id: r.id, username: r.username }]));
}

function normalizeAssignees(assignees, memberMap) {
  if (!Array.isArray(assignees)) return '[]';
  const clean = [];
  for (const a of assignees) {
    const uid = Number(a);
    if (Number.isInteger(uid) && memberMap.has(uid) && !clean.includes(uid)) {
      clean.push(uid);
    }
  }
  return JSON.stringify(clean);
}

const TASK_FIELDS =
  'id, roadmap_id, title, description, status, position, tags, assignees, created_at';

// GET /api/roadmaps/:id/tasks — any access level may read.
router.get('/', (req, res) => {
  const roadmapId = Number(req.params.id);
  const role = getRole(roadmapId, req.user.userId);
  if (!role) return res.status(404).json({ error: 'Roadmap not found' });

  const usersById = getMemberMap(roadmapId);
  const rows = db
    .prepare(
      `SELECT ${TASK_FIELDS} FROM tasks WHERE roadmap_id = ? ORDER BY status, position ASC, id ASC`
    )
    .all(roadmapId);

  res.json(rows.map((r) => serializeTask(r, usersById)));
});

// POST /api/roadmaps/:id/tasks — owner or editor.
router.post('/', (req, res) => {
  const roadmapId = Number(req.params.id);
  const role = getRole(roadmapId, req.user.userId);
  if (!role) return res.status(404).json({ error: 'Roadmap not found' });
  if (!canWrite(role)) {
    return res.status(403).json({ error: 'You do not have permission to add tasks' });
  }

  const { title, description, status, tags, assignees } = req.body || {};

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Task name is required' });
  }
  const st = STATUSES.includes(status) ? status : 'planned';
  const usersById = getMemberMap(roadmapId);

  // New task goes to the bottom of its status group.
  const maxRow = db
    .prepare('SELECT MAX(position) AS maxPos FROM tasks WHERE roadmap_id = ? AND status = ?')
    .get(roadmapId, st);
  const position = (maxRow && maxRow.maxPos != null ? maxRow.maxPos : -1) + 1;

  const result = db
    .prepare(
      'INSERT INTO tasks (roadmap_id, title, description, status, position, tags, assignees) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      roadmapId,
      title.trim(),
      (description || '').toString(),
      st,
      position,
      normalizeTags(tags),
      normalizeAssignees(assignees, usersById)
    );

  const row = db
    .prepare(`SELECT ${TASK_FIELDS} FROM tasks WHERE id = ?`)
    .get(result.lastInsertRowid);

  res.status(201).json(serializeTask(row, usersById));
});

// PUT /api/roadmaps/:id/tasks/:taskId — owner or editor. Every aspect of a
// task is editable: name, description, status, tags and assignees.
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

  const { title, description, status, tags, assignees } = req.body || {};
  const usersById = getMemberMap(roadmapId);

  const newTitle =
    typeof title === 'string' && title.trim() ? title.trim() : existing.title;
  const newDesc =
    typeof description === 'string' ? description : existing.description;
  const newStatus = STATUSES.includes(status) ? status : existing.status;
  const newTags = Array.isArray(tags) ? normalizeTags(tags) : existing.tags;
  const newAssignees = Array.isArray(assignees)
    ? normalizeAssignees(assignees, usersById)
    : existing.assignees;

  // Moving to a different status: append to the bottom of that group.
  let newPosition = existing.position;
  if (newStatus !== existing.status) {
    const maxRow = db
      .prepare('SELECT MAX(position) AS maxPos FROM tasks WHERE roadmap_id = ? AND status = ?')
      .get(roadmapId, newStatus);
    newPosition = (maxRow && maxRow.maxPos != null ? maxRow.maxPos : -1) + 1;
  }

  db.prepare(
    'UPDATE tasks SET title = ?, description = ?, status = ?, position = ?, tags = ?, assignees = ? WHERE id = ?'
  ).run(newTitle, newDesc, newStatus, newPosition, newTags, newAssignees, taskId);

  const row = db.prepare(`SELECT ${TASK_FIELDS} FROM tasks WHERE id = ?`).get(taskId);
  res.json(serializeTask(row, usersById));
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
