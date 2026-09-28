#!/bin/bash
# SEO crawl of our own site. Records what is actually on each page and resolves
# issues it no longer finds. Needs no external provider.
#
# The environment comes from the running application, not from the .env file
# beside it. Those two disagree on this server: the file still names the hosted
# project the platform migrated off, and the running process points at the
# database the site actually uses. A crawl that read the file would write its
# findings into a database nobody reads, which is indistinguishable from not
# running at all.
#
# The file is still read first, so anything the process does not carry is
# picked up from it; the process wins where both have a value.
set -euo pipefail
cd /var/www/softwarevala || exit 1

set -a
# shellcheck disable=SC1091
[ -f ./.env ] && . ./.env
set +a

PID="$(pm2 pid softwarevala-staging 2>/dev/null | tr -cd "0-9")"
if [ -n "$PID" ] && [ -r "/proc/$PID/environ" ]; then
  while IFS= read -r -d "" item; do
    case "$item" in
      SUPABASE_URL=*|SUPABASE_SERVICE_ROLE_KEY=*|SITE_URL=*|APP_BASE_URL=*)
        export "${item?}"
        ;;
    esac
  done < "/proc/$PID/environ"
else
  echo "sv-seo-crawl: the application is not running; using .env as it stands" >&2
fi

export SEO_CRAWL_MAX="${SEO_CRAWL_MAX:-60}"
exec /usr/bin/python3 scripts/seo_crawler.py
