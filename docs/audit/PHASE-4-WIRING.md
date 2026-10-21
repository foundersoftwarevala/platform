# Phase 4 — Task, Payment, Deadline, and Notification Wiring

## Implemented

Phase 4 adds canonical task reads to the developer task module and the manager
task-management, review, and payment screens. Task changes use the Phase 3
server functions and the `public.tasks` triggers; browser code does not write
task rows. Developer reads are restricted to the authenticated user, manager
reads are restricted to the caller's assignments or the existing operator
predicate, and the affected query caches include the authenticated user ID:

- Developer REST read: `src/lib/dashboard-records/records.functions.ts:770`.
- Existing dashboard query wrapper and user-scoped cache key:
  `src/lib/dashboard-records/use-dashboard-records.ts:14`.
- Developer task controls and notification focus:
  `src/components/dashboard/CrudWorkspace.tsx:153` and `:276`.
- Manager canonical query and mutations:
  `src/lib/dev-manager.functions.ts:63`,
  `src/lib/dev-manager.server.ts:573`, and
  `src/hooks/useDevManagerData.ts:60`.
- Manager assignment form, close/cancel, reopen, and disabled unsupported
  reassign/escalation controls:
  `src/components/developer-management/screens/DMTaskManagement.tsx:46`.
- Review and QA actions:
  `src/components/developer-management/screens/DMReviewQA.tsx:19`.
- Payment review and `markPaid`:
  `src/components/developer-management/screens/DMPaymentIncentive.tsx:10`.
- Shared authenticated task server functions:
  `src/lib/tasks/functions.ts:119`, `:161`, `:186`, `:223`, `:248`, `:278`,
  `:308`, `:333`, `:355`, `:370`, and `:412`.

The task-management screen can assign a new task and optionally collect a work
deadline. Reassignment and escalation are visibly disabled because the
existing handlers target legacy delivery data; no canonical audited versions
of those mutations were added in this phase. The old canonical task schema's
`due_at` is reserved for the seven-day payment SLA, so this phase adds nullable
`tasks.deadline_at` for work deadlines. No alert is generated for tasks without
a deadline. `createTask` validates the manager and developer roles and derives
the assigner from the authenticated caller.

## Notifications and database behavior

`public.notifications` already exists with platform-wide notifications. This
migration extends it rather than creating a conflicting table:
`supabase/migrations/20261108T145500_tasks_notifications_deadlines.sql:56`.
It adds `message`, `entity_type`, and `entity_id`, backfills `message` from the
existing title/body, adds task-recipient RLS and server-only task-notice
mutation policies at lines 98–129, and task-event notifications at lines
132–184.
It also adds `tasks_status_deadline_at_idx` (line 52) plus the notification
indexes `notifications_user_read_at_idx` (line 89) and
`notifications_created_at_idx` (line 91).

Task assignment, verification, rejection, payment-due, and payment-paid
notifications are inserted by the task trigger. Task notification reads are
recipient-scoped server functions at `src/lib/tasks/functions.ts:370` and
`:412`; marking unread task notifications as read writes an append-only
`audit_logs` event in the same transaction. The existing Phase 3 task audit
trigger records task status/payment changes at
`supabase/migrations/20261108T145400_tasks_fresh.sql:234` and `:300`. The
Part A audit migration defines append-only and hash-chain triggers at
`supabase/migrations/20261108T145300_audit_logs_truth_columns.sql:133`,
`:143`, `:149`, and `:183`.

The notification bell merges task notices with the existing platform feed,
shows the combined unread count, reports partial-source failures, marks notices
read through their respective server/RPC paths, and navigates to task details:
`src/components/notifications/NotificationBell.tsx:134`, `:155`, and `:180`.
The developer dashboard and manager shell provide the navigation callbacks at
`src/components/dashboard/TopBar.tsx:364` and
`src/components/developer-management/DMFullLayout.tsx:188`.

## Scheduled jobs

- Hourly payment-due processing:
  `src/lib/tasks/payment-cron.server.ts:4` and
  `scripts/payment-cron.mjs:1`. It updates verified, unpaid tasks past
  `due_at`; the Phase 3 triggers audit the payment-state change and create a
  `payment_due` notification.
