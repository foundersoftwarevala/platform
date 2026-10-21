# Phase 3 — Fresh Canonical Tasks

## Implementation status

The migration, server functions, and consistency queries are authored in the
repository. They have **not** been applied to the Hostinger database, and no
live task rows, audit rows, or grants were inspected or changed. A file in
`supabase/migrations/` is not evidence that the database has run it.

## Migration and data contract

Migration: [`20261108T145400_tasks_fresh.sql`](../../supabase/migrations/20261108T145400_tasks_fresh.sql).
It requires the prior audit-log foundation migration
[`20261108T145300_audit_logs_truth_columns.sql`](../../supabase/migrations/20261108T145300_audit_logs_truth_columns.sql)
to have been applied first. Its preflight requires the expected audit columns
and enabled append-only and hash-chain triggers; otherwise it raises an error
instead of creating a task table whose audit writes would fail.

| Change | Reason | Risk / verification |
| --- | --- | --- |
| Add [`task_status`](../../supabase/migrations/20261108T145400_tasks_fresh.sql#L85) and [`task_payment_status`](../../supabase/migrations/20261108T145400_tasks_fresh.sql#L117) enums | Enforce the locked task/payment values | Existing same-named types with unexpected labels stop the migration. |
| Add [`public.tasks`](../../supabase/migrations/20261108T145400_tasks_fresh.sql#L147) with IDs, developer/assigner IDs, task content, status, payment timestamps, artifacts, notes, and timestamps | Fresh canonical store; legacy data is not copied or rewritten | Requires `auth.users`, `auth.uid()`, `service_role` with `BYPASSRLS`, and `public.tm_is_operator()` in the platform database. Migration not applied; runtime row count is NOT VISIBLE. |
| Add `payment_reference` | Preserve the `markPaid(taskId, ref)` argument instead of discarding it | Additional nullable column beyond the requested table shape. |
| Add transition/payment preparation trigger ([function](../../supabase/migrations/20261108T145400_tasks_fresh.sql#L168), [trigger](../../supabase/migrations/20261108T145400_tasks_fresh.sql#L229)) | Enforce allowed transitions, timestamps, and derived payment state | `due` is recalculated on a task write; no scheduler was added to change rows exactly at the seven-day boundary. |
| Add audit trigger ([function](../../supabase/migrations/20261108T145400_tasks_fresh.sql#L234), [trigger binding](../../supabase/migrations/20261108T145400_tasks_fresh.sql#L300)) | Insert a status/payment audit event in the same transaction | Requires the Part A audit migration and enabled append-only/hash-chain triggers. No database execution test was available. |
| Add [four task indexes](../../supabase/migrations/20261108T145400_tasks_fresh.sql#L305) | Support developer/status, assigner/status, status/due, and payment/verification queries | Index presence is defined, not live-verified. |
| Enable RLS and add [scoped SELECT policy](../../supabase/migrations/20261108T145400_tasks_fresh.sql#L317) | Developers see their own tasks; operators and task creators/assigners can read | Server writes use the verified caller role plus a transaction-local `service_role`; client write grants are revoked. |
| [Revoke legacy task-table writes](../../supabase/migrations/20261108T145400_tasks_fresh.sql#L332) | Keep `developer_tasks` and `tm_tasks` intact but read-only to `PUBLIC`, `anon`, `authenticated`, and `service_role` | Legacy SELECT is granted to the three named application roles. Existing behavior can change when the migration is applied. |

The table columns at
[`migration:147`](../../supabase/migrations/20261108T145400_tasks_fresh.sql#L147)
are: `id`, `developer_id`, `assigned_by`, `created_by`, `title`,
`description`, `status`, `payment_status`, `verified_at`, `paid_at`, `due_at`,
`priority`, `artifacts`, `submission_notes`, `manager_notes`,
`payment_reference`, `created_at`, and `updated_at`. `payment_reference` is
the documented extension needed to retain `markPaid`'s `ref` parameter.
The three identity columns reference `auth.users`: deleting a developer is
restricted while a task exists; deleting an assigner/creator nulls that
attribution.

Triggers are `tasks_prepare_write` (transition validation, timestamps and
derived payment status) and `tasks_audit_change` (one audit event for a status
or payment change). The audit table's prerequisite triggers are
`audit_logs_append_only` and `audit_logs_hash_chain`, checked by the migration
preflight at
[`migration:4`](../../supabase/migrations/20261108T145400_tasks_fresh.sql#L4).
The four index names and ordered columns are:
`tasks_developer_status_idx(developer_id, status)`,
`tasks_assigned_by_status_idx(assigned_by, status)`,
`tasks_status_due_at_idx(status, due_at)`, and
`tasks_payment_status_verified_at_idx(payment_status, verified_at)`.
The only task RLS policy created is `tasks_read_scoped`; it is SELECT-only.
Client table grants are explicitly revoked; `service_role` receives
SELECT/INSERT/UPDATE but not DELETE.

The transition trigger accepts:

| From | To |
| --- | --- |
| assigned | in_progress, cancelled |
| in_progress | submitted, cancelled |
| submitted | verified, rejected |
| rejected | in_progress |
| verified | paid |
| paid, cancelled | terminal |

No legacy rows are copied; `developer_tasks` and `tm_tasks` remain physical
legacy tables. There is no status mapping or assigner backfill. Existing legacy
rows and their existing IDs/timestamps are untouched. Since the migration has
not run, canonical task count and old-table privilege changes are NOT VISIBLE.

## Server write paths

| Function | Location | Authorization and write |
| --- | --- | --- |
| `createTask` | [`functions.ts:124`](../../src/lib/tasks/functions.ts#L124) | Operator role; validates a developer account and writes only `tasks`. |
| `startTask` | [`functions.ts:165`](../../src/lib/tasks/functions.ts#L165) | Developer role and matching `developer_id`; supplies the required assigned/rejected-to-in_progress transition before submission. |
| `submitTask` | [`functions.ts:190`](../../src/lib/tasks/functions.ts#L190) | Developer role and matching `developer_id`; writes submission data and status. |
| `rejectTask` | [`functions.ts:227`](../../src/lib/tasks/functions.ts#L227) | Operator role; writes rejection status and manager reason. |
| `verifyTask` | [`functions.ts:252`](../../src/lib/tasks/functions.ts#L252) | Operator role; writes verification status and optional notes. |
| `markPaid` | [`functions.ts:282`](../../src/lib/tasks/functions.ts#L282) | Operator role; writes paid status and payment reference. |
| `cancelTask` | [`functions.ts:312`](../../src/lib/tasks/functions.ts#L312) | Operator role; writes cancellation status and reason. |

[`db.server.ts:7`](../../src/lib/tasks/db.server.ts#L7) resolves the canonical
`sv_platform` Postgres URL and wraps each mutation in a transaction with a
verified caller ID in transaction-local auth claims at
[`db.server.ts:39`](../../src/lib/tasks/db.server.ts#L39). The database status /
payment trigger writes the corresponding `audit_logs` row inside that same
transaction. Role checks are centralized at
[`functions.ts:74`](../../src/lib/tasks/functions.ts#L74), and existing-task
mutations lock the row through
[`functions.ts:109`](../../src/lib/tasks/functions.ts#L109). These
server functions are not wired to dashboard UI in this phase; existing
dashboard reads remain unchanged and new tasks will not appear in those UIs
until later data-layer/UI integration. `startTask` is an additional lifecycle
operation beyond the six requested functions because otherwise the specified
transition graph would leave a newly assigned task with no server-side path
into `in_progress`, making `submitTask` unreachable through the allowed
transitions. Because legacy client/server write grants are revoked by the
migration, existing dashboard write paths that still target those tables will
be denied until they are wired to these functions; that wiring is deliberately
not included here.

## Audit coverage

| Event | Audit trigger | Actor stamped |
| --- | --- | --- |
| Task inserted | Yes: `task.status_changed` from NULL to `assigned` | `auth.uid()`; nullable for service execution |
| Status changes | Yes: `task.status_changed`, with before/after status and row state | `auth.uid()`; nullable for service execution |
| Payment-status changes | Yes: `task.payment_changed`, with before/after payment and row state; combined with status event if both change | `auth.uid()`; nullable for service execution |
| Deadline crossing | No autonomous event; `due` is calculated on a later task write | NOT IMPLEMENTED: no deadline cron/scheduler |

The task trigger depends on the existing `audit_logs` append-only and
hash-chain triggers; both must be enabled. The audit columns are defined by
Part A, but whether they are installed and protecting the live database is
NOT VISIBLE from this repository alone.

## Consistency check

[`phase3_consistency_check.sql`](../../supabase/scripts/phase3_consistency_check.sql#L1)
is read-only. Its five queries report verified tasks missing `verified_at`,
paid tasks missing `paid_at`, verified payment states missing `due_at`, paid
payment states missing `paid_at`, and a missing/discontinuous/currently
mismatched status audit history. Expected result after migration and normal
task writes: **zero rows from every query**.

## Verification results

| Check | Result |
| --- | --- |
| `npx.cmd tsc --noEmit -p .` | PASS (exit 0). |
| Scoped ESLint on new task server files, with Prettier rule disabled | PASS. |
| `npm.cmd run i18n:check` | FAIL (exit 1): unused-key warnings and hard-coded strings in unrelated modified/untracked UI files (`RoleApplicationsQueue.tsx`, franchise/reseller dashboards, manager-suite, marketplace-manager, Sapphire home, and SEO manager). The task files add no user-facing strings. |
| Migration execution / consistency SQL | NOT RUN; no non-production database was available, and production was not accessed. |

## Phase 3 — Implementation Complete

Repository implementation only; the migration has not been applied.

- Migration: [`20261108T145400_tasks_fresh.sql`](../../supabase/migrations/20261108T145400_tasks_fresh.sql).
- Rows copied: `developer_tasks=0`, `tm_tasks=0` by design. Existing row counts were not queried.
- Status mapping: none; legacy rows are not migrated.
- Assigner backfill: none; legacy tables are untouched.
- Payment columns: `verified_at`, `paid_at`, `due_at` defined; live presence NOT VERIFIED.
- Views: none. Both old tables remain physical tables and their client/service-role privileges are restricted by the migration.
- Audit: task audit trigger defined; append-only/hash-chain behavior depends on the required Part A migration and is not live-verified.
- Indexes: `tasks_developer_status_idx`, `tasks_assigned_by_status_idx`, `tasks_status_due_at_idx`, `tasks_payment_status_verified_at_idx` defined.
- RLS: one SELECT policy, `tasks_read_scoped`; writes are restricted to authenticated server handlers using `service_role`.
- Server functions: `createTask`, `startTask`, `submitTask`, `rejectTask`, `verifyTask`, `markPaid`, `cancelTask` in [`functions.ts`](../../src/lib/tasks/functions.ts). `startTask` is the required server-side assigned/rejected-to-in_progress transition.
- Consistency script: [`phase3_consistency_check.sql`](../../supabase/scripts/phase3_consistency_check.sql); five read-only zero-row checks.
- Verification: `tsc=PASS`, scoped `eslint=PASS`, `i18n=FAIL` from unrelated worktree edits; database checks NOT RUN.
- Rollback: follow the reviewed, data-preserving procedure below; it drops newly created canonical rows and therefore requires an export first.
- Not done: UI wiring, payment UI, deadline scheduler/cron, notifications, and all excluded later-phase modules.

## Not done

- No dashboard UI or existing dashboard read path was changed or wired to
  `tasks`.
- No payment UI, deadline cron/scheduler, or notifications were added.
- No legacy data was copied, mapped, or backfilled.
- No Ayra, wallet, promise, PC assistant, chatbot, or AI API module was changed.
- No database migration, task mutation, or audit probe was run.

## Rollback

The migration itself contains no table drop or row deletion. Before rolling
back an applied migration, stop all application writers and export every row
from `public.tasks`; dropping the table discards canonical task data created
since deployment. Confirm that the export is recoverable and that no later
object depends on the task types or table. Then run a reviewed rollback:

```sql
DROP TABLE public.tasks CASCADE;
DROP FUNCTION IF EXISTS public.tasks_prepare_write();
DROP FUNCTION IF EXISTS public.tasks_audit_change();
DROP TYPE IF EXISTS public.task_payment_status;
DROP TYPE IF EXISTS public.task_status;

GRANT ALL ON TABLE public.developer_tasks TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.tm_tasks TO anon, authenticated, service_role;
```

The two `GRANT ALL` statements restore the privileges recorded for
[`developer_tasks`](../../supabase/schema/public-schema.sql#L66633) and
[`tm_tasks`](../../supabase/schema/public-schema.sql#L69762) in the repository
schema dump before this migration. Verify the actual live grants before
executing them; do not run this rollback against a database with
canonical task data that must be retained. The audit-log foundation is
independent and is not rolled back by these steps.
