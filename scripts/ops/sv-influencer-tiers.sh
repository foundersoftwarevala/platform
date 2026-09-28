#!/usr/bin/env bash
# Promote every influencer who has earned a higher tier.
#
# A tier that only moves when somebody remembers to look is not a programme, it
# is a promise. This runs the evaluation the database already holds, once an
# hour, so an influencer whose audience or sales crossed a threshold is on the
# higher rate before their next sale settles - and is told so, because the
# function raises a notice to them.
#
# It never demotes. Taking away a rate someone earned is a decision for the
# owner, not for a cron job.
#
#   0 * * * * /usr/local/bin/sv-influencer-tiers.sh >> /var/log/sv-influencer-tiers.log 2>&1
set -euo pipefail

APP_DIR="/var/www/softwarevala"
cd "$APP_DIR"

# The application's own environment is the authoritative copy of where the
# database is; this never carries its own idea of that.
# shellcheck disable=SC1091
set -a; . "$APP_DIR/.env"; set +a

URL="${SUPABASE_URL%/}"
KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

if [ -z "$URL" ] || [ -z "$KEY" ]; then
  echo "$(date -u +%FT%TZ) cannot run: the database is not configured in $APP_DIR/.env"
  exit 1
fi

RESULT="$(curl -fsS -X POST "$URL/rest/v1/rpc/influencer_tier_evaluate" \
  -H "apikey: $KEY" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{}' || echo '{"ok":false,"reason":"the call itself failed"}')"

echo "$(date -u +%FT%TZ) $RESULT"
