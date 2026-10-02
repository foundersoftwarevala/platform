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
| PM-ADD-1 | BROKEN | AddProduct.tsx | Product created through the browser Supabase client — the hosted project, not the VPS database the marketplace serves (the same reason the list, dashboard and analytics had already been moved). A product added here never reached the storefront, or was refused there; categories came from the same wrong database | VERIFIED LIVE (release 50e446d, 2026-10-02) — operator Add Product posted to /api/manager/resource (HTTP 200); row read back from sv_platform; no hosted-Supabase write from the studio |
| PM-ADD-2 | BROKEN | AddProduct.tsx | Leaving either price empty made the form refuse to submit with no message (NaN failed the schema; price and pricing-model errors were never rendered) | VERIFIED LIVE (release 50e446d, 2026-10-02) — created with Monthly Price left empty |
| PM-ADD-3 | MISSING | resource.ts products.creatable | `features` offered by the form could not be stored through the server path | VERIFIED LIVE (release 50e446d, 2026-10-02) — features stored as ["API Access"] |
| PM-ADD-4 | DEAD | AddProduct.tsx | Visibility "Country Specific" behaves exactly like Global (no country is asked for or stored) | NEEDS-OWNER — the established country model is the card slot (one category × one country, Marketplace Manager) plus search_keywords country:<name> markers; whether "Country Specific" restricts visibility or only targets, and who chooses the country, is defined nowhere |
| PM-ADD-5 | MISSING | AddProduct.tsx | No image, file, demo, technology, licence, subcategory or SEO input; a product is created with name, category, description, features and price only | NEEDS-OWNER — demos belong to Demo Manager, SEO to SEO Manager; images, technology and licence have no editor in any manager today |
| PM-POLICY-1 | UI-UX | AddProduct.tsx, ProductList.tsx | The screens say a product is "READ-ONLY forever / immutable", while Marketplace Manager → Products edits, publishes and retires the same rows | FIXED — wording now says read-only in this studio, edited and published in Marketplace Manager → Products (the code and RLS show products are editable) |
| PM-LIFE-1 | MISSING | Product Manager | A product added here is a draft (content_status default) and is not public; there is no publish, unpublish or edit here — that happens in Marketplace Manager / Moderation | VERIFIED boundary — Marketplace Manager owns edit, publish and retire (resource products.editable incl. content_status; RLS admin/boss write); Product Manager creates. Not a defect |
| PM-LIST-1 | MISSING | ProductList.tsx | Only the first 100 of ~7,365 products, no paging, no search | VERIFIED LIVE (release 50e446d, 2026-10-02) — "1–100 of 7,365", Next gives 101–200, search "school" gives 92 on the server |
| PM-LIST-2 | BROKEN | resource.ts products.select | `created_at` never selected, so "Created" was always "-" | VERIFIED LIVE (release 50e446d, 2026-10-02) — created_at stored and shown |
| PM-LIST-3 | BROKEN | resource.ts GET order | Paging ordered by sort_order alone (shared by many rows) repeats and skips rows across pages — every LiveTable too | VERIFIED LIVE (release 50e446d, 2026-10-02) — page 1 and page 2 share no rows; DB: 7,365 of 7,365 distinct over all pages |
| PM-LIST-4 | BROKEN | ProductList.tsx | A failed read showed "No products found" | FIXED |
| PM-LIST-5 | BROKEN | ProductList.tsx | "Active" meant visible only; a visible draft (not public) read Active | VERIFIED LIVE (release 50e446d, 2026-10-02) — the new draft read "Draft", not Active |
| PM-LIST-6 | DEAD | ProductList.tsx | A request for up to 2,000 demo rows whose result was never shown | FIXED (no longer made) |
| PM-DASH-1 | BROKEN | ProductDashboard.tsx | "Recent Products" / "Recent Demos" were the first four by display order, not the newest | FIXED |
| PM-DASH-2 | BROKEN | ProductDashboard.tsx | "Active Products" counted visible drafts | VERIFIED LIVE (release 50e446d, 2026-10-02) — Active Products 7,346 of 7,365 total |
| PM-DASH-3 | BROKEN | ProductDashboard.tsx, ProductAnalytics.tsx | A failed count showed 0 | FIXED (dash) |
| PM-AUDIT-1 | BROKEN | ProductAuditLogs.tsx | Read audit_logs on the hosted project; Manager product/demo changes are recorded in marketplace_audit_logs on the VPS, so none ever appeared | VERIFIED LIVE (release 50e446d, 2026-10-02) — the create appeared in Audit Logs with the operator's e-mail and time; one marketplace_audit_logs row |
| PM-AUDIT-2 | BROKEN | ProductAuditLogs.tsx | A failed read rendered an empty table | FIXED |
| PM-HEALTH-1 | BROKEN | hooks/useHealthCheck.ts (Health Check tab) | "Run health check" read the legacy `demos` table on the hosted project and asked a hosted edge function to check it; the demos visitors open are product_demo_urls on the VPS, so it checked a list nobody uses and stored nothing where the studio reads | VERIFIED LIVE (release 50e446d, 2026-10-02) — Run Health Check: 17/17 healthy; 17 PATCHes through /api/manager/resource, 17 demo_url.test audit rows, last_checked_at updated; no call to the hosted health-check function |
| PM-A11Y-1 | UI-UX | AddProduct.tsx, ProductList.tsx | Form labels were not tied to their fields (no htmlFor/id) and the search box had no label, so screen readers announced unnamed fields | VERIFIED LIVE (release 50e446d, 2026-10-02) — label[for=pm-product-name] resolves to its input |
| PM-A11Y-2 | UI-UX (accessibility) | ProductList.tsx View dialog | The dialog is opened from code, not a DialogTrigger, so after Escape focus went to the page body instead of the View button that opened it (live, 2026-10-03) | FIXED in code (focus returned through onCloseAutoFocus; build passes) — committed locally, not deployed; live check pending the next deploy |
| PM-ADD-6 | BROKEN | AddProduct.tsx | Category "Other" stores no category, so the product, once published, appears in no category row or category page | NEEDS-OWNER — an authoritative destination for Other products does not exist: none of the 91 categories is a catch-all; 'uncategorised' exists only as the product-URL fallback path (20260907280100), not as a category |
| PM-RLS-2 | BROKEN (security) | marketplace_products public SELECT policies | Both public read policies ignored content_status, and /rest/v1 on softwarevala.net answers without a key: anyone could list visible drafts (10 on 2026-10-02) — and every product Add Product creates is a visible draft | FIXED AND VERIFIED LIVE — re-checked after the deploy: anon REST returns [] for drafts, 0 demo addresses, 0 audit rows; 7,346 published products readable |
| PM-SCALE-1 | MISSING (performance) | marketplace_products indexes | Product List (order sort_order,id) and Recent (order created_at) sort the whole table on every request: 12.8 ms and 5.3 ms at 7,365 rows, growing linearly | FIXED AND VERIFIED LIVE — after the deploy: first page 0.15 ms, page 73 1.23 ms (12.8 ms before), newest four 0.10 ms (5.3 ms before), count 0.84 ms |
| PM-SCALE-2 | UI-UX (performance) | marketplace_products search | With the (sort_order, id) index the planner walks it and filters every row for an ilike search: "school" 19.8 ms against 15.6 ms with the earlier sequential scan, at 7,365 rows | FIXED AND VERIFIED LIVE (2026-10-03) — cause: name, slug and industry_label are searched with ilike '%term%' and only name had a trigram index, so the page and the count each read all 7,365 rows (15 runs: index plan median 18.1 ms, sequential 15.4 ms, count 15.0 ms; the +2.6 ms was the index-order walk filtering every row). Migration 20261003T090000 added slug and industry_label trigram indexes CONCURRENTLY (752 kB, 368 kB; no duplicate). After: BitmapOr over the three trigram indexes, page median 0.20 ms, count 0.16 ms; same 92 rows in the same order. No code change. API round trip for the same search is ~420 ms, dominated by the 227 kB response (every product column), not the database |
| PM-ROUTE-1 | UI-UX | ProductDemoManagerLayout.tsx | Tabs are not in the URL: no deep link, refresh returns to the dashboard, back leaves the studio | VERIFIED LIVE (release 50e446d, 2026-10-02) — every tab opens by ?tab=, refresh keeps it, a click writes ?tab= and Back returns |
| PM-ACCESS-1 | BROKEN | RouteAccessGate vs requireInternalOperator | founder and boss_owner open the studio and are refused by its API | NEEDS-OWNER — business authorization policy is undefined: RequireRole (UI) treats founder and boss_owner as operators, requireInternalOperator (API) does not, RLS lets only admin/boss write products; no document settles it |
| PM-I18N-1 | UI-UX | Product Manager pages | Dates printed with date-fns English month names; numbers en-IN | VERIFIED LIVE (release 50e446d, 2026-10-02) — dates render per language (hi 5 सित॰ 2026, ta 5 செப்., 2026, he 5 בספט׳ 2026, zh 2026年9月5日) |
| PM-I18N-2 | UI-UX | Product Manager pages | Most text is hardcoded and reaches other languages only through the page translator | VERIFIED LIVE (release 50e446d, 2026-10-02) in Product Manager scope — hi, ta, he, zh-Hans, zh-Hant: no English studio strings left, no raw keys; he renders dir=rtl. Global I18N-D6 OPEN outside PM |
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

