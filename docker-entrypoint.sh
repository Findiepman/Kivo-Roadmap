#!/bin/sh
set -e

# The ./data bind mount was created by root on older deploys. Hand it to the
# unprivileged "node" user and make it private (it holds password hashes),
# then run the app as "node", never as root.
if [ "$(id -u)" = "0" ]; then
  chown -R node:node /app/data
  chmod 700 /app/data
  find /app/data -type f -exec chmod 600 {} +
  umask 077
  exec su-exec node "$@"
fi

umask 077
exec "$@"
