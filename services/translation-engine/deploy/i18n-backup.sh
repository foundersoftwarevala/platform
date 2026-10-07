#!/bin/bash
# Nightly backup of the language system, run by cron:
#
#   20 0 * * * /opt/sv-translate/app/deploy/i18n-backup.sh
#
# Writes /root/backups/i18n/<UTC date>/ with
#   language-data.dump    pg_dump (custom format) of the language tables:
#                         i18n_languages, marketplace_translations (translation
#                         memory), i18n_glossary_terms, i18n_translation_revisions,
#                         i18n_translation_jobs - schema and data
#   counts.txt            row counts at dump time, to check a restore against
#   engine/               routing.json, the model manifest (pinned revision and
#                         checksum), the engine image tag, the nginx real-IP list
#   SHA256SUMS
# and keeps 14 days. Native schema migrations live in the canonical repository and the
# engine in the repository; models are re-downloaded (pinned) by
# deploy/install-models.sh. Secrets (/etc/sv-translate.env) are not copied.
#
# Restore: see services/translation-engine/README.md, "Backup and recovery".
#
# Runs as root against the existing local canonical PostgreSQL database.
set -euo pipefail

DB_NAME=sv_platform
ROOT=/root/backups/i18n
DAY=${I18N_BACKUP_DAY:-$(date -u +%F)}
[[ "$DAY" =~ ^[0-9A-Za-z_-]+$ ]] || { echo "invalid backup name"; exit 1; }
OUT="$ROOT/$DAY"
KEEP_DAYS=${KEEP_DAYS:-14}
TABLES=(i18n_languages marketplace_translations i18n_glossary_terms i18n_translation_revisions i18n_translation_jobs i18n_request_quota i18n_sessions)
mkdir -p "$OUT/engine"
chmod 700 "$ROOT"

args=()
for t in "${TABLES[@]}"; do args+=(--table="public.$t"); done
coproc SNAPSHOT { sudo -u postgres psql -X -qAt -v ON_ERROR_STOP=1 -d "$DB_NAME"; }
snapshot_pid=$SNAPSHOT_PID
printf 'begin isolation level repeatable read read only;\nselect pg_export_snapshot();\n' >&"${SNAPSHOT[1]}"
read -r snapshot <&"${SNAPSHOT[0]}"
[[ "$snapshot" =~ ^[0-9A-Fa-f-]+$ ]] || { echo "invalid backup snapshot"; exit 1; }
sudo -u postgres pg_dump "$DB_NAME" --snapshot="$snapshot" --format=custom --no-owner --no-privileges \
  "${args[@]}" > "$OUT/language-data.dump"

{
  for t in "${TABLES[@]}"; do
    printf '%s ' "$t"
    printf 'select count(*) from public.%s;\n' "$t" >&"${SNAPSHOT[1]}"
    read -r count <&"${SNAPSHOT[0]}"
    [[ "$count" =~ ^[0-9]+$ ]] || { echo "invalid row count"; exit 1; }
    printf '%s\n' "$count"
  done
} > "$OUT/counts.txt"
printf 'rollback;\n\\q\n' >&"${SNAPSHOT[1]}"
wait "$snapshot_pid"

APP=/opt/sv-translate/app
cp "$APP/routing.json" "$OUT/engine/"
[ -f /opt/sv-translate/models/MANIFEST ] && cp /opt/sv-translate/models/MANIFEST "$OUT/engine/"
sha256sum /opt/sv-translate/models/madlad400-3b-mt-ct2-int8/model.bin 2>/dev/null > "$OUT/engine/model.sha256" || true
docker inspect sv-translate --format '{{.Config.Image}}' > "$OUT/engine/image.txt" 2>/dev/null || true
cp /etc/nginx/conf.d/cloudflare-realip.conf "$OUT/engine/" 2>/dev/null || true

(cd "$OUT" && find . -type f ! -name SHA256SUMS -print0 | xargs -0 sha256sum > SHA256SUMS)
chmod -R go-rwx "$OUT"

while IFS= read -r stale; do
  [[ "$(basename "$stale")" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || continue
  for name in language-data.dump counts.txt SHA256SUMS; do rm -f -- "$stale/$name"; done
  for name in routing.json MANIFEST model.sha256 image.txt cloudflare-realip.conf; do rm -f -- "$stale/engine/$name"; done
  rmdir -- "$stale/engine" "$stale" || echo "retention left unexpected files untouched: $stale"
done < <(find "$ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +"$KEEP_DAYS")
echo "$(date -u +%FT%TZ) backup $OUT ok: $(tr '\n' ' ' < "$OUT/counts.txt")"