## Correction to "Deployment boundary" above

The paragraph above saying the production source is not a git checkout was
wrong. Read-only inspection on 2026-10-02 showed /var/www/softwarevala is a
clean checkout of main (no tracked modifications; every deploy in the reflog is
"reset: moving to origin/main"), and the running build matched commit 323dc28.
The differences seen earlier came from comparing it with local HEAD, which was
14 commits ahead of main.

## Release and deployment (2026-10-02)

- Release: origin/main (89371b0) + the Product Manager commit only - release
  commit 50e446d637c6, tree faad870, identical patch to e3a12f8. Verified alone
  in a worktree: build passes; typecheck 5,034 errors against 5,046 on
  origin/main, no file gained one; tests 770/771 against 628/629, the same three
  pre-existing failures; i18n failing files identical to origin/main's 25.
- Pushed to origin/main as a fast-forward 89371b0..50e446d (no force).
- VPS: fetched, origin/main = 50e446d, checkout moved to 50e446d, tree
  faad870, 0 tracked modifications. scripts/ops/sv-deploy.sh: build, manifest
  check, homepage on port 3011 (200, marker present), swap, PM2 stop / port
  free / start, LIVE OK http=200. No rollback. Previous build kept at
  .output.prev-20261002-183414.
- After: HEAD 50e446d, build date 2026-10-02T18:35:29Z, softwarevala-staging
  online (pid 3964582), port 3000 held by that pid only, one app process.
  Public routes /, /marketplace, /product-demo-manager, catalogue, search and a
  category page answer 200.

