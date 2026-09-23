#!/usr/bin/env bash
# Install a key for the operator scripts, once.
#
# Run this yourself: it is the one step that needs the server password typed by
# a person. Everything afterwards uses the key, so no password is ever stored in
# a file, passed on a command line, or written into a log.
#
#   bash scripts/ops/bootstrap-ssh.sh
#
# It makes a key used for nothing else, so it can be revoked on its own by
# deleting its line from the server's authorized_keys without disturbing any
# other access.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ROOT/.env.ops"

# Runs with or without .env.ops. Installing the key is the first thing anybody
# does here, and needing to fill in a configuration file before you can even
# reach the server is a step in the wrong order.
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a; . "$ENV_FILE"; set +a
fi

KEY="$(eval echo "${SV_SSH_KEY:-$HOME/.ssh/softwarevala_ops}")"
HOST="${SV_SSH_HOST:-${1:-root@77.37.121.112}}"

mkdir -p "$(dirname "$KEY")"
chmod 700 "$(dirname "$KEY")"

if [ -f "$KEY" ]; then
  echo "Using the key already at $KEY"
else
  echo "==> making a key for these scripts only"
  ssh-keygen -t ed25519 -N '' -C "softwarevala-ops@$(hostname)" -f "$KEY"
fi

echo
echo "==> installing the public key on $HOST"
echo "    You will be asked for the server password once. Nothing records it."
echo

# ssh-copy-id is not on Windows. Appending the key over a single session is the
# same thing, and it will not add a duplicate if the key is already there.
PUB="$(cat "$KEY.pub")"
ssh -o StrictHostKeyChecking=accept-new "$HOST" \
  "umask 077; mkdir -p ~/.ssh; touch ~/.ssh/authorized_keys; \
   grep -qxF '$PUB' ~/.ssh/authorized_keys || echo '$PUB' >> ~/.ssh/authorized_keys; \
   echo 'installed'"

echo
echo "==> checking that the key works without a password"
if ssh -i "$KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new "$HOST" \
     'echo "connected as $(whoami) on $(hostname)"; node --version 2>/dev/null || echo "node: not on PATH"'; then
  echo
  echo "Done. scripts/ops/sv.sh can now reach the server."
  echo
  echo "Now change the password you typed: it has been in a chat window."
  echo "  ssh $HOST 'passwd'"
else
  echo "The key did not work. Check that the server allows public key authentication:"
  echo "  grep -E 'PubkeyAuthentication|PasswordAuthentication' /etc/ssh/sshd_config"
  exit 1
fi
