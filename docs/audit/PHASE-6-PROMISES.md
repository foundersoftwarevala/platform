# Phase 6 — Canonical Task Promises

## Scope and compatibility

Phase 6 adds promises for canonical `public.tasks` without replacing the
existing Promise Tracker. That application already owns a wider
`public.promises` schema (including approvals, links, escalation and its own
ledger), so this phase uses `public.task_promises` rather than colliding with
or changing legacy data. Neither legacy `public.promises` nor task tables
were dropped or rewritten.

The migrations are
[`20261108T151000_task_promises.sql`](../../supabase/migrations/20261108T151000_task_promises.sql)
and
[`20261108T151100_task_promise_auto_fulfill.sql`](../../supabase/migrations/20261108T151100_task_promise_auto_fulfill.sql).
They were not applied to a database. The cron was not installed or run.

## Schema, transition rules and audit

`public.task_promises` stores `id`, canonical `task_id`, `developer_id`,
`promised_at`, `deadline_at`, `status`, `fine_cents`, `fine_applied_at`,
developer `note`, manager/system `break_reason`, `created_at`, and
`updated_at` ([migration:35](../../supabase/migrations/20261108T151000_task_promises.sql#L35)).
The row requires a real task owner, deadline after creation, nonnegative fine,
and a break reason for a broken promise. The task/developer pair is checked
on insert; commitment identity fields cannot be rewritten. Status can move
only from `pending` to `fulfilled` or `broken`. A partial unique index permits
only one pending promise per task; completed/broken history remains.

Indexes: `(developer_id, status)`, `(deadline_at, status)`, and `(task_id)`;
the pending-per-task and promise-fine idempotency indexes are also created
([migration:57](../../supabase/migrations/20261108T151000_task_promises.sql#L57)).

RLS permits developers to select their own promises, existing Promise Tracker
managers to select all, and `finance_manager` to select all. Client roles
receive no insert/update/delete grant; server writes use the task transaction.
Promise rows cannot be deleted. `promise.created`, `promise.status_changed`,
and `promise.fine_set` audit records include before/after row state and the
authenticated actor; the existing `audit_logs` triggers provide the platform
append-only/hash-chain behavior
([audit trigger](../../supabase/migrations/20261108T151000_task_promises.sql#L136),
[RLS and grants](../../supabase/migrations/20261108T151000_task_promises.sql#L314)).

## Server operations and role checks

All server handlers are in
[`promises.functions.ts`](../../src/lib/tasks/promises.functions.ts):

- `getMyTaskPromiseData` — line 109; developer-only, returns own canonical
  assigned/in-progress tasks and own promise history.
- `makePromise` — line 139; developer-only, requires ownership, an assigned
  or in-progress task, and a future deadline.
- `fulfillPromise` — line 180; developer-only, permits completion only after
  submission/verification. Task submission/verification normally fulfills
  automatically through the database trigger.
- `getManagedTaskPromises` — line 221; manager/finance role check; pending or
  broken queue.
- `setTaskPromiseFine` — line 245; manager/finance only; changes a fine only
  while the promise is pending. Amounts are integer cents.
- `breakPromise` — line 269; manager/finance only, requires an auditable
  reason, and delegates the atomic state/fine transaction to
  `public.break_task_promise`
  ([migration:204](../../supabase/migrations/20261108T151000_task_promises.sql#L204)).

The database break routine independently checks its actor and role. It marks
the promise broken and records the reason. If a configured fine is positive,
it inserts one `fine` row into the existing append-only
`developer_wallet_transactions` ledger. The Phase 5 wallet trigger performs
the balance debit, rejects a negative balance, and records the `wallet.tx`
audit entry. Promise state, fine timestamp, ledger, balance and audits share
one transaction: an insufficient balance or other failure rolls the whole
break back for retry. No fine is inferred from task value; a manager must
configure it explicitly.

## Automatic fulfillment and missed-deadline cron

The database trigger
`tasks_fulfill_pending_promises` runs after a real task status transition to
`submitted` or `verified` and changes all pending promises for that task to
`fulfilled` in the same transaction
([function and trigger](../../supabase/migrations/20261108T151100_task_promise_auto_fulfill.sql#L12)).
The promise audit trigger records those transitions with the task submitter
or verifier as actor.

[`scripts/promise-cron.mjs`](../../scripts/promise-cron.mjs#L1) processes
expired pending promises by calling the same database break routine, one
transaction per promise. It logs per-promise failures, continues to the next
item, and exits nonzero if any failed. A configured `PROMISE_CRON_ACTOR_ID`
must be the UUID of a real, provisioned manager or finance user; sentinel
actors are rejected by the database. `VPS_DATABASE_URL` is read from a
root-only environment file and the shared cron DB helper targets `sv_platform`.

Install only after the migration and after verifying the chosen actor has an
authorized role. Example root crontab entry (15-minute cadence):

```cron
*/15 * * * * set -a; . /etc/softwarevala/task-cron.env; set +a; cd /var/www/softwarevala && /usr/bin/node scripts/promise-cron.mjs >> /var/log/sv-promise-cron.log 2>&1
```

The root-only `/etc/softwarevala/task-cron.env` must define `VPS_DATABASE_URL`
and `PROMISE_CRON_ACTOR_ID`. This entry is documentation only; no VPS cron or
environment file was created or modified.

## Dashboard wiring

- Developer dashboard module `promises` is registered in
  [`roles.ts`](../../src/lib/roles.ts#L410) and rendered by
  [`ModulePage.tsx`](../../src/components/dashboard/ModulePage.tsx#L27).
  [`DMPromises.tsx`](../../src/components/developer-management/screens/DMPromises.tsx#L17)
  lists promised/deadline dates and status/fine details, and offers a deadline
  picker and optional note for each eligible task. It includes loading, empty,
  sign-in, and error states. No client-side database writes are used.
- The manager `Task Promises` screen is in
  [`DMTaskPromises.tsx`](../../src/components/developer-management/screens/DMTaskPromises.tsx#L15)
  and is wired into
  [`DMFullLayout.tsx`](../../src/components/developer-management/DMFullLayout.tsx#L68).
  It filters pending/broken promises, links task rows to Task Management and
  developers to their existing Registry view, displays promised/deadline dates
  and recorded fine state,
  permits manager fine configuration, and requires a reason to break a
  promise.
- User-facing labels are in
  [`devmanager.ts`](../../src/lib/i18n/messages/devmanager.ts#L13) and
  [`dashboard.ts`](../../src/lib/i18n/messages/dashboard.ts#L262).

## Verification

- Scoped ESLint with `prettier/prettier` disabled — PASS.
- Promise cron `node --check` — PASS.
- Existing wallet amount-format regression tests — PASS (3 tests).
- Full `npx.cmd tsc --noEmit -p .` on the final Phase 6 source — PASS (exit 0).
- `npm.cmd run build` on the final Phase 6 source — PASS (exit 0).
- `npm.cmd run i18n:check` — FAIL: the generated source catalogue is stale
  and the check reports hardcoded strings in unrelated modified files. It
  did not report missing/invalid Phase 6 message keys; unrelated application
  changes were not modified to force a pass.
- SQL migration dry-run/application and live authenticated acceptance — NOT
  RUN; no database was changed.

## Rollback

Disable/remove the cron entry first. Back up the database and inspect both
`task_promises` and its wallet/audit records before any rollback. A code-only
rollback is a normal commit revert. If the schema must be removed, drop the
`tasks_fulfill_pending_promises` trigger from `public.tasks`, then its
function; remove `public.break_task_promise(uuid,text)` and its execute grant;
drop `public.task_promises` and its helper triggers/functions; and remove
`developer_wallet_promise_fine_unique_idx` from the wallet ledger.

Dropping the table loses promise records but does not remove corresponding
wallet fine transactions or append-only audit records. Do not delete or
rewrite those financial/audit records; any financial correction requires an
authorized compensating transaction. Never drop the legacy `public.promises`
table as part of this rollback.

## Not done in Phase 6

No Promise Tracker migration or cleanup, deployment, VPS cron installation,
fine automation beyond the explicitly configured task-promise fine, wallet
payout-provider integration, notifications, PC assistant, Ayra, chatbot, or
AI API changes were made.
