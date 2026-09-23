#!/usr/bin/env bash
# One entry point for operating the live marketplace: the server, the database,
# the CDN and the repository.
#
# Everything here reads its credentials from `.env.ops` (git-ignored) and passes
# them to the tool that needs them. No credential is written into this file, and
# no command here does anything a person could not do by hand - it exists so the
# commands are the same every time and so a deploy cannot skip its own check.
#
#   scripts/ops/sv.sh help
#
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ROOT/.env.ops"

if [ ! -f "$ENV_FILE" ]; then
  echo "No .env.ops. Copy scripts/ops/env.example to .env.ops and fill it in." >&2
  exit 2
fi
# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a

SV_SITE="${SV_SITE:-https://softwarevala.net}"
SSH_KEY_PATH="$(eval echo "${SV_SSH_KEY:-$HOME/.ssh/softwarevala_ops}")"

die()  { echo "error: $*" >&2; exit 1; }
need() { [ -n "${!1:-}" ] || die "$1 is not set in .env.ops"; }

# Key-based, never interactive: a command that would sit waiting for a password
# hangs a script instead of failing it.
sv_ssh() {
  need SV_SSH_HOST
  [ -f "$SSH_KEY_PATH" ] || die "no key at $SSH_KEY_PATH - run scripts/ops/bootstrap-ssh.sh"
  ssh -i "$SSH_KEY_PATH" \
      -o BatchMode=yes -o StrictHostKeyChecking=accept-new \
      -o ConnectTimeout=15 \
      "$SV_SSH_HOST" "$@"
}

case "${1:-help}" in

# ----------------------------------------------------------------- the server
ssh)
  shift
  [ $# -gt 0 ] || die "usage: sv.sh ssh '<command>'"
  sv_ssh "$@"
  ;;

logs)
  sv_ssh "pm2 logs ${SV_PM2_NAME:-softwarevala-staging} --lines ${2:-200} --nostream"
  ;;

status)
  sv_ssh "pm2 jlist | python3 -c \"import sys,json;[print(p['name'], p['pm2_env']['status'], 'restarts='+str(p['pm2_env']['restart_time']), 'uptime='+str(p['pm2_env'].get('pm_uptime'))) for p in json.load(sys.stdin)]\"; echo; df -h / | tail -1; free -m | head -2"
  ;;

# What is actually on disk where the build is served from. This is the question
# that was unanswerable while the eight chunks were answering 500.
assets-on-disk)
  sv_ssh "cd ${SV_APP_DIR:-/var/www/softwarevala}/.output/public/assets 2>/dev/null || exit 1;
          echo \"files: \$(ls -1 | wc -l)\";
          echo '--- zero-byte or unreadable ---';
          find . -maxdepth 1 -type f \\( -size 0 -o ! -readable \\) -printf '%s %M %p\\n' | head -40;
          echo '--- newest five ---'; ls -lat | head -6"
  ;;

# ----------------------------------------------------------------- deploying
# Build, then check, then restart, then check again. The build happens before
# anything is swapped in, and the previous build is kept so a failed check can
# be put back.
deploy)
  need SV_SSH_HOST
  echo "==> pulling and building on the server"
  sv_ssh "set -e
    cd ${SV_APP_DIR:-/var/www/softwarevala}
    git fetch --all
    git checkout ${2:-main}
    git pull --ff-only
    rm -rf .output.prev && cp -a .output .output.prev 2>/dev/null || true
    rm -rf .output node_modules/.vite
    npm ci
    NITRO_PRESET=node-server npx vite build
    test -d .output/public/assets || { echo 'build produced no assets'; exit 1; }
    echo \"built \$(ls -1 .output/public/assets | wc -l) assets\"
  " || die "the build failed - nothing was restarted, the site is untouched"

  echo "==> restarting"
  sv_ssh "pm2 restart ${SV_PM2_NAME:-softwarevala-staging} --update-env && sleep 4 && pm2 describe ${SV_PM2_NAME:-softwarevala-staging} | grep -E 'status|restarts'"

  echo "==> checking the site it now serves"
  if "$ROOT/scripts/ops/verify-assets.sh" --origin; then
    echo "==> purging the CDN so visitors are served the new build"
    "$0" purge || echo "    (purge skipped - see the message above)"
  else
    echo
    echo "The new build does not serve its own assets. Putting the previous one back."
    sv_ssh "cd ${SV_APP_DIR:-/var/www/softwarevala} && rm -rf .output && mv .output.prev .output && pm2 restart ${SV_PM2_NAME:-softwarevala-staging}"
    die "rolled back"
  fi
  ;;

rollback)
  sv_ssh "cd ${SV_APP_DIR:-/var/www/softwarevala} && test -d .output.prev && rm -rf .output && mv .output.prev .output && pm2 restart ${SV_PM2_NAME:-softwarevala-staging}"
  "$ROOT/scripts/ops/verify-assets.sh" --origin
  ;;

# ---------------------------------------------------------------- the database
# Read-only questions go through PostgREST with the service key.
rpc)
  need SUPABASE_URL; need SUPABASE_SERVICE_ROLE_KEY
  [ -n "${2:-}" ] || die "usage: sv.sh rpc <function> ['<json args>']"
  curl -sS -X POST "$SUPABASE_URL/rest/v1/rpc/$2" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "${3:-{\}}"
  echo
  ;;

count)
  need SUPABASE_URL; need SUPABASE_SERVICE_ROLE_KEY
  [ -n "${2:-}" ] || die "usage: sv.sh count <table> [filter]"
  curl -sS -I "$SUPABASE_URL/rest/v1/$2?select=id${3:+&$3}" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Prefer: count=exact" -H "Range: 0-0" | grep -i content-range
  ;;

