#!/usr/bin/env bash
#
# The scheduled side of the platform.
#
# Two engines exist that only mean anything when nobody is looking: the Task
# Manager SLA sweep and the Promise Tracker deadline sweep. Both were written to
# be run on a schedule and neither was ever scheduled, so a deadline that passed
# overnight was still reported as on track in the morning. Section 15 of the
# Promise Tracker brief asks for exactly this: processing that continues with no
# page open.
#
# Both functions are granted to service_role alone, so the key is read from the
# application's own environment file and never written anywhere else. Nothing is
# echoed that could carry it.
#
# Both sweeps are idempotent by construction, so running this every few minutes
# costs a little and risks nothing; a missed run simply catches up on the next.

set -uo pipefail

LOG=/var/log/sv-sweeps.log

# From the running application, not from the .env file.
#
# This script read the file, and the file drifted. For weeks these sweeps ran
# against the old hosted backend while the application used the VPS, and every
# line in this log said ok — a sweep that processes nothing looks exactly like
# a sweep with nothing to process. sv-app-env.sh reads the one copy that cannot
# drift, and refuses to run against anything but the VPS gateway.
. "$(dirname "$(readlink -f "$0")")/sv-app-env.sh"
sv_app_env "$LOG" || exit 1
URL="$SUPABASE_URL"
KEY="$SUPABASE_SERVICE_ROLE_KEY"

sweep() {
  local fn="$1"
  local body
  local code
  body=$(curl -s -m 120 -w $'\n%{http_code}' \
    -X POST "${URL%/}/rest/v1/rpc/${fn}" \
    -H "apikey: ${KEY}" \
    -H "Authorization: Bearer ${KEY}" \
    -H "Content-Type: application/json" \
    -d '{}')
  code=$(printf '%s' "$body" | tail -1)
  body=$(printf '%s' "$body" | sed '$d')

  if [[ "$code" == "200" ]]; then
    echo "$(date -Is) ${fn} ok ${body}" >> "$LOG"
  else
    # A failing sweep is a real incident: it means deadlines stopped being
    # processed. Record it where the health screen can find it.
    echo "$(date -Is) ${fn} FAILED http=${code} ${body}" >> "$LOG"
    curl -s -m 30 -o /dev/null \
      -X POST "${URL%/}/rest/v1/promise_health_events" \
      -H "apikey: ${KEY}" -H "Authorization: Bearer ${KEY}" \
      -H "Content-Type: application/json" \
      -d "$(printf '{"source":"scheduler","level":"error","event":"sweep_failed","message":"%s returned HTTP %s","context":{"function":"%s"}}' "$fn" "$code" "$fn")"
  fi
}

sweep tm_sla_sweep
sweep pt_sweep
sweep ams_sweep

# The payment domain has its own scheduled work: drain the settlement queue so a
# paid customer gets their licence, sweep for payments that went quiet, and
# measure health against its thresholds. It lives in its own script because it
# calls the application rather than the database, and it keeps its own log.
# Failing here must not stop the sweeps above, hence the guard.
if [[ -x /usr/local/bin/sv-payment-jobs.sh ]]; then
  /usr/local/bin/sv-payment-jobs.sh || echo "$(date -Is) sv-payment-jobs.sh exited non-zero" >> "$LOG"
fi

# Keep the log from growing without bound.
if [[ -f "$LOG" ]] && [[ $(stat -c%s "$LOG") -gt 5242880 ]]; then
  tail -n 2000 "$LOG" > "${LOG}.tmp" && mv "${LOG}.tmp" "$LOG"
fi
