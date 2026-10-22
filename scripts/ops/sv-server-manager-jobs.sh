#!/usr/bin/env bash
set -uo pipefail

LOG="${SERVER_MANAGER_JOBS_LOG:-/var/log/sv-server-manager-jobs.log}"
SCRIPT_DIR="$(cd -- "$(dirname -- "$(readlink -f -- "$0")")" && pwd)"
. "${SCRIPT_DIR}/sv-app-env.sh"
sv_app_env "$LOG" || exit 1

TOKEN="${INTERNAL_API_TOKEN:-}"
PORT="${PORT:-3000}"
BASE="http://127.0.0.1:${PORT}"
if [[ -z "$TOKEN" ]]; then
  printf '%s FATAL INTERNAL_API_TOKEN is not configured\n' "$(date -Is)" >> "$LOG"
  exit 1
fi

call() {
  local path="$1"
  local code
  code="$(printf 'x-internal-token: %s\n' "$TOKEN" | curl --silent --show-error --max-time 180 \
    -o /dev/null -w '%{http_code}' -X POST "${BASE}${path}" \
    -H @- -H 'Content-Type: application/json' --data '{}')" || code="curl-error"
  printf '%s %s http=%s\n' "$(date -Is)" "$path" "$code" >> "$LOG"
  [[ "$code" == "200" ]]
}

failed=0
call /api/internal/server-manager/alert-deliveries || failed=1
call /api/internal/server-manager/subscriptions || failed=1
call /api/internal/email-flush || failed=1
exit "$failed"
