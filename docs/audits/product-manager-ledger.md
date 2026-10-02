# Product Manager — issue ledger

Same rules as `marketplace-ledger.md`: one list, kept for good; an item marked
FIXED is not reported again as new; a finding already in the marketplace
ledger is cross-referenced, not repeated.

Statuses: FIXED · OPEN · NEEDS-OWNER · BLOCKED · OUT-OF-SCOPE.
Primary class: MISSING · BROKEN · DEAD · UI-UX.

Scanned 2026-10-02, under the same constraint as the marketplace run:
production database and environment access were refused, so nothing here was
checked against live rows or deployed.

## What Product Manager is

The Control Panel's "Product Manager" entry (`product_manager`) opens
`/product-demo-manager` — the Product & Demo Studio:

| Tab | Component | Reads / writes |
|---|---|---|
| Product Dashboard | pages/product-demo-manager/ProductDashboard.tsx | GET /api/manager/resource (products, demos) |
| Add Product | AddProduct.tsx | was: browser Supabase client; now POST /api/manager/resource (products), categories via the same endpoint |
| Product List | ProductList.tsx | GET /api/manager/resource (products) |
| Demo Manager | DemoManager.tsx → marketplace-manager DemoUrlManagerSection | Demo Manager scope |
| Add Demo, Bulk Add, Health Check | AddDemo.tsx, BulkAdd.tsx (/api/demo/assign), HealthCheckPanel | Demo Manager scope; only the product link is in scope here |
| Analytics | ProductAnalytics.tsx | GET /api/manager/resource (demo_audit, demo_clicks) |
| Audit Logs | ProductAuditLogs.tsx | was: browser client → audit_logs (hosted); now marketplace_audit_logs (audit_history) |
| Settings | — | locked in the design |

Route gate: `/product-demo-manager` admits the operators plus `developer`
(RouteAccessGate). Server gate: requireInternalOperator (boss, admin,
super_admin, owner, developer).

Each tab is addressable as `/product-demo-manager?tab=<id>` (PM-ROUTE-1).

## Ledger

