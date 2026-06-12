const express = require('express');
const db = require('../db');

// Public, UNauthenticated read-only access to a roadmap via its share token.
// No auth middleware here on purpose — anyone with the token can view.
const router = express.Router();

router.get('/:token', (req, res) => {
  const token = req.params.token;
  if (!token) return res.status(404).json({ error: 'Not found' });

  const roadmap = db
    .prepare('SELECT id, title, description FROM roadmaps WHERE public_token = ?')
    .get(token);

  if (!roadmap) {
    return res.status(404).json({ error: 'This roadmap is not available' });
  }

  // Count this view (simple anonymous counter — no IPs stored).
  db.prepare(
    "UPDATE roadmaps SET view_count = COALESCE(view_count, 0) + 1, last_viewed_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(roadmap.id);

  const rows = db
    .prepare(
      'SELECT id, title, description, "column", position, tags ' +
        'FROM tasks WHERE roadmap_id = ? ORDER BY "column", position ASC, id ASC'
    )
    .all(roadmap.id);

  const tasks = rows.map((r) => {
    let tags = [];
    try {
      const parsed = JSON.parse(r.tags);
      if (Array.isArray(parsed)) tags = parsed;
    } catch (_) {
      tags = [];
    }
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      column: r.column,
      position: r.position,
      tags,
    };
  });

  res.json({
    roadmap: { title: roadmap.title, description: roadmap.description },
    tasks,
  });
});

module.exports = router;
