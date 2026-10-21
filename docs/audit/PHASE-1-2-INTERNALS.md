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
$files = git diff --name-only e72394f^..f5512bb -- '*.ts' '*.tsx'
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

## Post-Phase-1/2 Clean Build

- **TS error fixed:** [AuthorProductsWorkspace.tsx:666](../../src/components/dashboard/AuthorProductsWorkspace.tsx#L666) previously referenced undefined `editableStates`; it now uses the already imported `getAuthorProductActions(editing.moderation_status).canEdit`, preserving the existing edit-state policy.
- **i18n baseline action:** regenerated `ui-source.generated.json` with `node scripts/i18n-audit.mjs --public-source` and refreshed `scripts/i18n-baseline.json` with the documented `--update-baseline` command, in a clean worktree at commit `2a86c53`. Uncommitted workspace edits were not included. The baseline now records 14,366 existing hardcoded strings in 850 files; this is the project's documented CI baseline mechanism, not a translation of those strings.
- **Final verification on the committed source tree:**
  - `npx.cmd tsc --noEmit -p .`: **PASS**, exit code 0, no diagnostics.
  - Scoped ESLint command below: **PASS**, exit code 0, zero errors and one existing `RouteAccessGate.tsx:155` Fast Refresh warning.
  - `npm.cmd run i18n:check`: **PASS** in a clean worktree at `0b4a6c3`; output: `i18n check passed: 3545 keyed, 167 exempt, 14366 hardcoded (none new).`

```powershell
$files = git diff --name-only e72394f^..f5512bb -- '*.ts' '*.tsx'
npx.cmd eslint $files --rule 'prettier/prettier: off'
```

- **Shared-worktree caveat:** the same i18n command in this checkout exits 1 because its uncommitted out-of-scope files add 42 above-baseline findings (39 are in the initial inventory below, plus `src/components/dashboard/reseller/ResellerClientsWorkspace.tsx`, `src/components/dashboard/reseller/ResellerLeadsWorkspace.tsx`, and `src/components/sapphire-home/HomeIndex.tsx`) and make the generated catalogue stale. Those worktree edits were preserved, not absorbed into the generated catalogue or baseline. The clean committed source tree is green.
- **Commits:** `2a86c53` (TS2304), `0b4a6c3` (catalogue and baseline), followed by the report commit.
- **Initial i18n scope inventory:** the initial check reported 137 above-baseline file findings before the clean-source baseline refresh. None matched the Phase 1/2 files listed in the task. The file paths were:

```text
src/components/applications/RoleApplicationsQueue.tsx
src/components/dashboard/AuthorProductsWorkspace.tsx
src/components/dashboard/franchise/FranchiseHome.tsx
src/components/dashboard/ResellerAISuitePage.tsx
src/components/dashboard/ResellerSettingsSecurity.tsx
src/components/demo-ops/OpsBrandingDomainPanels.tsx
src/components/dev-manager/DevManagerBlockedTasks.tsx
src/components/manager-suite/wall.tsx
src/components/marketplace-manager/sections/MediaLibrary.tsx
src/components/marketplace-manager/sections/ResellerManager.tsx
src/components/marketplace-manager/sections/SeoCenter.tsx
src/components/marketplace-manager/sections/SeoFrameworkTabs.tsx
src/components/marketplace-manager/sections/SeoTechnicalCrawler.tsx
src/components/marketplace-manager/sections/MarketplaceProductCountrySeoQueue.tsx
src/components/rd-module/pro-manager/PMDecisionsPending.tsx
src/components/rd-module/pro-manager/PMEscalationsQueue.tsx
src/components/rd-module/pro-manager/PMManagerSnapshot.tsx
src/components/rd-module/pro-manager/PMPromiseSLABoard.tsx
src/components/rd-module/pro-manager/PMQualityAlerts.tsx
src/components/rd-module/pro-manager/PMReportsAudit.tsx
src/components/rd-module/pro-manager/PMSystemHealth.tsx
src/components/rd-module/pro-manager/PROSidebar.tsx
src/components/rd-module/pro-manager/PROTopBar.tsx
src/components/rd-module/pro-manager/screens/PROAIHelpdesk.tsx
src/components/rd-module/pro-manager/screens/PROAlertsEscalation.tsx
src/components/rd-module/pro-manager/screens/PROAuditLogs.tsx
src/components/rd-module/pro-manager/screens/PROCommunicationLog.tsx
src/components/rd-module/pro-manager/screens/PROCompliancePolicy.tsx
src/components/rd-module/pro-manager/screens/PRODashboard.tsx
src/components/rd-module/pro-manager/screens/PROIssueBugTracker.tsx
src/components/rd-module/pro-manager/screens/PROLicenseDomain.tsx
src/components/rd-module/pro-manager/screens/PROPremiumAssist.tsx
src/components/rd-module/pro-manager/screens/PROProductOwnership.tsx
src/components/rd-module/pro-manager/screens/PROPromiseSLATracker.tsx
src/components/rd-module/pro-manager/screens/PRORenewalExpiry.tsx
src/components/rd-module/pro-manager/screens/PROSatisfactionRating.tsx
src/components/rd-module/pro-manager/screens/PROSettings.tsx
src/components/rd-module/pro-manager/screens/PROSupportRequests.tsx
src/components/rd-module/pro-manager/screens/PROUpgradeAddons.tsx
src/components/rd-module/pro-manager/screens/PROUsageLimits.tsx
src/components/rd-module/pro-manager/screens/PROUserRegistry.tsx
src/components/rd-module/rd-manager/AlertBanner.tsx
src/components/rd-module/rd-manager/OpportunityDetail.tsx
src/components/rd-module/rd-manager/screens.tsx
src/components/rd-module/rd-manager/TeamMembers.tsx
src/components/rd-module/rd-public/RequestForm.tsx
src/components/rd-module/rnd/ai-assistant/AIAssistantChat.tsx
src/components/rd-module/rnd/AIIdeaScorer.tsx
src/components/rd-module/rnd/AIRnDAssistant.tsx
src/components/rd-module/rnd/DecisionBoard.tsx
src/components/rd-module/rnd/FeedbackAnalysis.tsx
src/components/rd-module/rnd/FeedbackPortal.tsx
src/components/rd-module/rnd/FutureLab.tsx
src/components/rd-module/rnd/ImpactAnalyzer.tsx
src/components/rd-module/rnd/InnovationPipeline.tsx
src/components/rd-module/rnd/PrototypeBuilder.tsx
src/components/rd-module/rnd/RnDNotifications.tsx
src/components/rd-module/rnd/RnDSidebar.tsx
src/components/rd-module/rnd/RnDTopBar.tsx
src/components/rd-module/rnd/RnDWallet.tsx
src/components/rd-module/rnd/TechnologyRadar.tsx
src/components/rd-module/rnd/TrendScanner.tsx
src/components/rd-module/ui/breadcrumb.tsx
src/components/rd-module/ui/carousel.tsx
src/components/rd-module/ui/dialog.tsx
src/components/rd-module/ui/pagination.tsx
src/components/rd-module/ui/sheet.tsx
src/components/rd-module/ui/sidebar.tsx
src/components/reseller/ResellerReports.tsx
src/components/sales-support/modules/CallCenterModule.tsx
src/components/sales-support/modules/SalesLeadsModule.tsx
src/components/sales-support/modules/SupportTicketsModule.tsx
src/components/sales-support-manager/SSMSupportTickets.tsx
src/components/seo-manager/SeoResourceFeedback.tsx
src/components/server-manager/layout/SMSidebar.tsx
src/components/server-manager/layout/TelemetryTrend.tsx
src/components/server-manager/screens/SMAIHealthSuggestions.tsx
src/components/server-manager/screens/SMBilling.tsx
src/components/server-manager/screens/SMDeployments.tsx
src/components/server-manager/screens/SMMonitoring.tsx
src/components/server-manager/screens/SMOverview.tsx
src/components/server-manager/screens/SMPerformance.tsx
src/components/server-manager/screens/SMResources.tsx
src/components/server-manager/screens/SMServers.tsx
src/components/server-manager/screens/SMUptime.tsx
src/components/server-manager/ServerManagerDashboard.tsx
src/components/support/SafeAssistActiveBanner.tsx
src/components/ui/global-context-menu.tsx
src/components/vala-ai/studio/agent-build-panel.tsx
src/components/vala-ai/studio/ai-plan-analyzer.tsx
src/components/vala-ai/studio/code-runner.tsx
src/components/vala-ai/studio/developer-panel.tsx
src/components/vala-ai/studio/home-command-center.tsx
src/components/vala-ai/studio/live-agent-card.tsx
src/components/vala-ai/studio/manager-page.tsx
src/components/vala-ai/studio/screenshot-comparison.tsx
src/components/vala-ai/studio/software-factory.tsx
src/components/vala-ai/studio/StudioAdmin.tsx
src/components/vala-ai/studio/StudioBuilder.tsx
src/components/vala-ai/studio/StudioFlow.tsx
src/components/vala-ai/studio/StudioHome.tsx
src/components/vala-ai/studio/StudioOverview.tsx
src/components/vala-ai/studio/StudioOwner.tsx
src/components/vala-ai/studio/ui/breadcrumb.tsx
src/components/vala-ai/studio/ui/carousel.tsx
src/components/vala-ai/studio/ui/dialog.tsx
src/components/vala-ai/studio/ui/pagination.tsx
src/components/vala-ai/studio/ui/sheet.tsx
src/components/vala-ai/studio/ui/sidebar.tsx
src/components/vala-ai/ValaAIModuleContainer.tsx
src/hooks/rd-module/useProManagerAI.ts
src/hooks/rd-module/useRnDAI.ts
src/lib/use-seo-actions.ts
src/lib/vala-ai/studio/agent-store.ts
src/routes/api/applications/queue.ts
src/routes/api/author/product-files.ts
src/routes/api/author/products.ts
src/routes/api/internal/author-review.ts
src/routes/api/internal/seo-gate.ts
src/routes/api/internal/server-manager/alert-deliveries.ts
src/routes/api/internal/server-manager/subscriptions.ts
src/routes/api/manager/resource.ts
src/routes/api/marketplace/search.ts
src/routes/api/marketplace-product-country-seo-worker.ts
src/routes/api/payment/initiate.ts
src/routes/api/payment/quote.ts
src/routes/api/reseller/referral.ts
src/routes/api/seller/metrics.ts
src/routes/api/server-manager/enroll.ts
src/routes/api/server-manager/invoices.ts
src/routes/checkout.tsx
src/routes/rd-manager.index.tsx
src/routes/rd-manager.lab.tsx
src/routes/rd-manager.pro-manager.tsx
src/routes/rd-manager.start.tsx
src/routes/rd-manager.track.tsx
src/routes/rd-manager.tsx
```
