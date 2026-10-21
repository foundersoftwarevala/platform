# Phase 3 Unified Tasks — Blocked at Schema/State Contract

> Sections 1–8 record the initial pre-approval review. The later owner-approved Option C and current implementation status are recorded in the final section below.

## 1. Canonical decision (initial recommendation; superseded)

Initial recommendation was **(A) `tm_tasks` as the eventual canonical table**, because it owns the Task Manager lifecycle, database transition enforcement, status audit trigger, and append-only `tm_activity`; see the [initial decision record](./PHASE-3-CANONICAL-DECISION.md). The business owner later approved a new `tasks` table (Option C), recorded below. This initial recommendation is retained for history only ([public-schema.sql:33152](../../supabase/schema/public-schema.sql#L33152), [public-schema.sql:25601](../../supabase/schema/public-schema.sql#L25601)).

## 2. Migration summary

| Change | Reason | Risk |
|---|---|---|
| No migration created | The required identity/status mapping is ambiguous; the task explicitly says to stop rather than guess | Creating the proposed migration now could misattribute tasks, alter valid lifecycle states, or falsely mark historical payment/review state |
| No existing table or data changed | Preserve both current physical tables and the existing bridge while contract questions remain | The dashboards continue to have potentially divergent reads |
| Current bridge reviewed, not changed | `developer_tasks.tm_task_id` is the existing link to `tm_tasks`; bridge status mapping is lossy ([public-schema.sql:25601](../../supabase/schema/public-schema.sql#L25601), [20260906120000_tm_developer_bridge.sql:29](../../supabase/migrations/20260906120000_tm_developer_bridge.sql#L29), [20260906120000_tm_developer_bridge.sql:54](../../supabase/migrations/20260906120000_tm_developer_bridge.sql#L54)) | One displayed status can differ by design |

**Blocking schema contract:**

- `tm_tasks` has `assigned_to` and `created_by`, both using `tm_members` identities; it has no `developer_id` or `manager_id` columns. `developer_tasks` has `developer_id` and `assigned_by`, but no `manager_id` ([public-schema.sql:25601](../../supabase/schema/public-schema.sql#L25601), [public-schema.sql:33152](../../supabase/schema/public-schema.sql#L33152), [public-schema.sql:47754](../../supabase/schema/public-schema.sql#L47754)).
- A developer/member mapping function exists, but uses a `LIMIT 1`; no manager mapping or uniqueness contract was found ([public-schema.sql:21738](../../supabase/schema/public-schema.sql#L21738), [public-schema.sql:21858](../../supabase/schema/public-schema.sql#L21858)).
- `tm_tasks` has `deadline`, `approved_at`, `reviewed_at`, `settled_at`, `billing_status`, and `approval_status`, not the requested `due_at`, `verified_at`, `paid_at`, or `payment_status`; `developer_tasks` has `deadline` and `completed_at` but no requested verification/payment fields ([public-schema.sql:25601](../../supabase/schema/public-schema.sql#L25601), [public-schema.sql:33152](../../supabase/schema/public-schema.sql#L33152)).
- The current `tm_tasks` CHECK permits 20 lifecycle labels, including `new`, `routed`, `available_for_claim`, `claimed`, `accepted`, `on_hold`, `blocked`, `ai_review`, `testing`, `under_review`, `approved`, `completed`, `failed`, and `closed`. Replacing it with only the seven requested states would invalidate existing behaviors and transitions ([public-schema.sql:33152](../../supabase/schema/public-schema.sql#L33152), [public-schema.sql:21317](../../supabase/schema/public-schema.sql#L21317)).
- Existing bridge mapping changes `developer_tasks.submitted` to `tm_tasks.ai_review`; `tm_status_from_developer` has no explicit `rejected` case and falls through to `assigned`. The reverse mapping maps TM `rejected` to developer `working` and maps `approved`/`closed` to `completed` ([public-schema.sql:22370](../../supabase/schema/public-schema.sql#L22370), [public-schema.sql:22381](../../supabase/schema/public-schema.sql#L22381), [public-schema.sql:22387](../../supabase/schema/public-schema.sql#L22387), [public-schema.sql:22393](../../supabase/schema/public-schema.sql#L22393), [public-schema.sql:22416](../../supabase/schema/public-schema.sql#L22416)).

## 3. Read/write path changes

No application paths were changed because the schema contract is unresolved.

| File:line | Before | After | Canonical? (Y/N) |
|---|---|---|---|
| [records.functions.ts:793](../../src/lib/dashboard-records/records.functions.ts#L793) | Developer task dashboard reads `developer_tasks`; bug list separately reads `tm_tasks` ([records.functions.ts:773](../../src/lib/dashboard-records/records.functions.ts#L773)) | Unchanged; no unified source can safely represent both until identity/status mappings are approved | N |
| [useDevManagerData.ts:242](../../src/hooks/useDevManagerData.ts#L242) | Submission rows join `developer_tasks`; task list reads `developer_tasks` ([useDevManagerData.ts:316](../../src/hooks/useDevManagerData.ts#L316)) | Unchanged | N |
| [dev-manager.server.ts:403](../../src/lib/dev-manager.server.ts#L403) | Developer Manager overview reads `developer_tasks`; reassign/escalation paths update it ([dev-manager.server.ts:578](../../src/lib/dev-manager.server.ts#L578), [dev-manager.server.ts:672](../../src/lib/dev-manager.server.ts#L672)) | Unchanged | N |
| [task-service.functions.ts:158](../../src/lib/tm/task-service.functions.ts#L158) | Task Manager reads and writes `tm_tasks`; status helper updates it, then records an application activity row ([task-service.functions.ts:182](../../src/lib/tm/task-service.functions.ts#L182), [task-service.functions.ts:185](../../src/lib/tm/task-service.functions.ts#L185)) | Unchanged | Y for Task Manager only |
| [api.ts:36](../../src/lib/tm/api.ts#L36) | Task Manager API reads `tm_tasks`; some helpers directly update it ([api.ts:620](../../src/lib/tm/api.ts#L620)) | Unchanged | Y for Task Manager only |
| [useDevManagerData.ts:276](../../src/hooks/useDevManagerData.ts#L276) | Submission review invokes existing `review_developer_submission` RPC directly from the browser client | Unchanged; centralizing this action needs an approved existing-server-function path and transaction contract | N |

The tracked worktree already has unrelated changes in `records.functions.ts`; it was not edited or staged for this investigation.

## 4. Audit coverage

| Transition | Audit trigger? (Y/N) | Actor stamped? (Y/N) |
|---|---|---|
| `assigned` | Y for a `tm_tasks.status` UPDATE; initial INSERT is not covered by the status UPDATE trigger | N (not guaranteed; service-role updates can have null `auth.uid()`) ([20260906140500_tm_audit_append_only.sql:34](../../supabase/migrations/20260906140500_tm_audit_append_only.sql#L34), [20260906140500_tm_audit_append_only.sql:38](../../supabase/migrations/20260906140500_tm_audit_append_only.sql#L38)) |
| `in_progress` | Y for a `tm_tasks.status` UPDATE | N (not guaranteed; trigger looks up `auth.uid()` and writes a null actor ID with a `system` label when no caller context is present) ([20260906140500_tm_audit_append_only.sql:34](../../supabase/migrations/20260906140500_tm_audit_append_only.sql#L34), [20260906140500_tm_audit_append_only.sql:38](../../supabase/migrations/20260906140500_tm_audit_append_only.sql#L38), [20260906140500_tm_audit_append_only.sql:41](../../supabase/migrations/20260906140500_tm_audit_append_only.sql#L41)) |
| `submitted` | `tm_tasks` supports this status, but the developer bridge maps developer `submitted` to `ai_review`; that mapped status UPDATE triggers an activity row | N (not guaranteed; same trigger actor context limitation) ([public-schema.sql:22370](../../supabase/schema/public-schema.sql#L22370), [public-schema.sql:22381](../../supabase/schema/public-schema.sql#L22381), [20260906140500_tm_audit_append_only.sql:34](../../supabase/migrations/20260906140500_tm_audit_append_only.sql#L34)) |
| `rejected` | Y for a direct `tm_tasks.status` UPDATE; developer-to-TM bridge falls through to `assigned`, and the reverse mapping returns `working` | N (not guaranteed; same trigger actor context limitation) ([public-schema.sql:22370](../../supabase/schema/public-schema.sql#L22370), [public-schema.sql:22416](../../supabase/schema/public-schema.sql#L22416), [20260906140500_tm_audit_append_only.sql:34](../../supabase/migrations/20260906140500_tm_audit_append_only.sql#L34)) |
| `verified` | N; this is not a `tm_tasks.status` value or a dedicated timestamp field ([public-schema.sql:33152](../../supabase/schema/public-schema.sql#L33152)) | N |
| `paid` | N; payment is represented separately by `billing_status` / `settled_at`, not this task status ([public-schema.sql:33152](../../supabase/schema/public-schema.sql#L33152)) | N |
| `cancelled` | Y for a `tm_tasks.status` UPDATE | N (not guaranteed; same trigger actor context limitation) ([20260906140500_tm_audit_append_only.sql:34](../../supabase/migrations/20260906140500_tm_audit_append_only.sql#L34)) |

`tm_activity` blocks UPDATE and DELETE ([public-schema.sql:43210](../../supabase/schema/public-schema.sql#L43210)). This does not establish the requested one-event guarantee: task-service status changes also make a separate application activity insert after the table update ([task-service.functions.ts:182](../../src/lib/tm/task-service.functions.ts#L182), [task-service.functions.ts:185](../../src/lib/tm/task-service.functions.ts#L185)). Actor identity for service-role-triggered updates requires an explicit transaction-local actor contract before it can be guaranteed.

## 5. Consistency check script

**NOT CREATED.** The requested peer-row query cannot be defined safely for all `tm_tasks`: the existing bridge creates a developer mirror only for assigned developers; the task model also serves other work ([20260906142500_tm_developer_mirror.sql:57](../../supabase/migrations/20260906142500_tm_developer_mirror.sql#L57), [20260906142500_tm_developer_mirror.sql:71](../../supabase/migrations/20260906142500_tm_developer_mirror.sql#L71), [20260906120000_tm_developer_bridge.sql:129](../../supabase/migrations/20260906120000_tm_developer_bridge.sql#L129)). The audit entity ID is the `tm_tasks` ID, while developer-facing task IDs are separate and linked by `tm_task_id` ([public-schema.sql:25601](../../supabase/schema/public-schema.sql#L25601), [public-schema.sql:33152](../../supabase/schema/public-schema.sql#L33152)). Writing a check against assumed all-row equivalence or nonexistent `verified`/`paid` status transitions would report false results.

## 6. Verification results

- `npx.cmd tsc --noEmit -p .`: **PASS** on clean committed tree `8d72ddc` (exit 0).
- `npx.cmd eslint` on the Phase 1/2 changed TypeScript files with `--rule 'prettier/prettier: off'`: **PASS**, zero errors; one existing `react-refresh/only-export-components` warning at `RouteAccessGate.tsx:155`.
- `npm.cmd run i18n:check`: **PASS** on clean committed tree `8d72ddc`; output reports 3,545 keyed, 167 exempt, 14,366 hardcoded strings (none new). Existing unused-key warnings remain.
- No migration was applied or executed, and no production database was accessed.

## 7. What was NOT done

- No migration, consistency-check SQL, or data-path refactor was created.
- No dashboard UI, payment UI, deadline cron, or notification work was done.
- No `developer_tasks`, `tm_tasks`, or audit data was changed or deleted.
- No later-phase module was touched. No changes were made to any listed application path.

## 8. Initial rollback state (historical)

At the initial blocker checkpoint, no Phase 3 migration or data-path change existed to roll back. The current migration/verification state is recorded below.

## Phase 3 — Initial audit-schema blocker (historical)

At this initial checkpoint, implementation stopped before creating a migration because the required audit-event contract did not match the existing audit table. This checkpoint is superseded by the current implementation status below.

- `public.audit_logs` columns found in the schema are exactly `id uuid`, `occurred_at timestamptz`, `actor text`, `action text`, `entity_type text`, `entity_id text`, `severity text`, `metadata jsonb`, and `ip text` ([public-schema.sql:23972](../../supabase/schema/public-schema.sql#L23972)). It has no `actor_id`, `before_status`, `after_status`, `before_payment`, or `after_payment` columns. No `audit_logs` append-only trigger definition was found in the reviewed schema/migrations; the schema shows RLS enabled and an anon-write-denied policy ([public-schema.sql:49390](../../supabase/schema/public-schema.sql#L49390), [public-schema.sql:51876](../../supabase/schema/public-schema.sql#L51876)).
- `public.tm_activity` has a different contract: `task_id`, `actor_name`, `actor_role`, `action`, `action_type`, `from_value`, `to_value`, `details`, `meta`, `created_at`, `actor_id`, and `updated_at` ([public-schema.sql:32920](../../supabase/schema/public-schema.sql#L32920)). It does not provide the requested payment before/after columns or the specified `entity`/`entity_id` shape. It was not silently substituted for `audit_logs`.
- At that checkpoint no canonical `tasks` table, renamed/deprecated tables, views, server functions, or consistency-check SQL existed. Row-copy counts, assigner backfill counts/nulls, and statuses present in actual database rows were **NOT VERIFIED**; no database was queried or changed.
- The later owner approval for adding columns and append-only enforcement is recorded in the current implementation status below; it did not resolve the distinct Part B identity and enum conflicts.

## Phase 3 — Part A prepared; Part B blocked

### Part A — `audit_logs` fix

- Migration: [20261108T145300_audit_logs_truth_columns.sql](../../supabase/migrations/20261108T145300_audit_logs_truth_columns.sql). It adds nullable `actor_id uuid`, `before_state jsonb`, `after_state jsonb`, `before_status text`, `after_status text`, `before_payment text`, `after_payment text`, `request_id text`, and `hash text`; it preflights existing column types/nullability and actor references before enforcing the FK ([migration:4](../../supabase/migrations/20261108T145300_audit_logs_truth_columns.sql#L4), [migration:99](../../supabase/migrations/20261108T145300_audit_logs_truth_columns.sql#L99)).
- Unique actor matches are backfilled only when the exact email/name match resolves to one auth user. The actual mapped and unmapped counts are **NOT VERIFIED** because no local database is available. The verification script reports both counts.
- Migration definitions create an UPDATE/DELETE exception trigger and a serialized SHA-256 insert hash-chain trigger, and request pgcrypto. These are **defined but not applied or DB-verified** ([migration:133](../../supabase/migrations/20261108T145300_audit_logs_truth_columns.sql#L133), [migration:149](../../supabase/migrations/20261108T145300_audit_logs_truth_columns.sql#L149), [migration:183](../../supabase/migrations/20261108T145300_audit_logs_truth_columns.sql#L183)).
- Policies defined: `audit_logs_phase3_read` permits authenticated operator/actor reads; restrictive `audit_logs_phase3_insert_deny`, `audit_logs_phase3_update_deny`, and `audit_logs_phase3_delete_deny` deny direct client writes ([migration:192](../../supabase/migrations/20261108T145300_audit_logs_truth_columns.sql#L192), [migration:199](../../supabase/migrations/20261108T145300_audit_logs_truth_columns.sql#L199), [migration:207](../../supabase/migrations/20261108T145300_audit_logs_truth_columns.sql#L207), [migration:216](../../supabase/migrations/20261108T145300_audit_logs_truth_columns.sql#L216)). Existing restrictive `anon_write_denied` is retained ([public-schema.sql:49390](../../supabase/schema/public-schema.sql#L49390)). The service role remains able to write through its RLS bypass.
- No local/dev database is available in this environment (`psql`, Docker, and Supabase CLI are not installed; local PostgreSQL ports 5432 and 54322 have no listener). [phase_a_audit_verify.sql](../../supabase/scripts/phase_a_audit_verify.sql) contains schema/policy/trigger checks and a rolled-back insert/hash/update/delete probe. The migration has **not** been applied to production or any database.

### Part B — unified tasks not implemented

- **Status enum conflict:** the existing `tm_tasks` check permits 20 statuses. Under the approved mappings, 12 remaining values (`routed`, `available_for_claim`, `claimed`, `accepted`, `on_hold`, `blocked`, `waiting_client`, `ai_review`, `testing`, `under_review`, `completed`, `failed`) cannot be retained in the locked seven-value `task_status` enum. The schema does not define a mapping for them ([public-schema.sql:33152](../../supabase/schema/public-schema.sql#L33152)).
- **Developer ownership conflict:** `developer_tasks.developer_id` is nullable and references `developers.id`, not `auth.users.id`; the requested `tasks.developer_id NOT NULL` and RLS predicate comparing it directly to `auth.uid()` cannot be claimed safe for every existing row ([public-schema.sql:25601](../../supabase/schema/public-schema.sql#L25601), [public-schema.sql:44946](../../supabase/schema/public-schema.sql#L44946), [public-schema.sql:44962](../../supabase/schema/public-schema.sql#L44962)). The actual number of null developer IDs was not queried.
- **TM row ownership conflict:** `tm_tasks.assigned_to` is nullable and references `tm_members.id`; it is not a developer ID. A user-ID join from `tm_members.user_id` to `developers.user_id` is structurally available for assigned rows, but coverage is unverified; unassigned tasks have no such owner to populate the required NOT NULL `tasks.developer_id` ([public-schema.sql:33055](../../supabase/schema/public-schema.sql#L33055), [public-schema.sql:33152](../../supabase/schema/public-schema.sql#L33152), [public-schema.sql:47742](../../supabase/schema/public-schema.sql#L47742)).
- **Required data/column conflict:** the proposed `tasks` shape omits existing developer fields (`requirements`, `links`, `attachments`, `progress_percent`, `client_id`, `deadline`, `estimated_hours`, `task_amount`, `tech_stack`, delivery/pause timestamps and `tm_task_id`) and TM fields (`code`, `category`, `module`, `difficulty`, SLA/time/progress data, billing/approval fields, tags, metadata, and review/assignment timestamps). A copy into only the specified target columns would not preserve all source data; views cannot recover omitted values ([public-schema.sql:25601](../../supabase/schema/public-schema.sql#L25601), [public-schema.sql:33152](../../supabase/schema/public-schema.sql#L33152)).
- **Mirror identity conflict:** `developer_tasks.tm_task_id` links existing mirror rows to a different `tm_tasks.id`; the prescribed `(legacy_source, legacy_id)` unique key would copy both as separate `tasks` rows, but the view design does not specify how those linked records become one shared status-bearing task ([public-schema.sql:25601](../../supabase/schema/public-schema.sql#L25601), [public-schema.sql:33152](../../supabase/schema/public-schema.sql#L33152)).
- Part B therefore has no migration, views/renames, task RLS, task audit trigger, server-function changes, or task-path changes. No task records were copied or changed. No database row counts or assigner backfill counts were fabricated.
- [phase3_consistency_check.sql](../../supabase/scripts/phase3_consistency_check.sql) contains the requested future-state violation queries. It is **not executable against the current schema** until the `tasks` table and Part B migration exist. Its audit query checks the current task status against a recent matching audit event; historical completeness before the trigger exists cannot be proven from the current task row alone.

### Verification

- `npx.cmd tsc --noEmit -p .`: **PASS** on clean committed source snapshot `4bab4a6` (exit 0).
- `npx.cmd eslint` on the seven requested Phase 3 application paths with `--rule 'prettier/prettier: off'`: **FAIL** with one pre-existing error at [api.ts:241](../../src/lib/tm/api.ts#L241) (`no-useless-escape`, unnecessary `\-`); this file was not changed in this phase. No TypeScript/TSX files were changed, so there are no changed TS files to lint separately. The unrelated baseline lint issue was not modified.
- `npm.cmd run i18n:check`: **PASS** on clean committed source snapshot `4bab4a6`: 3,545 keyed, 167 exempt, 14,366 hardcoded strings (none new). Existing unused-key warnings remain.
- `phase_a_audit_verify.sql`: committed; expected schema/trigger/policy checks to succeed, actor counts to report actual mapped/unmapped totals, hash probe to pass, UPDATE/DELETE probes to raise `audit_logs is append-only`, then the transaction to roll back.
- `phase3_consistency_check.sql`: committed; expected all six violation queries to return zero rows only after a future, approved and successfully applied Part B migration.

### Commits

- `05a7a82 feat(db): audit logs truth columns and hash chain` — Part A migration only; not applied to any database.
- `4bab4a6 test(db): add audit and Phase 3 consistency checks` — verification scripts.
- `4f561e9 fix(db): terminate Phase A PLpgSQL blocks` — SQL syntax correction after review.
- No Part B migration, task server functions, or application read/write refactor was committed because the locked schema contract cannot preserve all existing task states/owners.

### Rollback

The Part A migration has not been applied. To cancel it before application, revert commit `05a7a82` and the verification-script commit `4bab4a6` with normal `git revert` commits; do not rewrite branch history. If Part A is later applied and audit events are written, do not drop its columns or erase hash/history. Preserve the append-only triggers and use a reviewed forward migration for any correction. Part B has no database objects to reverse.

### What was not done

No Phase B migration, task server functions, task-path refactor, payment UI, deadline cron, notifications, or dashboard UI changes were made. No Ayra, wallet, promise, PC assistant, chatbot, or AI API modules were changed. No database was accessed, no production migration was applied, and no data was deleted.
