#!/bin/bash
# Deploys the language system to the live application process.
#
# Keeps every environment variable the running process already has, adds the
# translation engine settings, backs up the current build, and rolls back if
# the restarted process does not answer.
set -uo pipefail

APP=/var/www/softwarevala
NAME=softwarevala-staging      # the PM2 process that serves https://softwarevala.net
STAMP=$(date +%Y%m%d-%H%M%S)
PATCH=/tmp/app-lang.tgz

log() { echo "[$(date +%H:%M:%S)] $*"; }

# 1. Take the existing environment from the running process, so nothing is lost.
PID=$(pm2 jlist | python3 -c 'import sys,json; print(next(p["pid"] for p in json.load(sys.stdin) if p["name"]=="'"$NAME"'"))')
log "live pid $PID"
ENVFILE=/root/prod-env-$STAMP.sh
# The file holds every production secret: readable by root only, and removed
# when the deploy is done with it (see the end of this script).
umask 077
trap 'rm -f "$ENVFILE"' EXIT
python3 - "$PID" > "$ENVFILE" <<'PY'
import sys, shlex
pid = sys.argv[1]
with open(f"/proc/{pid}/environ", "rb") as fh:
    raw = fh.read().split(b"\0")
skip = {"PWD", "OLDPWD", "SHLVL", "_", "PM2_USAGE", "NODE_APP_INSTANCE", "SSH_CLIENT", "SSH_CONNECTION",
        "XDG_SESSION_ID", "XDG_RUNTIME_DIR", "XDG_SESSION_CLASS", "XDG_SESSION_TYPE", "DBUS_SESSION_BUS_ADDRESS",
        "pm_id", "unique_id", "name", "NODE_ENV_ORIGINAL",
        # PM2's IPC channel to its child. Exported into this shell, every node
        # process started from here treats fd 3 as a parent channel and aborts.
        "NODE_CHANNEL_FD", "NODE_CHANNEL_SERIALIZATION_MODE"}
for item in raw:
    if not item or b"=" not in item:
        continue
    key, value = item.decode("utf-8", "replace").split("=", 1)
    if key in skip or not key.replace("_", "").isalnum():
        continue
    print(f"export {key}={shlex.quote(value)}")
PY
log "captured $(grep -c '^export' "$ENVFILE") environment variables"

# 2. The translation engine settings.
cat >> "$ENVFILE" <<EOF
export TRANSLATE_PROVIDER_URL='http://127.0.0.1:5100/v1/translate'
export TRANSLATE_PROVIDER_TOKEN='$(. /etc/sv-translate.env; echo "$SVT_TOKEN")'
export TRANSLATION_ALLOW_EXTERNAL='false'
export TRANSLATION_PROVIDER_ORDER='owned-engine,ai-api-manager'
export I18N_JOB_WORKER='on'
EOF

# 3. Back up the build that is serving now.
log "backing up the current build"
rm -rf "$APP/.output.prev"
cp -a "$APP/.output" "$APP/.output.prev"

# 4. Apply the language changes and build.
cd "$APP" || exit 1
git rev-parse --short HEAD > /root/prod-commit-$STAMP.txt
tar -xzf "$PATCH" -C "$APP" || { log "could not unpack the patch"; exit 1; }
# shellcheck disable=SC1090
. "$ENVFILE"
# The build needs about 3 GB next to the engine (3 GB), LibreTranslate and the
# site on a host with 7.9 GB and no swap. Twice the kernel's OOM killer took
# the translation engine during a build (19:33 and 22:15 on 2026-09-18), and
# once the build itself, which left .output half deleted. So: LibreTranslate
# (the fallback backend only) is restarted to give its memory back when too
# little is free, the build is the process the kernel kills first, and a
# failed build puts the running build's files back.
avail=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
log "memory available before the build: ${avail} MB"
if [ "$avail" -lt 4200 ] && docker ps --format '{{.Names}}' | grep -qx libretranslate; then
  log "restarting libretranslate to free memory for the build (fallback backend; the engine keeps serving)"
  docker restart libretranslate > /dev/null
  sleep 5
  log "memory available now: $(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo) MB"
