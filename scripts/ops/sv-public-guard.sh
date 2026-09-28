#!/usr/bin/env bash
# Public-domain guard for softwarevala.net.
#
# The app guard (sv-homepage-guard.sh) proves the application is serving the
# homepage on 127.0.0.1:3000. This one proves a real visitor gets it: DNS,
# nginx, the TLS certificate and the redirect all included. A working origin
# behind a broken certificate or a stopped nginx still looks blank to customers,
# which is exactly the failure this business cannot afford.
#
# It only ever reloads nginx — it never stops anything and never deletes.

set -uo pipefail

URL="https://softwarevala.net/"
ORIGIN="http://127.0.0.1:3000/"
MIN_BYTES=20000
MARKER="The Name of Trust"
LOG="/var/log/sv-public-guard.log"
STATE="/tmp/sv-public-guard.fails"
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

log() { echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') $*" >> "$LOG"; }

out=$(curl -s -m 30 -o /tmp/sv-public.html -w '%{http_code} %{size_download}' "$URL" 2>/dev/null)
code=${out%% *}
size=${out##* }

healthy=1
[ "$code" = "200" ] || healthy=0
[ "${size:-0}" -ge "$MIN_BYTES" ] 2>/dev/null || healthy=0
grep -qF "$MARKER" /tmp/sv-public.html 2>/dev/null || healthy=0

# Certificate expiry warning — a lapsed certificate blanks the site for everyone.
days_left=$(echo | openssl s_client -servername softwarevala.net -connect softwarevala.net:443 2>/dev/null \
  | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
if [ -n "$days_left" ]; then
  secs=$(( $(date -d "$days_left" +%s 2>/dev/null || echo 0) - $(date +%s) ))
  days=$(( secs / 86400 ))
  [ "$days" -lt 10 ] && log "WARNING: TLS certificate expires in $days days"
fi

if [ "$healthy" = "1" ]; then
  [ -f "$STATE" ] && { log "public site recovered (http=$code bytes=$size)"; rm -f "$STATE"; }
  exit 0
fi

fails=$(( $(cat "$STATE" 2>/dev/null || echo 0) + 1 ))
echo "$fails" > "$STATE"
origin_code=$(curl -s -o /dev/null -m 25 -w '%{http_code}' "$ORIGIN")
log "PUBLIC UNHEALTHY #$fails http=$code bytes=$size (origin=$origin_code)"

# Two consecutive failures with a healthy origin means the edge is at fault.
if [ "$fails" -ge 2 ] && [ "$origin_code" = "200" ]; then
  log "origin is fine — reloading nginx"
  nginx -t >> "$LOG" 2>&1 && systemctl reload nginx >> "$LOG" 2>&1
  sleep 5
  after=$(curl -s -o /dev/null -m 30 -w '%{http_code}' "$URL")
  log "after nginx reload http=$after"
  [ "$after" = "200" ] && rm -f "$STATE"
fi
exit 0
