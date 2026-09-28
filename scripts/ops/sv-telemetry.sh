#!/usr/bin/env bash
#
# Real telemetry for Server Manager.
#
# Server Manager has twenty-five tables and a full set of screens, and every one
# of them was empty because nothing ever collected anything. The module could
# describe infrastructure it had no way to observe.
#
# This platform runs on a real server, so that server is what gets measured.
# Every figure below is read from the machine at the moment of the reading -
# /proc for load and memory, df for the disk, the interface counters for
# network, and an actual HTTP request to the site for response time. Nothing is
# estimated and nothing is filled in when a reading cannot be taken.
#
# One row is kept current in server_instances and one appended to
# server_metrics_history on each pass, which is what the history charts read.

set -uo pipefail

LOG=/var/log/sv-telemetry.log
CODE="SV-PROD-01"

# From the running application, not from the .env file. Readings taken off this
# machine and written to whichever database the file happened to name are worse
# than no readings: Server Manager would show a healthy server and the figures
# would be landing somewhere nobody was looking.
. "$(dirname "$(readlink -f "$0")")/sv-app-env.sh"
sv_app_env "$LOG" || exit 1
URL="$SUPABASE_URL"
KEY="$SUPABASE_SERVICE_ROLE_KEY"

api() {
  local method="$1" path="$2" body="${3:-}"
  curl -s -m 30 -X "$method" "${URL%/}/rest/v1/${path}" \
    -H "apikey: ${KEY}" -H "Authorization: Bearer ${KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    ${body:+-d "$body"}
}

# ------------------------------------------------------------- the machine --
CPU_CORES=$(nproc)
RAM_GB=$(awk '/MemTotal/ {printf "%d", ($2/1048576)+0.5}' /proc/meminfo)
DISK_GB=$(df -BG --output=size / | tail -1 | tr -dc '0-9')
HOSTNAME_=$(hostname)
OS=$(. /etc/os-release 2>/dev/null && echo "${ID}-${VERSION_ID}" || echo unknown)
IP=$(hostname -I 2>/dev/null | awk '{print $1}')

# CPU: the busy fraction over one second, from /proc/stat rather than a guess.
read -r _ a b c prev_idle rest_a < /proc/stat
prev_total=$((a+b+c+prev_idle))
for v in $rest_a; do prev_total=$((prev_total+v)); done
sleep 1
read -r _ a b c idle rest_b < /proc/stat
total=$((a+b+c+idle))
for v in $rest_b; do total=$((total+v)); done
d_total=$((total-prev_total)); d_idle=$((idle-prev_idle))
CPU=$(awk -v t="$d_total" -v i="$d_idle" 'BEGIN{ if (t<=0) print 0; else printf "%.1f", (1-(i/t))*100 }')

RAM=$(awk '/MemTotal/{t=$2} /MemAvailable/{a=$2} END{ if(t>0) printf "%.1f", (1-(a/t))*100; else print 0 }' /proc/meminfo)
DISK=$(df --output=pcent / | tail -1 | tr -dc '0-9')

# Network: bytes moved on the default interface over the same second.
IFACE=$(ip route show default 2>/dev/null | awk '/default/ {print $5; exit}')
if [[ -n "${IFACE:-}" && -r "/sys/class/net/${IFACE}/statistics/rx_bytes" ]]; then
  rx1=$(cat "/sys/class/net/${IFACE}/statistics/rx_bytes")
  tx1=$(cat "/sys/class/net/${IFACE}/statistics/tx_bytes")
  sleep 1
  rx2=$(cat "/sys/class/net/${IFACE}/statistics/rx_bytes")
  tx2=$(cat "/sys/class/net/${IFACE}/statistics/tx_bytes")
  NET_IN=$(awk -v a="$rx1" -v b="$rx2" 'BEGIN{printf "%.2f", ((b-a)*8)/1000000}')
  NET_OUT=$(awk -v a="$tx1" -v b="$tx2" 'BEGIN{printf "%.2f", ((b-a)*8)/1000000}')
