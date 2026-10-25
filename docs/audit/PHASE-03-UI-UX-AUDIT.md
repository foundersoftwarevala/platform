# Phase 03 - UI/UX & Navigation Audit (Partial)

**Audit date:** 2026-10-24

**Target:** https://softwarevala.net

**Mode:** Read-only production audit; a local responsive CSS fix was made. No production data was changed and no deployment was performed.

**Overall status:** 🟠 Partial - this is not a platform-wide sign-off.

## Executive summary

- Parsed the generated TanStack route inventory in [routeTree.gen.ts](../../src/routeTree.gen.ts): **275 non-API UI route nodes** and **264 unique effective path patterns**. The inventory excludes API, health/readiness, and sitemap routes; duplicate effective paths are retained as separate route-node rows (e.g. layouts/index nodes).
- **39/264 route patterns (14.8%) were checked**: the original public-route sample plus 31 additional patterns, including 19 additional AI CEO paths and key administrator/manager pages. **36/264 (13.6%) rendered expected page content**, two remained on access/loading screens, and AMS Overview returned HTTP 500. Route coverage is not interaction coverage.
- The central [RouteAccessGate.tsx](../../src/components/auth/RouteAccessGate.tsx) has 42 path-prefix rules; **215/275 generated UI route nodes match those prefixes**. This is a static access-scope count, not a runtime test. Other routes may have route-local guards.
- The mobile utility-strip defect is **fixed in source** by allowing wrapped rows to grow. A 390x844 browser comparison against the live DOM with the exact CSS override measured overlap changing from true to false; production itself has not been deployed with this fix.
- No document-level horizontal overflow was measured at 390px or 1440px viewport width. Fine-pointer emulation was used; coarse-pointer and real touch behavior were **not tested**.
- Authenticated navigation succeeded and displayed the Super Admin control-panel shell. No contact, payment, approval, import, create/update/delete, or other production-writing form was submitted. The chat-consent prompt was not accepted.
- A clean homepage sample had no captured console errors. A media/localization request canceled during navigation (ERR_ABORTED) was not counted as a defect. The missing marketplace slot and unknown route returned expected 404 states.

## Coverage calculation

| Measure | Numerator / denominator | Coverage | Notes |
|---|---:|---:|---|
| Unique effective route patterns checked | 39 / 264 | 14.8% | Includes AYRA, Control Panel, and manager-route navigation. |
| Unique route patterns with expected page content rendered | 36 / 264 | 13.6% | Two routes remained on access/loading screens; AMS Overview returned HTTP 500. |
| Homepage interactive controls | 2 named controls exercised | Not safely generalizable | Search + category selector were tested. Current DOM selector count varied by viewport/content (98 at 390px; 802 at 1440px), so no single stable platform-control denominator is claimed. |

**Routes checked:** the original eight route patterns plus 31 additional unique patterns listed in the authenticated route table below (39/264 total).

## Findings

| # | Status | URL / viewport | Evidence | Source | Recommended follow-up |
|---|---|---|---|---|---|
| 1 | 🟠 Confirmed on live site; source fix verified, not deployed | https://softwarevala.net/ at 390x844 | Before: utility wrapper 17px high while its three control rows extended to y=238; the announcement began at y=126, so they overlapped. Applying the CSS fix to the live DOM expanded the strip to y=249 and moved the announcement to y=249; overlap changed from true to false. No horizontal overflow. | [UtilityStrip.tsx:11](../../src/components/marketplace-home/UtilityStrip.tsx#L11), [TopUtilityBar.tsx:1369](../../src/components/marketplace-home/TopUtilityBar.tsx#L1369), [marketplace-home.css:192](../../src/styles/marketplace-home.css#L192) | Source now allows wrapped rows to grow. Deploy through the normal approved release process, then verify on production and coarse-pointer hardware. |
| 2 | 🟠 Authenticated partial | /ai-ceo/ayra, /control-panel | The authenticated Super Admin session rendered both surfaces. AYRA's read-only dashboard was visible; Control Panel showed its dashboard/sidebar plus repeated `useAuth must be used within an AuthProvider` diagnostics. See findings 7-8 and authenticated route checks below. | [RouteAccessGate.tsx](../../src/components/auth/RouteAccessGate.tsx), [AICEOAyra.tsx](../../src/components/ai-ceo/sections/AICEOAyra.tsx), [control-panel.tsx](../../src/routes/control-panel.tsx) | Use the authenticated-route evidence below; retest unresolved pages with a fresh authorized session. |
| 3 | 🟠 Not tested for safety | /contact and all production-mutating controls | Contact form rendered but was not submitted. No create/update/delete, payment, payout, approval, message-send, or other business-write action was executed in production. | Route-specific files in inventory below | Exercise state-changing controls in staging with disposable fixtures and a cleanup plan. |
| 4 | 🟡 Needs content confirmation | /blog/ | HTTP 200 and "Nothing to read" empty state appeared. No authorized content inventory was checked, so this is not confirmed as a defect. | [blog.index.tsx](../../src/routes/blog.index.tsx) | Confirm whether production is expected to contain published blog entries; then re-test with an approved content fixture if needed. |
| 5 | 🟡 Broad audit incomplete | All remaining routes and controls | The route inventory below marks each generated UI route node. Most are unvisited; public routes may also have local auth guards. Responsive, keyboard, screen-reader, loading/error, modal/dropdown, form validation, pagination, and role-specific paths are not comprehensively covered. | [routeTree.gen.ts](../../src/routeTree.gen.ts) | Continue by route group and role on staging, including actual outcomes for every interactive control. |
| 6 | 🔴 Confirmed live-route failure | https://softwarevala.net/ams/overview | Authenticated route returned HTTP 500. Browser console reported `Unauthorized: No authorization header provided`. No write action was attempted. | [ams.overview.tsx](../../src/routes/ams.overview.tsx), [ams/](../../src/routes) | Trace the route's authenticated API/request context; confirm the intended Super Admin caller contract and retest with a fresh authorized session. |
| 7 | 🟠 Live deployment mismatch | https://softwarevala.net/ai-ceo/ayra | Authenticated read-only dashboard rendered at desktop/mobile widths, but the live page contained no Agent Workspace text and no iframe. The checked-out [AICEOAyra.tsx](../../src/components/ai-ceo/sections/AICEOAyra.tsx) currently includes an iframe, so production and working-tree behavior differ. | [ai-ceo.ayra.tsx](../../src/routes/ai-ceo.ayra.tsx), [AICEOAyra.tsx](../../src/components/ai-ceo/sections/AICEOAyra.tsx) | Verify the intended release; deploy only through the approved release process, then verify iframe/tunnel availability from the user's browser. |
| 8 | 🔴 Confirmed Control Panel diagnostic | https://softwarevala.net/control-panel | Authenticated dashboard and sidebar rendered, but repeated runtime diagnostics stated `useAuth must be used within an AuthProvider` (5x/15m, later 16x/15m). Desktop and mobile document widths showed no horizontal overflow. | [control-panel.tsx](../../src/routes/control-panel.tsx), [useAuth.tsx](../../src/hooks/useAuth.tsx) | Trace the erroring component/provider boundary and inspect related failed resources; retest affected cards/panels after correction. |
| 9 | 🟠 Incomplete authenticated check | /rd-manager, /task-manager | R&D remained on Checking workspace access; Task Manager showed a loading state. During later checks the authenticated session had expired, so these are not confirmed functional defects. | [rd-manager.tsx](../../src/routes/rd-manager.tsx), [task-manager.tsx](../../src/routes/task-manager.tsx) | Re-run with a fresh Super Admin browser session and capture final rendered states. |

