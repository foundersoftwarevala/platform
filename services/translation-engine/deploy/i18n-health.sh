#!/bin/bash
# Health check for the language system, run every minute by cron:
#
#   * * * * * /opt/sv-translate/app/deploy/i18n-health.sh
#
# Each run records one JSON line in /var/log/sv-i18n-health.log (and the
# latest in /var/lib/sv-i18n/health.json) with what the site and the engine
# report about themselves:
#   public site, language pack and translate endpoint (status, latency),
#   engine readiness and backends, job queue, database latency, and the
#   application's own counters (requests, errors, cache hit ratios, latency
#   percentiles, event-loop delay) from GET /api/i18n/admin?view=metrics.
#
# It repairs what it safely can, after three failed checks in a row:
#   engine not ready  -> docker restart sv-translate
#   application down  -> a clean PM2 restart (stop, wait, start)
# and raises an ALERT line for anything wrong. When /etc/sv-i18n-health.env
# sets ALERT_WEBHOOK_URL, alerts are also POSTed there as JSON.
#
# Settings (optional) in /etc/sv-i18n-health.env:
#   ALERT_WEBHOOK_URL=        where to POST alerts
#   APP_URL=http://127.0.0.1:3000
#   PUBLIC_URL=https://softwarevala.net
#   PM2_NAME=softwarevala-staging
#   QUEUE_ALERT=150000        queued jobs above this raise an alert
#   LATENCY_ALERT_MS=2000     pack / translate latency above this raises an alert
set -uo pipefail

