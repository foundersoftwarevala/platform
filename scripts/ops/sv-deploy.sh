#!/usr/bin/env bash
# Verified deployment for the Software Vala marketplace.
#
# Why this exists: on 2026-09-05 a build replaced /var/www/softwarevala/.output
# underneath the running Node process without restarting it. The process kept
# importing a manifest from the previous build that was no longer on disk, so
# every request — including the homepage — returned HTTP 500 for hours while
# PM2 still reported the process as "online".
#
# This script never builds into the live directory, never deletes the previous
# build, proves the new build serves a real homepage on a spare port BEFORE it
# goes live, and always restarts the app after swapping. If any check fails the
# previous build is put straight back.

set -uo pipefail

APP="softwarevala-staging"
LIVE="/var/www/softwarevala"
BUILD="/var/www/sv-build"
TEST_PORT=3011
MIN_BYTES=20000
MARKER="Software Vala"
STAMP="$(date +%Y%m%d-%H%M%S)"
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

step() { echo; echo "=== $* ==="; }
fail() { echo "DEPLOY ABORTED: $*"; exit 1; }

step "1/6 Staging a build tree (the live directory is not touched)"
mkdir -p "$BUILD"
# --exclude '.output' matches that exact name and nothing else, so every
# retained rollback build (.output.prev-*) and every failed build was being
# copied into the staging tree on each deploy. That single omission grew the
# two trees to 74GB and took the disk to 97% full. Build output of any shape
# is excluded now; the staging tree only ever needs source.
rsync -a --delete \
  --exclude '.git' --exclude 'node_modules' \
  --exclude '.output' --exclude '.output.*' --exclude '.output-*' \
  --exclude '.tanstack' --exclude '.vite' \
  "$LIVE/" "$BUILD/" || fail "could not stage the source"
ln -sfn "$LIVE/node_modules" "$BUILD/node_modules"
rm -rf "$BUILD/.output"

step "2/6 Building"
cd "$BUILD" || fail "no build dir"
if ! npm run build; then fail "the build failed — nothing was deployed, the live site is untouched"; fi
[ -f "$BUILD/.output/server/index.mjs" ] || fail "the build produced no server entry"

step "3/6 Checking the build is internally consistent"
# Every module the SSR bundle imports by hashed filename must exist. This is the
# exact class of breakage that took the site down.
missing=0
cd "$BUILD/.output/server"
for ref in $(grep -rhoE '_tanstack-start-manifest_v-[A-Za-z0-9_-]+\.mjs' . | sort -u); do
  [ -f "./$ref" ] || { echo "  missing: $ref"; missing=1; }
done
[ "$missing" = "0" ] || fail "the build references files it did not produce"
echo "  manifest references all resolve"

step "4/6 Proving the new build serves a real homepage on port $TEST_PORT"
cd "$BUILD"
PORT=$TEST_PORT node "$BUILD/.output/server/index.mjs" > /tmp/sv-deploy-smoke.log 2>&1 &
SMOKE_PID=$!
ok=0
for i in $(seq 1 30); do
  sleep 2
  code=$(curl -s -o /tmp/sv-smoke.html -w '%{http_code}' -m 20 "http://127.0.0.1:$TEST_PORT/" 2>/dev/null)
  [ "$code" = "200" ] && { ok=1; break; }
done
size=$(wc -c < /tmp/sv-smoke.html 2>/dev/null || echo 0)
kill "$SMOKE_PID" 2>/dev/null; wait "$SMOKE_PID" 2>/dev/null
[ "$ok" = "1" ] || { tail -20 /tmp/sv-deploy-smoke.log; fail "the new build did not answer with 200 on / — NOT deployed"; }
[ "$size" -ge "$MIN_BYTES" ] || fail "the new homepage rendered only $size bytes — NOT deployed"
grep -q "$MARKER" /tmp/sv-smoke.html || fail "the new homepage did not contain '$MARKER' — NOT deployed"
echo "  homepage OK: http=200 bytes=$size marker present"

step "5/6 Swapping the build in and restarting"
cp -a "$BUILD/.output" "$LIVE/.output.new-$STAMP" || fail "could not copy the new build"
mv "$LIVE/.output" "$LIVE/.output.prev-$STAMP"       || fail "could not set the old build aside"
mv "$LIVE/.output.new-$STAMP" "$LIVE/.output"        || fail "could not move the new build in"
# The restart is mandatory: a running process keeps the previous build's module
# graph and will fail on files that no longer exist.
pm2 restart "$APP" --update-env >/dev/null 2>&1
sleep 8

