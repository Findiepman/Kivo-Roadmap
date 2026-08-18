const db = require('./db');

// Returns the user's role on a roadmap: 'owner', 'editor', 'viewer', or null (no access).
// Admins get 'owner' access on every roadmap (full control over everything).
function getRole(roadmapId, userId) {
  const roadmap = db.prepare('SELECT owner_id FROM roadmaps WHERE id = ?').get(roadmapId);
  if (!roadmap) return null;
  if (roadmap.owner_id === userId) return 'owner';
  if (isAdmin(userId)) return 'owner';

  const access = db
    .prepare('SELECT role FROM roadmap_access WHERE roadmap_id = ? AND user_id = ?')
    .get(roadmapId, userId);

  return access ? access.role : null;
}

// owner or editor may mutate tasks / be considered a writer
function canWrite(role) {
  return role === 'owner' || role === 'editor';
}

// Admin status lives in the database (users.is_admin), managed via the admin
// panel. The ADMIN_USERNAMES env var only seeds it on startup (see db.js).
function isAdmin(userId) {
  const row = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(userId);
  return !!(row && row.is_admin);
}

module.exports = { getRole, canWrite, isAdmin };