## Live E2E (2026-10-02, production)

42 automated checks plus a targeted health-check run, all passing:

- Signed out: studio shows "Access restricted"; GET and POST on the products
  API answer 401.
- Signed-in non-operator (reseller): GET, POST and a PATCH on another row's id
  answer 403.
- Operator: all six tabs open by URL with no failure and no raw message key;
  refresh and Back keep the tab; paging, search, dashboard figures as above.
- Real write, following the repository's E2E protocol (one marked record,
  removed afterwards): "zz-e2e PM check 2026-10-02T23:16:47" created through the
  form - draft, visible, features ["API Access"], price ₹1,234 lifetime,
  category set, created_at set, sort_order 0; one "Products created" audit row
  by the operator; listed in Product List as Draft; anonymous REST returned []
  for it. Then deleted by its id only (no demo links or order items referenced
  it); its audit row stays, as the trail is append-only.
- Languages (browser, production): hi, ta, he, zh-Hans, zh-Hant - studio title,
  table and dates in the language, he with dir=rtl, no English studio strings.
- Mobile 390 px: products, add-product and dashboard have no page-level
  horizontal overflow.
- No browser request from the studio wrote to a hosted Supabase REST endpoint;
  no console errors.

## Status by layer (2026-10-02)

| Layer | Status |
|---|---|
| CODE | VERIFIED |
| BUILD | VERIFIED |
| DATABASE | VERIFIED |
| API | VERIFIED |
| RLS | VERIFIED |
| SECURITY | VERIFIED |
| PERFORMANCE | VERIFIED (PM-SCALE-2 fixed live) |
| I18N | VERIFIED in Product Manager scope (five languages live, 140 by format test); global I18N-D6 OPEN |
| UI/UX | VERIFIED |
| ACCESSIBILITY | VERIFIED live except PM-A11Y-2 (fix ready, not deployed) |
| E2E | VERIFIED |
| PRODUCTION | VERIFIED |

Remaining owner decisions: PM-ACCESS-1, PM-ADD-4, PM-ADD-5, PM-ADD-6.

## Micro-closure (2026-10-03)

Keyboard, live on production with every write blocked in the browser:

- All six tabs: Tab moves through the page with no trap; focus is visible on
  every stop (desktop and 390 px).
- Order: the site-wide language dock (fixed, bottom left, root layout - not
  Product Manager) comes first, then the studio tabs top to bottom, then the
  page content in reading order; a disabled Previous is skipped.
- Studio tabs open with Enter and with Space; the locked Settings tab is
  disabled for the keyboard too.
- Search, Next and Previous work from the keyboard ("1–92 of 92", "101–200",
  back to "1–100").
- View dialog opens with Enter; Tab and Shift+Tab stay inside it; Escape closes
  it - focus then went to the page body (PM-A11Y-2, fixed in code).
- Add Product: the category select opens with Space and picks with the arrow
  keys and Enter; submitting from the keyboard shows the validation messages;
  the field in error can be focused again.
- Run Health Check is reachable and visibly focused (not pressed in this pass).
- No write left the browser during these checks.

PM-SCALE-2 resolved by database indexes only (above); production code is still
release 50e446d.
