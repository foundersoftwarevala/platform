# Phase 16 — Production cutover to `sv_platform`

## Final outcome: deployed to `sv_platform` (2026-10-22)

**Deployment status: PASS for the requested app cutover and smoke checks.**
The VPS checkout is clean on `main` at
`35b9cac807d12fec2a841b6ed27491b609daeab0`. The selected 15 migration files
listed below were applied to `sv_platform` in one transaction ending in
`COMMIT`. The database named `softwarevala` was not queried or modified.

| Check | Verified result |
|---|---|
| Runtime direct-Postgres target | `VPS_DATABASE_URL` and `I18N_DATABASE_URL` resolve to local `sv_platform`; a direct identity query returned `sv_platform`. |
| Supabase Auth and Storage | Browser `VITE_SUPABASE_URL` is the hosted project. Auth `/health` and Storage `/status` returned HTTP 200 against Supabase; CORS preflight allowed the site origin. Server-side `SUPABASE_URL` remains the local PostgREST gateway. |
| Production build and deploy | `scripts/ops/sv-deploy.sh` passed its staged build, manifest check, locale/session smoke checks, and live homepage check. The latest rollback build is `/var/www/softwarevala/.output.prev-20261022-145817`. |
| Live app | `softwarevala-staging` is online in PM2 (PID `4061226`) and owns `127.0.0.1:3000`. Local and public homepage checks returned HTTP 200; the live Hindi language-pack route returned `source=vps-postgresql`, `count=4077`. |
| PM2 persistence | The PM2 startup dump was saved and its `VPS_DATABASE_URL` path was verified as `/sv_platform`. The unrelated language worker was not restarted. |
| Cron automation | Payment (hourly) and deadline (every 15 minutes) jobs are installed in root's crontab. Promise fines are **not installed**: `PROMISE_CRON_ACTOR_ID` is missing, and the database requires a real manager/finance actor for an auditable fine. |
| Protected configuration | `/var/www/softwarevala/.env` remains mode `0600`. Pre-change copies and the Vala AI snapshot are under `/root/sv-seo-backup/main-cutover-20261022T144535Z/`. |

The browser URL was changed from `https://softwarevala.net` to the hosted
Supabase project endpoint after public requests through the Cloudflare-proxied
site URL returned HTTP 403. Direct hosted Auth/Storage requests and the
site-origin CORS preflight returned HTTP 200. The Auth/Storage project and
public key were preserved.

### Migrations applied

These 15 reviewed files were applied atomically to `sv_platform`:

- `20261108T141000_server_agent_read_only_enrollment.sql`
- `20261108T143000_server_alert_delivery_outbox.sql`
- `20261108T144000_server_subscription_lifecycle_and_invoices.sql`
- `20261108T145200_marketplace_author_product_files.sql`
- `20261108T145300_audit_logs_truth_columns.sql`
- `20261108T145400_tasks_fresh.sql`
- `20261108T145500_tasks_notifications_deadlines.sql`
- `20261108T150000_developer_wallets.sql`
- `20261108T151000_task_promises.sql`
- `20261108T151100_task_promise_auto_fulfill.sql`
- `20261108T152000_assist_system_real.sql`
- `20261108T153000_chat_consent_cursor_hardening.sql`
- `20261108T154000_ams_core_real.sql`
- `20261108T155000_affiliate_dashboard_payouts.sql`
- `20261108T160000_lead_manager_assignment_security.sql`

The migration log is `/root/sv-platform-cutover-apply.log`; its final result
is `COMMIT`. The transaction also restored `service_role` DML on legacy
`tm_tasks` and `developer_tasks` for server compatibility. Read-only
privilege checks confirmed `authenticated` and `anon` cannot update
`tm_tasks`; RLS is enabled on `tasks` and `assist_signal_tickets`. The app's
`sv_app` connection successfully assumed `service_role` in a read-only task
transaction, matching the server implementation.

### Cron installation

The root crontab was preserved and extended with these two working entries:

