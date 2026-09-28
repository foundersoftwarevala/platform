#!/usr/bin/env bash
# Keeps Vala TV in step with the business's YouTube channel.
#
# This is the "auto post" half: a film uploaded to youtube.com/@softwarevala
# appears on softwarevala.net by itself, without anybody remembering to copy it
# across. YouTube's per-channel Atom feed updates within a few minutes of an
# upload, so a quarter-hourly check is prompt without being noisy.
#
# The credentials come from the running application, never from a file on disk,
# because the two have drifted apart before and every scheduled job that read
# the file spent weeks writing to a database the application had stopped using.
# sv-app-env.sh refuses to run against anything but the VPS gateway.
#
# It only ever adds and refreshes. It never deletes a film, and it never
# touches one an operator created by hand.
#
# Install (as root):
#   install -m 755 sv-vala-tv-sync.sh /usr/local/bin/sv-vala-tv-sync.sh
#   install -m 644 vala-tv-youtube-sync.mjs /usr/local/lib/sv/vala-tv-youtube-sync.mjs
#   ( crontab -l; echo '*/15 * * * * /usr/local/bin/sv-vala-tv-sync.sh' ) | crontab -

set -uo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

LOG="/var/log/sv-vala-tv-sync.log"
SCRIPT="/usr/local/lib/sv/vala-tv-youtube-sync.mjs"

say() { echo "$(date -Is) $*" >> "$LOG"; }

# shellcheck disable=SC1091
. /usr/local/bin/sv-app-env.sh
sv_app_env "$LOG" || exit 1

[ -r "$SCRIPT" ] || { say "FATAL $SCRIPT is missing"; exit 1; }

out=$(node "$SCRIPT" --apply 2>&1)
status=$?

# One line in the log per run, carrying the numbers rather than the whole
# report, so a month of quarter-hourly runs stays readable.
summary=$(printf '%s\n' "$out" | grep -E '^(added|feed|FAILED)' | tr '\n' ' ')
if [ "$status" -eq 0 ]; then
  say "ok ${summary:-no summary printed}"
else
  say "FAILED ${summary:-see below}"
  printf '%s\n' "$out" | tail -20 >> "$LOG"
fi

exit "$status"
