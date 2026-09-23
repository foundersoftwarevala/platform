#!/usr/bin/env bash
# Rebuild the application on the server so it can serve its own files again.
#
# RUN THIS ON THE SERVER, in your own SSH session:
#
#   ssh root@77.37.121.112
#   bash /var/www/softwarevala/scripts/ops/fix-origin.sh
#
# Why it is needed
# ---------------
# The origin answers 500 for eight of the home page's own chunks, the entry
# module among them. Visitors do not see it, because Cloudflare is still
# serving copies it cached from an earlier build - every one of them comes back
# `cf-cache-status: HIT`. The site works on borrowed time: when that cache
# expires, or the moment anybody purges it, every visitor gets a page that
# renders and then does nothing.
#
# So this rebuilds, checks the files exist before anything is swapped in, and
# keeps the build that is serving now so it can be put back.
#
# It does NOT purge Cloudflare. Purging while the origin is broken is what
# would take the site down; purge only after the check below passes.
set -uo pipefail

APP="${SV_APP_DIR:-/var/www/softwarevala}"
NAME="${SV_PM2_NAME:-softwarevala-staging}"

say() { printf '\n==> %s\n' "$*"; }
die() { printf '\nSTOPPED: %s\n' "$*" >&2; exit 1; }

cd "$APP" || die "no $APP"

say "what the server is serving right now"
CURRENT_ENTRY=$(curl -s http://127.0.0.1:3000/ | grep -ao '/assets/index-[A-Za-z0-9_-]*\.js' | head -1)
echo "    entry module referenced by the page: ${CURRENT_ENTRY:-none found}"
if [ -n "$CURRENT_ENTRY" ]; then
  if [ -f ".output/public$CURRENT_ENTRY" ]; then
    echo "    on disk: yes, $(stat -c%s ".output/public$CURRENT_ENTRY") bytes"
  else
    echo "    on disk: NO - this is the fault. The page asks for a file the build does not have."
  fi
fi

say "how many assets the current build has"
ls -1 .output/public/assets 2>/dev/null | wc -l
echo "    zero-byte files:"
find .output/public/assets -maxdepth 1 -type f -size 0 2>/dev/null | head -20 || true

say "keeping the build that is serving now"
rm -rf .output.prev
cp -a .output .output.prev || die "could not keep a copy of the current build"
echo "    kept at $APP/.output.prev"

say "building"
# node_modules/.vite is cleared because a half-written cache is one of the ways
# a build silently produces fewer chunks than the manifest lists.
rm -rf .output node_modules/.vite
npm ci || die "npm ci failed - the previous build is untouched and still serving"
NITRO_PRESET=node-server npx vite build || die "the build failed - the previous build is untouched and still serving"

say "checking the new build has everything the new page asks for"
BUILT=$(ls -1 .output/public/assets | wc -l)
echo "    $BUILT assets built"
[ "$BUILT" -gt 100 ] || die "only $BUILT assets - that is not a complete build"
EMPTY=$(find .output/public/assets -maxdepth 1 -type f -size 0 | wc -l)
[ "$EMPTY" = "0" ] || die "$EMPTY zero-byte assets in the new build"

say "restarting"
pm2 restart "$NAME" --update-env || die "restart failed - put the old build back with: rm -rf $APP/.output && mv $APP/.output.prev $APP/.output && pm2 restart $NAME"
sleep 5

say "asking the server for every file its own page references"
PAGE=$(mktemp)
curl -s http://127.0.0.1:3000/ -o "$PAGE"
mapfile -t ASSETS < <(grep -ao '"/assets/[A-Za-z0-9_.@-]*\.\(js\|css\)"' "$PAGE" | tr -d '"' | sort -u)
echo "    ${#ASSETS[@]} referenced"
BAD=0
for a in "${ASSETS[@]}"; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:3000$a")
  [ "$CODE" = "200" ] || { echo "    FAIL $CODE $a"; BAD=$((BAD+1)); }
done
rm -f "$PAGE"

if [ "$BAD" -gt 0 ]; then
  echo
  echo "$BAD files still do not serve. Putting the previous build back."
  rm -rf .output && mv .output.prev .output && pm2 restart "$NAME"
  die "rolled back. The site is exactly as it was."
fi

echo
echo "PASSED: the server serves all ${#ASSETS[@]} files its page references."
echo
echo "Next, from your machine:"
echo "  bash scripts/ops/verify-assets.sh --origin     # confirm from outside"
echo "  bash scripts/ops/verify-assets.sh              # then through Cloudflare"
echo "  node scripts/ops/probe-hydration.mjs           # confirm the page still runs"
echo
echo "Only once those pass is it safe to purge Cloudflare."
