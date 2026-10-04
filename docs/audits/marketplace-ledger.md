FIXED (log line count); 03..05 OPEN
| ID | Class | Where | Defect | Status |
|---|---|---|---|---|
| HP-01 | BROKEN | lib/marketplace-manager/rows.functions.ts `configureSection` | Any signed-in account (a customer) could publish, unpublish or retitle homepage sections with the service role; archived sections could be republished | FIXED |
| HP-02 | BROKEN | rows.functions.ts `searchRowProducts` | Any caller could list draft/hidden products with `onlyPublished:false`; `%`/`_` not escaped | FIXED |
| HP-03 | BROKEN | rows.functions.ts `getRowAudit` | Anyone could read operator e-mails and before/after state | FIXED |
| OPS-SEO-01 | BROKEN | lib/seo.functions.ts | Seven POST server functions (audit, report, recrawl, automation, syncs) had no authorisation | FIXED |
| OPS-SEO-22 | BROKEN | seo.functions.ts | recrawlUrl invented HTTP status from the URL text; runAutomation inserted a fake "completed" run; Search Console / Semrush "sync" reported work never done; technical checks claimed to run | FIXED (real fetch, same-site only; the rest now say they are not connected) |
| OPS-SEO-21 | MISSING | seo.functions.ts | No length limit on AI prompts to the paid gateway | FIXED |
| SEO-GEN | BROKEN | lib/seo/tag-generation.server.ts `generateSlotTags` | Exported server function with no authorisation calling the AI provider | FIXED |
| COM-OPS-25 / GRW-23 | MISSING | lib/marketing/providers.functions.ts | Anyone could read which credentials the server holds | FIXED |
| OPS2-1 | BROKEN | api/marketplace/media.ts | `%2e%2e` in an asset path signed files in the legal-documents bucket | FIXED |
| OPS-MEDIA-03 | BROKEN | media.ts | Asset path not URL-encoded (`#`, `?` truncated) | FIXED |
| OPS-INTEG-01 | BROKEN | api/marketplace/integrations.ts | Editable webhook_url turned the probe into a request to any host (SSRF); every page view POSTed to every webhook | FIXED (same-origin `/api/` paths only, OPTIONS probe) |
| OPS2-13 | BROKEN | integrations.ts | Any status ≥400 reported as "no route served" | FIXED (only 404) |
| RBAC-01 | MISSING | api/marketplace/permissions.ts | Owner tier could revoke its own view/configure and lock everyone out | FIXED |
| RBAC-02 | BROKEN | lib/marketplace/permission-guard.ts | OWNER_ONLY not enforced; a role granted configure could grant itself everything | FIXED |
| RBAC-06 | MISSING | permissions.ts | Any role string accepted (typos stored as roles) | FIXED |
| RBAC-09 | BROKEN | permission-store.server.ts `rolesOf` | Roles not lower-cased, unlike the guard | FIXED |
| MM-03 | BROKEN | api/manager/resource.ts settings/system | Generic Settings table could rewrite the permission matrix, action layer, micro-interactions and palette; keys renamable | FIXED (reserved keys scoped out, key not editable) |
| MM-06 | MISSING | resource.ts licences, refunds, partner_commissions, partner_payouts, mail | Money and licence status freely editable (revoked licence reactivated; refund "processed" by hand; sent mail re-sent) | FIXED (transitions + time stamps) |
| MM-07 | MISSING | resource.ts demo_domain | bcrypt password_hash sent to the browser and editable as plain text | FIXED |
| MM-07b | MISSING | resource.ts media_library, support, ai_content, qr_system, automation | System-computed fields (sha256, csat, provenance, scan_count, run_count) editable | OPEN |
| MM-05 | BROKEN | LiveTable.tsx | Editing a JSON cell saved "[object Object]" | FIXED |
| MM-12 | BROKEN | LiveTable.tsx | Bulk selection survived page/search/sort change | FIXED |
| MM-13 | BROKEN | resource.ts PATCH/DELETE + LiveTable.tsx | 0-row write answered ok/row:null and crashed the table | FIXED |
| MM-14 | MISSING | LiveTable.tsx | Numeric cell: empty saved 0, text saved NaN | FIXED |
| OPS-SEC-01 / OPS-SUPPORT-02 / OPS2-6 | BROKEN | api/marketplace/security.ts, support.ts | `or=()` filter broken by commas/parentheses; crafted terms added conditions | FIXED |
| OPS-SEC-02/03 / OPS-SUPPORT-03 | MISSING | security.ts, support.ts exports | Failed read gave a header-only CSV reported as exported; 5,000-row silent cap; CSV formula injection | FIXED |
| COM-OPS-12 / GRW-13 | BROKEN | ProductAnalytics.tsx | CSV formula injection; comment line read as header | FIXED |
| COM-ORD-5 | BROKEN | orders export | Stops at 100, ignores payment filter, formula injection, not audited | OPEN |
| COM-RTF-1 | BROKEN | RLS on marketplace_reviews | A buyer can insert/republish their own review as published | BLOCKED (migration) |
| COM-DSH-19 | MISSING | migrations | mm_attention_center, mm_health_checks, mm_marketplace_score, mm_rows_list granted without an operator check | BLOCKED (migration) |
| CAT-M10 | BROKEN | mm_audit grant | Any signed-in user can write audit rows | BLOCKED (migration) |
| CAT-U6 / CAT-G16 | MISSING | mm_share_record, mm_brand_detect | Granted to anon | BLOCKED (migration) |
| CAT-P4 | BROKEN | marketplace.functions.ts upsertProduct | No role check; relies on RLS (a seller can feature their own product) | OPEN |
| COM-TV-1/2 | BROKEN | Vala TV | Browser-side publish/delete bypass mm_vala_tv_status and the audit | OPEN |
| OPS-VALAAI-01 | MISSING | chat-ai.functions.ts | No input schema: role "developer" acted as a system prompt; non-array crashed | FIXED |
| OPS-VALAAI-02 | MISSING | chat-ai.functions.ts | No per-user rate limit or cost cap | OPEN |
| OPS-VALAAI-04 | BROKEN | AiChatPanel.tsx | Chat history kept under fixed keys, visible to the next user of the browser | OPEN |

