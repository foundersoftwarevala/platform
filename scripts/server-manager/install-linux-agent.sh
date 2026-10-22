#!/usr/bin/env bash
set -euo pipefail

readonly SERVICE_USER="sv-server-agent"
readonly INSTALL_DIR="/usr/local/libexec"
readonly CONFIG_DIR="/etc/server-manager-agent"
readonly SERVICE_FILE="/etc/systemd/system/sv-server-manager-agent.service"
readonly DEFAULT_API_ORIGIN="https://softwarevala.net"
readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${EUID}" -ne 0 ]]; then
  printf 'Run this installer with administrator approval: sudo bash %q\n' "$0" >&2
  exit 1
fi
if [[ ! -r "${SCRIPT_DIR}/sv-readonly-agent.sh" ]]; then
  printf 'Agent runtime script is missing beside the installer.\n' >&2
  exit 1
fi

read -r -p "Software Vala API origin [${DEFAULT_API_ORIGIN}]: " api_origin
api_origin="${api_origin:-$DEFAULT_API_ORIGIN}"
if [[ ! "$api_origin" =~ ^https://[A-Za-z0-9.-]+(:443)?$ ]]; then
  printf 'API origin must be an HTTPS origin on port 443 without a path, query, or fragment.\n' >&2
  exit 1
fi

read -r -s -p "One-time enrollment/agent token: " agent_token
printf '\n'
if [[ ! "$agent_token" =~ ^sv_agent_[0-9a-f]{64}$ ]]; then
  printf 'Token must have the expected sv_agent_ format.\n' >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1 || ! command -v awk >/dev/null 2>&1 || ! command -v df >/dev/null 2>&1; then
  printf 'Install curl, awk, and df using your distribution package manager, then retry.\n' >&2
  exit 1
fi

if ! getent passwd "$SERVICE_USER" >/dev/null; then
  useradd --system --home-dir /nonexistent --shell /usr/sbin/nologin "$SERVICE_USER"
fi

install -d -o root -g root -m 0755 "$INSTALL_DIR"
install -o root -g root -m 0755 "${SCRIPT_DIR}/sv-readonly-agent.sh" "${INSTALL_DIR}/sv-readonly-agent.sh"
install -d -o root -g "$SERVICE_USER" -m 0750 "$CONFIG_DIR"
umask 077
printf 'SERVER_MANAGER_API_ORIGIN=%q\nSERVER_MANAGER_AGENT_TOKEN=%q\n' \
  "$api_origin" "$agent_token" > "${CONFIG_DIR}/agent.env"
chown root:"$SERVICE_USER" "${CONFIG_DIR}/agent.env"
chmod 0640 "${CONFIG_DIR}/agent.env"
unset agent_token

cat > "$SERVICE_FILE" <<'UNIT'
[Unit]
Description=Software Vala read-only server telemetry agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=sv-server-agent
Group=sv-server-agent
EnvironmentFile=/etc/server-manager-agent/agent.env
ExecStart=/usr/local/libexec/sv-readonly-agent.sh
Restart=on-failure
RestartSec=15s
UMask=0077
NoNewPrivileges=yes
CapabilityBoundingSet=
AmbientCapabilities=
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictSUIDSGID=yes
LockPersonality=yes
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
SystemCallArchitectures=native

[Install]
WantedBy=multi-user.target
UNIT
chmod 0644 "$SERVICE_FILE"

systemctl daemon-reload
systemctl enable --now sv-server-manager-agent.service
systemctl --no-pager --full status sv-server-manager-agent.service
