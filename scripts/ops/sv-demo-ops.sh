#!/usr/bin/env bash
#
# The scheduled side of Demo Operations: health, then scan, then sync.
#
# RUN THIS ON THE SERVER. Installed at /usr/local/bin/sv-demo-ops.sh and
# invoked by the root crontab, like the jobs already there.
#
# What it replaces
# ----------------
# sv-demo-monitor.sh ran demo_monitor.py in its direct mode: fetch every active
# demo and check them one after another inside the cron window. That is correct
# for one demo and roughly two hours of sequential requests for the 7,279
# marketplace cards still waiting for one — a run would still be going when the
# next started, and a demo broken for a month would be fetched ninety-six times
# a day to be told the same thing.
#
# So each demo becomes its own job on the Founder AI queue: concurrency is
# capped by fa_job_limits rather than by how fast one loop can go, a demo that
# keeps failing backs off, and Demo Manager can see which demo is queued or
# stuck rather than only the result of the last whole run.
#
# Where the credential comes from
# -------------------------------
# The running application's own environment, read from /proc for one
# invocation — the same mechanism rebuild-with-env.sh and sv-self-healing.sh
# use, and for the same reason. The file on disk drifted away from the
# application once already: four scheduled jobs spent weeks writing to a
# database the application had stopped using, and nothing looked wrong. Reading
# the process cannot drift, because there is only one copy.
#
# The environment is written to a root-only file, used once, and removed on
# exit including on failure. No value is ever echoed.
#
# Why passes rather than a loop until empty
# -----------------------------------------
# A bounded number of claims cannot run away. If there is more work than the
# passes cover it waits for the next invocation, which is what a queue is for;
# an unbounded drain would turn a fifteen-minute job into an open-ended one and
# take the ceiling off the concurrency the queue is enforcing.

set -uo pipefail

APP="${SV_PM2_NAME:-softwarevala-staging}"
DIR="${SV_APP_DIR:-/var/www/softwarevala}"
LOG=/var/log/sv-demo-ops.log
PASSES="${SV_DEMO_PASSES:-3}"

say() { printf '%s %s\n' "$(date -Is)" "$*" >> "$LOG"; }

for script in scripts/demo_monitor.py scripts/demo_scan.py scripts/demo_sync.py; do
  if [[ ! -r "$DIR/$script" ]]; then
    say "FATAL $script not found under $DIR"
    exit 1
  fi
done

PID=$(pm2 pid "$APP" 2>/dev/null | tr -cd '0-9')
if [[ -z "${PID:-}" || ! -d "/proc/$PID" ]]; then
  say "FATAL cannot find the running $APP process to read its environment from"
  exit 1
fi

umask 077
ENVF="/root/.sv-demo-ops-env-$$.sh"
trap 'rm -f "$ENVF"' EXIT INT TERM

python3 - "$PID" > "$ENVF" <<'PY'
import sys, shlex

pid = sys.argv[1]
# Only what these workers need. Taking the whole environment would copy
# credentials for unrelated services into a file for no reason.
# INTERNAL_API_TOKEN is here because the scanner does not scan: it asks the
# application to, through the same door the Demo Manager screen uses, and that
# door is guarded.
wanted = {"SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "INTERNAL_API_TOKEN"}

with open("/proc/%s/environ" % pid, "rb") as fh:
    for item in fh.read().split(b"\x00"):
        if not item or b"=" not in item:
            continue
        key, value = item.decode("utf-8", "replace").split("=", 1)
        if key in wanted:
            print("export %s=%s" % (key, shlex.quote(value)))
PY

# Presence, never the value.
if ! grep -q '^export SUPABASE_SERVICE_ROLE_KEY=' "$ENVF"; then
  say "FATAL the running process carries no service credential; not running the workers"
  exit 1
fi

# shellcheck disable=SC1090
. "$ENVF"

# The gateway is the only correct target: fa_jobs and the demo tables live on
# the VPS database behind it. A run pointed at the old hosted backend would find
# no queue function at all and report nothing to do, which is the failure worth
# refusing rather than logging.
case "${SUPABASE_URL:-}" in
  *127.0.0.1:3010*|*localhost:3010*) ;;
  *)
    say "FATAL the application is not pointed at the VPS gateway; refusing to run against another backend"
    exit 1
    ;;
esac

cd "$DIR" || { say "FATAL cannot enter $DIR"; exit 1; }

run() {
  local what="$1"; shift
  local out
  out=$(timeout --signal=TERM --kill-after=30s 240s python3 "$@" 2>&1)
  local code=$?
  if [[ $code -ne 0 ]]; then
    say "$what exited $code — ${out##*$'\n'}"
    return 1
  fi
  say "$what ${out##*$'\n'}"
  return 0
}

# Health first: sync only means anything for a demo whose state is current.
run "health enqueue" scripts/demo_monitor.py --enqueue
for ((i = 1; i <= PASSES; i++)); do
  run "health work $i" scripts/demo_monitor.py --work || break
done

# Scanning is the slow one — a fetch of somebody else's site and then a wait on
# a language model, measured at 20.8 and 33.5 seconds — so it sits between the
# cheap check and the cheap verification rather than holding either up.
run "scan enqueue" scripts/demo_scan.py --enqueue
for ((i = 1; i <= PASSES; i++)); do
  run "scan work $i" scripts/demo_scan.py --work || break
done

run "sync enqueue" scripts/demo_sync.py --enqueue
for ((i = 1; i <= PASSES; i++)); do
  run "sync work $i" scripts/demo_sync.py --work || break
done

# Keep the log from growing without bound.
if [[ -f "$LOG" ]] && [[ $(stat -c%s "$LOG") -gt 5242880 ]]; then
  tail -n 2000 "$LOG" > "${LOG}.tmp" && mv "${LOG}.tmp" "$LOG"
fi
