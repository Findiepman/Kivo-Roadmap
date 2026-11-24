const bcrypt = require('bcryptjs');

// Every bcrypt compare (login, confirming your current password) goes through
// here. At most MAX_CONCURRENT run at once: each costs ~250 ms of CPU, and
// without a cap a flood of checks from many addresses would starve every
// other request. Beyond it the check is refused briefly instead of queued.
// Known trade-off: a large enough flood keeps these slots full, so new logins
// get "busy" until it stops; existing sessions keep working.
const MAX_CONCURRENT = 4;
let inFlight = 0;

// Resolves to true / false, or to null when the server is too busy right now.
async function checkPassword(plain, hash) {
  if (inFlight >= MAX_CONCURRENT) return null;
  inFlight++;
  try {
    return await bcrypt.compare(plain, hash);
  } finally {
    inFlight--;
  }
}

function sendBusy(res) {
  return res.status(429).json({ error: 'The server is busy. Try again in a moment.' });
}

// A wrong password: counts toward the per-IP budget in rateLimits.loginPerIp.
function markPasswordFailed(res) {
  res.locals.passwordFailed = true;
}

module.exports = { checkPassword, sendBusy, markPasswordFailed };
