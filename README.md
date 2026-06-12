# Kivo-Roadmap

Simple kanban roadmaps — now with a real backend, user accounts and roles.

Organize your projects and tasks with interactive roadmaps. Track progress, move
tasks between columns, and share roadmaps with other people as editors or viewers.

## Features

- **Accounts** — register / log in with JWT auth (30-day tokens)
- **Roadmaps & tasks** — create, rename, delete; drag & drop tasks across To Do / Doing / Done
- **Sharing & roles** — invite users as **Editor** (can change tasks) or **Viewer** (read-only)
- **Real persistence** — SQLite database (not browser localStorage), so data is shared across devices
- **Self-hosted** — runs in Docker, exposed via Cloudflare Tunnel (no port forwarding)

## Tech stack

- Backend: Node.js + Express
- Database: SQLite via `better-sqlite3` (single file at `data/kivo.db`)
- Auth: JWT (`Authorization: Bearer <token>`), passwords hashed with `bcryptjs`
- Frontend: vanilla HTML / CSS / ES modules (unchanged visual design)
- Deployment: Docker Compose + `cloudflared`

## Project layout

```
server/            Express API
  index.js         entry point (serves API + public/ static files on port 3000)
  db.js            SQLite connection + schema
  permissions.js   role resolution (owner / editor / viewer)
  middleware/auth.js
  routes/          auth.js, roadmaps.js, tasks.js, access.js
public/            frontend (served as static files)
  index.html       login / register
  dashboard.html   roadmap list + sharing
  roadmap.html     kanban board
  scripts/, styles/
data/              SQLite db (gitignored, created at runtime)
Dockerfile, docker-compose.yml, .env.example
```

## Running with Docker (recommended)

1. Copy `.env.example` to `.env` and set a strong `JWT_SECRET` (and, for the
   tunnel, `CLOUDFLARE_TUNNEL_TOKEN`).
2. `docker compose up -d --build`
3. The app listens on `app:3000` inside the Docker network. Cloudflare Tunnel
   routes `roadmap.primalmines.net` → `http://app:3000`.

## Running locally without Docker

Requires Node 18–22 (better-sqlite3 has prebuilt binaries there).

```bash
npm install
JWT_SECRET=dev-secret npm start
# open http://localhost:3000
```

## API summary

All `/api/*` routes except register/login require `Authorization: Bearer <token>`.

| Method | Path | Who |
| --- | --- | --- |
| POST | `/api/auth/register` · `/login` | anyone |
| GET | `/api/auth/me` | authed |
| GET/POST | `/api/roadmaps` | authed (list = owned + shared) |
| GET | `/api/roadmaps/:id` | owner / editor / viewer |
| PUT/DELETE | `/api/roadmaps/:id` | owner only |
| GET | `/api/roadmaps/:id/tasks` | any access |
| POST/PUT/DELETE | `/api/roadmaps/:id/tasks[/:taskId]` | owner / editor |
| PUT | `/api/roadmaps/:id/tasks/reorder` | owner / editor |
| GET/POST | `/api/roadmaps/:id/access` | owner only |
| DELETE | `/api/roadmaps/:id/access/:userId` | owner only |

Role checks are enforced **server-side**, not just in the UI.
