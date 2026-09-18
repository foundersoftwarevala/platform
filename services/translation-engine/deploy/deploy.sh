#!/bin/sh
# Builds, tests and (re)starts the translation engine container.
#
#   deploy.sh [--live-tests]
#
# Expects:
#   /etc/sv-translate.env   SVT_TOKEN=... (and optional SVT_* overrides), mode 600
#   $MODELS                 populated by install-models.sh
# The service listens on 127.0.0.1:5100 only.
set -eu

HERE="$(cd "$(dirname "$0")/.." && pwd)"
MODELS="${MODELS:-/opt/sv-translate/models}"
ENV_FILE="${ENV_FILE:-/etc/sv-translate.env}"
NETWORK="${NETWORK:-sv-translate}"
NAME="${NAME:-sv-translate}"
PORT="${PORT:-5100}"
CPUS="${CPUS:-1.5}"
MEMORY="${MEMORY:-5g}"
TAG="sv-translate:$(date +%Y%m%d%H%M%S)"

test -s "$ENV_FILE" || { echo "missing $ENV_FILE" >&2; exit 1; }
test -s "$MODELS/madlad400-3b-mt-ct2-int8/model.bin" || { echo "models missing; run install-models.sh" >&2; exit 1; }

docker network inspect "$NETWORK" >/dev/null 2>&1 || docker network create "$NETWORK" >/dev/null
# The self-hosted LibreTranslate container, when present, joins the same network.
if docker inspect libretranslate >/dev/null 2>&1; then
  docker network connect "$NETWORK" libretranslate 2>/dev/null || true
fi

docker build -q -t "$TAG" "$HERE"
docker run --rm "$TAG" python -m pytest -q -p no:cacheprovider tests --ignore=tests/test_live.py

if [ "${1:-}" = "--live-tests" ]; then
  mkdir -p "$HERE/reports"
  docker run --rm --network "$NETWORK" --cpus "$CPUS" --memory "$MEMORY" --env-file "$ENV_FILE" \
    -e SVT_LIVE=1 -e SVT_LIVE_REPORT=/reports/live-report.json \
    -v "$MODELS:/models:ro" -v "$HERE/reports:/reports" --user root \
    "$TAG" python -m pytest -q -p no:cacheprovider tests/test_live.py
fi

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" --restart unless-stopped \
  --network "$NETWORK" -p "127.0.0.1:$PORT:5100" \
  --cpus "$CPUS" --memory "$MEMORY" --memory-swap "$MEMORY" \
  --read-only --tmpfs /tmp --security-opt no-new-privileges --cap-drop ALL \
  --env-file "$ENV_FILE" -v "$MODELS:/models:ro" \
  --log-opt max-size=20m --log-opt max-file=5 \
  "$TAG" >/dev/null
docker tag "$TAG" sv-translate:current

echo "waiting for the model to load..."
i=0
until curl -fsS "http://127.0.0.1:$PORT/ready" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 90 ]; then
    docker logs --tail 50 "$NAME"
    echo "engine did not become ready" >&2
    exit 1
  fi
  sleep 2
done
curl -fsS "http://127.0.0.1:$PORT/ready"
echo
echo "deployed $TAG"