# ---------------------------------------------------------------------------
# The deploy that did not deploy.
#
# On 2026-09-29 five copies of the app were found running at once, started by
# five separate deploys. The oldest held port 3000, so every later build was
# built, swapped in, restarted and verified - and never served a single
# request. Each deploy reported LIVE OK, because the homepage it fetched was
# being answered by a process seventeen days old.
#
# pm2 says "online" about a process that failed to take the port, so the only
# honest check is to ask the port who is holding it. Anything running this
# entry point that is not the process pm2 just started is a leftover and is
# stopped; then the holder of the port must be pm2's own process, or this is
# not a deployment and is rolled back.
# ---------------------------------------------------------------------------
PM2_PID="$(pm2 pid "$APP" 2>/dev/null | tr -d '[:space:]')"
for stray in $(pgrep -f "node $LIVE/.output/server/index.mjs" 2>/dev/null); do
  [ "$stray" = "$PM2_PID" ] && continue
  echo "  stopping a leftover app process: $stray"
  kill "$stray" 2>/dev/null
done
sleep 3
for stray in $(pgrep -f "node $LIVE/.output/server/index.mjs" 2>/dev/null); do
  [ "$stray" = "$PM2_PID" ] && continue
  kill -9 "$stray" 2>/dev/null
done

# If the leftovers were holding the port, pm2's process never bound it.
if [ -z "$PM2_PID" ] || ! ss -ltnp 2>/dev/null | grep -q ":3000 .*pid=$PM2_PID,"; then
  echo "  the port was not held by pm2's process; restarting it alone"
  pm2 restart "$APP" --update-env >/dev/null 2>&1
  sleep 10
  PM2_PID="$(pm2 pid "$APP" 2>/dev/null | tr -d '[:space:]')"
fi
holder="$(ss -ltnp 2>/dev/null | grep ':3000 ' | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)"
echo "  port 3000 is held by $holder, pm2 runs $PM2_PID, copies running: $(pgrep -fc "node $LIVE/.output/server/index.mjs" 2>/dev/null)"

step "6/6 Verifying the live site"
code=$(curl -s -o /tmp/sv-live.html -w '%{http_code}' -m 25 "http://127.0.0.1:3000/")
size=$(wc -c < /tmp/sv-live.html)
# A homepage answered by yesterday's process is not this build being live.
if [ -n "$holder" ] && [ -n "$PM2_PID" ] && [ "$holder" != "$PM2_PID" ]; then
  echo "  port 3000 is held by $holder, which is not the process pm2 started ($PM2_PID)"
  code="stale"
fi
if [ "$code" = "200" ] && [ "$size" -ge "$MIN_BYTES" ] && grep -q "$MARKER" /tmp/sv-live.html; then
  echo "  LIVE OK: http=$code bytes=$size"
  echo "  previous build kept at $LIVE/.output.prev-$STAMP"
# Rollback builds are kept, but not for ever: 92 of them had accumulated, at
# 543MB each. Three is more than any rollback here has ever reached back for,
# and the newest is the one a rollback actually uses.
  KEEP_ROLLBACKS=3
  ls -dt "$LIVE"/.output.prev-* 2>/dev/null | tail -n +$((KEEP_ROLLBACKS + 1)) | while read -r old; do
    rm -rf -- "$old" && echo "  retired old rollback build $(basename "$old")"
  done
  echo "  rollback builds retained: $(ls -d "$LIVE"/.output.prev-* 2>/dev/null | wc -l)"
  echo "  disk now: $(df -h / | tail -1 | awk '{print $4" free ("$5" used)"}')"
  exit 0
fi

echo "  LIVE CHECK FAILED (http=$code bytes=$size) — rolling back"
mv "$LIVE/.output" "$LIVE/.output.failed-$STAMP"
mv "$LIVE/.output.prev-$STAMP" "$LIVE/.output"
pm2 restart "$APP" --update-env >/dev/null 2>&1
sleep 8
back=$(curl -s -o /dev/null -m 25 -w '%{http_code}' "http://127.0.0.1:3000/")
echo "  rolled back to the previous build (http=$back)"
fail "the new build did not serve the homepage; the previous build is live again"
