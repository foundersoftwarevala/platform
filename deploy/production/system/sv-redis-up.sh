#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE=/var/www/softwarevala/deploy/production/redis/compose.yaml
REDIS_ENV_FILE=/etc/softwarevala/redis.env

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required to start the Software Vala Redis cache" >&2
  exit 1
fi
if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Redis compose file not found: $COMPOSE_FILE" >&2
  exit 1
fi
if [ ! -f "$REDIS_ENV_FILE" ] ||
   [ "$(stat -c '%u:%a' "$REDIS_ENV_FILE")" != "0:600" ] ||
   ! grep -Eq '^REDIS_PASSWORD=[0-9a-fA-F]{64}$' "$REDIS_ENV_FILE"; then
  echo "A root-owned mode-0600 $REDIS_ENV_FILE with a 32-byte hex REDIS_PASSWORD is required" >&2
  exit 1
fi

docker compose --env-file "$REDIS_ENV_FILE" -f "$COMPOSE_FILE" up -d
docker compose --env-file "$REDIS_ENV_FILE" -f "$COMPOSE_FILE" ps