```cron
0 * * * * umask 077; cd /var/www/softwarevala && /usr/bin/node --env-file=/var/www/softwarevala/.env scripts/payment-cron.mjs >> /var/log/payment-cron.log 2>&1
*/15 * * * * umask 077; cd /var/www/softwarevala && /usr/bin/node --env-file=/var/www/softwarevala/.env scripts/deadline-cron.mjs >> /var/log/deadline-cron.log 2>&1
```

`--env-file` supplies `VPS_DATABASE_URL` to Node; the shared cron DB helper
then forces the database path to `sv_platform`. The cron service is active.
Both log files are root-owned mode `0600`. The manual payment-script test
completed successfully against `sv_platform`: **0 tasks changed** (the
read-only preflight found zero eligible tasks, so no payment state was
modified). The deadline script was also run manually with the same Node
`.env` loading as cron and completed successfully. Its function uses an
advisory lock and only creates a warning/overdue audit event and notifications
when an eligible in-progress task is due; none were present in this check.
Crontab verification found exactly one payment entry and one
deadline entry, and confirmed all prior root crontab lines remain. The prior
crontab is backed up at
`/root/sv-seo-backup/main-cutover-20261022T144535Z/crontab.before-task-jobs`.

The promise/fine entry was deliberately **not** added. `scripts/promise-cron.mjs`
requires `PROMISE_CRON_ACTOR_ID`; no value is configured in
`/var/www/softwarevala/.env` or `/etc/softwarevala/task-cron.env` (the latter
does not exist). The database routine rejects missing actors and requires a
real manager or finance role, and its fine operation can debit a developer
wallet. A read-only role check found authorized manager/finance accounts but
no automation-named account; no human identity was guessed or used as a
system actor. The promise script was not manually run because its mandatory
actor precondition is missing. The read-only preflight found zero currently
overdue promises. Install this job only after the owner provisions and
authorizes a dedicated auditable manager/finance automation actor and
configures its UUID securely.

### Limits and unresolved compatibility

- This was a reviewed 15-file batch, **not** a verified application of every
  repository migration. The ledger is incomplete and still reports latest
  version `20261004181500`; no claim is made that all 390 repository files
  have been reconciled or applied.
- The canonical `tasks` and `assist_signal_tickets` tables exist, but each
  contains zero rows. Existing `tm_tasks` (30 rows) and `developer_tasks`
  (10 rows) were preserved and not copied into `tasks`; the legacy UI/data
  workflow was not fully exercised.
- Catalog checks found `affiliate_applications` and `affiliate_clicks`, but
  did not find relations named `affiliates`, `affiliate_referrals`, or
  `affiliate_payouts`. This deployment does not establish that the affiliate
  module's full requested data model is complete.
- `audit_logs` has 136 rows with `hash IS NULL`. The append-only and
  hash-chain triggers exist, but historical rows are not demonstrated to be
  tamper-evident.
- Payment and deadline cron jobs are installed; promise fines remain blocked
  on the missing approved actor described above. `/api/health` still returns
  404. The homepage, language route, and Auth/Storage endpoints passed; this
  is not an end-to-end acceptance of every authenticated business workflow.
- The production build passed. TypeScript and ESLint were not rerun because no
  repository source code changed in this deployment step.

Backup evidence:

- PostgreSQL pre-migration dump:
  `/var/lib/postgresql/sv-platform-backups/cutover-20261022T144318Z/sv_platform.dump`
  (SHA-256 `5c36bda747cfb55d90227fbd12dfc67c72ddbc292fd904631200d9d0e3074f74`).
- Vala AI SQLite backup:
  `/var/lib/vala-ai/backups/vala-20261022T144535Z.db`
  (SHA-256 `aa9148b88fc5e9d2b82d79414f2b5fc05a521a5518e2289891c873c89baaec0d`).

## Pre-cutover assessment (historical)

The following section records checks made before the authorized migration and
deployment. Its “blocked / not performed” statements are historical and are
superseded by the final outcome above.

## Verified target, backup, and rehearsal

