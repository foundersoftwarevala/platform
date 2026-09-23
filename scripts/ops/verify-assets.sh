#!/usr/bin/env bash
# Every file the home page asks for, actually asked for.
#
# The home page shipped for some time with eight of its own JavaScript chunks
# answering 500 - the entry module among them - so the document rendered and
# then nothing on it worked: no search, no favourites, no "show more", and
# eighty-one of the ninety-one category rows never loaded at all. Nothing caught
# it, because the page itself returns 200 and reads correctly to anything that
# only looks at the HTML.
#
# This asks for the page, pulls out every asset it references, and asks for each
# one. It exits non-zero if any of them is not 200, which is what makes it
# usable as the last step of a deploy.
#
#   scripts/ops/verify-assets.sh                     # https://softwarevala.net
#   scripts/ops/verify-assets.sh http://127.0.0.1:3000
#   scripts/ops/verify-assets.sh --origin            # skip the CDN, ask the server
#
set -uo pipefail

BASE="https://softwarevala.net"
ORIGIN_IP="77.37.121.112"
RESOLVE=()

for arg in "$@"; do
  case "$arg" in
    --origin) RESOLVE=(--resolve "softwarevala.net:443:${ORIGIN_IP}" -k) ;;
    http*)    BASE="${arg%/}" ;;
    *)        echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
PAGE="$TMP/page.html"

echo "==> $BASE/"
code=$(curl -sS --compressed "${RESOLVE[@]}" -o "$PAGE" -w '%{http_code}' \
       -H 'User-Agent: softwarevala-deploy-check' "$BASE/")
ttfb=$(curl -sS --compressed "${RESOLVE[@]}" -o /dev/null -w '%{time_starttransfer}' "$BASE/")
if [ "$code" != "200" ]; then
  echo "FAIL  the home page itself answered $code"
  exit 1
fi
echo "ok    home page 200, ${ttfb}s to first byte, $(wc -c < "$PAGE") bytes of HTML"

# Everything the document references under /assets/, once each. The page lists
# each chunk several times - as a modulepreload, in the router manifest and as
# the script tag - so the list is deduplicated before anything is fetched.
grep -ao '"/assets/[A-Za-z0-9_.@-]*\.\(js\|css\)"' "$PAGE" \
  | tr -d '"' | sort -u > "$TMP/assets.txt"

total=$(wc -l < "$TMP/assets.txt" | tr -d ' ')
if [ "$total" = "0" ]; then
  echo "FAIL  the page references no assets at all - the build manifest is missing"
  exit 1
fi
echo "==> $total assets referenced"

bad=0
bytes=0
while read -r path; do
  read -r acode asize <<<"$(curl -sS --compressed "${RESOLVE[@]}" -o /dev/null \
      -w '%{http_code} %{size_download}' "$BASE$path")"
  if [ "$acode" = "200" ]; then
    bytes=$((bytes + asize))
  else
    echo "FAIL  $acode  $path"
    bad=$((bad + 1))
  fi
done < "$TMP/assets.txt"

echo "==> $((total - bad))/$total answered 200, $((bytes / 1024)) KB compressed"

# The sections the home page is expected to carry in its own HTML. A section
# that is configured off is not a failure, so these are reported rather than
# enforced - except the catalogue, which is the page's whole purpose.
echo "==> sections in the served HTML"
check() {
  if grep -aq "$2" "$PAGE"; then echo "      present  $1"; else echo "      ABSENT   $1"; fi
}
check "hero carousel"     'hero-premium'
check "category slider"   'cursor-grab'
check "search bar"        'Search software'
check "catalogue rows"    'data-product-row'
check "Featured Software" 'Featured Software'
check "Trending Now"      'Trending Now'
check "Top Selling"       'Top Selling'
check "New Releases"      'New Releases'
check "AI Zone"           'AI Zone'
check "Success Stories"   'Success Stories'
check "Awards"            'Awards &amp; Champions'
check "Live Activity"     'Live Marketplace Activity'
check "Vala TV"           'Demos, walkthroughs'
check "Vala Academy"      'Vala Academy'
check "Partner Ecosystem" 'Partner Ecosystem'
check "FAQ"               'id="faq"'
check "Enterprise CTA"    'Run your entire business'
check "footer"            'lucide-circle-help\|/vala-tv'

rows=$(grep -ao 'data-product-row' "$PAGE" | wc -l | tr -d ' ')
cards=$(grep -ao 'href="/marketplace/product/' "$PAGE" | wc -l | tr -d ' ')
echo "==> $rows rails, $((cards / 3)) product cards server-rendered"

if [ "$rows" = "0" ]; then
  echo "FAIL  the catalogue rendered no rows"
  bad=$((bad + 1))
fi

if [ "$bad" -gt 0 ]; then
  echo
  echo "FAILED: $bad problem(s). The page will render and then not work."
  exit 1
fi
echo
echo "PASSED: every referenced asset answered 200."
