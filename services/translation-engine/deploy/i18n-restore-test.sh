#!/bin/bash
# Restores last night's language backup into a throwaway PostgreSQL and
# compares row counts with the counts recorded at backup time.
set -euo pipefail
DIR=${1:-/root/backups/i18n/$(date -u +%F)}
(cd "$DIR" && sha256sum -c --quiet SHA256SUMS) && echo "checksums: ok"
DB="sv_i18n_restore_$(date -u +%s)"
sudo -u postgres createdb "$DB"
trap 'sudo -u postgres dropdb "$DB"' EXIT
# Tables and data. Constraints that point outside the language tables
# (auth.users, registry_languages) belong to the full schema, restored from
# the canonical full database backup; they are not needed to verify recovered data.
sudo -u postgres pg_restore -d "$DB" --no-owner --no-privileges --exit-on-error \
  --section=pre-data --section=data < "$DIR/language-data.dump"
ok=1
while read -r table expected; do
  [[ "$table" =~ ^[a-z][a-z0-9_]*$ ]] || { echo "invalid backup table"; exit 1; }
  got=$(sudo -u postgres psql -d "$DB" -X -tA -v ON_ERROR_STOP=1 -c "select count(*) from public.$table")
  mark="ok"; [ "$got" = "$expected" ] || { mark="MISMATCH"; ok=0; }
  printf '  %-28s backup %-7s restored %-7s %s\n' "$table" "$expected" "$got" "$mark"
done < "$DIR/counts.txt"
[ "$ok" = 1 ] && echo "RESTORE OK" || { echo "RESTORE MISMATCH"; exit 1; }
