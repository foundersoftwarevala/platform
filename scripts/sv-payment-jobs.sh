#!/usr/bin/env bash
#
# The scheduled side of the payment domain.
#
# Three things have to keep happening when nobody is looking, or a payment that
# went slightly wrong stays wrong for ever:
#
#   1. the settlement queue has to be drained, so a customer whose licence could
#      not be issued at the moment they paid gets it on the next attempt rather
#      than never;
#   2. the consistency sweep has to run, so a dropped provider callback is found
#      and settled, and anything that does not add up becomes an exception a
#      person can see;
#   3. health has to be measured against the thresholds, so a spike in failures
#      raises an alert instead of waiting to be noticed.
#
# This is called from /usr/local/bin/sv-sweeps.sh, which the platform already
# runs every five minutes. There is no new cron entry and no new scheduler: the
# one that exists gained one more line.
#
# Everything here is idempotent. An empty queue is a no-op, a sweep that finds
# nothing writes nothing, and a missed run simply catches up on the next one.

set -uo pipefail

ENV_FILE=/var/www/softwarevala/.env
LOG=/var/log/sv-payment-jobs.log

if [[ ! -r "$ENV_FILE" ]]; then
  echo "$(date -Is) FATAL environment file unreadable" >> "$LOG"
  exit 1
fi

read_env() {
  grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'"' '
}

TOKEN=$(read_env INTERNAL_API_TOKEN)
PORT=$(read_env PORT)
PORT=${PORT:-3003}
BASE="http://127.0.0.1:${PORT}"

if [[ -z "$TOKEN" ]]; then
  echo "$(date -Is) FATAL INTERNAL_API_TOKEN not set; payment jobs cannot authenticate" >> "$LOG"
  exit 1
fi

# One correlation id per scheduled run, so every line this run produced — in
# this log, in payment_logs and in the application's own structured output —
# can be pulled out together afterwards.
RUN_ID="cron_$(date +%s)_$RANDOM"

call() {
  local path="$1"
  local payload="${2:-{\}}"
  local body code

  body=$(curl -s -m 180 -w $'\n%{http_code}' \
    -X POST "${BASE}${path}" \
    -H "x-internal-token: ${TOKEN}" \
    -H "x-correlation-id: ${RUN_ID}" \
    -H "Content-Type: application/json" \
    -d "$payload")
  code=$(printf '%s' "$body" | tail -1)
  body=$(printf '%s' "$body" | sed '$d')

  # 503 from the health endpoint is a measurement, not a failure to call it.
  if [[ "$code" == "200" || "$code" == "503" ]]; then
    echo "$(date -Is) ${RUN_ID} ${path} http=${code} ${body}" >> "$LOG"
  else
    echo "$(date -Is) ${RUN_ID} ${path} FAILED http=${code} ${body}" >> "$LOG"
  fi
}

# ---- every run ------------------------------------------------------------
# Draining the queue is cheap and is what stands between a paid customer and
# their licence, so it never waits.
call /api/internal/payment-jobs '{"limit":25}'

MINUTE=$(date +%-M)

# ---- every half hour ------------------------------------------------------
# The sweep asks providers about pending payments, so it is deliberately not run
# every five minutes.
if (( MINUTE % 30 < 5 )); then
  call /api/internal/payment-reconcile '{}'
fi

# ---- every fifteen minutes ------------------------------------------------
# Measure, and raise an alert for anything breaching. The alerting is
# deduplicated on the server, so this cadence cannot produce a storm.
if (( MINUTE % 15 < 5 )); then
  call /api/internal/payment-health '{}'
fi

# Keep the log from growing without bound.
if [[ -f "$LOG" ]] && [[ $(stat -c%s "$LOG") -gt 5242880 ]]; then
  tail -n 2000 "$LOG" > "${LOG}.tmp" && mv "${LOG}.tmp" "$LOG"
fi
