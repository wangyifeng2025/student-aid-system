#!/bin/sh
set -e

case "$1" in
  server)
    exec /app/server
    ;;
  seed)
    exec /app/seed
    ;;
  *)
    exec "$@"
    ;;
esac