| ID | Class | Where | Defect | Status |
|---|---|---|---|---|
| PM-ADD-1 | BROKEN | AddProduct.tsx | Product created through the browser Supabase client — the hosted project, not the VPS database the marketplace serves (the same reason the list, dashboard and analytics had already been moved). A product added here never reached the storefront, or was refused there; categories came from the same wrong database | FIXED (POST /api/manager/resource: operator-checked, whitelisted, audited, empties storefront caches) |
| PM-ADD-2 | BROKEN | AddProduct.tsx | Leaving either price empty made the form refuse to submit with no message (NaN failed the schema; price and pricing-model errors were never rendered) | FIXED |
| PM-ADD-3 | MISSING | resource.ts products.creatable | `features` offered by the form could not be stored through the server path | FIXED |
| PM-ADD-4 | DEAD | AddProduct.tsx | Visibility "Country Specific" behaves exactly like Global (no country is asked for or stored) | NEEDS-OWNER — the established country model is the card slot (one category × one country, Marketplace Manager) plus search_keywords country:<name> markers; whether "Country Specific" restricts visibility or only targets, and who chooses the country, is defined nowhere |
| PM-ADD-5 | MISSING | AddProduct.tsx | No image, file, demo, technology, licence, subcategory or SEO input; a product is created with name, category, description, features and price only | NEEDS-OWNER — demos belong to Demo Manager, SEO to SEO Manager; images, technology and licence have no editor in any manager today |
| PM-POLICY-1 | UI-UX | AddProduct.tsx, ProductList.tsx | The screens say a product is "READ-ONLY forever / immutable", while Marketplace Manager → Products edits, publishes and retires the same rows | FIXED — wording now says read-only in this studio, edited and published in Marketplace Manager → Products (the code and RLS show products are editable) |
| PM-LIFE-1 | MISSING | Product Manager | A product added here is a draft (content_status default) and is not public; there is no publish, unpublish or edit here — that happens in Marketplace Manager / Moderation | VERIFIED boundary — Marketplace Manager owns edit, publish and retire (resource products.editable incl. content_status; RLS admin/boss write); Product Manager creates. Not a defect |
| PM-LIST-1 | MISSING | ProductList.tsx | Only the first 100 of ~7,365 products, no paging, no search | FIXED (server paging + search) |
| PM-LIST-2 | BROKEN | resource.ts products.select | `created_at` never selected, so "Created" was always "-" | FIXED |
| PM-LIST-3 | BROKEN | resource.ts GET order | Paging ordered by sort_order alone (shared by many rows) repeats and skips rows across pages — every LiveTable too | FIXED (id tie-breaker; VPS store parses multi-key order) |
| PM-LIST-4 | BROKEN | ProductList.tsx | A failed read showed "No products found" | FIXED |
| PM-LIST-5 | BROKEN | ProductList.tsx | "Active" meant visible only; a visible draft (not public) read Active | FIXED (storefront rule: visible and published) |
| PM-LIST-6 | DEAD | ProductList.tsx | A request for up to 2,000 demo rows whose result was never shown | FIXED (no longer made) |
| PM-DASH-1 | BROKEN | ProductDashboard.tsx | "Recent Products" / "Recent Demos" were the first four by display order, not the newest | FIXED |
| PM-DASH-2 | BROKEN | ProductDashboard.tsx | "Active Products" counted visible drafts | FIXED |
| PM-DASH-3 | BROKEN | ProductDashboard.tsx, ProductAnalytics.tsx | A failed count showed 0 | FIXED (dash) |
| PM-AUDIT-1 | BROKEN | ProductAuditLogs.tsx | Read audit_logs on the hosted project; Manager product/demo changes are recorded in marketplace_audit_logs on the VPS, so none ever appeared | FIXED |
| PM-AUDIT-2 | BROKEN | ProductAuditLogs.tsx | A failed read rendered an empty table | FIXED |
| PM-HEALTH-1 | BROKEN | hooks/useHealthCheck.ts (Health Check tab) | "Run health check" read the legacy `demos` table on the hosted project and asked a hosted edge function to check it; the demos visitors open are product_demo_urls on the VPS, so it checked a list nobody uses and stored nothing where the studio reads | FIXED (checks every active product_demo_urls address with the Demo Manager's own check, result stored per address; the id-specific path used by Demo Manager's broken-demo alerts is unchanged and OUT-OF-SCOPE) |
| PM-A11Y-1 | UI-UX | AddProduct.tsx, ProductList.tsx | Form labels were not tied to their fields (no htmlFor/id) and the search box had no label, so screen readers announced unnamed fields | FIXED |
| PM-ADD-6 | BROKEN | AddProduct.tsx | Category "Other" stores no category, so the product, once published, appears in no category row or category page | NEEDS-OWNER — an authoritative destination for Other products does not exist: none of the 91 categories is a catch-all; 'uncategorised' exists only as the product-URL fallback path (20260907280100), not as a category |
| PM-RLS-2 | BROKEN (security) | marketplace_products public SELECT policies | Both public read policies ignored content_status, and /rest/v1 on softwarevala.net answers without a key: anyone could list visible drafts (10 on 2026-10-02) — and every product Add Product creates is a visible draft | FIXED AND VERIFIED LIVE (migration 20261002T120000 applied; live REST returns [] for drafts; anon still reads the 7,346 published products; homepage and search unchanged) |
| PM-SCALE-1 | MISSING (performance) | marketplace_products indexes | Product List (order sort_order,id) and Recent (order created_at) sort the whole table on every request: 12.8 ms and 5.3 ms at 7,365 rows, growing linearly | FIXED AND VERIFIED LIVE — migration 20261002T130000 created marketplace_products_sort_order_id_idx and marketplace_products_created_at_idx CONCURRENTLY (valid, ready); first page 0.148 ms index-only scan, newest four 0.093 ms backward index scan; paging still returns 7,365 of 7,365 distinct rows; storefront routes 200 |
| PM-ROUTE-1 | UI-UX | ProductDemoManagerLayout.tsx | Tabs are not in the URL: no deep link, refresh returns to the dashboard, back leaves the studio | FIXED (?tab=, Back/Forward follow it) |
| PM-ACCESS-1 | BROKEN | RouteAccessGate vs requireInternalOperator | founder and boss_owner open the studio and are refused by its API | NEEDS-OWNER — business authorization policy is undefined: RequireRole (UI) treats founder and boss_owner as operators, requireInternalOperator (API) does not, RLS lets only admin/boss write products; no document settles it |
| PM-I18N-1 | UI-UX | Product Manager pages | Dates printed with date-fns English month names; numbers en-IN | FIXED (canonical formatDate/formatNumber; 140-language formatting test) |
| PM-I18N-2 | UI-UX | Product Manager pages | Most text is hardcoded and reaches other languages only through the page translator | FIXED in Product Manager scope — every user-facing string in Product Dashboard, Add Product, Product List, Analytics, Audit Logs and the studio layout goes through t() (manager.products.*, 109 messages; status words and the item count via ICU). Global I18N-D6 remains OPEN outside Product Manager |
| PM-CACHE-1 | — | resource.ts | Product created/changed here now empties storefront caches | Covered by marketplace MM-15 (FIXED) |
| PM-RLS-1 | — | marketplace_products RLS on the VPS | Whether an authenticated non-operator can write products directly through PostgREST | VERIFIED live — a signed-in non-operator insert into marketplace_products is refused by RLS (rolled-back probe, nothing persisted) |

