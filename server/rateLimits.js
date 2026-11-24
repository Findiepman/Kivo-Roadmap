const net = require('net');
const rateLimit = require('express-rate-limit');

// IPv6 users get a whole /64 (often far more), so limiting per single IPv6
// address would let one attacker rotate through billions of keys. IPv6 is
// therefore limited per /64 prefix; IPv4-mapped IPv6 becomes plain IPv4.
function rateKeyForIp(ip) {
  const addr = String(ip || '').trim().split('%')[0];
  if (net.isIPv4(addr)) return addr;
  if (!net.isIPv6(addr)) return 'other';
  const g = ipv6Groups(addr);
  // IPv4-mapped (::ffff:a.b.c.d, in dotted or hex form) is really IPv4.
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) {
    return [g[6] >> 8, g[6] & 255, g[7] >> 8, g[7] & 255].join('.');
  }
  return g.slice(0, 4).map((x) => x.toString(16)).join(':') + '::/64';
}

// A valid IPv6 address (checked by net.isIPv6) as eight 16-bit numbers.
function ipv6Groups(addr) {
  let a = addr.toLowerCase();
  // A dotted IPv4 tail ("::ffff:1.2.3.4") becomes two hex groups.
  const dotted = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(a);
  if (dotted) {
    const [b1, b2, b3, b4] = dotted.slice(1).map(Number);
    a = a.slice(0, dotted.index) + ((b1 << 8) | b2).toString(16) + ':' + ((b3 << 8) | b4).toString(16);
  }
  let parts;
  if (a.includes('::')) {
    const [head, tail] = a.split('::');
    const h = head ? head.split(':') : [];
    const t = tail ? tail.split(':') : [];
    parts = [...h, ...Array(8 - h.length - t.length).fill('0'), ...t];
  } else {
    parts = a.split(':');
  }
  return parts.map((p) => parseInt(p || '0', 16));
}

// SECURITY ASSUMPTION: the app is only reachable through the cloudflared
// container (docker-compose publishes no port), so CF-Connecting-IP is always
// set by Cloudflare and cannot be forged by visitors. If the app is ever
// exposed another way (a ports: entry, another proxy), this header must no
// longer be trusted. It is used instead of trust proxy + X-Forwarded-For,
// because a client can prepend fake X-Forwarded-For entries.
// Without the header (local dev) the socket address is used.
function clientIp(req) {
  const cf = req.headers['cf-connecting-ip'];
  const ip = typeof cf === 'string' && cf.trim() ? cf.trim() : req.socket.remoteAddress;
  return rateKeyForIp(ip);
}

function limiter({ windowMs, limit, keyGenerator, skipSuccessfulRequests = false, requestWasSuccessful, message }) {
  return rateLimit({
    windowMs,
    limit,
    keyGenerator,
    skipSuccessfulRequests,
    ...(requestWasSuccessful ? { requestWasSuccessful } : {}),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // keyGenerator above never uses req.ip, so the library's proxy checks
    // (which warn about req.ip / X-Forwarded-For) do not apply.
    validate: false,
    handler: (req, res) => res.status(429).json({ error: message }),
  });
}

// Wrong passwords per IP, shared by login and "confirm your current password".
// Only a request whose handler set res.locals.passwordFailed counts; busy
// replies, typos in other fields and successes do not.
// Deliberately no per-username limit: that would let anyone lock a known
// account (the admin name is public) out by sending wrong passwords for it.
// Long passwords (validate.js) cover the slow, many-IP guessing that a per-IP
// limit cannot stop.
const loginPerIp = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  requestWasSuccessful: (req, res) => !res.locals.passwordFailed,
  keyGenerator: (req) => 'ip:' + clientIp(req),
  message: 'Too many failed logins. Try again in 15 minutes.',
});

// Public share links need no login, so they get their own tighter cap.
const publicView = limiter({
  windowMs: 60 * 1000,
  limit: 60,
  keyGenerator: (req) => 'ip:' + clientIp(req),
  message: 'Too many requests. Slow down a little.',
});

// Generous overall cap per IP for the whole API.
const api = limiter({
  windowMs: 60 * 1000,
  limit: 600,
  keyGenerator: (req) => 'ip:' + clientIp(req),
  message: 'Too many requests. Slow down a little.',
});

module.exports = { loginPerIp, publicView, api, rateKeyForIp };
