#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE=/var/www/softwarevala/deploy/production/redis/compose.yaml

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required to start the Software Vala Redis cache" >&2
  exit 1
fi
if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Redis compose file not found: $COMPOSE_FILE" >&2
  exit 1
fi

docker compose -f "$COMPOSE_FILE" up -d
docker compose -f "$COMPOSE_FILE" ps
