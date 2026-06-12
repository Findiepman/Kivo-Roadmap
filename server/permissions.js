const db = require('./db');

// Returns the user's role on a roadmap: 'owner', 'editor', 'viewer', or null (no access).
function getRole(roadmapId, userId) {
  const roadmap = db.prepare('SELECT owner_id FROM roadmaps WHERE id = ?').get(roadmapId);
  if (!roadmap) return null;
  if (roadmap.owner_id === userId) return 'owner';

  const access = db
    .prepare('SELECT role FROM roadmap_access WHERE roadmap_id = ? AND user_id = ?')
    .get(roadmapId, userId);

  return access ? access.role : null;
}

// owner or editor may mutate tasks / be considered a writer
function canWrite(role) {
  return role === 'owner' || role === 'editor';
}

module.exports = { getRole, canWrite };