## SU, self-healing, load

SU: as recorded in the marketplace ledger — not defined in this project.
Self-healing and load capacity: no Product-Manager-specific mechanism exists
beyond the platform guards listed in the marketplace ledger; not measurable
without production access in this run.

## Verification (local working tree)

- i18n check: no Product Manager file fails (new strings go through t()).
- ESLint: no new errors in Product Manager files (three pre-existing).
- Unit tests (src/lib): 708 pass; 1 failure is the i18n CI check on demo,
  influencer and vala-tv routes (out of scope); 2 AMS suites cannot load
  `jsqr`, which is missing from local node_modules (out of scope).
- Typecheck: Product Manager files 22 errors before this work and 22 after
  (all pre-existing: generated Supabase types, Row typed as unknown). The two
  that the first version of the Add Product fix introduced were removed.
  Repository total 4,847, unchanged.
- Production build: passes (no import-protection errors).
- Not run: any live write, database read, RLS probe or browser E2E against
  production — access refused in this run. Every FIXED here is FIXED in code,
  live UNVERIFIED.

## Finding detail (new Product Manager findings)

| ID | Severity | Route / tab | API | Database object | Root cause | Test | Status |
|---|---|---|---|---|---|---|---|
| PM-ADD-1 | High | /product-demo-manager?tab=add-product | was: browser supabase-js → hosted PostgREST; now POST /api/manager/resource | marketplace_products, marketplace_categories | screen used the browser client built against the hosted project | code trace; typecheck; build; live write BLOCKED | FIXED, live UNVERIFIED |
| PM-ADD-2 | Medium | add-product | — | — | valueAsNumber turns an empty field into NaN; errors not rendered | code trace; typecheck | FIXED |
| PM-ADD-3 | Low | add-product | POST /api/manager/resource | marketplace_products.features | column not in creatable | code trace | FIXED |
| PM-HEALTH-1 | High | ?tab=health-check | was: hosted demos + edge function; now /api/manager/resource (demos) | product_demo_urls | hook predates the move to the canonical table | code trace; typecheck; build | FIXED, live UNVERIFIED |
| PM-AUDIT-1 | High | ?tab=audit-logs | GET /api/manager/resource (audit_history) | marketplace_audit_logs | read the wrong table on the wrong database | code trace; typecheck | FIXED, live UNVERIFIED |
| PM-LIST-1..6 | Medium | ?tab=products | GET /api/manager/resource (products) | marketplace_products | fixed page of 100, missing column, single-key order, error read as empty | code trace; typecheck | FIXED |
| PM-LIST-3 | Medium | every LiveTable and Product List | GET /api/manager/resource | any | offset paging over a non-unique order | code trace | FIXED |
| PM-DASH-1..3 | Medium | ?tab=dashboard | GET /api/manager/resource | marketplace_products, product_demo_urls | display order used as recency; visible-only as active; failure as 0 | code trace | FIXED |
| PM-ROUTE-1 | Low | all tabs | — | — | tab held only in component state | code trace | FIXED |
| PM-A11Y-1 | Low | add-product, products | — | — | labels not associated | code trace | FIXED |