[ -f /etc/sv-i18n-health.env ] && . /etc/sv-i18n-health.env
[ -f /etc/sv-translate.env ] && . /etc/sv-translate.env
APP_URL=${APP_URL:-http://127.0.0.1:3000}
PUBLIC_URL=${PUBLIC_URL:-https://softwarevala.net}
PM2_NAME=${PM2_NAME:-softwarevala-staging}
QUEUE_ALERT=${QUEUE_ALERT:-150000}
LATENCY_ALERT_MS=${LATENCY_ALERT_MS:-2000}
ENGINE_URL=${ENGINE_URL:-http://127.0.0.1:5100}
STATE=/var/lib/sv-i18n
LOG=/var/log/sv-i18n-health.log
mkdir -p "$STATE"

# The application's internal token, from the running process's environment.
APP_PID=$(ss -ltnpH "sport = :${APP_URL##*:}" 2>/dev/null | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2)
INTERNAL_TOKEN=""
[ -n "$APP_PID" ] && INTERNAL_TOKEN=$(tr '\0' '\n' < "/proc/$APP_PID/environ" 2>/dev/null | sed -n 's/^INTERNAL_API_TOKEN=//p')

probe() { # url -> "code seconds"
  curl -s -o /dev/null -w '%{http_code} %{time_total}' -m 20 "$@" 2>/dev/null || echo "000 20"
}

read -r public_code public_s < <(probe "$PUBLIC_URL/")
read -r pack_code pack_s < <(probe "$APP_URL/api/i18n/pack?lang=hi")
read -r tr_code tr_s < <(probe -X POST "$APP_URL/api/marketplace/translate" -H "Content-Type: application/json" \
  -d '{"texts":["Language"],"target":"hi","memory_only":true}')
engine_ready=$(curl -s -m 10 "$ENGINE_URL/ready" 2>/dev/null | python3 -c 'import sys,json
try: print(str(json.load(sys.stdin).get("ready", False)).lower())
except Exception: print("false")')
metrics=$(curl -s -m 30 "$APP_URL/api/i18n/admin?view=metrics" -H "x-internal-token: $INTERNAL_TOKEN" 2>/dev/null)

record=$(PUBLIC="$public_code $public_s" PACK="$pack_code $pack_s" TR="$tr_code $tr_s" ENGINE_READY="$engine_ready" \
  METRICS="$metrics" QUEUE_ALERT="$QUEUE_ALERT" LATENCY_ALERT_MS="$LATENCY_ALERT_MS" STATE="$STATE" python3 - <<'PY'
import json, os, time
def pair(name):
    code, seconds = os.environ[name].split()
    return int(code), round(float(seconds) * 1000)
public, pack, tr = pair("PUBLIC"), pair("PACK"), pair("TR")
try:
    m = json.loads(os.environ.get("METRICS") or "{}")
except Exception:
    m = {}
app = m.get("app", {})
counters = app.get("counters", {})
# Error deltas since the previous run (counters are totals since the process started).
prev_path = os.path.join(os.environ["STATE"], "counters.json")
try:
    prev = json.load(open(prev_path))
except Exception:
    prev = {}
json.dump(counters, open(prev_path, "w"))
def delta(prefix):
    return sum(v - prev.get(k, 0) for k, v in counters.items() if k.startswith(prefix) and v >= prev.get(k, 0))
errors_5xx = delta("api.translate.5") + delta("api.pack.5")
requests = delta("api.translate.") - delta("api.translate.strings") - delta("api.translate.from_memory") \
    - delta("api.translate.engine_translated") - delta("api.translate.pending") + delta("api.pack.")
queue = m.get("queue", {})
engine = m.get("engine", {})
alerts = []
if public[0] != 200: alerts.append(f"public site answered {public[0]}")
if pack[0] != 200: alerts.append(f"language pack answered {pack[0]}")
if tr[0] != 200: alerts.append(f"translate endpoint answered {tr[0]}")
if os.environ["ENGINE_READY"] != "true": alerts.append("translation engine not ready")
if not m: alerts.append("application metrics unavailable")
limit = int(os.environ["LATENCY_ALERT_MS"])
if pack[1] > limit: alerts.append(f"language pack took {pack[1]} ms")
if tr[1] > limit: alerts.append(f"translate endpoint took {tr[1]} ms")
if queue.get("queued", 0) > int(os.environ["QUEUE_ALERT"]): alerts.append(f"job queue at {queue['queued']}")
if m and not m.get("database", {}).get("reachable", False): alerts.append("database not reachable")
if errors_5xx > 0: alerts.append(f"{errors_5xx} server errors from the language endpoints in the last minute")
print(json.dumps({
    "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "public": {"code": public[0], "ms": public[1]},
    "pack": {"code": pack[0], "ms": pack[1]},
    "translate": {"code": tr[0], "ms": tr[1]},
    "engine": {"ready": os.environ["ENGINE_READY"] == "true",
               "counters": {k: v for k, v in (engine.get("counters") or {}).items() if "backend_calls" in k}},
    "database": m.get("database"),
    "queue": queue,
    "requests_last_minute": requests,
    "errors_5xx_last_minute": errors_5xx,
    "latency": app.get("latency", {}),
    "caches": {k: v.get("hitRatio") for k, v in app.get("caches", {}).items()},
    "process": app.get("process"),
    "alerts": alerts,
}))
PY
)
echo "$record" >> "$LOG"
echo "$record" > "$STATE/health.json"

# Consecutive failures, for the repairs.
fails() { # name ok(true/false) -> prints the new count
  local f="$STATE/fail-$1" n=0
  [ -f "$f" ] && n=$(cat "$f")
  if [ "$2" = "true" ]; then n=0; else n=$((n + 1)); fi
  echo "$n" > "$f"; echo "$n"
}
alert() {
  echo "$(date -u +%FT%TZ) ALERT $*" >> "$LOG"
  if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
    curl -s -m 10 -X POST "$ALERT_WEBHOOK_URL" -H "Content-Type: application/json" \
      -d "$(python3 -c 'import json,sys; print(json.dumps({"service":"sv-language-system","alert":sys.argv[1]}))' "$*")" >/dev/null || true
  fi
}

engine_fails=$(fails engine "$engine_ready")
app_ok=false; [ "$tr_code" = "200" ] || [ "$pack_code" = "200" ] && app_ok=true
app_fails=$(fails app "$app_ok")

if [ "$engine_fails" -ge 3 ]; then
  alert "engine not ready for $engine_fails checks; restarting the sv-translate container"
  docker restart sv-translate >/dev/null 2>&1 || alert "docker restart sv-translate failed"
  echo 0 > "$STATE/fail-engine"
fi
if [ "$app_fails" -ge 3 ]; then
  alert "application not answering for $app_fails checks; clean restart of $PM2_NAME"
  pm2 stop "$PM2_NAME" >/dev/null 2>&1
  for _ in $(seq 1 15); do [ -z "$(ss -ltnpH "sport = :${APP_URL##*:}")" ] && break; sleep 1; done
  pm2 restart "$PM2_NAME" >/dev/null 2>&1 || alert "pm2 restart $PM2_NAME failed"
  echo 0 > "$STATE/fail-app"
fi
python3 -c 'import json,sys
for a in json.loads(sys.argv[1]).get("alerts", []): print(a)' "$record" | while read -r line; do alert "$line"; done
exit 0
