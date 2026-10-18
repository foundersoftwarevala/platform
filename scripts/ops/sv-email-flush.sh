#!/usr/bin/env bash
# Software Vala — drain the outbound mail queue.
#
# Messages are queued durably in email_outbox whether or not a provider is
# configured, so nothing is lost while credentials are missing. Nothing was
# draining that queue: there was an endpoint but no schedule, so even once a
# provider is configured the backlog would have sat there until somebody
# remembered to POST to it by hand.
#
# When no provider is configured this exits quietly after saying so. It never
# reports a delivery that did not happen.

set -uo pipefail

LOG=/var/log/sv-email-flush.log
URL="http://127.0.0.1:3000/api/internal/email-flush"
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

log() { echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') $*" >> "$LOG"; }

# The token comes from the running application rather than the .env file, for
# the reason set out in sv-app-env.sh: the file drifted once and the jobs that
# read it went on reporting success against the wrong backend for weeks. A
# stale token here would mean the endpoint refusing every call and queued mail
# sitting unsent.
. "$(dirname "$(readlink -f "$0")")/sv-app-env.sh"
sv_app_env "$LOG" || exit 1

TOKEN="${INTERNAL_API_TOKEN:-}"
if [[ -z "$TOKEN" ]]; then
  log "FATAL INTERNAL_API_TOKEN is not set; the endpoint would refuse the call"
  exit 1
fi

# Ask first. If nothing is waiting there is no reason to make the server work.
status=$(curl -s -m 30 -H "x-internal-token: $TOKEN" "$URL")
pending=$(printf '%s' "$status" | grep -o '"pending":[0-9]*' | cut -d: -f2)
provider=$(printf '%s' "$status" | grep -o '"provider":"[^"]*"' | cut -d'"' -f4)

if [[ "${pending:-0}" -eq 0 ]]; then
  exit 0
fi

if [[ "$provider" == "none configured" ]]; then
  log "$pending message(s) waiting, no provider configured — leaving them queued"
  exit 0
fi

result=$(curl -s -m 120 -X POST -H "x-internal-token: $TOKEN" \
  -H 'Content-Type: application/json' -d '{}' "$URL")
log "flush: $result"