- Every-15-minute deadline processing:
  `src/lib/tasks/deadline-cron.server.ts:4`,
  `scripts/deadline-cron.mjs:1`, and the idempotent
  `public.tasks_deadline_alerts()` function in the migration at line 187.
  It emits one warning within 24 hours and one overdue event/notification per
  task deadline episode; it does not cancel tasks.
- Both external scripts require `VPS_DATABASE_URL`, use the `sv_platform`
  database, and run writes as `service_role` inside transactions:
  `scripts/task-cron-db.mjs:3` and `:18`.

**Not installed or run on the VPS.** No database connection, migration
application, `pg_cron` availability check, deployment, or crontab change was
performed. After deploying the application and applying migrations 20261108T145400
and 20261108T145500 in order, create a root-only
`/etc/softwarevala/tasks-cron.env` containing `VPS_DATABASE_URL` and use these
root crontab entries:

```cron
0 * * * * set -a; . /etc/softwarevala/tasks-cron.env && set +a && cd /var/www/softwarevala && /usr/bin/node scripts/payment-cron.mjs >> /var/log/softwarevala-task-payment-cron.log 2>&1
*/15 * * * * set -a; . /etc/softwarevala/tasks-cron.env && set +a && cd /var/www/softwarevala && /usr/bin/node scripts/deadline-cron.mjs >> /var/log/softwarevala-task-deadline-cron.log 2>&1
```

Keep the environment file root-owned with mode `0600`; do not put the database
URL in the crontab or repository. Confirm the deployed scripts and target
database before enabling either schedule.

## Deployment and scope

The Phase 3 migration is present in the repository but has not been applied to
the VPS. Phase 4 migration and code are also not deployed; canonical task
screens and task notifications therefore require both migrations and the
application release before they can work against production. Other manager
modules outside task management, review, and payment still contain legacy
task reads; this report does not claim that the entire manager console has
migrated.

No payment UI integration with a payout provider, automatic payout, payment
verification outside the manager's `markPaid` action, or deadline scheduler
installation was performed. Alerts are notifications, not email/SMS delivery.
Ayra, wallet, promise, PC, chatbot, and AI API systems were not changed.

This is not a whole-dashboard legacy-data migration. The developer `bugs`
module still reads its existing `tm_tasks` bug records because the canonical
task schema has no bug-specific fields. The manager overview, escalation and
internal-note surfaces still depend on legacy delivery data; only the
task-management, review/QA, payment, and developer-registry active-task count
surfaces described above use canonical tasks. Canonical reassignment and
escalation remain unavailable and visibly disabled.

## Verification

- `npx.cmd tsc --noEmit -p .`: **PASS**, exit code 0.
- Scoped ESLint with `prettier/prettier` disabled: **PASS** when excluding
  `src/components/dashboard/TopBar.tsx`. Including that changed file reports
  three existing `@typescript-eslint/no-explicit-any` errors at lines 601,
  668, and 848; those `icon: any` declarations are unchanged from `HEAD`.
- `npm.cmd run i18n:check`: **FAIL**, due to a stale generated static-source
  catalogue and increased hardcoded-string counts in unrelated dirty API and
  route files. No Phase 4 UI file was listed as a hardcoded-string failure;
  the generated catalogue and unrelated baseline were not rewritten.
- Focused regression tests: **PASS**, 56 tests across five task/manager
  suites.
- Production build: **PASS**.
- Cron script syntax checks (`node --check`): **PASS**.
- No database execution test was run; SQL effects, installed cron state, and
  live notification delivery are **UNVERIFIED**.

## Rollback

1. Disable the two cron entries before rolling back application code.
2. Revert the Phase 4 code/report commits with normal `git revert` commits;
   do not rewrite published history.
3. Do not drop `public.notifications`, task rows, or audit rows. The migration
   is additive and old notification data is retained. If a schema rollback is
   later required, review task/notification data first and remove only
   Phase-4-specific policies/functions/indexes/columns under an approved,
   separately tested migration.
4. The current VPS has not received these migrations, so there is no live
   schema rollback to perform.
