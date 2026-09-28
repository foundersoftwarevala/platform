#!/usr/bin/env bash
# Keeps the containers the platform depends on running.
#
# Written after the Hostinger upgrade to KVM 4 on 28 September 2026. Hostinger
# applied the new CPU and memory by rebooting the machine, and the reboot is
# what exposed this: sv-postgrest exited 255 and did not come back, while
# sv-translate and libretranslate did. Every container here carries
# --restart unless-stopped, so Docker should have restarted it; PostgREST needs
# PostgreSQL to be accepting connections when it starts, and on a cold boot it
# is not always there yet, so PostgREST gives up and Docker honours that.
#
# The site stayed up and kept answering 200, which is what made it dangerous:
# the data layer was gone, the marketplace rendered about a hundred kilobytes
# short, and nothing reported a fault. The existing guards watch HTTP; nothing
# watched the containers.
#
# It only ever STARTS a container that is present and not running. It never
# stops one, never removes one, never creates one, and never touches a
# container that an operator has deliberately stopped and removed from this
# list. A container that is missing entirely is reported, not recreated —
# recreating one would need its full run arguments, which belong to its own
# deploy script.
#
# Install (as root):
#   install -m 755 sv-container-guard.sh /usr/local/bin/sv-container-guard.sh
#   ( crontab -l; echo '*/5 * * * * /usr/local/bin/sv-container-guard.sh' ) | crontab -

set -uo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

REQUIRED="sv-postgrest sv-translate libretranslate"
LOG="/var/log/sv-container-guard.log"

log() { echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') $*" >> "$LOG"; }

command -v docker >/dev/null 2>&1 || { log "FATAL docker is not on PATH"; exit 1; }

started=0
missing=0
running=0

for name in $REQUIRED; do
  # Present at all? `docker inspect` is the question; `docker ps` only answers
  # for the ones already running.
  if ! docker inspect "$name" >/dev/null 2>&1; then
    log "MISSING $name does not exist on this host - its own deploy script owns it"
    missing=$((missing + 1))
    continue
  fi

  state=$(docker inspect --format '{{.State.Status}}' "$name" 2>/dev/null)
  if [ "$state" = "running" ]; then
    running=$((running + 1))
    continue
  fi

  code=$(docker inspect --format '{{.State.ExitCode}}' "$name" 2>/dev/null)
  log "DOWN $name is $state (exit $code) - starting it"
  if docker start "$name" >/dev/null 2>&1; then
    # Give it a moment and say whether it actually held.
    sleep 5
    after=$(docker inspect --format '{{.State.Status}}' "$name" 2>/dev/null)
    if [ "$after" = "running" ]; then
      log "RECOVERED $name is running again"
      started=$((started + 1))
    else
      log "FAILED $name is $after after a start attempt - needs a person"
    fi
  else
    log "FAILED $name could not be started - needs a person"
  fi
done

# ---------------------------------------------------------------------------
# The other thing that reboot broke, and that nothing shouted about.
# ---------------------------------------------------------------------------
# pm2 resurrected the application from a dump saved on 25 September, and that
# dump carried SUPABASE_URL pointed at the hosted Supabase project together
# with the hosted secret. The site kept answering 200 and looked entirely
# healthy; it was reading a different database, and the marketplace rendered a
# hundred kilobytes short with a whole product row absent.
#
# It is only reported here, never corrected: the URL and the key have to match
# each other, and guessing at half a pair is how an outage gets made worse.
# sv-app-env.sh already refuses to run a scheduled job against the wrong
# backend, so the data jobs fail closed - but nothing said so out loud.
check_app_backend() {
  local pid url
  pid=$(pm2 pid "${SV_PM2_NAME:-softwarevala-staging}" 2>/dev/null | tr -cd '0-9')
  [ -n "${pid:-}" ] && [ -r "/proc/$pid/environ" ] || {
    log "WRONG-BACKEND cannot read the application's environment to check it"
    return
  }
  url=$(tr '\0' '\n' < "/proc/$pid/environ" | sed -n 's/^SUPABASE_URL=//p' | head -1)
  case "$url" in
    *127.0.0.1:3010*|*localhost:3010*) ;;
    "") log "WRONG-BACKEND the application has no SUPABASE_URL at all" ;;
    *)  log "WRONG-BACKEND the application is pointed at $url, not the VPS gateway - it is reading the wrong database; restart it with the matched pair from /var/www/softwarevala/.env and run pm2 save" ;;
  esac
}

check_app_backend

# A quiet line every run, so the log shows the guard is alive rather than only
# showing the days something broke.
log "checked ${REQUIRED// /, }: $running running, $started restarted, $missing missing"

exit 0
