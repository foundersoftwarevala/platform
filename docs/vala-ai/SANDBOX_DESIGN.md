# Vala AI — Sandbox for acceptance checks

Status: sandbox implementation and approved infrastructure were verified on 2026-10-12.
The authorized scoped application deployment is live, and runtime Docker status is ready.

## Problem (audit finding, High)

Acceptance checks (`npm test`, `npx vitest`, `node check.mjs`) and `npm ci`/`npm install`
run the project's own code. Before isolation they ran as the same OS user as the platform server,
with a scrubbed environment but full filesystem and network access. On the VPS that user can read
`/var/www/softwarevala/.env` (Supabase service key, encryption key, provider credentials),
the Vala AI database, other projects' workspaces, and anything else the app user can read.

## Approach: one disposable container per check, as an unprivileged user

Docker is already installed on the VPS (the translation engine runs in it). Each check runs in
a fresh container that sees only that project's workspace.

| Control      | Setting                                                                                                                                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Image        | Pinned digest of an official `node:22-bookworm-slim` image, rebuilt deliberately, never `latest`                                                                                                                                                                                |
| User         | `--user 10001:10001` (no root inside), `--security-opt no-new-privileges`, `--cap-drop ALL`                                                                                                                                                                                     |
| Filesystem   | Root filesystem `--read-only`; workspace bind-mounted at `/work` (read-write, this project only); `--tmpfs /tmp:rw,size=256m,noexec`; npm cache on a per-project tmpfs. Nothing else from the host is mounted: no app directory, no `.env`, no data directory, no Docker socket |
| Network      | `--network none` for checks. Package installation is a separate, approval-gated step with network limited to the npm registry through an egress proxy allow-list; after install, checks run offline                                                                             |
| Processes    | `--pids-limit 256`, `--init` so the whole tree dies with the container                                                                                                                                                                                                          |
| Memory / CPU | `--memory` and `--memory-swap` from settings (default 1 GB), `--cpus` (default 1.0)                                                                                                                                                                                             |
| Time         | Existing `command_timeout_s`; on expiry `docker kill`, then `docker rm -f`                                                                                                                                                                                                      |
| Output       | Same output cap as today, captured from the container's stdout and stderr                                                                                                                                                                                                       |
| Cleanup      | `--rm`; a sweep removes any container labelled `vala-ai=1` older than the timeout                                                                                                                                                                                               |
| Environment  | Only `CI=1`, `NO_COLOR=1`, `HOME=/tmp`; no host variables                                                                                                                                                                                                                       |

The agent's own file edits stay on the host, through the existing path guard (now symlink-safe).
Git operations stay on the host with fixed arguments.

Windows development machines without Docker: checks run as today and the UI labels them
"not sandboxed"; production refuses to run checks without the sandbox (`VALA_AI_SANDBOX=docker`).

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

## Implementation status (2026-10-09)

Built and tested locally:

- `src/lib/vala-ai/sandbox.server.ts`: policy (`VALA_AI_SANDBOX=off|docker`, docker by default in
  production, `off` refused in production unless `VALA_AI_SANDBOX_ALLOW_OFF_IN_PRODUCTION=yes`),
  digest-pinned image required, non-root user required, the `docker run` arguments above, stale
  container sweep (every 10 minutes from the runner).
- Checks in docker mode run as `docker run … <image> <tokens>` (no shell), killed by container
  name at the timeout or on cancel. If Docker or the image is missing the check is **refused**
  (exit 126, reason in the evidence), never run on the host instead.
- Every evidence row records where it ran (`none`, `docker <image>`, `refused`); the UI shows it.
- Host git hardening (applies with or without the sandbox): hooks and fsmonitor off for every
  git call; external diff drivers and textconv off; git refuses to run in a workspace whose
  `.git/config` changed after Vala AI created it.
- Tests: `npx vitest run src/lib/vala-ai/sandbox.server.test.ts src/lib/vala-ai/git-hardening.server.test.ts`.

## Approved infrastructure verification (2026-10-12)

- Docker 29.1.3 is available. The approved Linux/amd64 image was pulled and exercised:
  `node:22-bookworm-slim@sha256:efd0ab5780c2d9ab1f0f869571a00d5edb17793bff4cce4a2792e3eb0ffc7562`
  (Node v22.23.3).
- Environment: `/etc/softwarevala/vala-ai.env`, root:root 0640; its eight approved keys are
  active in the application and persisted for PM2 startup.
- Numeric UID/GID 10001:10001 wrote and read the approved disposable bind-mounted workspace;
  the test file and directory were removed.
- Host-created projects keep their host owner for Git. In docker mode, Linux content
  directories use the configured sandbox GID with 2770 permissions; regular files use 0660,
  executable files 0770. New nested host writes are provisioned too. `.git` is excluded and
  remains a separate read-only container mount. Sharing checks opened descriptors for
  containment and refuses special files and hard links; it does not share private database
  or evidence trees. Linux file reads, writes and deletes hold parent directory descriptors,
  so container-writable ancestors cannot redirect operations outside the workspace.
  A non-root host must be authorized to provision the configured group.
- Private VPS validation passed all seven original container cases plus the positive
  host-created/nested-file write case. The PID test requires actual `EAGAIN` below 256 children
  without a timeout; the memory test requires exit 137 without a timeout.
- Targeted workspace/sandbox/backup/Git/RBAC suite: 51 passed. Full Linux non-provider suite:
  104 passed, zero failures, one deliberately skipped real-provider test. The Unix-space-path
  operator/viewer redaction defect found during preparation was fixed, with regression coverage
  for whitespace, nested JSON, unchanged owner visibility and relative file paths.
- Proof: `/root/sv-seo-backup/vala-ai-validation-20261012T161000Z/`.
- Exact scoped candidate verification repeated all eight real Docker cases. Additional
  acceptance removed a real stale labelled container, retained an unrelated sentinel, and
  refused an unpinned tag and a missing digest. Owner browser/system API reports Docker ready;
  acceptance left no containers behind. Release evidence:
  `/root/sv-seo-backup/vala-scoped-validation-20261012/`.

Application deployment/restart and read-only browser acceptance were separately authorized
and completed. Real provider acceptance and package-install network policy remain pending.
