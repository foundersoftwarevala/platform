#!/usr/bin/env bash
set -euo pipefail
umask 077

PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
CONFIG=/etc/softwarevala/db-backup-r2.env
BACKUP=/usr/local/bin/sv-db-backup.py
BACKUP_ROOT=/var/backups/softwarevala
LOCK=/run/lock/sv-db-backup-r2.lock

if [ "$(id -u)" -ne 0 ]; then
  echo "Database backups must run as root" >&2
  exit 1
fi
if [ ! -r "$CONFIG" ]; then
  echo "R2 backup configuration is missing: $CONFIG" >&2
  exit 1
fi
# The root-owned 0600 file contains credentials and is never stored in Git.
# shellcheck disable=SC1090
source "$CONFIG"

for name in R2_ACCOUNT_ID R2_BUCKET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BACKUP_AGE_RECIPIENT; do
  if [ -z "${!name:-}" ]; then
    echo "Required R2 backup setting is empty: $name" >&2
    exit 1
  fi
done
for command_name in age aws flock python3 tar sha256sum; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Required backup command is missing: $command_name" >&2
    exit 1
  fi
done
if [ ! -x "$BACKUP" ]; then
  echo "Existing logical backup command is missing: $BACKUP" >&2
  exit 1
fi

exec 9>"$LOCK"
if ! flock -n 9; then
  echo "Another database backup is already running" >&2
  exit 1
fi

previous=$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' 2>/dev/null |
  sort | tail -n 1)
"$BACKUP" --out "$BACKUP_ROOT" --keep 7

latest=$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' |
  sort | tail -n 1)
if [ -z "$latest" ] || [ "$latest" = "$previous" ] || [ ! -d "$BACKUP_ROOT/$latest" ]; then
  echo "No completed local backup directory was found" >&2
  exit 1
fi

tmp=$(mktemp -d /var/tmp/sv-db-backup-r2.XXXXXX)
trap 'rm -rf -- "$tmp"' EXIT
archive="$tmp/softwarevala-db-$latest.tar.gz.age"
tar -C "$BACKUP_ROOT" -czf - "$latest" |
  age -r "$R2_BACKUP_AGE_RECIPIENT" -o "$archive"

digest=$(sha256sum "$archive" | cut -d' ' -f1)
object_key="softwarevala/database/softwarevala-db-$latest.tar.gz.age"
endpoint="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION=auto
export AWS_EC2_METADATA_DISABLED=true

aws --endpoint-url "$endpoint" s3 cp "$archive" "s3://${R2_BUCKET}/${object_key}" \
  --only-show-errors
aws --endpoint-url "$endpoint" s3 cp "s3://${R2_BUCKET}/${object_key}" \
  "$tmp/remote-verification" --only-show-errors
remote_digest=$(sha256sum "$tmp/remote-verification" | cut -d' ' -f1)
if [ "$remote_digest" != "$digest" ]; then
  echo "R2 checksum verification failed for $object_key" >&2
  exit 1
fi
remote_size=$(aws --endpoint-url "$endpoint" s3api head-object \
  --bucket "$R2_BUCKET" --key "$object_key" --query ContentLength --output text)
local_size=$(stat -c '%s' "$archive")
if [ "$remote_size" != "$local_size" ]; then
  echo "R2 size verification failed for $object_key" >&2
  exit 1
fi

printf '%s  %s\n' "$digest" "$(basename "$archive")" > "$tmp/checksum"
aws --endpoint-url "$endpoint" s3 cp "$tmp/checksum" \
  "s3://${R2_BUCKET}/${object_key}.sha256" --only-show-errors

echo "Encrypted logical backup uploaded and size-verified: s3://${R2_BUCKET}/${object_key}"
