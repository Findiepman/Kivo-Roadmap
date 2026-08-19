// Where the frontend finds the backend API.
//
// The app is served two ways:
//  1. By the Node server itself (localhost, Docker, Cloudflare Tunnel) —
//     the API lives on the same origin, so '/api' works.
//  2. By GitHub Pages (roadmap.findiepman.dev) — Pages is static-only and
//     has no backend, so API calls must go to the tunnel URL below.
//
// BACKEND_ORIGIN must be the public hostname of your Cloudflare Tunnel
// (the one from docker-compose). Create it in the Cloudflare Zero Trust
// dashboard as a "Public hostname" on the tunnel, e.g. api.findiepman.dev
// pointing at http://app:3000.
const BACKEND_ORIGIN = "https://api.findiepman.dev";

// Hostnames that serve only static files (no backend on the same origin).
const STATIC_HOSTS = ["roadmap.findiepman.dev", "findiepman.github.io"];

export const API_BASE = STATIC_HOSTS.includes(window.location.hostname)
    ? `${BACKEND_ORIGIN}/api`
    : "/api";
