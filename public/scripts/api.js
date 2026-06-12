const BASE = '/api'

function getToken() {
  return localStorage.getItem('kivo_token')
}

function headers() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  }
}

async function request(method, path, body, opts = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined
  })
  // For authenticated requests, a 401 means the token is gone/expired:
  // clear it and bounce to the login page. Skipped for login/register so
  // their error messages can surface instead.
  if (res.status === 401 && !opts.skipAuthRedirect) {
    localStorage.removeItem('kivo_token')
    window.location.href = '/index.html'
    return
  }
  if (!res.ok) throw await res.json().catch(() => ({ error: 'Request failed' }))
  // Some endpoints (rare) may return no body.
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

export const api = {
  login: (username, password) =>
    request('POST', '/auth/login', { username, password }, { skipAuthRedirect: true }),
  register: (username, password) =>
    request('POST', '/auth/register', { username, password }, { skipAuthRedirect: true }),
  me: () => request('GET', '/auth/me'),
  getRoadmaps: () => request('GET', '/roadmaps'),
  createRoadmap: (data) => request('POST', '/roadmaps', data),
  updateRoadmap: (id, data) => request('PUT', `/roadmaps/${id}`, data),
  deleteRoadmap: (id) => request('DELETE', `/roadmaps/${id}`),
  getRoadmap: (id) => request('GET', `/roadmaps/${id}`),
  getTasks: (roadmapId) => request('GET', `/roadmaps/${roadmapId}/tasks`),
  createTask: (roadmapId, data) => request('POST', `/roadmaps/${roadmapId}/tasks`, data),
  updateTask: (roadmapId, taskId, data) => request('PUT', `/roadmaps/${roadmapId}/tasks/${taskId}`, data),
  deleteTask: (roadmapId, taskId) => request('DELETE', `/roadmaps/${roadmapId}/tasks/${taskId}`),
  reorderTasks: (roadmapId, tasks) => request('PUT', `/roadmaps/${roadmapId}/tasks/reorder`, { tasks }),
  getAccess: (roadmapId) => request('GET', `/roadmaps/${roadmapId}/access`),
  addAccess: (roadmapId, username, role) => request('POST', `/roadmaps/${roadmapId}/access`, { username, role }),
  removeAccess: (roadmapId, userId) => request('DELETE', `/roadmaps/${roadmapId}/access/${userId}`),
}
