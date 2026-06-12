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

// Accounts allowed to CREATE new roadmaps, from the ADMIN_USERNAMES env var
// (comma-separated, case-insensitive). If unset/empty, everyone may create
// (original behaviour). Set ADMIN_USERNAMES=81hp_ to lock creation down.
function getAdminUsernames() {
  return (process.env.ADMIN_USERNAMES || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isAdmin(username) {
  const admins = getAdminUsernames();
  if (admins.length === 0) return true; // no restriction configured
  return admins.includes(String(username || '').toLowerCase());
}

module.exports = { getRole, canWrite, isAdmin };