| Check | Result |
|---|---|
| Selected production database | `sv_platform` |
| PostgreSQL exposure | PASS — listens on loopback only (`127.0.0.1`, `::1`) |
| `sv_platform` backup | PASS — `/var/lib/postgresql/sv-platform-backups/phase16-20261022T124003Z/sv_platform.dump` |
| Backup integrity | PASS — `pg_restore --list` and full archive extraction succeeded |
| Backup permissions | PASS — owner `postgres:postgres`, mode `0600` |
| Backup SHA-256 | `7023a9f26ef3bdd3daf2c267b4efe25f56c5408e5282f6fae7673d0235bae0bc` |
| Migration rehearsal | PASS — all 54 repository migrations matching `20261108T*.sql` (from `090000_chat_customer_security.sql` through `160000_lead_manager_assignment_security.sql`) were replayed in filename order inside one rollback-only transaction. Standalone migration `BEGIN`/`COMMIT` lines were omitted from the rehearsal input so the outer transaction could roll back. PostgreSQL exited successfully and returned `ROLLBACK`. |
| Post-rehearsal state | PASS — `tasks`, `developer_wallets`, `task_promises`, `assist_signal_tickets`, `chat_user_consents`, `lead_activities`, and `audit_logs.hash` remain absent; the recorded migration maximum remains `20261004181500`. |
| SEO gate schema/data on target | PASS — `seo_indexing_decisions` and `seo_fingerprints` exist in `sv_platform` (catalog estimates approximately 14,819 and 103,586 rows). Data parity with the current direct-Postgres URL was not checked. |
| Assist schema on target | PARTIAL — base tables `assist_sessions`, `assist_session_requests`, `assist_approvals`, `assist_agents`, `assist_end_users`, and `assist_audit_logs` exist; `assist_signal_tickets` does not. |
| Staging database | NOT TOUCHED — no database query or write to `softwarevala` in this follow-up |

The rehearsal verifies SQL preconditions and transaction execution only. It
does not verify compatibility with the currently running application and is
not evidence that migrations have been applied. The remaining migration files
outside this `20261108T*.sql` series were not rehearsed as one batch.

### Migration reconciliation (read-only)

A second read-only name-based comparison checked files newer than
`sv_platform`'s latest recorded version (`20261004181500`) against the live
`sv_platform` catalog. It found **180 files** after that version and **15
files** with at least one table, view, function, index, or trigger name absent
from the catalog:

| Candidate file | Absent named objects (representative) |
|---|---|
| `20261108T141000_server_agent_read_only_enrollment.sql` | `server_agents`, `server_agent_enroll` |
| `20261108T143000_server_alert_delivery_outbox.sql` | `server_alert_deliveries`, `server_queue_alert_delivery` |
| `20261108T144000_server_subscription_lifecycle_and_invoices.sql` | `server_subscriptions`, subscription notifications, invoices |
| `20261108T145200_marketplace_author_product_files.sql` | product-file tables |
| `20261108T145300_audit_logs_truth_columns.sql` | audit guard/hash-chain functions and triggers |
| `20261108T145400_tasks_fresh.sql` | canonical `tasks` and write/audit functions |
| `20261108T145500_tasks_notifications_deadlines.sql` | task deadline notification functions |
| `20261108T150000_developer_wallets.sql` | developer wallet ledger tables |
| `20261108T151000_task_promises.sql` | `task_promises` and related functions |
| `20261108T151100_task_promise_auto_fulfill.sql` | promise-fulfillment function/trigger |
| `20261108T152000_assist_system_real.sql` | Assist logs, signal tickets, and controls |
| `20261108T153000_chat_consent_cursor_hardening.sql` | consent table and chat hardening functions |
| `20261108T154000_ams_core_real.sql` | XP audit function and leaderboard index |
| `20261108T155000_affiliate_dashboard_payouts.sql` | affiliate dashboard/payout functions |
| `20261108T160000_lead_manager_assignment_security.sql` | `lead_activities` and manager functions |

These 15 are **candidates requiring review, not a verified pending-migration
list**. The scan compares object names only; it cannot detect data migrations,
changed function definitions, policy/grant differences, constraints, or
behavioral conflicts. A lexical scan also found statements that can mutate
data, replace functions, drop objects, or alter policies in 152 of the 180
later files. The 165 files whose named objects exist are not thereby certified
applied. No migration was selected or applied based on this scan.

## Application and schema compatibility

