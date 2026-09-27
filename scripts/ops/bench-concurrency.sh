#!/usr/bin/env bash
# What the home page does as concurrency rises.
#
# Short bursts, not a load test. Each level fires N requests at once, waits for
# all of them, and reports the spread. It is deliberately small and brief: this
# is one uncached server render per request against a single Node process, and
# the point is to find where latency turns, not to see how hard it can be hit.
#
#   scripts/ops/bench-concurrency.sh [url] [levels...]
#   scripts/ops/bench-concurrency.sh https://softwarevala.net/ 1 10 50
set -uo pipefail

URL="${1:-https://softwarevala.net/}"
shift 2>/dev/null || true
LEVELS=("${@:-1 10 50}")
[ $# -eq 0 ] && LEVELS=(1 5 10 25 50)

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

printf "%-6s %-8s %-9s %-9s %-9s %-9s %s\n" "conc" "ok/total" "min" "median" "p90" "max" "non-200"
printf -- "------------------------------------------------------------------------\n"

for n in "${LEVELS[@]}"; do
  rm -f "$TMP"/*
  for i in $(seq 1 "$n"); do
    (
      out=$(curl -s -o /dev/null -m 60 --compressed \
            -w '%{http_code} %{time_starttransfer}' "$URL" 2>/dev/null)
      echo "$out" > "$TMP/$i"
    ) &
  done
  wait

  ok=0; bad=""
  : > "$TMP/times"
  for f in "$TMP"/[0-9]*; do
    [ -f "$f" ] || continue
    code=$(cut -d' ' -f1 "$f"); t=$(cut -d' ' -f2 "$f")
    if [ "$code" = "200" ]; then ok=$((ok+1)); echo "$t" >> "$TMP/times"
    else bad="$bad $code"; fi
  done

  if [ -s "$TMP/times" ]; then
    sort -n "$TMP/times" > "$TMP/sorted"
    c=$(wc -l < "$TMP/sorted")
    min=$(head -1 "$TMP/sorted")
    max=$(tail -1 "$TMP/sorted")
    med=$(sed -n "$(( (c+1)/2 ))p" "$TMP/sorted")
    p90=$(sed -n "$(( c*9/10 > 0 ? c*9/10 : 1 ))p" "$TMP/sorted")
  else
    min=-; max=-; med=-; p90=-
  fi

  printf "%-6s %-8s %-9s %-9s %-9s %-9s %s\n" \
    "$n" "$ok/$n" "${min}s" "${med}s" "${p90}s" "${max}s" "${bad:-none}"
  sleep 4   # let the origin settle between levels
done
