#!/usr/bin/env bash
set -euo pipefail
umask 027

exec 9>/run/lock/vala-ai-backup.lock
if ! flock -n 9; then
  echo "Vala AI backup failed: another backup is running." >&2
  exit 75
fi

set -a
source "${VALA_AI_BACKUP_ENV:-/etc/softwarevala/vala-ai.env}"
set +a
LOG=/var/log/vala-ai/backup.log
mkdir -p /var/log/vala-ai
chmod 750 /var/log/vala-ai
touch "$LOG"
chmod 640 "$LOG"
printf '\n[%s] Backup started (source: %s/vala.db)\n' "$(date -u +%FT%TZ)" "$VALA_AI_DATA_DIR" >> "$LOG"
if [[ ! -f "$VALA_AI_DATA_DIR/vala.db" ]]; then
  message="Vala AI backup NOT READY: source database is absent; no database initialized."
  echo "$message" >> "$LOG"
  echo "$message" >&2
  exit 69
fi

if node /usr/local/lib/vala-ai-backup/scripts/vala-ai/backup.ts \
  --out "$VALA_AI_DATA_DIR/backups" --keep 7 >> "$LOG" 2>&1; then
  printf '[%s] Backup completed\n' "$(date -u +%FT%TZ)" >> "$LOG"
else
  status=$?
  echo "Vala AI backup FAILED (exit $status); see $LOG." | tee -a "$LOG" >&2
  exit "$status"
fi
