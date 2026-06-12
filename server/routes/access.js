const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const { getRole } = require('../permissions');

const router = express.Router({ mergeParams: true });

router.use(auth);

const ROLES = ['editor', 'viewer'];

// Guard: every access route requires the caller to be the roadmap owner.
function requireOwner(req, res, next) {
  const roadmapId = Number(req.params.id);
  const role = getRole(roadmapId, req.user.userId);
  if (!role) return res.status(404).json({ error: 'Roadmap not found' });
  if (role !== 'owner') {
    return res.status(403).json({ error: 'Only the owner can manage access' });
  }
  next();
}

router.use(requireOwner);

function listAccess(roadmapId) {
  return db
    .prepare(
      `SELECT u.id AS userId, u.username AS username, ra.role AS role
       FROM roadmap_access ra
       JOIN users u ON u.id = ra.user_id
       WHERE ra.roadmap_id = ?
       ORDER BY u.username ASC`
    )
    .all(roadmapId);
}

// GET /api/roadmaps/:id/access
router.get('/', (req, res) => {
  res.json(listAccess(Number(req.params.id)));
});

// POST /api/roadmaps/:id/access — grant a user editor/viewer access by username.
router.post('/', (req, res) => {
  const roadmapId = Number(req.params.id);
  const { username, role } = req.body || {};

  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'Username is required' });
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ error: "Role must be 'editor' or 'viewer'" });
  }

  const user = db.prepare('SELECT id, username FROM users WHERE username = ?').get(username.trim());
  if (!user) {
    return res.status(404).json({ error: 'No user with that username' });
  }

  const roadmap = db.prepare('SELECT owner_id FROM roadmaps WHERE id = ?').get(roadmapId);
  if (roadmap.owner_id === user.id) {
    return res.status(400).json({ error: 'The owner already has full access' });
  }

  // Insert or update the role if the user already has access.
  db.prepare(
    `INSERT INTO roadmap_access (roadmap_id, user_id, role) VALUES (?, ?, ?)
     ON CONFLICT(roadmap_id, user_id) DO UPDATE SET role = excluded.role`
  ).run(roadmapId, user.id, role);

  res.status(201).json(listAccess(roadmapId));
});

// DELETE /api/roadmaps/:id/access/:userId — revoke a user's access.
router.delete('/:userId', (req, res) => {
  const roadmapId = Number(req.params.id);
  const userId = Number(req.params.userId);

  db.prepare('DELETE FROM roadmap_access WHERE roadmap_id = ? AND user_id = ?').run(
    roadmapId,
    userId
  );

  res.json(listAccess(roadmapId));
});

module.exports = router;
