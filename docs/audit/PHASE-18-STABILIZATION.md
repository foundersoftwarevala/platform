# Phase 18 — Stabilization Audit

**Audit date:** 2026-10-22
**Production database:** VPS PostgreSQL `sv_platform`
**Production application:** `/var/www/softwarevala`, branch `feature/marketplace-fixes`, commit `214107336b5501e7fb3314bce0de3826b0468d4d`

## Scope and migration accounting

The production connection was verified without printing credentials:
`VPS_DATABASE_URL` resolves to host `127.0.0.1`, database `sv_platform`, and
`current_database()` returned `sv_platform`. No connection or migration was
made against the separate `softwarevala` database.

The repository contains 396 migration files; the production migration ledger
contains 101 rows, and 218 repository filenames are absent from that ledger.
Repository guidance says the ledger is incomplete, so absence from it is not
proof that a migration is unapplied. Live schema, policy, function, trigger,
and privilege state was checked instead. Three missing migrations were
preflighted inside rollback-only transactions and then applied individually
to `sv_platform`:

| Migration | Result | Live proof |
|---|---|---|
| [`20261108T142000_server_ai_insight_acknowledgement_only.sql`](../../supabase/migrations/20261108T142000_server_ai_insight_acknowledgement_only.sql) | **APPLIED** | Authenticated users retain `SELECT` and can update only `status`; the update policy permits only `acknowledged` or `dismissed`. The service role retains its server-side privileges. |
| [`20261108T161000_task_promise_fine_tiers.sql`](../../supabase/migrations/20261108T161000_task_promise_fine_tiers.sql) | **APPLIED** | `fine_percentage` defaults to 5; `fine_amount` is present. Read-only function checks returned 5%, 7%, and 10% for the first, second, and later breaks; a 10,000-cent task calculates 500, 700, and 1,000 cents. The break function records the fine transaction atomically with the promise change. No live promise was broken and no wallet was charged. |
| [`20261108T161100_sales_support_workspaces.sql`](../../supabase/migrations/20261108T161100_sales_support_workspaces.sql) | **APPLIED** | `sales_quotes` and `support_replies` now exist with their indexes. RLS is enabled on all five Sales/Support business tables. `authenticated` has no `INSERT`, `UPDATE`, or `DELETE` table privilege on them; scoped read policies and server-role write grants are present. Audit triggers are installed, and support replies reject updates/deletes. |

Three other candidates were **not reapplied** because their intended state was
already present:

- `20261108T145000_marketplace_public_read_requires_approval.sql`: both live
  public product-read policies already require approval and published/valid
  scheduling fields.
- `20261108T145100_marketplace_products_server_write_only.sql`: both
  owner-write policies this migration removes were already absent.
- `20261108T160000_lead_manager_assignment_security.sql`: the assigned-user
  column, lead activity table, scoped policies, manager helper, server
  functions, and append-only activity trigger were already present.

The required core relations were verified on `sv_platform`: `leads`, `tasks`,
`chat_messages`, `support_tickets`, and `sales_deals`.

## Sales & Support and Bidding code audit

The active workspace implementation in local `main` at `e76377c8` has routes
[`dashboard.sales.tsx`](../../src/routes/dashboard.sales.tsx) and
[`dashboard.support.tsx`](../../src/routes/dashboard.support.tsx), which render
[`SalesWorkspace.tsx`](../../src/components/sales-support/SalesWorkspace.tsx)
and
[`SupportWorkspace.tsx`](../../src/components/sales-support/SupportWorkspace.tsx).
The forms and controls call server functions in
[`core.functions.ts`](../../src/lib/sales-support/core.functions.ts):

- Sales: `getSalesWorkspace`, `createDeal`, `updateDealStage`, `createQuote`,
  and manager-only team linking.
- Support: `getSupportWorkspace`, `createTicket`, `replyToTicket`,
  `assignTicket`, and manager-only team linking/assignment.
- Workspace reads show loading and error states; mutations refresh the query,
  and mutation failures render an alert. Lead rows are read-only in the Sales
  workspace; lead creation/assignment is not claimed here.
- Server functions verify the bearer-token user and required role before
  entering `withTaskTransaction`, which sets the verified actor and uses the
  service role server-side. No browser-side database write is used by these
  workspace forms.