### Authenticated critical-route spot checks

The following are route-load and visible-content checks only. Buttons, forms, approvals, import, payment, and other state-changing actions were not invoked.

| Route | Browser result | Visible evidence |
|---|---|---|
| /control-panel | HTTP 200; authenticated Super Admin shell | Control Panel dashboard and sidebar rendered; browser displayed repeated "useAuth must be used within an AuthProvider" runtime diagnostics (5x/15m and later 16x/15m). |
| /admin/import | HTTP 200 | Demo Import page described inserting demo records; Start Import was not clicked. |
| /ai-ceo | HTTP 200 | AI CEO Dashboard heading and executive overview rendered. |
| /ai-ceo/ayra | HTTP 200 | Read-only platform intelligence and live data summary rendered at desktop and mobile widths; no Agent Workspace label or iframe existed in the production DOM. |
| /ai-ceo/approvals | HTTP 200 | Approval Suggestions queue showed 0 awaiting decision; approve/reject actions were not used. |
| /ai-ceo/agents | HTTP 200 | Agents page rendered with its navigation and read state. |
| /ai-ceo/automations | HTTP 200 | Automations page rendered with its navigation and read state. |
| /ai-ceo/decision-engine | HTTP 200 | Decision Engine page rendered. |
| /ai-ceo/healing | HTTP 200 | Self-Healing page rendered. |
| /ai-ceo/insights | HTTP 200 | AI insights page rendered. |
| /ai-ceo/live-monitor | HTTP 200 | Live Action Monitor rendered. |
| /ai-ceo/morning | HTTP 200 | Morning AI page rendered. |
| /ai-ceo/notifications | HTTP 200 | Notifications page rendered. |
| /ai-ceo/performance | HTTP 200 | Performance Intelligence page rendered. |
| /ai-ceo/learning | HTTP 200 | System Learning Log rendered. |
| /ai-ceo/predictions | HTTP 200 | Predictive Insights page rendered. |
| /ai-ceo/reports | HTTP 200 | AI Reports page rendered. |
| /ai-ceo/risk | HTTP 200 | Risk & Compliance page rendered. |
| /ai-ceo/security | HTTP 200 | Security signals page rendered. |
| /ai-ceo/settings | HTTP 200 | Settings page identified itself as a read-only configuration surface. |
| /ai-ceo/usage | HTTP 200 | API usage and spend page rendered. |
| /ai-ceo/tasks | HTTP 200 | Tasks page rendered. |
| /marketplace-manager | HTTP 200 | Marketplace dashboard/KPIs rendered; the historical Invalid URL failure did not reproduce in this session. |
| /server-manager | HTTP 200 | Server Overview rendered; displayed status Unknown. |
| /ai-api-manager | HTTP 200, redirected to /manager/ai-api | AI API dashboard rendered. |
| /dev-manager | HTTP 200 | Developer Dashboard rendered. |
| /rd-manager | HTTP 200, incomplete | Page remained on Checking workspace access; later auth state was no longer available. |
| /task-manager | HTTP 200, partial | Task shell rendered, then Loading task control; full data state was not verified. |
| /promise-tracker | HTTP 200 | Promise Tracker Overview rendered; displayed 0 active and 0 overdue while data was connecting. |
| /demo-manager | HTTP 200 | Demo Dashboard rendered. |
| /ams/overview | HTTP 500 | Console error: Unauthorized: No authorization header provided. |
| /seo-manager | HTTP 200 | SEO Manager dashboard navigation rendered. |
| /finance-manager | HTTP 200, partial | Billing Engine rendered; data remained loading. |

The application session expired during the later spot checks; the routes that remained at access/loading screens are not counted as successful page-content renders. No credentials are included in this report.

### Targeted checks that passed (limited scope)

- / returned HTTP 200 and rendered the homepage. At 1440x900 and 390x844, documentElement.scrollWidth equaled clientWidth.
- Search for "school management" returned matching results (4,639 matching count shown; 40 cards on the first page). A unique no-match search showed zero results and an empty-state message.
- Selecting retail-pos showed the "Retail & POS - 106" category state and products. A clean interaction reproduced successfully.
- /login, /vala-tv, /blog, and /contact rendered HTTP 200. Their full forms/actions were not exercised.
- /marketplace/education/angola rendered HTTP 200 for an occupied slot. /marketplace/academy/atlantis displayed the expected missing-slot state and 404. An arbitrary unknown path also showed the expected not-found page.
- Authenticated /ai-ceo/ayra and /control-panel rendered. AYRA is read-only; Control Panel displayed repeated runtime diagnostics. See findings above.

## Route-by-route inventory

Status meanings: 🟢 fully tested; 🔴 confirmed defect; 🟠 partial/blocked; 🟡 not tested/evidence missing. No entire route is marked green because the route's complete control set was not tested. A route with one issue may be listed as partial here; the defect itself is recorded above.

