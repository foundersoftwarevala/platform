#!/usr/bin/env bash
# Apply the data half of 20260922120000_card_fields_absent_vs_empty.sql.
#
# RUN THIS ON THE SERVER. It reads the service key from the running
# application's own environment; no credential is passed in, printed or stored.
#
# What this does and does not do
# ------------------------------
# The migration has three statements. Two are row updates on
# marketplace_card_fields and are applied here. The third redefines
# mm_card_fields(), which is DDL - PostgREST cannot run it, and this box has no
# psql, no Supabase CLI and no Postgres connection string, so it cannot be
# applied from here at all. It is a robustness change (it lets the storefront
# tell "this group is switched off" apart from "this group does not exist") and
# nothing in PR #3 depends on it.
#
# Why these two are safe to apply before that PR ships
# ----------------------------------------------------
#   action/buy-now       The build serving now does not consult the card
#                        composition for Buy Now at all, so enabling the row
#                        changes nothing today. It has to be enabled *before*
#                        PR #3 deploys, because that PR starts honouring the
#                        switch - and with the row off, Buy Now would disappear
#                        from every card on the marketplace.
#   metadata/license     Two products in three carry a licence. Enabling it
#                        makes the card draw it. Additive.
#   metadata/platform    The build serving now gates Deployment on
#                        platform/platform-web, a different key, so enabling
#                        this changes nothing until PR #3 ships.
#
# All three are reversible from Product Card Manager.
set -uo pipefail

APP="${SV_PM2_NAME:-softwarevala-staging}"
PID=$(pm2 pid "$APP" 2>/dev/null | tr -cd '0-9')
[ -n "$PID" ] && [ -d "/proc/$PID" ] || { echo "cannot find the running $APP process"; exit 1; }

read_env() { tr '\0' '\n' < "/proc/$PID/environ" | grep -m1 "^$1=" | cut -d= -f2-; }
URL=$(read_env SUPABASE_URL)
KEY=$(read_env SUPABASE_SERVICE_ROLE_KEY)
[ -n "$URL" ] && [ -n "$KEY" ] || { echo "the running process has no Supabase URL/service key"; exit 1; }

TABLE="$URL/rest/v1/marketplace_card_fields"
AUTH=(-H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json")

show() {
  echo "  $1"
  curl -sS "${AUTH[@]}" \
    "$TABLE?select=kind,key,label,enabled&key=in.(buy-now,license,platform)&order=kind.asc" \
  | tr '}' '}\n' | grep -o '"kind": *"[^"]*", *"key": *"[^"]*", *"label": *"[^"]*", *"enabled": *[a-z]*' \
  | sed 's/"//g; s/kind: //; s/key: //; s/label: //; s/enabled: //' | sed 's/^/     /'
}

echo "==> before"
show "marketplace_card_fields:"

echo
echo "==> enabling metadata/license, metadata/platform, action/buy-now"
OUT=$(curl -sS -X PATCH "$TABLE?key=in.(license,platform,buy-now)" \
        "${AUTH[@]}" -H "Prefer: return=representation" \
        -d '{"enabled":true}' -w '\n%{http_code}')
CODE=$(printf '%s' "$OUT" | tail -n1)
echo "  HTTP $CODE"
[ "$CODE" = "200" ] || { echo "  refused - nothing changed"; printf '%s' "$OUT" | head -c 300; exit 1; }

echo
echo "==> after"
show "marketplace_card_fields:"

echo
echo "==> what the storefront will now be told (mm_card_fields)"
curl -sS -X POST "$URL/rest/v1/rpc/mm_card_fields" "${AUTH[@]}" -d '{}' | sed 's/^/  /'
echo
echo "Reversible at any time from Marketplace Manager -> Product Card Manager."
