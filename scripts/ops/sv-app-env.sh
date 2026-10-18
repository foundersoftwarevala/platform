#!/usr/bin/env bash
#
# Where a scheduled job gets its credentials: the running application, not the
# file on disk.
#
# This exists because the two drifted apart and nothing looked wrong.
# rebuild-with-env.sh reads the running process's environment and says why in
# its own header — "the application's own environment is the authoritative
# copy" — so a deploy carries the right values forward whatever the file says.
# The file was left behind, and the scheduled jobs read the file. Four of them
# spent weeks writing runtime data to a database the application had stopped
# using, while every log line said the run had succeeded. The demo monitor is
# how it finally surfaced: it reported a healthy check every fifteen minutes
# while the VPS database's newest monitor row stayed at 25 September.
#
# There is only one copy of a process's environment, so reading it cannot
# drift.
#
# Usage, from a script run as root on the server:
#
#     . /usr/local/bin/sv-app-env.sh          # or scripts/ops/sv-app-env.sh
#     sv_app_env "$LOG" || exit 1
#     # SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are now set
#
# It writes the values into the caller's environment and prints nothing. A
# credential is never echoed, never written to a file, and never passed on a
# command line.

# Reads the application's environment into this shell.
#   $1  log file to record a refusal in (optional)
# Returns non-zero, having logged why, if the values cannot be trusted.
sv_app_env() {
  local log="${1:-/dev/null}"
  local app="${SV_PM2_NAME:-softwarevala-staging}"
  local pid line key value

  pid=$(pm2 pid "$app" 2>/dev/null | tr -cd '0-9')
  if [[ -z "${pid:-}" || ! -r "/proc/$pid/environ" ]]; then
    echo "$(date -Is) FATAL cannot read the environment of the running $app" >> "$log"
    return 1
  fi

  # Only what a scheduled job needs. Taking the whole environment would pull in
  # credentials for unrelated services for no reason.
  #
  # Read with read -d '' rather than $(cat ...): the file is null-separated, and
  # a command substitution drops null bytes, which bash warns about and which
  # would run every variable together into one.
  #
  # INTERNAL_API_TOKEN is here for the jobs that call the application through
  # its own guarded endpoints rather than talking to the database. It is not
  # required - a caller that needs it checks for itself - because most of these
  # jobs never touch it.
  while IFS= read -r -d '' line; do
    key=${line%%=*}
    value=${line#*=}
    case "$key" in
      SUPABASE_URL)              export SUPABASE_URL="$value" ;;
      SUPABASE_SERVICE_ROLE_KEY) export SUPABASE_SERVICE_ROLE_KEY="$value" ;;
      INTERNAL_API_TOKEN)        export INTERNAL_API_TOKEN="$value" ;;
    esac
  done < "/proc/$pid/environ"

  if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
    echo "$(date -Is) FATAL the running $app carries no database credentials" >> "$log"
    return 1
  fi

  # The gateway is the only correct target: the runtime tables live on the VPS
  # database behind it. A run pointed somewhere else would write real data to
  # the wrong place and report success, which is the failure this whole file
  # exists to prevent — so it is refused rather than logged and continued.
  case "$SUPABASE_URL" in
    *127.0.0.1:3010*|*localhost:3010*) ;;
    *)
      echo "$(date -Is) FATAL the application is not pointed at the VPS gateway; refusing to run against another backend" >> "$log"
      return 1
      ;;
  esac

  return 0
}