## Access decisions

| ID | Class | Where | Defect | Status |
|---|---|---|---|---|
| RBAC-04 / COM-OPS-1 / MM-01 / LT-1 / GRW-1 / OPS-SEO-02 / OPS-ALL-01 | BROKEN | internal-guard.ts vs RouteAccessGate / mm_is_operator | The page admits marketing, seo, founder, boss_owner; the consoles refuse them with a demo-publishing message; developer can call APIs the page does not admit | NEEDS-OWNER |
| RBAC-03 / MM-02 / LT-2 | MISSING | resource.ts, *.functions.ts, rows.ts | Role matrix enforced on bulk but not on single-row writes and ~20 server functions (changes developer's write access across managers) | NEEDS-OWNER |
| OPS-ACTIONS-01 / OPS2-4 | BROKEN | actions/registry.ts, seo/generate-tags.ts | No matrix check | NEEDS-OWNER (same decision) |
| OPS-MICRO-03 | BROKEN | micro-interactions.ts | marketplace.micro.edit allows no write | NEEDS-OWNER |
| COM-ORD-13 / CAT-M4 | MISSING | mm_is_operator | marketing/seo can refund and change moderation policy | NEEDS-OWNER |
| OPS2-12 | BROKEN | ai-request-auth.server.ts | super_admin refused by Vala AI | NEEDS-OWNER |
| MM-04 / LT-6 | MISSING | resource.ts products | visible/content_status editable around the moderation state machine (removing the columns removes a working control) | NEEDS-OWNER |

## Public storefront (live evidence)

| ID | Class | Where | Defect | Status |
|---|---|---|---|---|
| D1 | BROKEN | lib/marketplace/catalog.server.ts | /marketplace row paging repeated `event-services` and never showed `construction` (no tiebreaker on sort_order) | FIXED |
| D2 | BROKEN | api/marketplace/search.ts | Search scanned an arbitrary 200 rows; name matches dropped; rows matched on keywords scored 0; best-seller bonus without a match | FIXED |
| D3 | BROKEN | search.ts | `category` ignored on every path but one; unknown slug accepted | FIXED |
| D4 | BROKEN | search.ts | Hindi query became no words; "café" became "caf"; non-searchable query answered with the featured list | FIXED |
| D5 | BROKEN | catalog.server.ts, api/marketplace/catalog.ts | Offset past the end answered 404 "No such category" / 502; fractional params | FIXED |
| D6 | BROKEN | marketplace.product / category / country / $category.$country routes | Unknown slugs answered 200 (soft 404) | FIXED (404 status, page unchanged) |
| D7 | DEAD | sapphire-home HomeIndex cards | 191 homepage cards open "Product not found" on live | FIXED in 49190ce, not deployed |
| D8 | UI-UX | marketplace.product.$slug.tsx | Fallback product pages had a generic title and no canonical | FIXED |
| D9 | BROKEN | lib/seo/category-seo.ts | Product head used `visible` only; body used the full on-sale rule — a product head over a "not found" body | FIXED |
| D10 | DEAD | sapphire-home HomeIndex `/demo/<slug>` | 17 of 20 preview links point at slugs with no product row | NEEDS-OWNER (the card data is the owner's) |
| D11 | UI-UX | migration catalogue_headline | Headline counts 10 products that are not public | BLOCKED (migration) |
| D12 | UI-UX | category-seo.ts vs marketplace.functions.ts | Education & Coaching: head says 80, body shows 97 | OPEN |
| D13 | MISSING | routes/index.tsx, product route | No og:url on home and product pages | FIXED |
| D13b | MISSING | all pages | No og:image although twitter:card is summary_large_image | NEEDS-OWNER (needs a brand image) |
| D14 | UI-UX | sapphire-home HomeIndex | Shelf counts include repeated cards ("80 Products" for 2) | FIXED |
| ACT-01 | BROKEN | lib/marketplace/action-layer.ts | DISABLED visibility came back available | FIXED |
| ACT-02 / OPS-ACTIONS-02 | BROKEN | marketplace-home HomeIndex DemoCard | /marketplace Buy Now ignored the Action Layer in the no-demo branch | FIXED |
| MM-15 / LT-16 / HP-14 / HP-35 / OPS-ACTIONS-05 / OPS-AICONTENT-04 | MISSING | catalog, rows, actions/config, home-layout, chrome caches | Manager writes never invalidate storefront caches (30–120 s stale, per process) | OPEN |
| HP-10 | MISSING | home-route-data.ts | /marketplace loader may render built-in fallback hero slides first | OPEN |
| HP-24 | BROKEN | mm_topbar_modules + TopUtilityBar | Archiving a top-bar module makes it show on the storefront | BLOCKED (SQL function) |
| HP-33 | MISSING | SiteFooter / FloatingElements | Published footer and floating elements reach only /marketplace/ | OPEN |

## Marketplace Manager — function

| ID | Class | Where | Defect | Status |
|---|---|---|---|---|
| COM-DSH-1 | BROKEN | migration revenue_series | mm_revenue_series revoked from authenticated; revenue chart always errors | BLOCKED (migration) |
| COM-DSH-2 | BROKEN | DashboardSection.tsx | Two shapes cached under one key crashed each other | FIXED |
| COM-DSH-3..12 | BROKEN | mm_dashboard SQL | Refund double count, mixed currencies, wrong tables, UTC buckets | BLOCKED (migration) |
| COM-DSH-13/14/15/16/18 | UI-UX/MISSING | DashboardSection, executiveFeed.ts | Errors as "Nothing waiting"; drafts in strip; invented banner feed; link params ignored; no refetch | OPEN |
| COM-ORD-1/3/4 | BROKEN | OrdersLive.tsx | Counters from a capped list; filter values the data never holds | OPEN |
| COM-ORD-6 | BROKEN | OrdersLive.tsx | Refund always the full total; offered on unpaid orders | FIXED |
| COM-ORD-7 | BROKEN | OrdersLive.tsx | Dispute double-submit | FIXED (unique open dispute in SQL still BLOCKED) |
| COM-ORD-9/10/11/12/14 | DEAD/UI-UX | Orders | resolveDispute unused; proforma doc type; caps; labels | OPEN |
| COM-PPR-1 | BROKEN | EnterpriseCommerce.tsx | /active/ matched "inactive" | FIXED |
| COM-PPR-2..12 | DEAD/UI-UX | Pricing / Payments / Releases | Unwired controls, invented KPIs | FIXED (2026-10-03, working tree) — Pricing: MRR/plans/coupons/gift cards/wallet literals removed; Priced products (7,365) and Active coupons (0) counted from marketplace_products / marketplace_coupons, coupon tab lists marketplace_coupons rows or says none exist; plan/trial/EMI/tax/currency controls disabled with the reason (no table). Payments: Live gateways and Success rate (volume-weighted) from finance_gateways, the other KPIs say not measured; QR/subscriptions/payouts/wallets literals replaced by truthful empty states; gateway controls point at Finance Manager. Releases: timeline/changelog/deprecations read marketplace_product_versions via /api/governance/console (0 rows live → empty states); roadmap/beta say no table; New branch / New release disabled (no writer) |
| COM-LM-1 | BROKEN | LiveModules.tsx | Influencer "Approved" filtered a status the CHECK forbids (always 0) | FIXED (now `active`) |
| MM-10 / LT-10 / COM-LM-4 | BROKEN | LiveModules.tsx | Every partner kind's money under Authors, Vendors and Affiliate | FIXED |
| MM-09 / LT-9 | BROKEN | resource.ts | ilike search on enum partner_kind → 502 | FIXED |
| COM-LM-2/3/5..8 | BROKEN/UI-UX | LiveModules.tsx | Vendors table; authors include vendors; duplicate tables | OPEN |
| MM-08 / LT-5 | BROKEN | resource.ts quality_gate | Boolean primary key never PATCHable | OPEN |
| MM-11 / LT-11 | DEAD | LiveTable.tsx / bulk.ts | Export audit never recorded | OPEN |
| MM-16 / LT-15 | MISSING | Offers | Coupons affect no price | NEEDS-OWNER (business rule) |
| MM-17 | UI-UX | resource.ts | Search ignored on unsearchable resources | OPEN |
| HP-05 | BROKEN | lib/hero-slides.ts, HeroSlidesManager.tsx | Draft/archived slides could be switched back on to the live homepage | FIXED |
| HP-06 | BROKEN | hero-slides.ts | Saving a published slide erased its unpublish date | FIXED |
| HP-07 | BROKEN | hero-slides.ts | Create dropped the secondary link and archived state | FIXED |
| HP-08/09/11/12/13 | DEAD/MISSING/UI-UX | Hero | Targeting fields unused; no schedule validation; icons; reorder in filtered tab; preview modal unused | OPEN |
| HP-15/16 | BROKEN | mm_slot_pin, mm_rows_reorder | Pin fails on curated rows; reorder skips them | BLOCKED (SQL functions) |
| HP-17 | MISSING | rows.functions.ts clearRowSlots | "N slots cleared" when none were | FIXED |
| HP-18/19/20/21/23 | DEAD/MISSING/UI-UX | Homepage Rows | Curated hidden toggle; device toggles; scheduled never live; counts; cross-screen cache | OPEN |
| HP-22 | BROKEN | HomepageRowsSection.tsx | Two Manage links landed on the Dashboard | FIXED |
| HP-25..32/34/36/37 | DEAD/MISSING/UI-UX | Top Bar, Upcoming, Notifications, Footer, Filters, Layout Order, Walls | See audit notes | OPEN |
| OPS-AICONTENT-01 | BROKEN | AiContentGenerator.tsx | "Open" put the module in an error state | FIXED (client); queue product_id in SQL BLOCKED |
| OPS-AICONTENT-02 | BROKEN | AiContentGenerator.tsx | Regenerate used the previous selection | FIXED |
| OPS-AICONTENT-05/11 | BROKEN | AiContentGenerator.tsx | Bulk run hung on "Running" | FIXED |
| OPS-AICONTENT-06 | DEAD | AiContentGenerator.tsx | Batch size setting ignored | FIXED |
| OPS-AICONTENT-07 | MISSING | AiContentGenerator.tsx | Retry/Cancel/History errors swallowed | FIXED |
| OPS-AICONTENT-10 | MISSING | AiContentGenerator.tsx | Clearing the daily cap set it to 0 | FIXED |
| OPS-AICONTENT-03/08/09 | MISSING/DEAD | AI Content | Unpublish leaves copy live; picker cap 20; count mismatch | OPEN |
| OPS2-19 | BROKEN | aicontent.functions.ts | Generation left RUNNING when finish fails | OPEN |
| OPS-SEO-03 / OPS2-3 / OPS-SEO-18 | BROKEN | SeoCenter.tsx | Clicks in the drawer, pager and Generate opened a generic drawer over themselves | FIXED |
| OPS-SEO-04 | BROKEN | resource.ts filter parser | `not.is.null` dropped → unfiltered totals | FIXED |
| OPS-SEO-04b | BROKEN | resource.ts seo_pages | scored_at/score_source not selected | BLOCKED (column presence unverified) |
| OPS-SEO-05 | BROKEN | seo-store.server.ts | `*` not mapped to `%` on the VPS store | FIXED |
| OPS-SEO-06..20 | MISSING/UI-UX/DEAD | SeoCenter, catalogue-audit | Duplicate issues per run; no refresh; capped counts; wrong-table export; fake previews | OPEN |
| OPS-SEOAUTO-01..04 | MISSING | api/seo/console.ts | `not.is.null` on NOT NULL columns (always 100%); drafts in the denominator; errors as 0 | FIXED |
| OPS-SEC-05 | UI-UX | SecurityCenter.tsx | Alerts read created_at (absent); no order | FIXED |
| OPS-SEC-04/06/07 | MISSING/UI-UX | security.ts | Capped auth totals; panel=audit unused; mixed Blocked metric | OPEN |
| OPS-SYS-01 | BROKEN | api/marketplace/system.ts | not_connected ranked above healthy; never healthy | FIXED |
| OPS-SYS-04 | MISSING | system.ts | Queue count from a 100-row read | FIXED |
| OPS-SYS-02/03/05/06 / OPS2-7 | MISSING/UI-UX | system.ts | Metric window truncated; uptime ignores missing probes; arbitrary host | OPEN |
| OPS-DEPLOY-01/02 | MISSING | api/marketplace/deployment.ts | limit=5/1/1 shown as counts; fixed "both empty" note | FIXED |
| OPS-DEPLOY-03..05 | MISSING/DEAD/UI-UX | deployment | Errors as 0; Save validates; log spinner | OPEN |
| OPS-INTEG-02/03/04 | BROKEN/UI-UX | integrations.ts | Credentials looked up in ai_providers; vocabularies compared raw; test probes every webhook | OPEN |
| OPS-INTEG-POL-01..04 / OPS2-8..10 | MISSING | api/marketplace/integrity.ts | "Enforced" claims; capped lists; errors read as ENFORCED | OPEN |
| COM-OPS-2 / GRW-2 | BROKEN | api/leads/console.ts | Read errors shown as zeros | FIXED (leads); analytics and governance OPEN |
| COM-OPS-4 / GRW-3 | BROKEN | leads/console.ts, governance/console.ts | "Today" counted in the server's zone | FIXED |
| GRW-4 | BROKEN | same | Unknown tz answered an HTML 500 | FIXED |
| COM-OPS-5 / GRW-6 | BROKEN | leads/console.ts | Open escalations counted resolved ones, cap 20 | FIXED |
| COM-OPS-7 | BROKEN | leads/console.ts | Routing counts included inactive rows, cap 50 | FIXED |
| COM-OPS-3 / GRW-7 | BROKEN | leads/console.ts | Lead totals from a 5,000-row list | OPEN |
| COM-OPS-6 / GRW-5 | BROKEN | leads/console.ts | Average score includes the default 50 | OPEN |
| COM-OPS-8 / GRW-19 | UI-UX | LeadOps.tsx | Pipeline tabs don't filter the table | OPEN |
| COM-OPS-9/10/11 / GRW-8/9/10 | BROKEN | api/analytics/products.ts | Capped reads; URL overflow; currencies summed; gross not net | OPEN |
| COM-OPS-13 / GRW-11 | BROKEN | ProductAnalytics.tsx | Slow period answer shown under another period | FIXED |
| COM-OPS-14 | UI-UX | analytics/products.ts | Unknown period silently "all time" | FIXED (400) |
| COM-OPS-15 | BROKEN | governance/console.ts | Event and rollback counts from the newest 500 rows | FIXED |
| COM-OPS-16 | BROKEN | governance/console.ts | Hero un-archive counted as a rollback | FIXED |
| COM-OPS-17 / GRW-14 | BROKEN | governance/console.ts | "Scheduled" counted past dates and deleted products | FIXED |
| COM-OPS-18 | BROKEN | governance/console.ts | 401/500 counted as "table exists" | FIXED |
| COM-OPS-19 / GRW-15 | UI-UX | AuditHistory.tsx | Backups card showed a hard-coded 0 | FIXED |
| COM-OPS-20/21 / GRW-16..18 | UI-UX/MISSING | AuditHistory | Versions without product; no filter/diff; header mismatch | OPEN |
| COM-OPS-22 / GRW-20 | BROKEN | MarketingOverview.tsx, summary.functions.ts | Refused summary shown as zeros | FIXED |
| COM-OPS-26 / GRW-21 | UI-UX | MarketingOverview.tsx | Literal `</code>` text | FIXED |
| COM-OPS-23/24 / GRW-22/24 | BROKEN/UI-UX | Marketing | Seed rows in "actual" (SQL); channel flags vs real senders | OPEN |
| COM-OPS-27 | UI-UX | LeadOps, ProductAnalytics, AuditHistory | Spinner kept turning after an error | FIXED |
| COM-CUS-1..5 | BROKEN/UI-UX | CustomerManager | Hardcoded $, mixed currencies, errors as empty | OPEN |
| COM-RTF-2..16 | BROKEN/MISSING/UI-UX | ReviewTrustFaq | Report dismiss, >100% rates, caps, scheduling | OPEN |
| CAT-P1/P2/P3/P5..P15 | BROKEN/MISSING/DEAD | ProductsAdmin, CategoriesAdmin | Draft default, upsert-on-slug overwrite, hard delete cascades, swallowed errors | OPEN |
| CAT-C1..C10, CAT-U1..U24, CAT-M1..M15, CAT-G1..G16 | various | Cards, URLs, Demo Domain/Sandbox, Moderation, Approval, Quality Gate, Scanner, Brand | See audit notes | OPEN |
| OPS-AUTO-01 | MISSING | sv-sweeps.sh | Demo/sandbox expiry and approval SLA sweeps never scheduled | BLOCKED (server crontab) |
| OPS-AUTO-02..05, OPS-MICRO-01/02/04, OPS-MEDIA-01/02/04/05, OPS-API-01..03 | various | Automation, Micro, Media, API | Capped totals; unread config; legal files listed | OPEN |
| OPS-SHARED-UI-01..04, OPS-AIPROV-01..05, OPS-EXTRA-01..03, OPS-SETTINGS-01..03, OPS-TOOLKIT-01..04, Walls | DEAD/UI-UX | static shells | Buttons and switches with no effect, invented counts | FIXED (2026-10-03, working tree) — at the root: PillButton (ui.tsx), ActionButton, ToolBtn, RowActions, BulkActionBar, DetailActionRail and the toolbar search (actions.tsx) render disabled with the reason on hover when nothing is wired, instead of staying live / toasting "not connected"; pill-looking links use PillButton href. Local Switch/IconBtn in index, ExtraSections, EnterpriseCommerce only move with an onChange. Walls list marketplace_row_config (4 live) instead of 18 "Enabled" names; Offers cards no longer promise "Up to 70% off"; Search runs the query against products; Trending/Analytics charts say not measured; Contact shows the channels the storefront footer prints; Settings/AI Recs switches no longer drawn on; feature-outline toolbar count no longer the number of features; Card Manager "6 templates" removed (no template table); Toolkit theme presets/apply disabled (no theme store); Quality Gate Publish opens Author Approval |
| OPS-SEO-CHG-01 | DEAD | SeoCenter.tsx change control, drawers, RowActs | Change requests could not be moved from the screen; drawer Save/confirm and row View/Edit/More answered with toasts | FIXED (2026-10-03, working tree) — each change row has its next step (Approve / Publish / Roll back) through POST /api/seo/change (requireInternalOperator; state machine in change-control.server.ts refuses wrong-state steps); a rollback marks the row ROLLED_BACK, not the undo request's PUBLISHED; unbound drawers and RowActs are disabled with the reason; drawer Position/CTR and prefilled meta copy no longer invented |
| OPS-VALAAI-03/05..08 | MISSING/UI-UX | AiChatPanel | Dead 429 branch; local "audit log"; label; clear without confirm | OPEN |

## Added from the Product Manager run (2026-10-02)

| ID | Class | Where | Defect | Status |
|---|---|---|---|---|
| PM-RLS-2 | BROKEN | RLS on marketplace_products | Public read ignored content_status; /rest/v1 answers without a key, so visible drafts were listable by anyone | FIXED AND VERIFIED LIVE — see product-manager-ledger.md |
| PM-LIST-3 | BROKEN | api/manager/resource.ts GET | Offset paging over sort_order alone: live, 223 of 7,365 products never shown | FIXED in code — see product-manager-ledger.md |

## Localisation (140 languages)

Measured 2026-10-02: 140 active languages (+5 retired redirects). All 140
packs answer 200. 980 language×string checks: 893 pass the automatic checks,
31 fall back to English, 0 fail; 109 languages pass all seven strings. A
manual meaning check found the errors below.

| ID | Class | Where | Defect | Status |
|---|---|---|---|---|
| I18N-D1 | BROKEN | translation memory, lib/i18n/quality.ts | "Card {position} of {total}" wrong in 43 languages ("of" → "or"); other wrong strings | BLOCKED (memory rows are in production) |
| I18N-D2 | MISSING | 31 window.prompt/confirm calls in the Manager | Native dialogs stay in English | OPEN |
| I18N-D3 | BROKEN | marketplace-home/SiteFooter.tsx | i18n check failed on the footer promise | FIXED (remaining failures are demo/influencer/vala-tv routes — OUT-OF-SCOPE) |
| I18N-D4 | UI-UX | sapphire-home ProductCarouselRow, CategorySlider | Carousels froze in right-to-left languages | FIXED (autoplay) ; logical spacing classes OPEN |
| I18N-D5 | BROKEN | storefront + Manager | Numbers, dates, currency ignore the chosen language | OPEN |
| I18N-D6 | UI-UX | storefront | Sentences split into fragments | OPEN |
| I18N-D7 | UI-UX | TopUtilityBar | Two language pickers; disabled languages still offered | OPEN |
| I18N-D8 | BROKEN | Arabic memory | Presentation-form ligatures stored | OPEN |
| I18N-D9 | DEAD | messages/marketplace.ts | marketplace.search.* unused | OPEN |

## SU

No module, flag or service named "SU" exists in the code. The closest real
thing is the `super_admin` role. Its marketplace standing: admitted by the
operator guard and by requireOperator; refused by Vala AI (OPS2-12). Status of
"SU" as a system: MISSING (not defined in this project).

## Self-healing (what actually recovers)

Present and running on the server (from the scripts in scripts/ops):
sv-homepage-guard.sh restarts the app when the homepage stops answering a
real page; sv-public-guard.sh reloads nginx when the public domain fails;
self-healing-worker.mjs works a bounded batch of incidents per cron run;
sv-deploy.sh refuses to swap in a build that does not serve the homepage and
puts the previous build back. Not verified live in this run (production
access refused).

## Verification (2026-10-02, local working tree)

- Production build (`vite build`, node-server preset): passes. The first
  attempt failed on import protection (the new 404 helper reached the client
  bundle); fixed with createServerOnlyFn and rebuilt clean.
- Unit tests: 33 files touched by this work, 496 + 16 new tests pass. One
  failure, `messages.test.ts` "CI check passes", is the i18n check failing on
  demo, influencer and vala-tv routes (other modules, uncommitted work from
  another session) — OUT-OF-SCOPE here.
- New tests: zoned-day (5), marketplace-guards (9: owner-only enforcement,
  DISABLED actions, or() search terms, CSV cells), single-flight clear (2).
- i18n check: no marketplace or Marketplace Manager file fails.
- Typecheck: the repository has 4,847 pre-existing errors (generated Supabase
  types are stale). Compared file by file before and after, no file changed in
  this run gained an error; two lost one each.
- ESLint (prettier line-ending noise excluded): no new errors in changed files.
- Not done in this run: deployment, live re-probe, and any database change —
  production access was refused. Every FIXED item is in the working tree only.