## Live verification (2026-10-02, second run — production DB read access available)

- Schema: created_at timestamptz NOT NULL default now(); features jsonb NOT NULL
  default '[]'; sort_order int NOT NULL default 0; content_status text NOT NULL
  default 'draft'. Matches the code.
- PM-LIST-3 on the live table: paging 7,365 products 100 at a time ordered by
  sort_order alone returned 7,142 distinct ids — 223 never shown, 223 shown
  twice; with sort_order,id: 7,365 distinct, 0 missing. sort_order has 239
  distinct values; the largest tie is 62 rows.
- PM-DASH-2: visible 7,356, visible and published 7,346 — the old "Active"
  overcounted by the 10 visible drafts.
- RLS (rolled-back probes): anon reads 0 unapproved products, 0 demo addresses,
  0 marketplace audit rows; a non-operator insert is refused.
- Query timing at 7,365 rows (EXPLAIN ANALYZE): last page 12.8 ms, count 2.0 ms,
  "school" search 15.6 ms, newest four 5.3 ms. All are sequential scans plus a
  sort: fast at this size, linear in rows. Indexes on (sort_order, id) and
  (created_at) would keep them flat; not added in this run (OPEN, PM-SCALE-1).
- Formatting: formatDate/formatNumber run for all 140 configured languages
  with the studio's options (142 tests pass); Hindi, Tamil, Hebrew, zh-Hans and
  zh-Hant render in their own script. Static (Node ICU), not a browser run.
- Not live-verified: the new Product Manager code. Production runs the build
  of 2026-09-29; the code fixes are in the working tree only (see Deployment).
- A later read of database function definitions was refused by the auto-mode
  classifier; the role functions were read from the repository migrations.

## Deployment boundary

Product Manager work is separable and is staged on its own (16 files): the six
studio pages, useHealthCheck, demo.ts runCheck export, use-resource sort, the
format test, the two migrations, this ledger, and - built on HEAD, not on the
working tree - only the Product Manager hunks of resource.ts (created_at,
features, id tie-breaker), seo-store.server.ts (multi-key order) and manager.ts
(manager.products.* messages). Nothing it needs comes from another session's
uncommitted work. AddProduct.tsx and ProductAuditLogs.tsx also carried an
earlier uncommitted attempt at the same two screens (table names); this work
supersedes those hunks, so the files are committed whole.

The staged tree was checked out alone in a separate worktree and verified
there: production build passes; i18n catalogue check passes; 457 of 458 tests
pass - the one failure is the i18n CI check on BulkAdd.tsx, demo and
influencer routes and vala-tv, all as committed at HEAD (pre-existing).

Deployment is BLOCKED. The production source on the VPS is not a git checkout
of any commit: some files equal local HEAD (catalog.server.ts, OrdersLive.tsx)
and others differ from it (marketplace.functions.ts, payment/initiate.ts), and
sv-deploy.sh builds whatever that directory holds. "Product Manager only"
cannot be deployed without first deciding which source the server should
carry. The branch is also 14 commits ahead of main with unrelated work.
The two database migrations are live.