| Effective route pattern | Route source | Audit status / evidence |
|---|---|---|
| <code>/</code> | [src/routes/index.tsx](../../src/routes/index.tsx) | 🟠 PARTIAL - public homepage and targeted search/filter tested; CSS fix verified against live DOM but not deployed |
| <code>/academy/</code> | [src/routes/academy.index.tsx](../../src/routes/academy.index.tsx) | 🟡 NOT TESTED |
| <code>/academy/$course</code> | [src/routes/academy.$course.tsx](../../src/routes/academy.$course.tsx) | 🟡 NOT TESTED |
| <code>/account/purchases</code> | [src/routes/account/purchases.tsx](../../src/routes/account/purchases.tsx) | 🟡 NOT TESTED |
| <code>/admin/import</code> | [src/routes/admin.import.tsx](../../src/routes/admin.import.tsx) | 🟠 PARTIAL - HTTP 200; Demo Import form rendered; import button intentionally not submitted |
| <code>/affiliate-manager</code> | [src/routes/affiliate-manager.tsx](../../src/routes/affiliate-manager.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/affiliate-manager</code> | [src/routes/affiliate-manager.index.tsx](../../src/routes/affiliate-manager.index.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/affiliate-manager/affiliate-links</code> | [src/routes/affiliate-manager.affiliate-links.tsx](../../src/routes/affiliate-manager.affiliate-links.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/affiliate-manager/affiliates</code> | [src/routes/affiliate-manager.affiliates.tsx](../../src/routes/affiliate-manager.affiliates.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/affiliate-manager/affiliates/$id</code> | [src/routes/affiliate-manager.affiliates.$id.tsx](../../src/routes/affiliate-manager.affiliates.$id.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/affiliate-manager/analytics</code> | [src/routes/affiliate-manager.analytics.tsx](../../src/routes/affiliate-manager.analytics.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/affiliate-manager/applications</code> | [src/routes/affiliate-manager.applications.tsx](../../src/routes/affiliate-manager.applications.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/affiliate-manager/audit-log</code> | [src/routes/affiliate-manager.audit-log.tsx](../../src/routes/affiliate-manager.audit-log.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/affiliate-manager/bulk-actions</code> | [src/routes/affiliate-manager.bulk-actions.tsx](../../src/routes/affiliate-manager.bulk-actions.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/affiliate-manager/campaigns</code> | [src/routes/affiliate-manager.campaigns.tsx](../../src/routes/affiliate-manager.campaigns.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/affiliate-manager/commissions</code> | [src/routes/affiliate-manager.commissions.tsx](../../src/routes/affiliate-manager.commissions.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/affiliate-manager/communication</code> | [src/routes/affiliate-manager.communication.tsx](../../src/routes/affiliate-manager.communication.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/affiliate-manager/compliance</code> | [src/routes/affiliate-manager.compliance.tsx](../../src/routes/affiliate-manager.compliance.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/affiliate-manager/coupons</code> | [src/routes/affiliate-manager.coupons.tsx](../../src/routes/affiliate-manager.coupons.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/affiliate-manager/customers</code> | [src/routes/affiliate-manager.customers.tsx](../../src/routes/affiliate-manager.customers.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/affiliate-manager/documents</code> | [src/routes/affiliate-manager.documents.tsx](../../src/routes/affiliate-manager.documents.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/affiliate-manager/export</code> | [src/routes/affiliate-manager.export.tsx](../../src/routes/affiliate-manager.export.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/affiliate-manager/import</code> | [src/routes/affiliate-manager.import.tsx](../../src/routes/affiliate-manager.import.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/affiliate-manager/leads</code> | [src/routes/affiliate-manager.leads.tsx](../../src/routes/affiliate-manager.leads.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/affiliate-manager/marketing</code> | [src/routes/affiliate-manager.marketing.tsx](../../src/routes/affiliate-manager.marketing.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/affiliate-manager/marketplace</code> | [src/routes/affiliate-manager.marketplace.tsx](../../src/routes/affiliate-manager.marketplace.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/affiliate-manager/orders</code> | [src/routes/affiliate-manager.orders.tsx](../../src/routes/affiliate-manager.orders.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/affiliate-manager/payouts</code> | [src/routes/affiliate-manager.payouts.tsx](../../src/routes/affiliate-manager.payouts.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/affiliate-manager/performance</code> | [src/routes/affiliate-manager.performance.tsx](../../src/routes/affiliate-manager.performance.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/affiliate-manager/products</code> | [src/routes/affiliate-manager.products.tsx](../../src/routes/affiliate-manager.products.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/affiliate-manager/realtime-test</code> | [src/routes/affiliate-manager.realtime-test.tsx](../../src/routes/affiliate-manager.realtime-test.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/affiliate-manager/referral-codes</code> | [src/routes/affiliate-manager.referral-codes.tsx](../../src/routes/affiliate-manager.referral-codes.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/affiliate-manager/referral-network</code> | [src/routes/affiliate-manager.referral-network.tsx](../../src/routes/affiliate-manager.referral-network.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/affiliate-manager/reports</code> | [src/routes/affiliate-manager.reports.tsx](../../src/routes/affiliate-manager.reports.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/affiliate-manager/sales</code> | [src/routes/affiliate-manager.sales.tsx](../../src/routes/affiliate-manager.sales.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/affiliate-manager/search</code> | [src/routes/affiliate-manager.search.tsx](../../src/routes/affiliate-manager.search.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/affiliate-manager/settings</code> | [src/routes/affiliate-manager.settings.tsx](../../src/routes/affiliate-manager.settings.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/affiliate-manager/support</code> | [src/routes/affiliate-manager.support.tsx](../../src/routes/affiliate-manager.support.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/affiliate-manager/wallet</code> | [src/routes/affiliate-manager.wallet.tsx](../../src/routes/affiliate-manager.wallet.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ai-api-manager</code> | [src/routes/ai-api-manager.tsx](../../src/routes/ai-api-manager.tsx) | 🟠 PARTIAL - HTTP 200; route redirected to /manager/ai-api; dashboard rendered |
| <code>/ai-ceo</code> | [src/routes/ai-ceo.tsx](../../src/routes/ai-ceo.tsx) | 🟠 PARTIAL - HTTP 200; AI CEO Dashboard rendered; controls not submitted |
| <code>/ai-ceo</code> | [src/routes/ai-ceo.index.tsx](../../src/routes/ai-ceo.index.tsx) | 🟠 PARTIAL - HTTP 200; AI CEO Dashboard rendered; controls not submitted |
| <code>/ai-ceo/agents</code> | [src/routes/ai-ceo.agents.index.tsx](../../src/routes/ai-ceo.agents.index.tsx) | 🟠 PARTIAL - HTTP 200; Agents page rendered; data-read state shown; controls not submitted |
| <code>/ai-ceo/agents/$agentId</code> | [src/routes/ai-ceo.agents.$agentId.tsx](../../src/routes/ai-ceo.agents.$agentId.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ai-ceo/approvals</code> | [src/routes/ai-ceo.approvals.tsx](../../src/routes/ai-ceo.approvals.tsx) | 🟠 PARTIAL - HTTP 200; Approvals queue rendered and empty; approve/reject not clicked |
| <code>/ai-ceo/automations</code> | [src/routes/ai-ceo.automations.tsx](../../src/routes/ai-ceo.automations.tsx) | 🟠 PARTIAL - HTTP 200; Automations page rendered; controls not submitted |
| <code>/ai-ceo/ayra</code> | [src/routes/ai-ceo.ayra.tsx](../../src/routes/ai-ceo.ayra.tsx) | 🟠 PARTIAL - authenticated read-only AYRA dashboard rendered at desktop/mobile; production page had no Agent Workspace text or iframe |
| <code>/ai-ceo/decision-engine</code> | [src/routes/ai-ceo.decision-engine.tsx](../../src/routes/ai-ceo.decision-engine.tsx) | 🟠 PARTIAL - HTTP 200; Decision Engine page rendered; actions not submitted |
| <code>/ai-ceo/healing</code> | [src/routes/ai-ceo.healing.tsx](../../src/routes/ai-ceo.healing.tsx) | 🟠 PARTIAL - HTTP 200; Self-Healing page rendered; controls not submitted |
| <code>/ai-ceo/insights</code> | [src/routes/ai-ceo.insights.tsx](../../src/routes/ai-ceo.insights.tsx) | 🟠 PARTIAL - HTTP 200; AI insights page rendered; controls not submitted |
| <code>/ai-ceo/learning</code> | [src/routes/ai-ceo.learning.tsx](../../src/routes/ai-ceo.learning.tsx) | 🟠 PARTIAL - HTTP 200; System Learning Log rendered; controls not submitted |
| <code>/ai-ceo/live-monitor</code> | [src/routes/ai-ceo.live-monitor.tsx](../../src/routes/ai-ceo.live-monitor.tsx) | 🟠 PARTIAL - HTTP 200; Live Action Monitor rendered; controls not submitted |
| <code>/ai-ceo/morning</code> | [src/routes/ai-ceo.morning.tsx](../../src/routes/ai-ceo.morning.tsx) | 🟠 PARTIAL - HTTP 200; Morning AI page rendered; controls not submitted |
| <code>/ai-ceo/notifications</code> | [src/routes/ai-ceo.notifications.tsx](../../src/routes/ai-ceo.notifications.tsx) | 🟠 PARTIAL - HTTP 200; Notifications page rendered; controls not submitted |
| <code>/ai-ceo/performance</code> | [src/routes/ai-ceo.performance.tsx](../../src/routes/ai-ceo.performance.tsx) | 🟠 PARTIAL - HTTP 200; Performance Intelligence rendered; controls not submitted |
| <code>/ai-ceo/predictions</code> | [src/routes/ai-ceo.predictions.tsx](../../src/routes/ai-ceo.predictions.tsx) | 🟠 PARTIAL - HTTP 200; Predictive Insights rendered; controls not submitted |
| <code>/ai-ceo/reports</code> | [src/routes/ai-ceo.reports.tsx](../../src/routes/ai-ceo.reports.tsx) | 🟠 PARTIAL - HTTP 200; AI Reports rendered; controls not submitted |
| <code>/ai-ceo/risk</code> | [src/routes/ai-ceo.risk.tsx](../../src/routes/ai-ceo.risk.tsx) | 🟠 PARTIAL - HTTP 200; Risk & Compliance page rendered; controls not submitted |
| <code>/ai-ceo/security</code> | [src/routes/ai-ceo.security.tsx](../../src/routes/ai-ceo.security.tsx) | 🟠 PARTIAL - HTTP 200; Security signals rendered; controls not submitted |
| <code>/ai-ceo/settings</code> | [src/routes/ai-ceo.settings.tsx](../../src/routes/ai-ceo.settings.tsx) | 🟠 PARTIAL - HTTP 200; read-only settings surface rendered; controls not submitted |
| <code>/ai-ceo/tasks</code> | [src/routes/ai-ceo.tasks.index.tsx](../../src/routes/ai-ceo.tasks.index.tsx) | 🟠 PARTIAL - HTTP 200; Tasks page rendered; controls not submitted |
| <code>/ai-ceo/tasks/$taskId</code> | [src/routes/ai-ceo.tasks.$taskId.tsx](../../src/routes/ai-ceo.tasks.$taskId.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ai-ceo/usage</code> | [src/routes/ai-ceo.usage.tsx](../../src/routes/ai-ceo.usage.tsx) | 🟠 PARTIAL - HTTP 200; API usage and spend rendered; controls not submitted |
| <code>/ai/assistant</code> | [src/routes/ai.assistant.tsx](../../src/routes/ai.assistant.tsx) | 🟡 NOT TESTED |
| <code>/ai/compare</code> | [src/routes/ai.compare.tsx](../../src/routes/ai.compare.tsx) | 🟡 NOT TESTED |
| <code>/ai/finder</code> | [src/routes/ai.finder.tsx](../../src/routes/ai.finder.tsx) | 🟡 NOT TESTED |
| <code>/ai/recommend</code> | [src/routes/ai.recommend.tsx](../../src/routes/ai.recommend.tsx) | 🟡 NOT TESTED |
| <code>/ams</code> | [src/routes/ams.tsx](../../src/routes/ams.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams</code> | [src/routes/ams.index.tsx](../../src/routes/ams.index.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams-manager</code> | [src/routes/ams-manager.tsx](../../src/routes/ams-manager.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/achievement-vault</code> | [src/routes/ams.achievement-vault.tsx](../../src/routes/ams.achievement-vault.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/achievements</code> | [src/routes/ams.achievements.tsx](../../src/routes/ams.achievements.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/ai</code> | [src/routes/ams.ai.tsx](../../src/routes/ams.ai.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/analytics</code> | [src/routes/ams.analytics.tsx](../../src/routes/ams.analytics.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/audit</code> | [src/routes/ams.audit.tsx](../../src/routes/ams.audit.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/author-progression</code> | [src/routes/ams.author-progression.tsx](../../src/routes/ams.author-progression.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/award-vault</code> | [src/routes/ams.award-vault.tsx](../../src/routes/ams.award-vault.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/awards</code> | [src/routes/ams.awards.index.tsx](../../src/routes/ams.awards.index.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/awards/$id</code> | [src/routes/ams.awards.$id.tsx](../../src/routes/ams.awards.$id.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/awards/$id/edit</code> | [src/routes/ams.awards.$id.edit.tsx](../../src/routes/ams.awards.$id.edit.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/awards/audit</code> | [src/routes/ams.awards.audit.tsx](../../src/routes/ams.awards.audit.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/awards/categories</code> | [src/routes/ams.awards.categories.tsx](../../src/routes/ams.awards.categories.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/awards/effects</code> | [src/routes/ams.awards.effects.tsx](../../src/routes/ams.awards.effects.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/awards/libraries/achievements</code> | [src/routes/ams.awards.libraries.achievements.tsx](../../src/routes/ams.awards.libraries.achievements.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/awards/libraries/badges</code> | [src/routes/ams.awards.libraries.badges.tsx](../../src/routes/ams.awards.libraries.badges.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/awards/libraries/ranks</code> | [src/routes/ams.awards.libraries.ranks.tsx](../../src/routes/ams.awards.libraries.ranks.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/awards/libraries/trophies</code> | [src/routes/ams.awards.libraries.trophies.tsx](../../src/routes/ams.awards.libraries.trophies.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/awards/new</code> | [src/routes/ams.awards.new.tsx](../../src/routes/ams.awards.new.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/awards/rules/levels</code> | [src/routes/ams.awards.rules.levels.tsx](../../src/routes/ams.awards.rules.levels.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/awards/rules/milestones</code> | [src/routes/ams.awards.rules.milestones.tsx](../../src/routes/ams.awards.rules.milestones.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/awards/rules/rewards</code> | [src/routes/ams.awards.rules.rewards.tsx](../../src/routes/ams.awards.rules.rewards.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/awards/rules/streaks</code> | [src/routes/ams.awards.rules.streaks.tsx](../../src/routes/ams.awards.rules.streaks.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/awards/rules/xp</code> | [src/routes/ams.awards.rules.xp.tsx](../../src/routes/ams.awards.rules.xp.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/badge-vault</code> | [src/routes/ams.badge-vault.tsx](../../src/routes/ams.badge-vault.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/badges</code> | [src/routes/ams.badges.tsx](../../src/routes/ams.badges.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/certificate-vault</code> | [src/routes/ams.certificate-vault.tsx](../../src/routes/ams.certificate-vault.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/certificates</code> | [src/routes/ams.certificates.tsx](../../src/routes/ams.certificates.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/challenges</code> | [src/routes/ams.challenges.tsx](../../src/routes/ams.challenges.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/chat</code> | [src/routes/ams.chat.tsx](../../src/routes/ams.chat.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/claims</code> | [src/routes/ams.claims.tsx](../../src/routes/ams.claims.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/collection</code> | [src/routes/ams.collection.index.tsx](../../src/routes/ams.collection.index.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/collection/$type</code> | [src/routes/ams.collection.$type.tsx](../../src/routes/ams.collection.$type.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/collections</code> | [src/routes/ams.collections.tsx](../../src/routes/ams.collections.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/developer-progression</code> | [src/routes/ams.developer-progression.tsx](../../src/routes/ams.developer-progression.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/founder-seal-vault</code> | [src/routes/ams.founder-seal-vault.tsx](../../src/routes/ams.founder-seal-vault.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/hall-of-fame</code> | [src/routes/ams.hall-of-fame.tsx](../../src/routes/ams.hall-of-fame.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/hall-of-fame-vault</code> | [src/routes/ams.hall-of-fame-vault.tsx](../../src/routes/ams.hall-of-fame-vault.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/honor-coin-vault</code> | [src/routes/ams.honor-coin-vault.tsx](../../src/routes/ams.honor-coin-vault.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/identity</code> | [src/routes/ams.identity.tsx](../../src/routes/ams.identity.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/identity-card-vault</code> | [src/routes/ams.identity-card-vault.tsx](../../src/routes/ams.identity-card-vault.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/leaderboards</code> | [src/routes/ams.leaderboards.tsx](../../src/routes/ams.leaderboards.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/legacy</code> | [src/routes/ams.legacy.tsx](../../src/routes/ams.legacy.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/legacy-medal-vault</code> | [src/routes/ams.legacy-medal-vault.tsx](../../src/routes/ams.legacy-medal-vault.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/levels</code> | [src/routes/ams.levels.tsx](../../src/routes/ams.levels.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/license-card-vault</code> | [src/routes/ams.license-card-vault.tsx](../../src/routes/ams.license-card-vault.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/membership-vault</code> | [src/routes/ams.membership-vault.tsx](../../src/routes/ams.membership-vault.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/missions</code> | [src/routes/ams.missions.tsx](../../src/routes/ams.missions.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/museum</code> | [src/routes/ams.museum.index.tsx](../../src/routes/ams.museum.index.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/museum/$showcase</code> | [src/routes/ams.museum.$showcase.tsx](../../src/routes/ams.museum.$showcase.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/notifications</code> | [src/routes/ams.notifications.tsx](../../src/routes/ams.notifications.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/overview</code> | [src/routes/ams.overview.tsx](../../src/routes/ams.overview.tsx) | 🔴 CONFIRMED DEFECT - HTTP 500; console reported Unauthorized: No authorization header provided |
| <code>/ams/passport</code> | [src/routes/ams.passport.tsx](../../src/routes/ams.passport.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/passport-vault</code> | [src/routes/ams.passport-vault.tsx](../../src/routes/ams.passport-vault.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/quests</code> | [src/routes/ams.quests.tsx](../../src/routes/ams.quests.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/rank-vault</code> | [src/routes/ams.rank-vault.tsx](../../src/routes/ams.rank-vault.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/ranks</code> | [src/routes/ams.ranks.tsx](../../src/routes/ams.ranks.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/recognition-coin-vault</code> | [src/routes/ams.recognition-coin-vault.tsx](../../src/routes/ams.recognition-coin-vault.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/reputation-vault</code> | [src/routes/ams.reputation-vault.tsx](../../src/routes/ams.reputation-vault.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/reward-chest-vault</code> | [src/routes/ams.reward-chest-vault.tsx](../../src/routes/ams.reward-chest-vault.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/rewards</code> | [src/routes/ams.rewards.tsx](../../src/routes/ams.rewards.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/role-manager</code> | [src/routes/ams.role-manager.tsx](../../src/routes/ams.role-manager.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/role-manager</code> | [src/routes/ams.role-manager.index.tsx](../../src/routes/ams.role-manager.index.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/role-manager/$slug</code> | [src/routes/ams.role-manager.$slug.tsx](../../src/routes/ams.role-manager.$slug.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/role-showcase</code> | [src/routes/ams.role-showcase.index.tsx](../../src/routes/ams.role-showcase.index.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/role-showcase/$slug</code> | [src/routes/ams.role-showcase.$slug.tsx](../../src/routes/ams.role-showcase.$slug.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/settings</code> | [src/routes/ams.settings.tsx](../../src/routes/ams.settings.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/tickets</code> | [src/routes/ams.tickets.index.tsx](../../src/routes/ams.tickets.index.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/tickets/$id</code> | [src/routes/ams.tickets.$id.tsx](../../src/routes/ams.tickets.$id.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/tickets/new</code> | [src/routes/ams.tickets.new.tsx](../../src/routes/ams.tickets.new.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/trophies</code> | [src/routes/ams.trophies.tsx](../../src/routes/ams.trophies.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/trophy-gallery</code> | [src/routes/ams.trophy-gallery.tsx](../../src/routes/ams.trophy-gallery.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/trophy-stages</code> | [src/routes/ams.trophy-stages.tsx](../../src/routes/ams.trophy-stages.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/trophy-vault</code> | [src/routes/ams.trophy-vault.tsx](../../src/routes/ams.trophy-vault.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/trust-seal-vault</code> | [src/routes/ams.trust-seal-vault.tsx](../../src/routes/ams.trust-seal-vault.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/vendor-progression</code> | [src/routes/ams.vendor-progression.tsx](../../src/routes/ams.vendor-progression.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/verification-vault</code> | [src/routes/ams.verification-vault.tsx](../../src/routes/ams.verification-vault.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/xp</code> | [src/routes/ams.xp.tsx](../../src/routes/ams.xp.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/ams/xp-crystal-vault</code> | [src/routes/ams.xp-crystal-vault.tsx](../../src/routes/ams.xp-crystal-vault.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/application-manager</code> | [src/routes/application-manager.tsx](../../src/routes/application-manager.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/apply/</code> | [src/routes/apply.index.tsx](../../src/routes/apply.index.tsx) | 🟡 NOT TESTED |
| <code>/apply/$role</code> | [src/routes/apply.$role.tsx](../../src/routes/apply.$role.tsx) | 🟡 NOT TESTED |
| <code>/assist-manager</code> | [src/routes/assist-manager.tsx](../../src/routes/assist-manager.tsx) | 🟡 NOT TESTED |
| <code>/auth</code> | [src/routes/auth.tsx](../../src/routes/auth.tsx) | 🟡 NOT TESTED |
| <code>/blog/</code> | [src/routes/blog.index.tsx](../../src/routes/blog.index.tsx) | 🟠 PARTIAL - rendered "Nothing to read"; expected content state unverified |
| <code>/blog/$slug</code> | [src/routes/blog.$slug.tsx](../../src/routes/blog.$slug.tsx) | 🟡 NOT TESTED |
| <code>/boss</code> | [src/routes/boss.tsx](../../src/routes/boss.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/chat</code> | [src/routes/chat.tsx](../../src/routes/chat.tsx) | 🟡 NOT TESTED |
| <code>/chat-manager</code> | [src/routes/chat-manager.tsx](../../src/routes/chat-manager.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/checkout</code> | [src/routes/checkout.tsx](../../src/routes/checkout.tsx) | 🟡 NOT TESTED |
| <code>/contact</code> | [src/routes/contact.tsx](../../src/routes/contact.tsx) | 🟠 PARTIAL - rendered; form not submitted in production |
| <code>/control-panel</code> | [src/routes/control-panel.tsx](../../src/routes/control-panel.tsx) | 🟠 PARTIAL - authenticated Super Admin dashboard/sidebar rendered at desktop/mobile; repeated useAuth runtime diagnostic visible |
| <code>/control-panel/finance</code> | [src/routes/control-panel.finance.tsx](../../src/routes/control-panel.finance.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/creator-manager</code> | [src/routes/creator-manager.tsx](../../src/routes/creator-manager.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/dashboard/$role</code> | [src/routes/dashboard.$role.tsx](../../src/routes/dashboard.$role.tsx) | 🟡 NOT TESTED |
| <code>/dashboard/bidding</code> | [src/routes/dashboard.bidding.tsx](../../src/routes/dashboard.bidding.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/dashboard/sales</code> | [src/routes/dashboard.sales.tsx](../../src/routes/dashboard.sales.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/dashboard/support</code> | [src/routes/dashboard.support.tsx](../../src/routes/dashboard.support.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/demo-manager</code> | [src/routes/demo-manager.tsx](../../src/routes/demo-manager.tsx) | 🟠 PARTIAL - HTTP 200; Demo Dashboard rendered; state-changing controls not submitted |
| <code>/demo-ops</code> | [src/routes/demo-ops.tsx](../../src/routes/demo-ops.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/demo-workspace</code> | [src/routes/demo-workspace.tsx](../../src/routes/demo-workspace.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/demo/</code> | [src/routes/demo..tsx](../../src/routes/demo..tsx) | 🟡 NOT TESTED |
| <code>/demo/$slug</code> | [src/routes/demo.$slug.tsx](../../src/routes/demo.$slug.tsx) | 🟡 NOT TESTED |
| <code>/dev-manager</code> | [src/routes/dev-manager.tsx](../../src/routes/dev-manager.tsx) | 🟠 PARTIAL - HTTP 200; Developer Dashboard rendered; controls not submitted |
| <code>/finance-manager</code> | [src/routes/finance-manager.tsx](../../src/routes/finance-manager.tsx) | 🟠 PARTIAL - HTTP 200; Billing Engine rendered but data remained loading |
| <code>/franchise-manager</code> | [src/routes/franchise-manager.tsx](../../src/routes/franchise-manager.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/influencer-manager</code> | [src/routes/influencer-manager.tsx](../../src/routes/influencer-manager.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/internal-support-ai</code> | [src/routes/internal-support-ai.tsx](../../src/routes/internal-support-ai.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/keywords</code> | [src/routes/keywords.tsx](../../src/routes/keywords.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/language-manager</code> | [src/routes/language-manager.tsx](../../src/routes/language-manager.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/lead-manager</code> | [src/routes/lead-manager.tsx](../../src/routes/lead-manager.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/lead-manager</code> | [src/routes/lead-manager.index.tsx](../../src/routes/lead-manager.index.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/legal-manager</code> | [src/routes/legal-manager.tsx](../../src/routes/legal-manager.tsx) | 🟡 NOT TESTED |
| <code>/legal/</code> | [src/routes/legal.index.tsx](../../src/routes/legal.index.tsx) | 🟡 NOT TESTED |
| <code>/legal/$slug</code> | [src/routes/legal.$slug.tsx](../../src/routes/legal.$slug.tsx) | 🟡 NOT TESTED |
| <code>/login</code> | [src/routes/login.tsx](../../src/routes/login.tsx) | 🟠 PARTIAL - rendered; authentication submission not tested |
| <code>/manager</code> | [src/routes/manager.tsx](../../src/routes/manager.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/manager</code> | [src/routes/manager/index.tsx](../../src/routes/manager/index.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/manager/$section</code> | [src/routes/manager/$section.tsx](../../src/routes/manager/$section.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/marketing</code> | [src/routes/marketing.tsx](../../src/routes/marketing.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/marketing</code> | [src/routes/marketing.index.tsx](../../src/routes/marketing.index.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/marketing/ai-automation</code> | [src/routes/marketing.ai-automation.tsx](../../src/routes/marketing.ai-automation.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/marketing/analytics</code> | [src/routes/marketing.analytics.tsx](../../src/routes/marketing.analytics.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/marketing/approvals</code> | [src/routes/marketing.approvals.tsx](../../src/routes/marketing.approvals.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/marketing/audit</code> | [src/routes/marketing.audit.tsx](../../src/routes/marketing.audit.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/marketing/campaign-builder</code> | [src/routes/marketing.campaign-builder.tsx](../../src/routes/marketing.campaign-builder.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/marketing/campaigns</code> | [src/routes/marketing.campaigns.tsx](../../src/routes/marketing.campaigns.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/marketing/content</code> | [src/routes/marketing.content.tsx](../../src/routes/marketing.content.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/marketing/creatives</code> | [src/routes/marketing.creatives.tsx](../../src/routes/marketing.creatives.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/marketing/hierarchy</code> | [src/routes/marketing.hierarchy.tsx](../../src/routes/marketing.hierarchy.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/marketing/lead-sources</code> | [src/routes/marketing.lead-sources.tsx](../../src/routes/marketing.lead-sources.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/marketing/offers</code> | [src/routes/marketing.offers.tsx](../../src/routes/marketing.offers.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/marketing/performance</code> | [src/routes/marketing.performance.tsx](../../src/routes/marketing.performance.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/marketing/reports</code> | [src/routes/marketing.reports.tsx](../../src/routes/marketing.reports.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/marketing/schedules</code> | [src/routes/marketing.schedules.tsx](../../src/routes/marketing.schedules.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/marketing/seo</code> | [src/routes/marketing.seo.tsx](../../src/routes/marketing.seo.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/marketing/targeting</code> | [src/routes/marketing.targeting.tsx](../../src/routes/marketing.targeting.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/marketplace</code> | [src/routes/marketplace.tsx](../../src/routes/marketplace.tsx) | 🟡 NOT TESTED |
| <code>/marketplace</code> | [src/routes/marketplace.index.tsx](../../src/routes/marketplace.index.tsx) | 🟡 NOT TESTED |
| <code>/marketplace-manager</code> | [src/routes/marketplace-manager.tsx](../../src/routes/marketplace-manager.tsx) | 🟠 PARTIAL - HTTP 200; dashboard/KPIs rendered; prior Invalid URL failure was not reproduced |
| <code>/marketplace-recovery</code> | [src/routes/marketplace-recovery.tsx](../../src/routes/marketplace-recovery.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/marketplace/$category/$country</code> | [src/routes/marketplace.$category.$country.tsx](../../src/routes/marketplace.$category.$country.tsx) | 🟠 PARTIAL - occupied slot rendered; missing-slot 404 checked; redirects untested |
| <code>/marketplace/category/$slug</code> | [src/routes/marketplace.category.$slug.tsx](../../src/routes/marketplace.category.$slug.tsx) | 🟡 NOT TESTED |
| <code>/marketplace/country/$country</code> | [src/routes/marketplace.country.$country.tsx](../../src/routes/marketplace.country.$country.tsx) | 🟡 NOT TESTED |
| <code>/marketplace/product/$slug</code> | [src/routes/marketplace.product.$slug.tsx](../../src/routes/marketplace.product.$slug.tsx) | 🟡 NOT TESTED |
| <code>/pages</code> | [src/routes/pages.tsx](../../src/routes/pages.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/payment/fail</code> | [src/routes/payment/fail.tsx](../../src/routes/payment/fail.tsx) | 🟡 NOT TESTED |
| <code>/payment/success</code> | [src/routes/payment/success.tsx](../../src/routes/payment/success.tsx) | 🟡 NOT TESTED |
| <code>/privacy</code> | [src/routes/privacy.tsx](../../src/routes/privacy.tsx) | 🟡 NOT TESTED |
| <code>/product-demo-manager</code> | [src/routes/product-demo-manager.tsx](../../src/routes/product-demo-manager.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/promise-tracker</code> | [src/routes/promise-tracker.tsx](../../src/routes/promise-tracker.tsx) | 🟠 PARTIAL - HTTP 200; overview rendered; displayed zero active/overdue with data still connecting |
| <code>/promise-tracker</code> | [src/routes/promise-tracker.index.tsx](../../src/routes/promise-tracker.index.tsx) | 🟠 PARTIAL - HTTP 200; overview rendered; displayed zero active/overdue with data still connecting |
| <code>/promise-tracker/active</code> | [src/routes/promise-tracker.active.tsx](../../src/routes/promise-tracker.active.tsx) | 🟡 NOT TESTED |
| <code>/promise-tracker/all</code> | [src/routes/promise-tracker.all.tsx](../../src/routes/promise-tracker.all.tsx) | 🟡 NOT TESTED |
| <code>/promise-tracker/audit-logs</code> | [src/routes/promise-tracker.audit-logs.tsx](../../src/routes/promise-tracker.audit-logs.tsx) | 🟡 NOT TESTED |
| <code>/promise-tracker/broken</code> | [src/routes/promise-tracker.broken.tsx](../../src/routes/promise-tracker.broken.tsx) | 🟡 NOT TESTED |
| <code>/promise-tracker/categories</code> | [src/routes/promise-tracker.categories.tsx](../../src/routes/promise-tracker.categories.tsx) | 🟡 NOT TESTED |
| <code>/promise-tracker/create</code> | [src/routes/promise-tracker.create.tsx](../../src/routes/promise-tracker.create.tsx) | 🟡 NOT TESTED |
| <code>/promise-tracker/delayed</code> | [src/routes/promise-tracker.delayed.tsx](../../src/routes/promise-tracker.delayed.tsx) | 🟡 NOT TESTED |
| <code>/promise-tracker/escalations</code> | [src/routes/promise-tracker.escalations.tsx](../../src/routes/promise-tracker.escalations.tsx) | 🟡 NOT TESTED |
| <code>/promise-tracker/fulfilled</code> | [src/routes/promise-tracker.fulfilled.tsx](../../src/routes/promise-tracker.fulfilled.tsx) | 🟡 NOT TESTED |
| <code>/promise-tracker/insights</code> | [src/routes/promise-tracker.insights.tsx](../../src/routes/promise-tracker.insights.tsx) | 🟡 NOT TESTED |
| <code>/promise-tracker/rules</code> | [src/routes/promise-tracker.rules.tsx](../../src/routes/promise-tracker.rules.tsx) | 🟡 NOT TESTED |
| <code>/promise-tracker/settings</code> | [src/routes/promise-tracker.settings.tsx](../../src/routes/promise-tracker.settings.tsx) | 🟡 NOT TESTED |
| <code>/rd-manager</code> | [src/routes/rd-manager.tsx](../../src/routes/rd-manager.tsx) | 🟠 BLOCKED/INCOMPLETE - remained on Checking workspace access after auth session expired |
| <code>/rd-manager</code> | [src/routes/rd-manager.index.tsx](../../src/routes/rd-manager.index.tsx) | 🟠 BLOCKED/INCOMPLETE - remained on Checking workspace access after auth session expired |
| <code>/rd-manager/lab</code> | [src/routes/rd-manager.lab.tsx](../../src/routes/rd-manager.lab.tsx) | 🟡 NOT TESTED |
| <code>/rd-manager/pro-manager</code> | [src/routes/rd-manager.pro-manager.tsx](../../src/routes/rd-manager.pro-manager.tsx) | 🟡 NOT TESTED |
| <code>/rd-manager/start</code> | [src/routes/rd-manager.start.tsx](../../src/routes/rd-manager.start.tsx) | 🟡 NOT TESTED |
| <code>/rd-manager/track</code> | [src/routes/rd-manager.track.tsx](../../src/routes/rd-manager.track.tsx) | 🟡 NOT TESTED |
| <code>/refund-policy</code> | [src/routes/refund-policy.tsx](../../src/routes/refund-policy.tsx) | 🟡 NOT TESTED |
| <code>/request-software</code> | [src/routes/request-software.tsx](../../src/routes/request-software.tsx) | 🟡 NOT TESTED |
| <code>/reseller-manager</code> | [src/routes/reseller-manager.tsx](../../src/routes/reseller-manager.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/s/$code</code> | [src/routes/s.$code.ts](../../src/routes/s.$code.ts) | 🟡 NOT TESTED |
| <code>/sales-crm</code> | [src/routes/sales-crm.tsx](../../src/routes/sales-crm.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/sales-support-manager</code> | [src/routes/sales-support-manager.tsx](../../src/routes/sales-support-manager.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/seo-manager</code> | [src/routes/seo-manager.tsx](../../src/routes/seo-manager.tsx) | 🟠 PARTIAL - HTTP 200; SEO Manager navigation/dashboard rendered; controls not submitted |
| <code>/server-manager</code> | [src/routes/server-manager.tsx](../../src/routes/server-manager.tsx) | 🟠 PARTIAL - HTTP 200; Server Overview rendered with status Unknown; controls not submitted |
| <code>/server-manager/$view</code> | [src/routes/server-manager.$view.tsx](../../src/routes/server-manager.$view.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/support</code> | [src/routes/support.tsx](../../src/routes/support.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/support-agent</code> | [src/routes/support-agent.tsx](../../src/routes/support-agent.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/support-chatbot</code> | [src/routes/support-chatbot.tsx](../../src/routes/support-chatbot.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/support-chatbot-blueprint</code> | [src/routes/support-chatbot-blueprint.tsx](../../src/routes/support-chatbot-blueprint.tsx) | 🟡 NOT TESTED |
| <code>/task-manager</code> | [src/routes/task-manager.tsx](../../src/routes/task-manager.tsx) | 🟠 PARTIAL - HTTP 200; shell appeared with Loading task control; later session expired before full content check |
| <code>/terms</code> | [src/routes/terms.tsx](../../src/routes/terms.tsx) | 🟡 NOT TESTED |
| <code>/vala-ai</code> | [src/routes/vala-ai.tsx](../../src/routes/vala-ai.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/vala-ai</code> | [src/routes/vala-ai.index.tsx](../../src/routes/vala-ai.index.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/vala-ai/activity</code> | [src/routes/vala-ai.activity.tsx](../../src/routes/vala-ai.activity.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/vala-ai/admin</code> | [src/routes/vala-ai.admin.tsx](../../src/routes/vala-ai.admin.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/vala-ai/approvals</code> | [src/routes/vala-ai.approvals.tsx](../../src/routes/vala-ai.approvals.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/vala-ai/builder</code> | [src/routes/vala-ai.builder.tsx](../../src/routes/vala-ai.builder.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/vala-ai/chat</code> | [src/routes/vala-ai.chat.tsx](../../src/routes/vala-ai.chat.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/vala-ai/command-center</code> | [src/routes/vala-ai.command-center.tsx](../../src/routes/vala-ai.command-center.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/vala-ai/flow</code> | [src/routes/vala-ai.flow.tsx](../../src/routes/vala-ai.flow.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/vala-ai/owner</code> | [src/routes/vala-ai.owner.tsx](../../src/routes/vala-ai.owner.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/vala-ai/pipeline</code> | [src/routes/vala-ai.pipeline.tsx](../../src/routes/vala-ai.pipeline.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/vala-ai/projects</code> | [src/routes/vala-ai.projects.index.tsx](../../src/routes/vala-ai.projects.index.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/vala-ai/projects/$projectId</code> | [src/routes/vala-ai.projects.$projectId.tsx](../../src/routes/vala-ai.projects.$projectId.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/vala-ai/qa</code> | [src/routes/vala-ai.qa.tsx](../../src/routes/vala-ai.qa.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/vala-ai/releases</code> | [src/routes/vala-ai.releases.tsx](../../src/routes/vala-ai.releases.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/vala-ai/settings</code> | [src/routes/vala-ai.settings.tsx](../../src/routes/vala-ai.settings.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/vala-ai/studio</code> | [src/routes/vala-ai.studio.tsx](../../src/routes/vala-ai.studio.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/vala-ai/tasks/$taskId</code> | [src/routes/vala-ai.tasks.$taskId.tsx](../../src/routes/vala-ai.tasks.$taskId.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/vala-tv</code> | [src/routes/vala-tv.tsx](../../src/routes/vala-tv.tsx) | 🟠 PARTIAL - rendered; controls not exhaustively tested |
| <code>/vendor-manager</code> | [src/routes/vendor-manager.tsx](../../src/routes/vendor-manager.tsx) | 🟠 BLOCKED - matches central role-gate prefix; authorized view not tested |
| <code>/verify/$code</code> | [src/routes/verify.$code.tsx](../../src/routes/verify.$code.tsx) | 🟡 NOT TESTED |

## Limitations and next prerequisite

This audit is **partial**, not a 100% route/control audit. The authenticated session expired during later checks, leaving R&D Manager and Task Manager incomplete. Continue with a fresh shared Super Admin/test-user session or a staging URL with a pre-provisioned session. Production forms that write data should remain unsubmitted; validate those flows in staging. A separate real/coarse-pointer run is needed before certifying the mobile touch-target rules.

The standard production build passed. A local dev preview could not hydrate because local Supabase environment variables were unavailable, so the responsive before/after comparison applied the proposed CSS to the actual production DOM without changing the live site.

**Change record:** `src/styles/marketplace-home.css` contains the focused mobile height fix. No production deployment or business-data write was performed. The report was also updated.