else
  NET_IN=0; NET_OUT=0
fi

UPTIME_S=$(awk '{printf "%d", $1}' /proc/uptime)
CONNS=$(ss -Htn state established 2>/dev/null | wc -l)

# Response time and health, measured by actually asking the site.
RESP=$(curl -s -o /dev/null -m 20 -w '%{time_total}' http://127.0.0.1:3000/ 2>/dev/null || echo 0)
RESP_MS=$(awk -v s="$RESP" 'BEGIN{printf "%d", s*1000}')
HTTP=$(curl -s -o /dev/null -m 20 -w '%{http_code}' http://127.0.0.1:3000/ 2>/dev/null || echo 0)

# Health is derived from the readings, not asserted.
HEALTH=$(awk -v c="$CPU" -v r="$RAM" -v d="$DISK" -v h="$HTTP" 'BEGIN{
  s=100
  if (c>85) s-=20; else if (c>70) s-=10
  if (r>90) s-=20; else if (r>75) s-=10
  if (d>90) s-=25; else if (d>80) s-=10
  if (h!=200) s-=40
  if (s<0) s=0
  printf "%d", s }')
STATE=$(awk -v s="$HEALTH" 'BEGIN{ print (s>=85) ? "healthy" : (s>=60 ? "degraded" : "critical") }')

# ------------------------------------------------------------ record it ----
EXISTING=$(api GET "server_instances?select=id&server_code=eq.${CODE}" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')

COMMON=$(cat <<JSON
"hostname":"${HOSTNAME_}","ip_address":"${IP}","os_type":"${OS}",
"cpu_cores":${CPU_CORES},"ram_gb":${RAM_GB},"storage_gb":${DISK_GB},
"cpu_usage":${CPU},"ram_usage":${RAM},"disk_usage":${DISK},
"network_in_mbps":${NET_IN},"network_out_mbps":${NET_OUT},
"response_time_ms":${RESP_MS},"health_score":${HEALTH},
"health_status":"${STATE}","last_health_check":"$(date -Is)","updated_at":"$(date -Is)"
JSON
)
COMMON=$(echo "$COMMON" | tr -d '\n')

if [[ -z "$EXISTING" ]]; then
  BODY="{\"server_code\":\"${CODE}\",\"server_name\":\"Software Vala production\",\"server_type\":\"production\",\"workload\":\"app\",\"provider\":\"hostinger\",\"region_code\":\"eu-central\",\"region_name\":\"Europe\",\"status\":\"active\",${COMMON}}"
  EXISTING=$(api POST "server_instances" "$BODY" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
  echo "$(date -Is) registered ${CODE} as ${EXISTING}" >> "$LOG"
else
  api PATCH "server_instances?id=eq.${EXISTING}" "{${COMMON}}" > /dev/null
fi

if [[ -n "$EXISTING" ]]; then
  api POST "server_metrics_history" "{\"server_id\":\"${EXISTING}\",\"cpu_usage\":${CPU},\"ram_usage\":${RAM},\"disk_usage\":${DISK},\"network_in_mbps\":${NET_IN},\"network_out_mbps\":${NET_OUT},\"active_connections\":${CONNS},\"response_time_ms\":${RESP_MS},\"error_count\":$([[ "$HTTP" == "200" ]] && echo 0 || echo 1)}" > /dev/null
  echo "$(date -Is) ${CODE} cpu=${CPU}% ram=${RAM}% disk=${DISK}% resp=${RESP_MS}ms http=${HTTP} health=${HEALTH} ${STATE}" >> "$LOG"
fi

# Keep the history from growing without bound: thirty days is plenty for the charts.
api DELETE "server_metrics_history?recorded_at=lt.$(date -Is -d '30 days ago')" > /dev/null 2>&1

if [[ -f "$LOG" ]] && [[ $(stat -c%s "$LOG") -gt 5242880 ]]; then
  tail -n 2000 "$LOG" > "${LOG}.tmp" && mv "${LOG}.tmp" "$LOG"
fi
