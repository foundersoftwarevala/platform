#!/bin/bash
# Demo URL monitoring. Runs the real server-side health check over every active
# demo, writes the result, appends history and raises or clears alerts.
cd /var/www/softwarevala || exit 1
set -a; . ./.env; set +a
exec /usr/bin/python3 scripts/demo_monitor.py