| Check | Result |
|---|---|
| Running application checkout | `/var/www/softwarevala`, branch `feature/marketplace-fixes`, commit `2141073`; worktree clean |
| Online PM2 processes | `softwarevala-staging` (`/var/www/softwarevala`) and `softwarevala-lang-staging` (`/var/www/sv-phase1-check`) |
| API modules in deployed checkout | LEGACY / compatibility NOT VERIFIED — requested `core.server.ts` entry points are missing; older `ams/*.functions.ts`, `affiliate/core.ts`, and `lead-manager/api.ts` modules are present. Their compatibility with the current migration contracts was not established. |
| Current direct database routing | Previously inspected PM2 configuration has `VPS_DATABASE_URL` targeting `softwarevala`; `I18N_DATABASE_URL`/`SV_PLATFORM_DATABASE_URL` target `sv_platform`. No values were changed. |
| SEO gate / Assist dependency | NOT READY for cutover. The SEO server selects its database through `VPS_DATABASE_URL`; its two tables exist in `sv_platform`, but data parity against the current direct-Postgres target was not checked. Assist signaling targets `sv_platform`; its base tables exist, but `assist_signal_tickets` is currently absent. |
| Legacy task records | Present in `developer_tasks` (10 rows; all 10 link to `tm_tasks`) and `tm_tasks` (30 rows). Statuses include accepted/completed and, on `tm_tasks`, ai_review/approved. The canonical task migration creates `tasks` but does not copy those records, then revokes writes to the legacy tables. No mapping was inferred or performed. |
| Migration tracking | Incomplete — `sv_platform` has 101 recorded versions, latest `20261004181500`; repository has 390 migration files. A bounded name-based comparison found 15 candidate files among 180 later files, but cannot establish a safe pending queue by itself. |
| Production deployment | NOT PERFORMED — local `main` includes the Vala AI rebuild, whose deployment prerequisites and separate authorization remain in force. |

`/rest/v1` already routes through the local PostgREST gateway targeting
`sv_platform`; `/auth/v1` and `/storage/v1` route to the hosted Supabase
project. This routing was not changed.

## Cron, build, and network status

- No cron entries were installed or changed.
- The requested `payment-cron.mjs`, `deadline-cron.mjs`, and
  `promise-cron.mjs` scripts are absent from the deployed checkout; no such
  jobs were enabled.
- No package installation, build, application start/restart, or deployment
  occurred.
- Existing host preflight: Ubuntu 24.04; Node.js v22, npm 10, PostgreSQL client
  17, PM2 7; UFW active with SSH/HTTP/HTTPS allowed and PostgreSQL not publicly
  exposed.
- `/api/health` returned 404 in the earlier preflight; a passing health
  endpoint remains NOT VERIFIED.

## Required decisions before cutover

1. Decide how the 40 existing legacy task rows are to remain usable: either
   authorize a reviewed, non-destructive mapping into canonical `tasks` before
   legacy writes are revoked, or defer the canonical task migration and retain
   the existing task workflow. No rows were copied or changed.
2. Verify the legacy AMS/Affiliate/Lead API modules against the migration
   contracts, then deploy a compatible scoped release before applying
   restrictive RLS changes; do not deploy local `main` until the Vala AI
   setup and backup prerequisites are satisfied.
3. Confirm the deployment's approved source and parity plan for the direct-
   PostgreSQL modules before changing `VPS_DATABASE_URL`. This follow-up
   verified the SEO gate tables exist on `sv_platform` but did not compare
   their data with another database. Assist signaling remains blocked until
   its migration and a compatible application release are deployed.
4. After decisions 1–3, reconcile the remaining migrations against the live
   schema, verify a fresh backup, apply only the reviewed pending migrations
   transactionally, then update the application configuration and verify
   authenticated application behavior.
5. Create cron jobs only after their scripts, schema prerequisites, actor
   identity, environment, logging, and rollback are verified.

## Errors and validation

- No migration execution errors occurred during the rollback-only rehearsal.
- The `psql` rehearsal exited 0 and explicitly rolled back. Targeted catalog
  checks confirmed the rehearsed objects were not persisted.
- Typecheck and ESLint were not run because no source code changed.
- No migration, environment, cron, build, deployment, or service restart is
  reported as passed.
