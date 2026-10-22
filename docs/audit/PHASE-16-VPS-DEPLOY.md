# Phase 16 — Production cutover to `sv_platform`

## Current outcome: blocked before production changes

The requested production target is confirmed as VPS database `sv_platform`;
Supabase remains in use for Authentication and Media/Storage. The database
backup and rollback-only migration rehearsal passed. **No migration, app
configuration, cron, build, deployment, restart, or production data change has
been made.** `softwarevala` was not queried or modified during this follow-up.

The cutover is not safe to complete yet: the currently running application is
an older release with legacy API modules whose compatibility with the latest
migration contracts is unverified, and the task migration makes legacy task
tables read-only without copying their existing rows. The SEO gate tables are
present in `sv_platform`, but their data parity with the currently configured
direct-Postgres target has not been verified. Assist signaling's required
`assist_signal_tickets` table is missing. Applying the security migrations or
changing the runtime target before those code/data dependencies are resolved
risks breaking live workflows.

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
