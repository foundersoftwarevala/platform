# Phase 10 — VPS deployment status

## Outcome: deployment blocked; no production writes made

No migration, cron entry, database test row, or Ollama request was run against
production. The current workspace does not provide a usable VPS configuration:
`.env.ops` is absent, `SV_SSH_HOST` and `VPS_DATABASE_URL` are unset, and
`psql` is not installed on this Windows workstation. The SSH private-key file
is present, but the corresponding host/configuration is not. Do not infer a
database target or select migrations from filename order alone.

The read-only [`migration-reconcile.mjs`](../../scripts/ops/migration-reconcile.mjs)
run completed once and returned this inventory: 386 migration files, zero
versions recorded in `supabase_migrations.schema_migrations`, 89 files whose
created objects all existed, and 297 files with one or more missing objects.
It reported the following relevant missing effects:

| Migration | Missing objects reported by reconciliation |
|---|---|
| `20261108T145300_audit_logs_truth_columns.sql` | `audit_logs_guard`, `audit_logs_hash_chain`, append-only and hash-chain triggers |
| `20261108T145400_tasks_fresh.sql` | `public.tasks`, task preparation/audit functions, indexes, and triggers |
| `20261108T145500_tasks_notifications_deadlines.sql` | task notification/deadline functions, indexes, and trigger; the base `notifications` relation was not listed as missing |
| `20261108T150000_developer_wallets.sql` | developer wallet and transaction tables, ledger/audit functions, indexes, and triggers |
| `20261108T151000_task_promises.sql` | `task_promises`, promise audit/break functions, indexes, and triggers |
| `20261108T151100_task_promise_auto_fulfill.sql` | promise fulfillment function and task trigger |
| `20261108T152000_assist_system_real.sql` | `assist_logs`, signaling tickets, consent/status functions, indexes, and triggers |

This is a preliminary observation, not authorization to apply those files.
The subsequent direct connectivity probe failed because `.env.ops` could not
be read. Treat the inventory as needing a fresh authenticated confirmation
before taking action. Migration history is not a reliable applied-status
source here; reconcile real schema, read each candidate migration in full,
check prerequisites/data preflights, prepare rollback, and dry-run
transactionally before applying. Stop on the first SQL error.

## VPS and database preflight

| Check | Result |
|---|---|
| Local `psql` | **MISSING** (`Get-Command psql` found no executable) |
| SSH executable | Present, but no configured host was available |
| `.env.ops` in workspace | **MISSING** |
| `SV_SSH_HOST` / `VPS_DATABASE_URL` in current environment | **MISSING** |
| Remote `psql` / production DB connectivity | **NOT VERIFIED** |
| Required table/column verification | **NOT RUN directly**; the read-only migration reconciliation reported missing effects above |

Commands and observed results:

```powershell
Get-Command ssh,psql,node,npm
# ssh, node, npm found; psql was not found (PowerShell reports it as missing)

Test-Path .env.ops
# False

node scripts/ops/migration-reconcile.mjs
# Completed once; inventory summarized above. Do not treat as a fresh
# connectivity check because the subsequent explicit read failed.

node scripts/ops/db.mjs --sql "select current_database(), current_setting('server_version')"
# Failed: ENOENT opening C:\Users\oooo\Desktop\founder\platform\.env.ops

node scripts/payment-cron.mjs
# Error: VPS_DATABASE_URL must be set for task cron jobs.

node scripts/deadline-cron.mjs
# Error: VPS_DATABASE_URL must be set for task cron jobs.

node scripts/promise-cron.mjs
# Error: PROMISE_CRON_ACTOR_ID must be a provisioned manager or finance user UUID.
```

No database migration was attempted, so no migration SQL failure occurred.

## Cron jobs

The three scripts exist locally:

- [`payment-cron.mjs`](../../scripts/payment-cron.mjs)
- [`deadline-cron.mjs`](../../scripts/deadline-cron.mjs)
- [`promise-cron.mjs`](../../scripts/promise-cron.mjs)

They require `VPS_DATABASE_URL`; the promise worker additionally requires
`PROMISE_CRON_ACTOR_ID` for a provisioned manager/finance account. The cron
scripts force the database name to `sv_platform` and use `service_role`.
Promise work calls the existing audited `break_task_promise` database
function; it must not be run until its actor has been verified.

Manual local prerequisite checks (these did not connect or write to a DB):

```powershell
node scripts/payment-cron.mjs
# Error: VPS_DATABASE_URL must be set for task cron jobs.

node scripts/deadline-cron.mjs
# Error: VPS_DATABASE_URL must be set for task cron jobs.

node scripts/promise-cron.mjs
# Error: PROMISE_CRON_ACTOR_ID must be a provisioned manager or finance user UUID.
```

`crontab -l` and server log files are **NOT VISIBLE / NOT PROVIDED**. No cron
line was installed, no cron output log was created or checked, and the
production environment-file location/permissions were not verified.

After verifying the production project path and creating a root-owned
`/etc/softwarevala/task-cron.env` (mode `0600`) containing the correct
`VPS_DATABASE_URL` and provisioned `PROMISE_CRON_ACTOR_ID`, candidate root
crontab entries are:

```cron
0 * * * * set -a; . /etc/softwarevala/task-cron.env; set +a; cd /var/www/softwarevala && /usr/bin/node scripts/payment-cron.mjs >> /var/log/payment-cron.log 2>&1
*/15 * * * * set -a; . /etc/softwarevala/task-cron.env; set +a; cd /var/www/softwarevala && /usr/bin/node scripts/deadline-cron.mjs >> /var/log/deadline-cron.log 2>&1
*/15 * * * * set -a; . /etc/softwarevala/task-cron.env; set +a; cd /var/www/softwarevala && /usr/bin/node scripts/promise-cron.mjs >> /var/log/promise-cron.log 2>&1
```

These are **not installed**. Confirm `/var/www/softwarevala` is the active
release and that it contains these scripts before installation. Confirm the
environment file is root-owned, mode `0600`, and never echo its contents.
The scripts' exact database URL source is `process.env.VPS_DATABASE_URL` in
[`task-cron-db.mjs`](../../scripts/task-cron-db.mjs). `sv-app-env.sh` does not
export that variable, so it is not a substitute for the protected cron
environment file without a verified change.

## Ayra / Ollama connectivity

The deployed-code requirement is now supported in code, but not deployed.
[`core.server.ts`](../../src/lib/ayra/core.server.ts) reads the Ollama endpoint
configuration through
[`ollama-endpoint.server.ts`](../../src/lib/ayra/ollama-endpoint.server.ts):

- `AYRA_OLLAMA_URL` may be an HTTPS endpoint/base URL or an HTTP loopback,
  RFC1918, or IPv6 ULA VPN address. Public HTTP, URL credentials, query/hash
  components, and redirects are rejected.
- Remote HTTPS requires both `AYRA_OLLAMA_ACCESS_CLIENT_ID` and
  `AYRA_OLLAMA_ACCESS_CLIENT_SECRET`, sent as Cloudflare Access headers.
  Configure an Access application/policy on the tunnel too; a Cloudflare
  Tunnel hostname alone is not proof that Ollama is access-controlled.
- `AYRA_OLLAMA_MODEL` must name an installed Ollama model that supports the
  tool-call format.

No Cloudflare Tunnel hostname, VPN address, Access credentials, or VPS
environment file was provided/visible. No tunnel was created, raw port 11434
was not opened, no `.env` was changed, and no `curl` request was sent. The VPS
to Ollama connection is **NOT VERIFIED**.

## Data safety and verification

- No database mutation or migration was performed.
- The requested test-task insert/delete was not performed: deletion is
  explicitly prohibited, and the required DB connection is unavailable.
- No production cron ran; the local checks stopped at missing environment
  prerequisites before opening a database connection.
- The Ollama secure-URL resolver has four passing focused tests:
  [`ollama-endpoint.server.test.ts`](../../src/lib/ayra/ollama-endpoint.server.test.ts).
  TypeScript and focused ESLint results are recorded below.
- No migrations applied, crontab output, log paths, or successful curl output
  can truthfully be reported.

## Code validation

The only code changes in this deployment attempt configure Ayra to use a
validated Ollama endpoint and optional Cloudflare Access headers; they do not
perform deployment or database operations.

| Check | Exact command | Result |
|---|---|---|
| TypeScript | `npx.cmd tsc --noEmit -p .` | **PASS**, exit code 0 |
| Focused tests | `npx.cmd vitest run src/lib/ayra/ollama-endpoint.server.test.ts` | **PASS**, 4/4 tests |
| Focused ESLint | `npx.cmd eslint src/lib/ayra/core.server.ts src/lib/ayra/ollama-endpoint.server.ts src/lib/ayra/ollama-endpoint.server.test.ts --rule 'prettier/prettier: off'` | **PASS**, exit code 0 |

The test runner printed an existing Vite `vite-tsconfig-paths` deprecation
notice; the focused tests still passed. No production endpoint was contacted.

## Failed / blocked work

1. Direct VPS DB probe: failed before connecting because workspace `.env.ops`
   is absent.
2. Payment and deadline manual cron checks: failed fast on missing
   `VPS_DATABASE_URL`; no DB session was opened.
3. Promise manual cron check: failed fast on missing
   `PROMISE_CRON_ACTOR_ID`; no DB session was opened.
4. VPS migration application, table checks, crontab installation/listing,
   cron log verification, and Ollama curl test: blocked by missing access
   configuration and secure tunnel endpoint.
5. The first migration reconciliation identified substantial missing schema;
   applying migrations without renewed access, preflight, rollback, and a
   dry-run would be unsafe.

## Rollback / follow-up commands

There is no production change to roll back. Once access is restored, use the
repo's approved read-only inventory first:

```powershell
node scripts/ops/migration-reconcile.mjs
```

Do not apply the whole migration directory. For each confirmed missing
migration, first inspect the full SQL and dependencies, prepare a rollback,
and dry-run inside `BEGIN; ... ROLLBACK;`. Only then apply one migration at a
time with `psql -v ON_ERROR_STOP=1` and stop on the first error. Before
crontab changes, save `crontab -l`, preserve all existing entries, then verify
the installed entries and run each job only after validating its environment.
Ollama must remain private or behind HTTPS plus Cloudflare Access; never open
port 11434 to the public internet.