# Statements go through the Management API, which is the only route that can run
# SQL. PostgREST cannot, which is why a migration could not be applied from here
# before.
sql)
  need SUPABASE_ACCESS_TOKEN; need SUPABASE_PROJECT_REF
  [ -n "${2:-}" ] || die "usage: sv.sh sql '<statement>'   |   sv.sh sql --file <path>"
  if [ "$2" = "--file" ]; then
    [ -f "${3:-}" ] || die "no such file: ${3:-}"
    QUERY="$(cat "$3")"
  else
    QUERY="$2"
  fi
  # Encoded as JSON by python rather than by hand: a migration is full of
  # quotes, dollar-quoting and newlines.
  python3 -c 'import json,sys; print(json.dumps({"query": sys.stdin.read()}))' <<<"$QUERY" \
  | curl -sS -X POST "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query" \
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
      -H "Content-Type: application/json" --data-binary @-
  echo
  ;;

migrate)
  # Applies a migration file and nothing else. Named explicitly, so no run of
  # this command can apply a file the operator did not name.
  [ -n "${2:-}" ] || die "usage: sv.sh migrate supabase/migrations/<file>.sql"
  echo "==> applying $2"
  "$0" sql --file "$2"
  ;;

# ------------------------------------------------------------------- the CDN
cf)
  need CF_API_TOKEN; need CF_ZONE_ID
  curl -sS -X "${3:-GET}" "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/${2:-}" \
    -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
    ${4:+--data "$4"}
  echo
  ;;

purge)
  need CF_API_TOKEN; need CF_ZONE_ID
  # A purge is only safe while the server can still produce what is being
  # purged. It was not, and nobody could tell: the origin answered 500 for
  # eight of the home page's own chunks - the entry module among them - while
  # every visitor was served Cloudflare's cached copies and the site worked.
  # Purging in that state empties the only remaining copy and takes the whole
  # site down in one call. So the origin is asked first, every time.
  if [ "${2:-}" != "--force" ]; then
    echo "==> checking the server can serve what is about to be purged"
    if ! "$ROOT/scripts/ops/verify-assets.sh" --origin >/dev/null 2>&1; then
      echo
      "$ROOT/scripts/ops/verify-assets.sh" --origin | grep -E '^FAIL|^==>' || true
      echo
      die "the server cannot serve its own assets. Purging now would take the site down, because Cloudflare's cached copies are what visitors are getting. Fix the deploy first, or pass --force if you know better."
    fi
  fi
  out=$(curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
    -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
    --data '{"purge_everything":true}')
  echo "$out"
  grep -q '"success":true' <<<"$out" \
    || die "the purge was refused. CF_API_TOKEN is probably the Account ID rather than a token - see scripts/ops/env.example"
  ;;

# Is the CDN caching the home page, or is every visitor reaching the server?
cache-status)
  echo "page:  $(curl -sSI --compressed "$SV_SITE/" | grep -i 'cf-cache-status\|^cache-control' | tr -d '\r' | paste -sd' ' -)"
  a=$(curl -sS --compressed "$SV_SITE/" | grep -ao '"/assets/[A-Za-z0-9_.@-]*\.js"' | tr -d '"' | sort -u | head -1)
  echo "asset: $(curl -sSI --compressed "$SV_SITE$a" | grep -i 'cf-cache-status\|^cache-control' | tr -d '\r' | paste -sd' ' -)"
  ;;

# ------------------------------------------------------------ the repository
push)
  need GITHUB_TOKEN; need GITHUB_REPO
  branch="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD)"
  # Never to main, and never a force: this repository is connected to Lovable
  # and rewriting pushed history destroys the project history there.
  [ "$branch" != "main" ] || die "refusing to push straight to main - branch first"
  git -C "$ROOT" push "https://x-access-token:$GITHUB_TOKEN@github.com/$GITHUB_REPO.git" "$branch"
  ;;

pr)
  need GITHUB_TOKEN; need GITHUB_REPO
  branch="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD)"
  curl -sS -X POST "https://api.github.com/repos/$GITHUB_REPO/pulls" \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -d "$(python3 -c 'import json,sys; print(json.dumps({"title": sys.argv[1], "head": sys.argv[2], "base": "main", "body": sys.argv[3]}))' "${2:-$branch}" "$branch" "${3:-}")"
  echo
  ;;

# ----------------------------------------------------------------- checking
verify)  "$ROOT/scripts/ops/verify-assets.sh" "${@:2}" ;;
e2e)     (cd "$ROOT" && npx playwright test "${@:2}") ;;
build)   (cd "$ROOT" && npx tsc --noEmit && NITRO_PRESET=node-server npx vite build) ;;
check)   (cd "$ROOT" && npx tsc --noEmit) ;;

help|*)
  cat <<'USAGE'
sv.sh - operate the live marketplace

  server
    ssh '<cmd>'            run a command on the application host
    status                 pm2 state, disk, memory
    logs [lines]           application log
    assets-on-disk         what is really in .output/public/assets

  deploying
    deploy [branch]        pull, build, restart, verify, purge - rolls back if
                           the new build does not serve its own assets
    rollback               put the previous build back

  database
    rpc <fn> ['<json>']    call a Postgres function through PostgREST
    count <table> [filter] exact row count
    sql '<statement>'      run SQL through the Management API
    sql --file <path>      run a file
    migrate <path>         apply one migration file

  CDN
    cf <path> [METHOD] [body]   raw Cloudflare zone API
    purge                       purge everything
    cache-status                is the page being cached, or is every visitor
                                reaching the server

  repository
    push                   push the current branch (never main, never forced)
    pr [title] [body]      open a pull request against main

  checking
    verify [--origin|URL]  every asset the home page references
    e2e [args]             the browser tests
    check                  typecheck
    build                  typecheck and build
USAGE
  ;;
esac
