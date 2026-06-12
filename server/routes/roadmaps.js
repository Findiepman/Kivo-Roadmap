const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const auth = require('../middleware/auth');
const { getRole } = require('../permissions');

const router = express.Router();

// All roadmap routes require authentication.
router.use(auth);

// GET /api/roadmaps — every roadmap the user owns or has been granted access to.
router.get('/', (req, res) => {
  const userId = req.user.userId;

  const rows = db
    .prepare(
      `SELECT r.id, r.title, r.description, r.created_at,
              CASE WHEN r.owner_id = @userId THEN 'owner' ELSE ra.role END AS role
       FROM roadmaps r
       LEFT JOIN roadmap_access ra
         ON ra.roadmap_id = r.id AND ra.user_id = @userId
       WHERE r.owner_id = @userId OR ra.user_id = @userId
       ORDER BY r.created_at ASC, r.id ASC`
    )
    .all({ userId });

  res.json(rows);
});

// POST /api/roadmaps — create a roadmap owned by the current user.
router.post('/', (req, res) => {
  const { title, description } = req.body || {};

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const result = db
    .prepare('INSERT INTO roadmaps (owner_id, title, description) VALUES (?, ?, ?)')
    .run(req.user.userId, title.trim(), (description || '').toString());

  const roadmap = db
    .prepare('SELECT id, title, description, created_at FROM roadmaps WHERE id = ?')
    .get(result.lastInsertRowid);

  res.status(201).json({ ...roadmap, role: 'owner' });
});

// GET /api/roadmaps/:id — readable by owner, editor or viewer.
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const role = getRole(id, req.user.userId);

  if (!role) {
    return res.status(404).json({ error: 'Roadmap not found' });
  }

  const roadmap = db
    .prepare('SELECT id, title, description, created_at FROM roadmaps WHERE id = ?')
    .get(id);

  res.json({ ...roadmap, role });
});

// PUT /api/roadmaps/:id — owner only.
router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const role = getRole(id, req.user.userId);

  if (!role) return res.status(404).json({ error: 'Roadmap not found' });
  if (role !== 'owner') {
    return res.status(403).json({ error: 'Only the owner can edit this roadmap' });
  }

  const { title, description } = req.body || {};
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }

  db.prepare('UPDATE roadmaps SET title = ?, description = ? WHERE id = ?').run(
    title.trim(),
    (description || '').toString(),
    id
  );

  const roadmap = db
    .prepare('SELECT id, title, description, created_at FROM roadmaps WHERE id = ?')
    .get(id);

  res.json({ ...roadmap, role: 'owner' });
});

// DELETE /api/roadmaps/:id — owner only. Cascades to tasks and access rows.
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const role = getRole(id, req.user.userId);

  if (!role) return res.status(404).json({ error: 'Roadmap not found' });
  if (role !== 'owner') {
    return res.status(403).json({ error: 'Only the owner can delete this roadmap' });
  }

  db.prepare('DELETE FROM roadmaps WHERE id = ?').run(id);
  res.json({ success: true });
});

// --- Public share link (owner only) ---

// GET /api/roadmaps/:id/share — current public token (or null).
router.get('/:id/share', (req, res) => {
  const id = Number(req.params.id);
  const role = getRole(id, req.user.userId);
  if (!role) return res.status(404).json({ error: 'Roadmap not found' });
  if (role !== 'owner') {
    return res.status(403).json({ error: 'Only the owner can manage the share link' });
  }
  const row = db.prepare('SELECT public_token FROM roadmaps WHERE id = ?').get(id);
  res.json({ publicToken: row.public_token || null });
});

// POST /api/roadmaps/:id/share — create the public link (idempotent: reuses an
// existing token if one is already set).
router.post('/:id/share', (req, res) => {
  const id = Number(req.params.id);
  const role = getRole(id, req.user.userId);
  if (!role) return res.status(404).json({ error: 'Roadmap not found' });
  if (role !== 'owner') {
    return res.status(403).json({ error: 'Only the owner can create a share link' });
  }

  let row = db.prepare('SELECT public_token FROM roadmaps WHERE id = ?').get(id);
  if (!row.public_token) {
    const token = crypto.randomBytes(16).toString('hex');
    db.prepare('UPDATE roadmaps SET public_token = ? WHERE id = ?').run(token, id);
    row = { public_token: token };
  }
  res.json({ publicToken: row.public_token });
});

// DELETE /api/roadmaps/:id/share — revoke the public link.
router.delete('/:id/share', (req, res) => {
  const id = Number(req.params.id);
  const role = getRole(id, req.user.userId);
  if (!role) return res.status(404).json({ error: 'Roadmap not found' });
  if (role !== 'owner') {
    return res.status(403).json({ error: 'Only the owner can revoke the share link' });
  }
  db.prepare('UPDATE roadmaps SET public_token = NULL WHERE id = ?').run(id);
  res.json({ publicToken: null });
});

module.exports = router;
