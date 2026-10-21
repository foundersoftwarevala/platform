# Phase 3 Unified Tasks — Blocked at Schema/State Contract

## 1. Canonical decision

Recommend **(A) `tm_tasks` as the eventual canonical table**, because it already owns the Task Manager lifecycle, database transition enforcement, status audit trigger, and append-only `tm_activity`; see the [decision record](./PHASE-3-CANONICAL-DECISION.md). This recommendation is not a safe authorization to migrate yet: the requested `manager_id`, developer identity crosswalk, status semantics, and payment/verification backfill are not established in the inspected schema ([public-schema.sql:33152](../../supabase/schema/public-schema.sql#L33152), [public-schema.sql:25601](../../supabase/schema/public-schema.sql#L25601)).

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

- `npx.cmd tsc --noEmit -p .`: **NOT RUN for this blocked Phase 3 change**; no TypeScript changes were made.
- `npx.cmd eslint <changed files> --rule 'prettier/prettier: off'`: **NOT RUN for this blocked Phase 3 change**; no TypeScript/TSX changes were made.
- `npm.cmd run i18n:check`: **NOT RUN for this blocked Phase 3 change**; no user-facing strings or translations were changed.
- No migration was applied or executed, and no production database was accessed.

## 7. What was NOT done

- No migration, consistency-check SQL, or data-path refactor was created.
- No dashboard UI, payment UI, deadline cron, or notification work was done.
- No `developer_tasks`, `tm_tasks`, or audit data was changed or deleted.
- No later-phase module was touched. No changes were made to any listed application path.

## 8. Rollback instructions

No Phase 3 migration or data-path change exists to roll back. The only new artifacts are these audit documents. The recommendation for a future migration is to keep `tm_tasks` canonical and retain the existing tables until a documented, data-verified crosswalk exists. Before a future deployment, rehearse a transaction rollback against a non-production database; after application writes begin, do not drop or restore task data—use an additive forward repair or a reviewed commit revert, and preserve both task tables and their audit history.
