#!/usr/bin/env bash
# Software Vala homepage guard.
#
# The marketplace homepage is a protected production route. On 2026-09-05 the
# site served HTTP 500 on every request for hours: the .output build directory
# had been replaced underneath a long-running Node process, so the process kept
# dynamically importing a manifest file from the previous build that no longer
# existed on disk (ERR_MODULE_NOT_FOUND). PM2 reported the process as "online"
# the whole time, so nothing noticed.
#
# This guard checks what a visitor actually gets — a 200 with real homepage
# markup, not just an open port — and restarts the app when that is not true.
# It never stops the app and never deletes anything.
#
# ---------------------------------------------------------------------------
# 2026-09-23: the guard was making the outage it was written to end.
#
# By this date it had logged 1071 restarts. The failure it kept seeing was
# `http=000 bytes=0` — curl giving up, not a bad page — and each restart made
# the next timeout more likely:
#
#   1. a restart leaves the previous Node process alive, holding 127.0.0.1:3000
#   2. the replacement PM2 starts cannot bind, so it serves nothing and only
#      occupies memory
#   3. 139 such processes accumulated, 4 GB of an 8 GB box
#   4. the box slowed down, curl passed its 25 s deadline, the guard called it
#      unhealthy and restarted again — step 1
#
# And the orphan holding the port was older than the last build swap, so it
# went on serving a manifest whose files had been deleted: eight of the home
# page's own chunks answered 500 for a day and a half while every health check
# said 200, because the *document* was fine.
#
# Four things are corrected below. Nothing the guard used to do was removed.
# ---------------------------------------------------------------------------

set -uo pipefail

APP="softwarevala-staging"
URL="http://127.0.0.1:3000/"
PORT=3000
MIN_BYTES=20000            # a real homepage render is ~800KB; an error page is ~1KB
MARKER="Software Vala"     # must appear in the returned HTML
LOG="/var/log/sv-homepage-guard.log"
STATE="/tmp/sv-homepage-guard.fails"
HISTORY="/tmp/sv-homepage-guard.restarts"   # one epoch second per restart
# A guard that restarts for ever while the cause persists is an outage
# amplifier. Past this many restarts in an hour it stops acting and only
# reports, so a human sees a standing alarm instead of a slowly dying box.
MAX_RESTARTS_PER_HOUR=4
PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/root/.bun/bin"

log() { echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') $*" >> "$LOG"; }

# The pid PM2 believes is the app, and the pid actually holding the port.
managed_pid() { pm2 pid "$APP" 2>/dev/null | tr -cd '0-9'; }
port_pid() {
  ss -ltnp 2>/dev/null | grep ":$PORT " | grep -o 'pid=[0-9]*' | cut -d= -f2 | head -1
}

# Every Node process running this build, and nothing else.
#
# `pgrep -f` is not usable here. The pattern is a path, and any shell, ssh
# command or script whose own command line mentions that path matches it too -
# including the command doing the counting. That is how a box with four app
# processes was measured as having twenty-one. The command line is read
# directly instead and has to *begin* with the node invocation.
app_pids() {
  local p c
  for p in /proc/[0-9]*; do
    c=$(tr '\0' ' ' < "$p/cmdline" 2>/dev/null) || continue
    case "$c" in
      "node /var/www/softwarevala/.output/server/index.mjs"*) basename "$p" ;;
    esac
  done
}

# Fix 2: every Node process running this build that is neither the listener nor
# PM2's child is doing nothing but holding memory. They are what turned one bad
# restart into a dying box. Only processes older than ten minutes are touched,
# so a restart in progress is never interrupted.
reap_orphans() {
  local keep_listener keep_managed reaped=0 p age
  keep_listener="$(port_pid)"
  keep_managed="$(managed_pid)"
  for p in $(app_pids); do
    [ "$p" = "$keep_listener" ] && continue
    [ "$p" = "$keep_managed" ] && continue
    age=$(ps -o etimes= -p "$p" 2>/dev/null | tr -d ' ')
    [ -z "$age" ] && continue
    [ "$age" -lt 600 ] && continue
    kill "$p" 2>/dev/null && reaped=$((reaped + 1))
  done
  [ "$reaped" -gt 0 ] && log "reaped $reaped orphaned app process(es)"
  return 0
}

