#!/usr/bin/env bash
set -euo pipefail
umask 077
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export TZ=UTC
trap 'status=$?; logger -p daemon.err -t sv-seo-gate -- "Software Vala SEO gate wrapper ERROR: exit=$status; line=$LINENO" || printf "ALERT ERROR: wrapper failure could not reach syslog\n" >&2; exit "$status"' ERR

APP_DIR=/var/www/softwarevala
LOG_DIR=/var/log/sv-seo-gate
CONFIG=/etc/softwarevala/seo-gate.env
[[ ! -f "$CONFIG" ]] || source "$CONFIG"
export SEO_GATE_MAX_DROP_PERCENT="${SEO_GATE_MAX_DROP_PERCENT:-2}"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/gate-$(date +%Y%m%d).log"
touch "$LOG"
chmod 640 "$LOG"
case "${SEO_GATE_ALERT_LOCAL_MAIL:-0}" in
  0|1) ;;
  *)
    printf 'ALERT CONFIG ERROR: SEO_GATE_ALERT_LOCAL_MAIL must be 0 or 1.\n' >&2
    logger -p daemon.err -t sv-seo-gate -- 'SEO_GATE_ALERT_LOCAL_MAIL must be 0 or 1'
    exit 2
    ;;
esac
# Only this job's dated files, never another service's logs.
find "$LOG_DIR" -maxdepth 1 -type f -regextype posix-extended \
  -regex '.*/gate-[0-9]{8}\.log(\.[0-9]+|-[0-9]{8})?(\.gz)?' -mtime +6 -delete

alert() {
  local message="$1"
  printf '%s %s\n' "$(date -u +%FT%TZ)" "$message" > "$LOG_DIR/last-failure.txt"
  printf '%s\n' "$message" >> "$LOG"
  if ! logger -p daemon.err -t sv-seo-gate -- "$message"; then
    printf 'ALERT ERROR: syslog delivery failed\n' >> "$LOG"
    return 1
  fi
  if [[ "${SEO_GATE_ALERT_LOCAL_MAIL:-0}" == 1 ]]; then
    if ! printf 'To: root\nSubject: Software Vala SEO gate alert\nX-SoftwareVala-Alert: seo-gate\n\n%s\n' "$message" |
      /usr/sbin/sendmail -oi -t >> "$LOG" 2>&1; then
      printf 'ALERT ERROR: local root mail submission failed.\n' >> "$LOG"
      return 1
    fi
    printf 'ALERT: local root mail submitted; mailbox delivery is handled by the MTA.\n' >> "$LOG"
  fi
  if [[ -z "${SEO_GATE_ALERT_WEBHOOK:-}" ]]; then
    printf 'ALERT: syslog and persistent failure record delivered; external webhook UNCONFIGURED.\n' >> "$LOG"
    return 0
  fi
  if [[ ! "$SEO_GATE_ALERT_WEBHOOK" =~ ^https://[^[:space:]]+$ ]]; then
    printf 'ALERT ERROR: configured webhook must use HTTPS\n' >> "$LOG"
    return 1
  fi
  local payload
  payload="$(SEO_GATE_ALERT_MESSAGE="$message" node -e \
    'console.log(JSON.stringify({text:process.env.SEO_GATE_ALERT_MESSAGE,content:process.env.SEO_GATE_ALERT_MESSAGE}))')"
  # Keep the secret webhook URL out of the process argument list.
  if ! printf 'url = "%s"\n' "$SEO_GATE_ALERT_WEBHOOK" |
    curl --config - --fail --silent --show-error --connect-timeout 10 --max-time 30 \
      --header 'Content-Type: application/json' --data "$payload" >> "$LOG" 2>&1; then
    printf 'ALERT ERROR: external webhook delivery failed; local failure record retained.\n' >> "$LOG"
    return 1
  fi
  printf 'ALERT: external webhook delivered.\n' >> "$LOG"
}

if [[ "${1:-}" == "--test-alert" ]]; then
  alert "TEST: Software Vala SEO gate failure notification; no gate run or DB write."
  exit $?
fi

cd "$APP_DIR"
printf '\n=== %s guarded gate start ===\n' "$(date -u +%FT%TZ)" >> "$LOG"
if [[ -z "${SEO_GATE_ALERT_WEBHOOK:-}" ]]; then
  printf 'Alert mode: syslog + persistent failure record; local root mail=%s; external webhook UNCONFIGURED.\n' \
    "${SEO_GATE_ALERT_LOCAL_MAIL:-0}" >> "$LOG"
fi
if node scripts/ops/seo-gate-run.mjs --kind slot --slice 50 "$@" >> "$LOG" 2>&1; then
  printf '=== %s gate exit=0 ===\n' "$(date -u +%FT%TZ)" >> "$LOG"
  printf '%s exit=0 log=%s\n' "$(date -u +%FT%TZ)" "$LOG" > "$LOG_DIR/last-run.txt"
else
  status=$?
  printf '%s exit=%s log=%s\n' "$(date -u +%FT%TZ)" "$status" "$LOG" > "$LOG_DIR/last-run.txt"
  if ! alert "Software Vala SEO gate FAILED: exit=$status; see $LOG"; then
    printf 'FAILURE ALERT DELIVERY ERROR; check last-failure.txt and syslog.\n' >> "$LOG"
  fi
  exit "$status"
fi
