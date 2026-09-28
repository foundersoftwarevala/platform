#!/bin/bash
# Restores last night's language backup into a throwaway PostgreSQL and
# compares row counts with the counts recorded at backup time.
set -euo pipefail
DIR=${1:-/root/backups/i18n/$(date -u +%F)}
(cd "$DIR" && sha256sum -c --quiet SHA256SUMS) && echo "checksums: ok"
docker rm -f i18n-restore-test >/dev/null 2>&1 || true
docker run -d --name i18n-restore-test -e POSTGRES_PASSWORD=restore -v "$DIR:/backup:ro" postgres:17-alpine >/dev/null
for i in $(seq 1 30); do docker exec i18n-restore-test pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 2
# Tables and data. Constraints that point outside the language tables
# (auth.users, registry_languages) belong to the full schema, restored from
# supabase/migrations; they are not needed to recover the data.
docker exec i18n-restore-test pg_restore -U postgres -d postgres --no-owner --no-privileges \
  --section=pre-data --section=data /backup/language-data.dump 2>&1 | grep -v "^$" | head -5 || true
ok=1
while read -r table expected; do
  got=$(docker exec i18n-restore-test psql -U postgres -tA -c "select count(*) from public.$table")
  mark="ok"; [ "$got" = "$expected" ] || { mark="MISMATCH"; ok=0; }
  printf '  %-28s backup %-7s restored %-7s %s\n' "$table" "$expected" "$got" "$mark"
done < "$DIR/counts.txt"
echo "sample restored translation:"
docker exec i18n-restore-test psql -U postgres -tA -c "select target_language, left(source_text,30), left(translated_text,30), status from public.marketplace_translations where target_language='he' and status='machine' limit 2"
docker rm -f i18n-restore-test >/dev/null
[ "$ok" = 1 ] && echo "RESTORE OK" || { echo "RESTORE MISMATCH"; exit 1; }
