#!/usr/bin/env bash
set -euo pipefail

readonly AGENT_ENV_FILE="${SERVER_MANAGER_AGENT_ENV:-/etc/server-manager-agent/agent.env}"
if [[ ! -r "$AGENT_ENV_FILE" ]]; then
  printf 'Agent configuration is not readable: %s\n' "$AGENT_ENV_FILE" >&2
  exit 1
fi
# The root-owned, service-readable environment file contains only the agent token
# and the HTTPS Software Vala API origin.
# shellcheck disable=SC1090
source "$AGENT_ENV_FILE"

readonly API_ORIGIN="${SERVER_MANAGER_API_ORIGIN:-}"
readonly TOKEN="${SERVER_MANAGER_AGENT_TOKEN:-}"
if [[ ! "$API_ORIGIN" =~ ^https://[A-Za-z0-9.-]+(:443)?$ ]]; then
  printf 'A valid HTTPS API origin on port 443 is required.\n' >&2
  exit 1
fi
if [[ ! "$TOKEN" =~ ^sv_agent_[0-9a-f]{64}$ ]]; then
  printf 'Agent token is invalid.\n' >&2
  exit 1
fi
if ! command -v curl >/dev/null 2>&1 || ! command -v awk >/dev/null 2>&1 || ! command -v df >/dev/null 2>&1; then
  printf 'Required read-only system tools (curl, awk, df) are missing.\n' >&2
  exit 1
fi

read_cpu_counters() {
  awk 'NR == 1 && $1 == "cpu" {
    total = 0
    for (i = 2; i <= 9; i++) total += $i
    idle = $5 + $6
    printf "%.0f %.0f\n", total, idle
    exit
  }' /proc/stat
}

read_network_counters() {
  awk -F '[: ]+' '
    NR > 2 && $2 != "lo" {
      rx += $3
      tx += $11
    }
    END { printf "%.0f %.0f\n", rx, tx }
  ' /proc/net/dev
}

read_memory_percent() {
  awk '
    $1 == "MemTotal:" { total = $2 }
    $1 == "MemAvailable:" { available = $2 }
    END {
      if (total <= 0 || available < 0) exit 1
      printf "%.2f", (total - available) * 100 / total
    }
  ' /proc/meminfo
}

read_disk_percent() {
  df -P / | awk 'NR == 2 {
    value = $5
    sub(/%$/, "", value)
    if (value !~ /^[0-9]+$/) exit 1
    printf "%d.00", value
  }'
}

read_uptime_seconds() {
  awk '{ printf "%.0f", $1 }' /proc/uptime
}

previous_network="$(read_network_counters)"
previous_cpu="$(read_cpu_counters)"
previous_uptime="${SECONDS}"

while true; do
  cycle_start="${SECONDS}"
  sleep 1

  current_cpu="$(read_cpu_counters)"
  cpu_usage="$(awk -v old="$previous_cpu" -v new="$current_cpu" '
    BEGIN {
      split(old, a, " "); split(new, b, " ")
      total = b[1] - a[1]; idle = b[2] - a[2]
      if (total <= 0 || idle < 0 || idle > total) exit 1
      printf "%.2f", (total - idle) * 100 / total
    }
  ')"
  current_network="$(read_network_counters)"
  network_rates="$(awk -v old="$previous_network" -v new="$current_network" -v elapsed="$((SECONDS - previous_uptime))" '
    BEGIN {
      split(old, a, " "); split(new, b, " ")
      if (elapsed <= 0 || b[1] < a[1] || b[2] < a[2]) exit 1
      printf "%.2f %.2f", (b[1] - a[1]) * 8 / elapsed / 1000000, (b[2] - a[2]) * 8 / elapsed / 1000000
    }
  ')"
  read -r network_in_mbps network_out_mbps <<< "$network_rates"

  ram_usage="$(read_memory_percent)"
  disk_usage="$(read_disk_percent)"
  uptime_seconds="$(read_uptime_seconds)"
  timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  idempotency_key="$(cat /proc/sys/kernel/random/uuid)"

  payload="$(printf \
    '{"cpu_usage":%s,"ram_usage":%s,"disk_usage":%s,"network_in_mbps":%s,"network_out_mbps":%s,"uptime_seconds":%s,"failed_logins":null,"open_ports":null,"patch_status":"unknown","suspicious_process":null,"timestamp":"%s"}' \
    "$cpu_usage" "$ram_usage" "$disk_usage" "$network_in_mbps" "$network_out_mbps" "$uptime_seconds" "$timestamp")"

  if ! curl --fail --silent --show-error --proto '=https' --tlsv1.2 \
    --connect-timeout 10 --max-time 20 \
    -X POST "${API_ORIGIN%/}/api/agent/heartbeat" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: ${idempotency_key}" \
    --data-binary "$payload" >/dev/null; then
    printf '%s heartbeat failed; retrying next interval\n' "$timestamp" >&2
  else
    printf '%s read-only heartbeat accepted\n' "$timestamp"
  fi

  previous_cpu="$current_cpu"
  previous_network="$current_network"
  previous_uptime="${SECONDS}"
  elapsed_cycle="$((SECONDS - cycle_start))"
  if (( elapsed_cycle < 60 )); then sleep "$((60 - elapsed_cycle))"; fi
done
