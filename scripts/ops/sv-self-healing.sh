#!/usr/bin/env bash
#
# The scheduled side of self-healing.
#
# RUN THIS ON THE SERVER. Installed at /usr/local/bin/sv-self-healing.sh and
# invoked by the root crontab, exactly like the nine jobs already there.
#
# Where the credential comes from
# -------------------------------
# The same place rebuild-with-env.sh takes it: the running application's own
# environment. That is the platform's established, already-authorized
# mechanism — the application is started with the credentials it needs, and a
# root-owned job reads them from the live process for one invocation.
#
# This matters because the obvious alternatives are all worse. The .env file
# on disk still names the old hosted backend, so a job reading it would talk
# to a database that does not have these tables. Copying the token into a
# second file would mean two places to rotate and one to forget. Reading the
# PostgREST secret directly would be reaching past the application for
# something the application already holds.
#
# The environment is written to a root-only file, used once, and removed on
# exit including on failure. No value is ever echoed, and the worker itself
# prints only counts and incident titles.
#
# Why a short-lived job rather than a daemon
# ------------------------------------------
# A long-lived healing loop can wedge, leak, or keep acting after somebody has
# decided it should stop. Cron starts this, it works at most a few incidents,
# and it exits — so the longest it can outlive a decision to switch it off is
# one pass.
#
# The kill switch, the per-incident block, the circuit breaker and the
# recovery budget are all enforced in the database, so this script cannot
# bypass them even if it is wrong.

set -uo pipefail

APP="${SV_PM2_NAME:-softwarevala-staging}"
DIR="${SV_APP_DIR:-/var/www/softwarevala}"
WORKER="$DIR/scripts/ops/self-healing-worker.mjs"
LOG=/var/log/sv-self-healing.log
BUDGET="${SV_HEALING_BUDGET:-5}"

say() { printf '%s %s\n' "$(date -Is)" "$*" >> "$LOG"; }

if [[ ! -r "$WORKER" ]]; then
  say "FATAL worker script not found at $WORKER"
  exit 1
fi

PID=$(pm2 pid "$APP" 2>/dev/null | tr -cd '0-9')
if [[ -z "${PID:-}" || ! -d "/proc/$PID" ]]; then
  say "FATAL cannot find the running $APP process to read its environment from"
  exit 1
fi

umask 077
ENVF="/root/.sv-healing-env-$$.sh"
# Removed however this exits, including on error or signal.
trap 'rm -f "$ENVF"' EXIT INT TERM

python3 - "$PID" > "$ENVF" <<'PY'
import sys, shlex

pid = sys.argv[1]
# Only what the worker needs. Taking the whole environment would copy
# credentials for unrelated services into a file for no reason.
wanted = {"SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"}

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
  say "FATAL the running process carries no service credential; not running the worker"
  exit 1
fi

# shellcheck disable=SC1090
. "$ENVF"

# The gateway is the only correct target: these tables live on the VPS
# database behind it. A job pointed at the old hosted backend would find no
# incidents and report a healthy engine, which is the failure worth refusing.
case "${SUPABASE_URL:-}" in
  *127.0.0.1:3010*|*localhost:3010*) ;;
  *)
    say "FATAL the application is not pointed at the VPS gateway; refusing to run against another backend"
    exit 1
    ;;
esac

cd "$DIR" || { say "FATAL cannot enter $DIR"; exit 1; }

# Bounded by timeout as well as by the worker's own budget, so a wedged pass
# cannot hold the next one out. SIGTERM first so the worker's graceful
# shutdown runs; SIGKILL only if it ignores that.
OUTPUT=$(timeout --signal=TERM --kill-after=30s 240s \
  node "$WORKER" --budget "$BUDGET" 2>&1)
STATUS=$?

while IFS= read -r line; do
  [[ -n "$line" ]] && say "$line"
done <<< "$OUTPUT"

if [[ $STATUS -eq 124 ]]; then
  say "WARN the pass exceeded its time limit and was stopped"
elif [[ $STATUS -ne 0 ]]; then
  say "WARN the pass exited with status $STATUS"
fi

exit 0
