#!/usr/bin/env bash
# Rebuild on the server using the environment the application is actually
# running with.
#
# RUN THIS ON THE SERVER.
#
# Why the environment matters to a *build*
# ----------------------------------------
# Vite replaces every `import.meta.env.VITE_*` with a literal at build time.
# A build produced without those variables ships a browser bundle with empty
# values, and the Supabase browser client throws the moment it is constructed:
#
#   [Supabase] Missing Supabase environment variable(s):
#     SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY
#
# The throw happens inside the homepage's section boundaries, which catch it and
# render their fallbacks - so the page hydrates, and the catalogue that the
# server had rendered disappears. Ten rails with JavaScript off, none with it
# on. Nothing fails at the network level, so no health check sees it.
#
# The application's own environment is the authoritative copy. It is read from
# the running process, used for one build, and deleted. No value is printed.
set -uo pipefail

APP="${SV_PM2_NAME:-softwarevala-staging}"
DIR="${SV_APP_DIR:-/var/www/softwarevala}"
MARKER_HOST="${SV_SUPABASE_HOST:-supabase.co}"

say() { printf '\n==> %s\n' "$*"; }
die() { printf '\nSTOPPED: %s\n' "$*" >&2; exit 1; }

cd "$DIR" || die "no $DIR"
PID=$(pm2 pid "$APP" 2>/dev/null | tr -cd '0-9')
[ -n "$PID" ] && [ -d "/proc/$PID" ] || die "cannot find the running $APP process to read its environment from"

say "reading the running application's environment (pid $PID)"
umask 077
ENVF="/root/build-env-$(date +%s).sh"
trap 'rm -f "$ENVF"' EXIT
python3 - "$PID" > "$ENVF" <<'PY'
import sys, shlex
pid = sys.argv[1]
skip = {
    "PWD", "OLDPWD", "SHLVL", "_", "PM2_USAGE", "NODE_APP_INSTANCE",
    "NODE_CHANNEL_FD", "NODE_CHANNEL_SERIALIZATION_MODE",
    "pm_id", "unique_id", "name", "NODE_ENV_ORIGINAL",
}
with open("/proc/%s/environ" % pid, "rb") as fh:
    for item in fh.read().split(b"\x00"):
        if not item or b"=" not in item:
            continue
        key, value = item.decode("utf-8", "replace").split("=", 1)
        if key in skip or not key.replace("_", "").isalnum():
            continue
        print("export %s=%s" % (key, shlex.quote(value)))
PY
echo "    $(grep -c '^export' "$ENVF") variables, $(grep -c '^export VITE_' "$ENVF") of them VITE_*"
grep -q '^export VITE_SUPABASE_PUBLISHABLE_KEY=' "$ENVF" \
  || die "the running process has no VITE_SUPABASE_PUBLISHABLE_KEY - building would produce the same broken bundle"

say "keeping the build that is serving now"
rm -rf .output.prev
cp -a .output .output.prev || die "could not keep a copy of the current build"
echo "    kept at $DIR/.output.prev"

say "building"
# shellcheck disable=SC1090
. "$ENVF"
export NITRO_PRESET=node-server
rm -rf node_modules/.vite
if ! npx vite build > /tmp/sv-build.log 2>&1; then
  tail -20 /tmp/sv-build.log
  die "the build failed. Nothing was swapped; the previous build is still serving."
fi
tail -3 /tmp/sv-build.log

say "checking the browser bundle is configured this time"
grep -rlq "$MARKER_HOST" .output/public/assets/ 2>/dev/null \
  || die "the new browser bundle still carries no Supabase host. Not restarting."
echo "    yes - the Supabase host is compiled into the client bundle"

BUILT=$(ls -1 .output/public/assets 2>/dev/null | wc -l)
echo "    $BUILT assets, $(find .output/public/assets -maxdepth 1 -type f -size 0 | wc -l) of them empty"
[ "$BUILT" -gt 100 ] || die "only $BUILT assets - that is not a complete build"

say "restarting, and making sure the managed process is the one that answers"
pm2 stop "$APP" >/dev/null 2>&1
sleep 3
for p in /proc/[0-9]*; do
  c=$(tr '\0' ' ' < "$p/cmdline" 2>/dev/null) || continue
  case "$c" in "node $DIR/.output/server/index.mjs"*) kill "$(basename "$p")" 2>/dev/null ;; esac
done
sleep 5
for p in /proc/[0-9]*; do
  c=$(tr '\0' ' ' < "$p/cmdline" 2>/dev/null) || continue
  case "$c" in "node $DIR/.output/server/index.mjs"*) kill -9 "$(basename "$p")" 2>/dev/null ;; esac
done
pm2 start "$APP" >/dev/null 2>&1
for _ in $(seq 1 40); do curl -sf -o /dev/null -m 10 http://127.0.0.1:3000/ && break; sleep 2; done

holder=$(ss -ltnp 2>/dev/null | grep ':3000 ' | grep -o 'pid=[0-9]*' | cut -d= -f2 | head -1)
managed=$(pm2 pid "$APP" 2>/dev/null | tr -cd '0-9')
echo "    port 3000: ${holder:-nobody}   pm2: ${managed:-none}"
[ -n "$holder" ] && [ "$holder" = "$managed" ] || die "the managed process is not the one serving"

say "asking the server for every file its own page references"
curl -s http://127.0.0.1:3000/ -o /tmp/sv-page.html
BAD=0; N=0
while read -r a; do
  N=$((N+1))
  CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:3000$a")
  [ "$CODE" = "200" ] || { echo "    FAIL $CODE $a"; BAD=$((BAD+1)); }
done < <(grep -ao '"/assets/[A-Za-z0-9_.@-]*\.\(js\|css\)"' /tmp/sv-page.html | tr -d '"' | sort -u)
echo "    $((N - BAD))/$N answered 200"
echo "    rails server-rendered: $(grep -ao 'data-product-row' /tmp/sv-page.html | wc -l)"

if [ "$BAD" -gt 0 ]; then
  echo
  echo "Putting the previous build back."
  pm2 stop "$APP" >/dev/null 2>&1
  rm -rf .output && mv .output.prev .output
  pm2 start "$APP" >/dev/null 2>&1
  die "rolled back."
fi

echo
echo "PASSED. From your machine, confirm the page actually runs:"
echo "  node scripts/ops/probe-hydration.mjs"
echo "  node scripts/ops/probe-console.mjs"