fi
log "building"
if ! nice -n 10 bash -c 'echo 1000 > /proc/self/oom_score_adj; exec env NODE_OPTIONS=--max-old-space-size=3072 npm run build' > /root/prod-build-$STAMP.log 2>&1; then
  log "BUILD FAILED - nothing was restarted; restoring the running build's files; see /root/prod-build-$STAMP.log"
  tail -20 /root/prod-build-$STAMP.log
  rm -rf "$APP/.output"
  cp -a "$APP/.output.prev" "$APP/.output"
  [ -f "$APP/.output/server/index.mjs" ] && log "files restored" || log "RESTORE FAILED - .output.prev is the last good build"
  exit 1
fi
log "build ok"

# Restart without overlap. `pm2 restart` starts the new process before the
# old one has finished its graceful shutdown; when the old one then exits
# (SIGINT), pm2 takes that for the new process crashing and starts a second
# copy, which leaves two servers and two job workers running and the port
# held by whichever bound first. So: stop, wait until nothing is left, start.
restart_clean() {
  pm2 stop "$NAME" > /dev/null 2>&1
  for _ in $(seq 1 15); do
    pgrep -f "$APP/.output/server/[i]ndex.mjs" > /dev/null || break
    sleep 1
  done
  pkill -9 -f "$APP/.output/server/[i]ndex.mjs" 2>/dev/null
  pm2 restart "$NAME" --update-env > /dev/null
}

# 5. Restart with the full environment.
restart_clean
sleep 10

# 6. Health checks; roll back if the site does not answer.
ok=1
for i in 1 2 3 4 5 6; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 45 http://127.0.0.1:3000/)
  [ "$code" = "200" ] && { log "local http $code"; break; }
  log "local http $code (attempt $i)"
  ok=0
  sleep 5
  [ "$i" = "6" ] || ok=1
done
public=$(curl -s -o /dev/null -w '%{http_code}' -m 45 https://softwarevala.net/)
log "public https $public"
[ "$public" = "200" ] || ok=0

if [ "$ok" != "1" ]; then
  log "HEALTH CHECK FAILED - rolling back"
  rm -rf "$APP/.output"
  mv "$APP/.output.prev" "$APP/.output"
  restart_clean
  sleep 8
  curl -s -o /dev/null -w 'after rollback: %{http_code}\n' -m 45 http://127.0.0.1:3000/
  exit 1
fi

log "nginx"
nginx -t && systemctl reload nginx && log "nginx reloaded"
log "deployed; previous build kept at $APP/.output.prev"

# 7. One process, and it must be the one the process manager knows about.
#
# `pm2 restart` on this app has been seen to leave the previous process alive
# and still holding port 3000 while pm2 tracks a newer one: the site then keeps
# serving the old build, and both processes work the translation job queue. So
# the state is checked, and repaired once, rather than assumed.
port_owner() { ss -ltnpH "sport = :3000" 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 | head -1; }
tracked_pid() {
  pm2 jlist | python3 -c 'import sys,json;print(next((p["pid"] for p in json.load(sys.stdin) if p["name"]=="'"$NAME"'"), ""))'
}
count_procs() { pgrep -cf "$APP/.output/server/[i]ndex.mjs" || true; }

owner=$(port_owner); tracked=$(tracked_pid); procs=$(count_procs)
log "port 3000 owner $owner, pm2 pid $tracked, processes $procs"
if [ "$owner" != "$tracked" ] || [ "$procs" != "1" ]; then
  log "repairing: stopping every instance and starting one"
  pm2 stop "$NAME" > /dev/null 2>&1
  sleep 3
  pkill -f "$APP/.output/server/[i]ndex.mjs" 2>/dev/null
  sleep 4
  pkill -9 -f "$APP/.output/server/[i]ndex.mjs" 2>/dev/null
  sleep 2
  pm2 restart "$NAME" --update-env > /dev/null
  sleep 12
  owner=$(port_owner); tracked=$(tracked_pid); procs=$(count_procs)
  log "after repair: port owner $owner, pm2 pid $tracked, processes $procs"
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 45 http://127.0.0.1:3000/)
  log "local http $code"
  if [ "$owner" != "$tracked" ] || [ "$procs" != "1" ] || [ "$code" != "200" ]; then
    log "PROCESS STATE STILL WRONG - check pm2 and ss by hand"
    exit 1
  fi
fi
pm2 save > /dev/null 2>&1
log "one process, tracked by pm2, serving port 3000"
