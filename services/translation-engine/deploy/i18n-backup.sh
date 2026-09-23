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
# and keeps 14 days. The schema also lives in supabase/migrations and the
# engine in the repository; models are re-downloaded (pinned) by
# deploy/install-models.sh. Secrets (/etc/sv-translate.env) are not copied.
#
# Restore: see services/translation-engine/README.md, "Backup and recovery".
#
# Needs DB_HOST and DB_PASSWORD in /etc/sv-i18n-backup.env (mode 600).
set -euo pipefail

. /etc/sv-i18n-backup.env
DB_HOST=${DB_HOST:?} DB_PASSWORD=${DB_PASSWORD:?}
ROOT=/root/backups/i18n
DAY=$(date -u +%F)
OUT="$ROOT/$DAY"
KEEP_DAYS=${KEEP_DAYS:-14}
TABLES=(i18n_languages marketplace_translations i18n_glossary_terms i18n_translation_revisions i18n_translation_jobs)
mkdir -p "$OUT/engine"
chmod 700 "$ROOT"

pg() { # runs a postgres 17 client container on the host network
  docker run --rm -i --network host -e PGPASSWORD="$DB_PASSWORD" -v "$OUT:/out" postgres:17-alpine "$@"
}
CONN="host=$DB_HOST port=5432 user=postgres dbname=postgres sslmode=require connect_timeout=20"

args=()
for t in "${TABLES[@]}"; do args+=(--table="public.$t"); done
pg pg_dump "$CONN" --format=custom --no-owner --no-privileges "${args[@]}" --file=/out/language-data.dump

{
  for t in "${TABLES[@]}"; do
    printf '%s ' "$t"
    pg psql "$CONN" -tA -c "select count(*) from public.$t"
  done
} > "$OUT/counts.txt"

APP=/opt/sv-translate/app
cp "$APP/routing.json" "$OUT/engine/"
[ -f /opt/sv-translate/models/MANIFEST ] && cp /opt/sv-translate/models/MANIFEST "$OUT/engine/"
sha256sum /opt/sv-translate/models/madlad400-3b-mt-ct2-int8/model.bin 2>/dev/null > "$OUT/engine/model.sha256" || true
docker inspect sv-translate --format '{{.Config.Image}}' > "$OUT/engine/image.txt" 2>/dev/null || true
cp /etc/nginx/conf.d/cloudflare-realip.conf "$OUT/engine/" 2>/dev/null || true

(cd "$OUT" && find . -type f ! -name SHA256SUMS -print0 | xargs -0 sha256sum > SHA256SUMS)
chmod -R go-rwx "$OUT"

find "$ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +"$KEEP_DAYS" -exec rm -rf {} +
echo "$(date -u +%FT%TZ) backup $OUT ok: $(tr '\n' ' ' < "$OUT/counts.txt")"
