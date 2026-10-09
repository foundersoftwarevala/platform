# Vala AI — Sandbox for acceptance checks (design, not implemented)

Status: **proposal awaiting approval**. Nothing in this document is built.

## Problem (audit finding, High)

Acceptance checks (`npm test`, `npx vitest`, `node check.mjs`) and `npm ci`/`npm install`
run the project's own code. Today they run as the same OS user as the platform server, with
a scrubbed environment but full filesystem and network access. On the VPS that user can read
`/var/www/softwarevala/.env` (Supabase service key, encryption key, provider credentials),
the Vala AI database, other projects' workspaces, and anything else the app user can read.

## Approach: one disposable container per check, as an unprivileged user

Docker is already installed on the VPS (the translation engine runs in it). Each check runs in
a fresh container that sees only that project's workspace.

| Control | Setting |
|---|---|
| Image | Pinned digest of an official `node:22-bookworm-slim` image, rebuilt deliberately, never `latest` |
| User | `--user 10001:10001` (no root inside), `--security-opt no-new-privileges`, `--cap-drop ALL` |
| Filesystem | Root filesystem `--read-only`; workspace bind-mounted at `/work` (read-write, this project only); `--tmpfs /tmp:rw,size=256m,noexec`; npm cache on a per-project tmpfs. Nothing else from the host is mounted: no app directory, no `.env`, no data directory, no Docker socket |
| Network | `--network none` for checks. Package installation is a separate, approval-gated step with network limited to the npm registry through an egress proxy allow-list; after install, checks run offline |
| Processes | `--pids-limit 256`, `--init` so the whole tree dies with the container |
| Memory / CPU | `--memory` and `--memory-swap` from settings (default 1 GB), `--cpus` (default 1.0) |
| Time | Existing `command_timeout_s`; on expiry `docker kill`, then `docker rm -f` |
| Output | Same output cap as today, captured from the container's stdout and stderr |
| Cleanup | `--rm`; a sweep removes any container labelled `vala-ai=1` older than the timeout |
| Environment | Only `CI=1`, `NO_COLOR=1`, `HOME=/tmp`; no host variables |

The agent's own file edits stay on the host, through the existing path guard (now symlink-safe).
Git operations stay on the host with fixed arguments.

Windows development machines without Docker: checks run as today and the UI labels them
"not sandboxed"; production refuses to run checks without the sandbox (`VALA_AI_SANDBOX=required`).

## Fallback if Docker is not acceptable

A dedicated `vala-runner` system user with no read access to `/var/www`, `/etc/sv-*`, or the
data directory; workspaces owned by that user; checks started with `systemd-run --uid=vala-runner
-p MemoryMax=… -p CPUQuota=… -p RuntimeMaxSec=… -p PrivateNetwork=yes -p ProtectSystem=strict
-p ReadWritePaths=<workspace>`. Weaker isolation than a container, no image to maintain.

## Security acceptance tests (must pass before production use)

1. A check that reads `/var/www/softwarevala/.env` (or any absolute host path) fails to read it.
2. A check that lists `/` sees only the container's filesystem.
3. A check that opens a socket to an external host fails (`--network none`).
4. A check that forks without limit is stopped by the pid limit; the server stays responsive.
5. A check that allocates beyond the memory limit is killed and recorded as failed.
6. A check that sleeps past the timeout is killed; no container remains afterwards.
7. A check cannot write outside `/work` or into `/work/.git` hooks that later run on the host
   (host git runs with `core.hooksPath=/dev/null`).
8. Two projects' checks running back to back cannot see each other's files.
9. The existing Vala AI suite and the browser end-to-end run pass with the sandbox on.

## What approval is needed for

- Running containers on the VPS (resource budget, image choice) or creating the system user.
- Network policy for package installation.
- Server access to build and test it (SSH is currently not available to this session).