# Fix 3: a restart is only a restart if the process PM2 manages ends up owning
# the port. If an unmanaged process still holds it, that process is the problem
# and it is stopped before trying again.
restart_app() {
  local holder managed
  pm2 restart "$APP" >> "$LOG" 2>&1      # Fix 1: no --update-env, see below
  sleep 6
  holder="$(port_pid)"; managed="$(managed_pid)"
  if [ -n "$holder" ] && [ "$holder" != "$managed" ]; then
    log "port $PORT is held by $holder, which PM2 does not manage — stopping it"
    kill "$holder" 2>/dev/null
    for _ in $(seq 1 12); do ss -ltn 2>/dev/null | grep -q ":$PORT " || break; sleep 1; done
    ss -ltn 2>/dev/null | grep -q ":$PORT " && kill -9 "$holder" 2>/dev/null
    pm2 restart "$APP" >> "$LOG" 2>&1
    sleep 6
  fi
  # Fix 1: `--update-env` used to be passed here. PM2 holds this application's
  # environment — the Supabase URL and its keys among it — and --update-env
  # replaces that with the environment of whatever started the restart. This
  # runs from cron, whose environment has none of it. The stored environment is
  # the one that works, so it is left alone.
  reap_orphans
}

# How many restarts in the last hour, from the recorded history.
recent_restarts() {
  local now cutoff
  now=$(date +%s); cutoff=$((now - 3600))
  [ -f "$HISTORY" ] || { echo 0; return; }
  awk -v c="$cutoff" '$1 > c' "$HISTORY" 2>/dev/null | wc -l | tr -d ' '
}

record_restart() {
  local now cutoff
  now=$(date +%s); cutoff=$((now - 3600))
  { [ -f "$HISTORY" ] && awk -v c="$cutoff" '$1 > c' "$HISTORY"; echo "$now"; } > "$HISTORY.new" 2>/dev/null
  mv -f "$HISTORY.new" "$HISTORY" 2>/dev/null
}

# --------------------------------------------------------------- the check --

body=$(curl -s -m 25 -w '\n%{http_code}\n%{size_download}' "$URL" 2>/dev/null)
code=$(printf '%s' "$body" | tail -n 2 | head -n 1)
size=$(printf '%s' "$body" | tail -n 1)
html=$(printf '%s' "$body" | head -n -2)

healthy=1
[ "$code" = "200" ] || healthy=0
[ "${size:-0}" -ge "$MIN_BYTES" ] 2>/dev/null || healthy=0
# A pipeline is wrong here. `grep -q` exits the moment it matches, `printf`
# is still writing a megabyte, and `set -o pipefail` at the top of this script
# then reports the pipeline as status 141 (SIGPIPE) even though grep succeeded.
# The result was a healthy homepage being declared UNHEALTHY and production
# being restarted every two minutes. A herestring has no second process to
# signal, so grep's own status is what is read. The sibling guards
# (sv-public-guard, sv-deploy) already grep a file for exactly this reason.
grep -q "$MARKER" <<< "$html" || healthy=0

if [ "$healthy" = "1" ]; then
  [ -f "$STATE" ] && { log "recovered (http=$code bytes=$size)"; rm -f "$STATE"; }
  # Even while healthy: if something unmanaged owns the port, or orphans have
  # built up, say so and clear them. Both were true here for a day and a half
  # with every check passing.
  holder="$(port_pid)"; managed="$(managed_pid)"
  if [ -n "$holder" ] && [ -n "$managed" ] && [ "$holder" != "$managed" ]; then
    log "WARNING healthy, but port $PORT is held by $holder and PM2 manages $managed"
  fi
  reap_orphans
  exit 0
fi

fails=$(( $(cat "$STATE" 2>/dev/null || echo 0) + 1 ))
echo "$fails" > "$STATE"
log "UNHEALTHY #$fails http=$code bytes=$size"

# Fix 4: `000` is curl giving up, not a broken page. Under load — which a
# restart loop causes — it says nothing about whether the homepage renders, so
# it needs more evidence before it is acted on than a real 500 does.
need=2
[ "$code" = "000" ] && need=3
if [ "$fails" -lt "$need" ]; then exit 0; fi

done_recently=$(recent_restarts)
if [ "$done_recently" -ge "$MAX_RESTARTS_PER_HOUR" ]; then
  log "NOT restarting: already restarted $done_recently times in the last hour. \
Something is wrong that a restart does not fix — look at the app log, the port \
holder and the number of app processes (sv.sh doctor)."
  exit 0
fi

log "restarting $APP (restart $((done_recently + 1)) of $MAX_RESTARTS_PER_HOUR allowed this hour)"
record_restart
restart_app
after=$(curl -s -o /dev/null -m 25 -w '%{http_code}' "$URL")
log "after restart http=$after port_holder=$(port_pid) pm2_pid=$(managed_pid) app_processes=$(app_pids | wc -l)"
[ "$after" = "200" ] && rm -f "$STATE"
exit 0
