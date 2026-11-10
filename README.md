# Kivo-Roadmap

Simple roadmaps with a real backend, user accounts and an admin panel.

Organize your projects and tasks with roadmaps. Every task is planned, in
progress or finished. Share roadmaps with other accounts by username, assign
tasks to members and publish read-only public links.

## Features

- **Accounts** — created by an admin (no self-service sign-up), JWT auth (30-day tokens)
- **Admin dashboard** — an admin's home page shows every roadmap on the install next to every account; admins create accounts, change any username or password, delete accounts and see (and remove) who is on which roadmap
- **Roadmaps & tasks** — admins create roadmaps; tasks move between planned, in progress and finished
- **List or board** — view a roadmap as a list or as a kanban board (remembered per browser); owners and editors drag tasks between statuses
- **Comments** — everyone on a roadmap, viewers included, can comment on its tasks; you delete your own comments, the owner and admins any
- **Assignees** — on shared roadmaps every member can pick who is working on a task
- **Sharing** — share a roadmap with an account by username, or publish a read-only public link
- **Real persistence** — SQLite database (not browser localStorage), so data is shared across devices
- **Self-hosted** — runs in Docker, exposed via Cloudflare Tunnel (no port forwarding)

## Tech stack

- Backend: Node.js + Express
- Database: SQLite via `better-sqlite3` (single file at `data/kivo.db`)
- Auth: JWT (`Authorization: Bearer <token>`), passwords hashed with `bcryptjs`
- Frontend: vanilla HTML / CSS / ES modules, baby blue and white theme
- Deployment: Docker Compose + `cloudflared`

## Project layout

```
server/            Express API
  index.js         entry point (serves API + public/ static files on port 3000)
  db.js            SQLite connection + schema + migrations + admin seeding
  permissions.js   role resolution (owner / editor / viewer) + admin check
  middleware/auth.js
  routes/          auth.js, admin.js, roadmaps.js, tasks.js, access.js, public.js
public/            frontend (served as static files)
  index.html       login
  dashboard.html   roadmap list + sharing (admins: every roadmap + every account)
  roadmap.html     tasks grouped by status, as a list or a board, with comments
  settings.html    account info
  view.html        public read-only view
  scripts/, styles/
data/              SQLite db (gitignored, created at runtime)
Dockerfile, docker-compose.yml, .env.example
```

## Admin accounts

Admin status lives in the database (`users.is_admin`). On startup the usernames
in `ADMIN_USERNAMES` (default `81hp_`) are granted admin status. If the database
is completely empty, the first admin account is created automatically with
`BOOTSTRAP_ADMIN_PASSWORD` so you can log in.

Admins can create roadmaps, manage every account (including their own) from the
admin dashboard, and have full access to all roadmaps.

## Running with Docker (recommended)

1. Copy `.env.example` to `.env` and set a strong `JWT_SECRET` (and, for the
   tunnel, `CLOUDFLARE_TUNNEL_TOKEN`).
2. `docker compose up -d --build`
3. The app listens on `app:3000` inside the Docker network. Cloudflare Tunnel
   routes the public hostnames (`roadmap.findiepman.dev` and
   `roadmap.primalmines.net`) → `http://app:3000`.

## Running locally without Docker

Requires Node 18–22 (better-sqlite3 has prebuilt binaries there).

```bash
npm install
JWT_SECRET=dev-secret npm start
# open http://localhost:3000
```

## API summary

All `/api/*` routes except login and the public view require
`Authorization: Bearer <token>`.

| Method | Path | Who |
| --- | --- | --- |
| POST | `/api/auth/login` | anyone |
| GET | `/api/auth/me` | authed |
| GET/POST/PUT/DELETE | `/api/admin/users[/:id]` | admin only |
| GET/POST | `/api/roadmaps` | authed (list = owned + shared, admins all; create = admin) |
| GET | `/api/roadmaps/:id` | owner / editor / viewer |
| GET | `/api/roadmaps/:id/members` | any access |
| PUT/DELETE | `/api/roadmaps/:id` | owner only |
| GET | `/api/roadmaps/:id/tasks` | any access |
| POST/PUT/DELETE | `/api/roadmaps/:id/tasks[/:taskId]` | owner / editor |
| GET/POST | `/api/roadmaps/:id/tasks/:taskId/comments` | any access |
| DELETE | `/api/roadmaps/:id/tasks/:taskId/comments/:commentId` | the comment's author, or owner |
| GET/POST | `/api/roadmaps/:id/access` | owner only |
| DELETE | `/api/roadmaps/:id/access/:userId` | owner only |
| GET/POST/DELETE | `/api/roadmaps/:id/share` | owner only |
| GET | `/api/public/:token` | anyone with the link |

Role checks are enforced **server-side**, not just in the UI.
