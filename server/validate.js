// Length caps for everything users can store. Keeps one account from filling
// the disk and keeps pages readable.
const LIMITS = {
  USERNAME_MIN: 3,
  USERNAME_MAX: 32,
  PASSWORD_MIN: 10,
  // bcrypt only looks at the first 72 bytes; longer input is pointless.
  PASSWORD_MAX: 72,
  ROADMAP_TITLE_MAX: 200,
  ROADMAP_DESC_MAX: 2000,
  TASK_TITLE_MAX: 200,
  TASK_DESC_MAX: 10000,
  TAG_MAX: 40,
  TAGS_MAX: 20,
  COMMENT_MAX: 1000,
};

function validUsername(username) {
  if (typeof username !== 'string') return false;
  const n = username.trim().length;
  return n >= LIMITS.USERNAME_MIN && n <= LIMITS.USERNAME_MAX;
}

function validPassword(password) {
  return (
    typeof password === 'string' &&
    password.length >= LIMITS.PASSWORD_MIN &&
    Buffer.byteLength(password, 'utf8') <= LIMITS.PASSWORD_MAX
  );
}

// Returns an error message, or null when the text fits.
function tooLong(value, max, label) {
  if (typeof value === 'string' && value.length > max) {
    return `${label} can be at most ${max} characters`;
  }
  return null;
}

module.exports = { LIMITS, validUsername, validPassword, tooLong };