Focused checks passed: **16 tests across 3 files** and scoped ESLint for the
active workspace, server functions, and routes.

**Production visibility limitation:** production remains on
`feature/marketplace-fixes` at `2141073`; it is not on local `main` and does
not contain these Sales/Support workspace routes. The production homepage
being healthy does not prove that the Sales/Support pages are deployed or
authenticated live. Deploying full `main` was intentionally avoided because
the repository's production notes require separate Vala AI setup/approval
before a `main` deployment.

**Bidding is MISSING:** no Bidding dashboard route, bid UI component, or
`createBid`/`submitBid`/`placeBid` server function was found in `src/routes`,
`src/components`, or `src/lib`. No Bidding feature was added under this
stabilization-only scope.

The active workspaces contain no “Coming Soon” action or `toast.info` fake
button. Separate legacy modules under
`src/components/sales-support/modules` do contain simulated toast actions;
their parent `components/salespages/SalesSupportDashboard.tsx` has no route
import and is referenced only by its test. They are not the active workspace
routes and were not represented as live functionality.

## Notification configuration

Presence was checked on the VPS without exposing values:

| Variable | Presence | Meaning |
|---|---|---|
| `RESEND_API_KEY` | Set | Resend is the configured provider according to `mailer.ts`. |
| `MAIL_FROM` | Set | Sender identity is configured. |
| `SMTP_RELAY_URL` | Missing | Required only to use the SMTP HTTP relay provider. |
| `SMTP_RELAY_TOKEN` | Missing | Required with `SMTP_RELAY_URL` for that relay. |
| `LEADS_NOTIFY_EMAIL` | Missing | Optional explicit lead-recipient override; code falls back to users with the boss role. |

No email was sent; the presence of Resend credentials does not verify
deliverability. No WhatsApp provider or delivery implementation was found.
Additionally, `mailer.ts` queues messages through Supabase REST
(`SUPABASE_URL` / service-role key) into `email_outbox`; that queue remains
outside the stated VPS-only application-data boundary and was not changed in
this task.

## Production backup, deployment, and verification

Before applying migrations, a custom-format `sv_platform` backup was created
and validated with `pg_restore -l`:

- Directory: `/var/lib/postgresql/sv-platform-backups/phase18-20261022T211037Z/`
- Archive: `sv_platform.dump` (113,319,653 bytes; 9,518 archive entries)
- SHA-256: `bffe6d23e53087815f6098b0ca013b4a5f553bca1ac8e1dfeb0711b6b154c3e8`
- Per-migration output is retained in the same directory.

The production checkout was clean and matched
`origin/feature/marketplace-fixes` before deployment. The existing guarded
`scripts/ops/sv-deploy.sh` built and smoke-tested that same branch, then
restarted `softwarevala-staging`; it did **not** deploy `main`.

| Check | Result |
|---|---|
| Build and guarded homepage smoke test | **PASS**, HTTP 200 |
| Live PM2 process | **online**, `softwarevala-staging`, PID 88069 after restart |
| Local production homepage | **HTTP 200**, 239,002 bytes |
| Public `https://softwarevala.net` | **HTTP 200** |
| Production branch/commit | `feature/marketplace-fixes` / `214107336b5501e7fb3314bce0de3826b0468d4d` |
| `softwarevala` database | **NOT TOUCHED** |

The staging-copy step printed a nonfatal rsync warning that it could not delete
an existing non-empty directory named `reseller-release-20261020-1`. The
guarded build, internal checks, smoke test, swap, restart, and live HTTP check
all completed successfully.

## Validation and remaining limits

- Full TypeScript check: `npx.cmd tsc --noEmit -p .` — **PASS**, exit code 0.
- Scoped ESLint: **PASS** (active Sales/Support implementation).
- Focused Sales/Support tests: **16/16 PASS**.
- Production build/restart: **PASS** through the guarded deploy script.
- No authenticated production mutation was used to test a quote, ticket,
  reply, assignment, or promise break. UI actions are verified from code and
  focused tests, not from a live user session.
- Sales/Support UI code is present on local `main`, not in the deployed
  production branch. Bidding remains missing. Email deliverability and
  WhatsApp delivery remain unverified/unimplemented.
