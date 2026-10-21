# Phase 1–2 Internals Audit

## 1. Summary

- `/dev-manager` now has matching operator-only route and server-function guards ([dev-manager.tsx:79](../../src/routes/dev-manager.tsx#L79), [dev-manager.functions.ts:25](../../src/lib/dev-manager.functions.ts#L25)).
- Developers are removed from the Control Panel route and server API allowlist, including cockpit figures ([RouteAccessGate.tsx:25](../../src/components/auth/RouteAccessGate.tsx#L25), [cockpit.ts:15](../../src/lib/control-panel/cockpit.ts#L15)).
- The Developer Dashboard reads only persisted `skill_tags`; existing submission reads were already filtered to the signed-in developer’s linked row ([developer-profile.functions.ts:9](../../src/lib/dashboard-records/developer-profile.functions.ts#L9), [records.functions.ts:810](../../src/lib/dashboard-records/records.functions.ts#L810)).
- Toast-only Developer Manager actions and non-persisted settings are disabled; payment wording no longer implies paid/settled status ([DMCodeSubmission.tsx:132](../../src/components/developer-management/screens/DMCodeSubmission.tsx#L132), [DMSettings.tsx:22](../../src/components/developer-management/screens/DMSettings.tsx#L22), [DMPaymentIncentive.tsx:89](../../src/components/developer-management/screens/DMPaymentIncentive.tsx#L89)).
- The audit screen reads `audit_logs`, but the supplied schema does not show append-only or tamper-evident enforcement for that table ([dev-manager.server.ts:772](../../src/lib/dev-manager.server.ts#L772), [public-schema.sql:23972](../../supabase/schema/public-schema.sql#L23972)).
- No migration, database write, or data deletion was included in these Phase 1/2 changes.
- Focused tests passed 23/23; the changed-file ESLint run has zero errors and one Fast Refresh warning.
- Full typecheck fails on an unrelated TS2304 in [AuthorProductsWorkspace.tsx:666](../../src/components/dashboard/AuthorProductsWorkspace.tsx#L666); `i18n:check` fails on unrelated worktree diagnostics and a stale generated catalogue.

## 2. Developer Dashboard fixes

| Issue | File:line | Fix | Verified (Y/N) |
|---|---|---|---|
| Developer could enter the operator Control Panel and read its server-provided cockpit figures | [RouteAccessGate.tsx:25](../../src/components/auth/RouteAccessGate.tsx#L25), [control-panel.tsx:166](../../src/routes/control-panel.tsx#L166), [cockpit.ts:15](../../src/lib/control-panel/cockpit.ts#L15), [access.server.ts:26](../../src/lib/control-panel/access.server.ts#L26) | Removed `developer` from the route and the shared server endpoint role list. Cockpit, feed, and partner endpoints use `controlPanelCaller`, which checks that list. | Y |
| Profile fields available to display | [developer-profile.functions.ts:9](../../src/lib/dashboard-records/developer-profile.functions.ts#L9), [dashboard.$role.tsx:238](../../src/routes/dashboard.$role.tsx#L238), [types.ts:7212](../../src/integrations/supabase/types.ts#L7212) | Added an authenticated read-only `skill_tags` display with loading, error, unlinked, and empty states. No write flow or new profile field was added. | Y |
| Submission ownership | [records.functions.ts:810](../../src/lib/dashboard-records/records.functions.ts#L810), [records.functions.ts:853](../../src/lib/dashboard-records/records.functions.ts#L853) | Existing query already filters by the signed-in developer’s linked `developer_id`; no code change was needed. | Y |
| Developer wallet “settled” label | [sources.ts:118](../../src/lib/dashboard-records/sources.ts#L118) | No developer wallet data source or settled label is present; the dashboard uses an unconnected/empty state. No payment claim needed correction here. | Y |
| Module loading/error/empty states | [CrudWorkspace.tsx:378](../../src/components/dashboard/CrudWorkspace.tsx#L378), [sources.ts:118](../../src/lib/dashboard-records/sources.ts#L118) | Record-backed modules have generic loading, error, and empty branches. Wallet and settings have no source/query and display a not-connected empty state; async loading/error states are not applicable until a source exists. | Y |

## 3. Developer Manager fixes

| Issue | File:line | Fix | Verified (Y/N) |
|---|---|---|---|
| Developer access to Developer Manager route/data | [dev-manager.tsx:79](../../src/routes/dev-manager.tsx#L79), [RouteAccessGate.tsx:134](../../src/components/auth/RouteAccessGate.tsx#L134), [dev-manager.functions.ts:25](../../src/lib/dev-manager.functions.ts#L25) | Route guard disables the operator bypass and names the server’s operator roles; the central route gate is operator-only. Every exported Developer Manager handler checks `requireDevManager` before admin-client work. | Y |
| Submit/Resubmit/Lock toast-only controls | [DMCodeSubmission.tsx:132](../../src/components/developer-management/screens/DMCodeSubmission.tsx#L132) | All three controls are disabled with a localized “Not yet implemented” tooltip; no mutation was invented. | Y |
| Pause/Close toast-only controls | [DMTaskManagement.tsx:223](../../src/components/developer-management/screens/DMTaskManagement.tsx#L223) | Both controls are disabled with the same localized tooltip; existing reassign/escalate actions remain active. | Y |
| Start/Stop/Send-to-QA controls without a pipeline | [DMBuildAssignment.tsx:76](../../src/components/developer-management/screens/DMBuildAssignment.tsx#L76) | All three controls are disabled with the localized tooltip. | Y |
| Settings switches have no persistence | [DMSettings.tsx:22](../../src/components/developer-management/screens/DMSettings.tsx#L22), [DMSettings.tsx:38](../../src/components/developer-management/screens/DMSettings.tsx#L38) | All 12 placeholder switches are disabled; a visible localized note says their values are not persisted. | Y |
| Payment amount falsely implied paid/settled or incentive/hold status | [DMPaymentIncentive.tsx:26](../../src/components/developer-management/screens/DMPaymentIncentive.tsx#L26), [DMPaymentIncentive.tsx:89](../../src/components/developer-management/screens/DMPaymentIncentive.tsx#L89), [devmanager.ts:347](../../src/lib/i18n/messages/devmanager.ts#L347) | Amount label is “Amount due (not paid)”; “paid”/“settled” claims and unsupported incentive/hold badges are not rendered. The amount remains a sum of completed task amounts, not a payment record. | Y |
| Audit screen data source and row mutation controls | [DMAuditLogs.tsx:45](../../src/components/developer-management/screens/DMAuditLogs.tsx#L45), [dev-manager.server.ts:772](../../src/lib/dev-manager.server.ts#L772) | Screen reads the server audit-trail query backed by `audit_logs`; controls are refresh, search, filter, pagination, and export. No row edit/delete control is present. | Y |

## 4. Verification results

### TypeScript

Command: `npx.cmd tsc --noEmit -p .`  
Status: **FAIL** (exit code 2)

```text
src/components/dashboard/AuthorProductsWorkspace.tsx(666,23): error TS2304: Cannot find name 'editableStates'.
```

This diagnostic is outside the Phase 1/2 files changed here.

### ESLint

Command:

```powershell
$files = git diff --name-only HEAD~3..HEAD -- '*.ts' '*.tsx'
npx.cmd eslint $files --rule 'prettier/prettier: off'
```

Status: **PASS** (exit code 0; zero errors)

```text
src/components/auth/RouteAccessGate.tsx
  155:17  warning  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components  react-refresh/only-export-components

✖ 1 problem (0 errors, 1 warning)
```

The remaining warning is the existing Fast Refresh warning in
[RouteAccessGate.tsx:155](../../src/components/auth/RouteAccessGate.tsx#L155).

### i18n

Command: `npm.cmd run i18n:check`  
Status: **FAIL** (exit code 1)

```text
137 above-baseline hardcoded-string diagnostics across the current worktree.
Static source catalogue is stale. Run node scripts/i18n-audit.mjs --public-source.
```

The above-baseline diagnostics are in unrelated files; none of the Phase 1/2
changed UI files was reported for new hardcoded strings. The checker also
reported 40 unused-key warnings, which are not the command's failure cause.
Refreshing the generated catalogue still left the unrelated hardcoded-string
failures, so that generated file was not changed as part of this scoped work.
No missing translation keys for the Phase 1/2 UI changes were reported.

## 5. Missing columns/features

- `developers` includes `skill_tags`, but the reviewed row has no experience-level, programming-language-list, portfolio, KYC/ID, or payout-details columns ([types.ts:7212](../../src/integrations/supabase/types.ts#L7212), [public-schema.sql:25641](../../supabase/schema/public-schema.sql#L25641)).
- A developer profile submission/edit form is **NOT VISIBLE IN PROVIDED CODE**; this change only displays the existing skill tags ([dashboard.$role.tsx:237](../../src/routes/dashboard.$role.tsx#L237)).
- A developer payment record and one-week payment trigger are **NOT VISIBLE IN PROVIDED CODE**; the Developer Manager summary computes amounts from completed developer tasks ([DMPaymentIncentive.tsx:25](../../src/components/developer-management/screens/DMPaymentIncentive.tsx#L25), [DMPaymentIncentive.tsx:89](../../src/components/developer-management/screens/DMPaymentIncentive.tsx#L89)). Task Manager's separate wallet query selects `tm_tasks.settled_at`, but no seven-day developer payout rule is visible there ([task-service.functions.ts:673](../../src/lib/tm/task-service.functions.ts#L673)).
- Developer-facing deadline alert/notification behavior is **NOT VISIBLE IN PROVIDED CODE**. Developer Manager auto-escalation runs when its authorized overview is loaded, not from a verified cron ([dev-manager.server.ts:255](../../src/lib/dev-manager.server.ts#L255), [dev-manager.server.ts:438](../../src/lib/dev-manager.server.ts#L438)).
- The `audit_logs` schema has no before/after columns or visible append-only/hash-chain/WORM enforcement ([public-schema.sql:23972](../../supabase/schema/public-schema.sql#L23972), [public-schema.sql:49390](../../supabase/schema/public-schema.sql#L49390)).
- Developer RLS allows updating an owned `developer_tasks` row without a column-level restriction; its own-submission INSERT policy does not constrain `review_status`. Manager-only verified state is therefore not guaranteed by those policies ([public-schema.sql:53711](../../supabase/schema/public-schema.sql#L53711), [public-schema.sql:53639](../../supabase/schema/public-schema.sql#L53639)).
- Developer Manager audit writes happen in application code after several state writes; atomic DB transaction coupling is **NOT VISIBLE IN PROVIDED CODE** ([dev-manager.server.ts:590](../../src/lib/dev-manager.server.ts#L590), [dev-manager.server.ts:604](../../src/lib/dev-manager.server.ts#L604)).

## 6. What was NOT done

- No feature-module wiring was added; the profile read is a dashboard-records server function and reuses the REST helper already used by that layer ([records.functions.ts:4](../../src/lib/dashboard-records/records.functions.ts#L4), [developer-profile.functions.ts:9](../../src/lib/dashboard-records/developer-profile.functions.ts#L9)).
- No migrations, schema edits, database writes, or data deletions were made by these changes.
- No submission form, payout processing, one-week scheduler, KYC flow, or profile write flow was added ([sources.ts:118](../../src/lib/dashboard-records/sources.ts#L118), [developer-profile.functions.ts:9](../../src/lib/dashboard-records/developer-profile.functions.ts#L9)).
- The Task Manager implementation and the AI API Manager `/manager` module were not changed ([task-manager.tsx:28](../../src/routes/task-manager.tsx#L28), [manager.tsx:19](../../src/routes/manager.tsx#L19)).
- No database/RLS audit-truth repair was made; the existing spoofable task/submission write policies remain for a separately approved migration ([public-schema.sql:53639](../../supabase/schema/public-schema.sql#L53639), [public-schema.sql:53711](../../supabase/schema/public-schema.sql#L53711)).
- The route and access details are recorded in the separate [role matrix](./role-matrix.md).

## 7. Next phase recommendation

Before enabling submissions or payment claims, separately authorize a schema/RLS change that prevents developers from writing manager-owned task/review fields, and couple each state mutation to an append-only actor-stamped audit record in one transaction; then define a persisted payment record and a verifiable seven-day trigger. The present code proves neither immutable audit storage nor a payment SLA, and this phase deliberately created no migration ([public-schema.sql:53639](../../supabase/schema/public-schema.sql#L53639), [public-schema.sql:53711](../../supabase/schema/public-schema.sql#L53711), [public-schema.sql:23972](../../supabase/schema/public-schema.sql#L23972), [DMPaymentIncentive.tsx:89](../../src/components/developer-management/screens/DMPaymentIncentive.tsx#L89)).
