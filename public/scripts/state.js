// In-memory app state. No longer backed by localStorage — data lives on the
// server and is fetched through the API. kivo_token is the only thing we keep
// in localStorage (handled in api.js).
export const state = {
    roadmaps: [],   // dashboard list: { id, name, desc, role }
    user: null,     // { id, username }
    roadmap: null   // current roadmap on the editor page (with columns + role)
};
