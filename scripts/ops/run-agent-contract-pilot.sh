#!/usr/bin/env bash
set -euo pipefail

LIVE=/var/www/softwarevala
cd "$LIVE"
/usr/bin/node --env-file="$LIVE/.env" --experimental-strip-types "$LIVE/scripts/run-agents.mjs" 2>&1 | /usr/bin/logger -t sv-agent-contract-pilot
