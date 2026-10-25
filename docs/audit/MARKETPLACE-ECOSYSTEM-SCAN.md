# Marketplace Ecosystem Scan

**Audit mode:** static repository inspection only  
**Repository:** `foundersoftwarevala/platform`, branch `feature/marketplace-fixes`  
**Audit date:** 2026-10-25  
**Runtime/live database status:** UNVERIFIED. No application, browser, production API, database, or external service was contacted.

“Connected” below means a source-level call, route, query, or database definition was found. It does not mean that the route is deployed, the migration is applied, or the complete transaction succeeds at runtime. In particular, several migration filenames post-date this audit date; their checked-in definitions are not evidence of application to either database.

## 1. Ecosystem Map

```text
Homepage (/) ── local allDemos search ──> product detail
     │                                      │
     └── country rails ─> marketplace catalog API
                                            │
Separate marketplace search API ───────────┤
                                            v
                            marketplace_products / categories
                                            │
Author API ─> draft/submitted product ─> Marketplace Manager review
                                            │
                            visible + approved + published product
                                            │
                 product detail / product_demo_urls / SEO gate
                                            │
Customer cart ─> checkout server functions ─> marketplace_create_checkout
                                            │
             marketplace_orders + order_items + payment_intents
                                            │
              POST /api/payment/initiate ─> PayU
                                            │
                 return routes / payment webhook
                                            v
                  signature + amount + provider verification
                                            │
                       order status -> paid
            ┌───────────────┼────────────────┬──────────────────┐
            v               v                v                  v
        Entitlements     Invoices       Commission rules     Referral
        / licenses      (finance_      and paid-order       attribution
                         invoices)       triggers           (reseller/
                                                            influencer/
                                                            affiliate)
            │               │                │                  │
            v               v                v                  v
        Customer        Finance UI      partner_commissions   analytics
        access/email                    / reseller_commissions

Marketplace lead form ─> leads ─> Lead Manager intake/routing
Marketplace products ─> SEO metadata/indexing gate/sitemap
Marketplace catalogue ─> Demo Manager/product demo URLs
Marketplace order read ─> AYRA commercial summary (per-user aggregate)

No sale-triggered Finance wallet/ledger, AMS award, or Task Manager handoff
was found in the traced payment/fulfillment path. Franchise catalogue/
pricing integration is incomplete; see role and manager status below.
```

## 2. Role-by-Role Connection Status

| Role / connection | Status | Source trace and boundary |
|---|---|---|
| Customer / buyer | **Connected** | Product detail invokes authenticated cart operations, checkout creates an order, payment initiation verifies order ownership and sends the buyer to PayU, and the callback settles then fulfills. UI/API references: [ProductDetail.tsx](../../src/components/marketplace-home/ProductDetail.tsx#L65), [marketplace-commerce.functions.ts](../../src/lib/marketplace-commerce.functions.ts#L30), [checkout.tsx](../../src/routes/checkout.tsx#L27), [initiate.ts](../../src/routes/api/payment/initiate.ts#L57), [webhook.ts](../../src/routes/api/payment/webhook.ts#L15). Runtime payment provider configuration and successful delivery are UNVERIFIED. |
| Author / vendor | **Connected; publication is gated** | Author product API sets the seller from authenticated context and creates a hidden draft; submission changes moderation/content state but does not itself approve or publish. A manager/review path and the public visibility/status gates are separate. [products.ts](../../src/routes/api/author/products.ts#L106), [author-guard.ts](../../src/lib/marketplace/author-guard.ts#L150), [marketplace.functions.ts](../../src/lib/marketplace.functions.ts#L427). The inspected references did not establish which UI calls the author API; live moderation behavior is UNVERIFIED. |
| Reseller | **Connected** | Active reseller can create/toggle an `SVR…` referral code; URL uses `/?ref=…`. Captured attribution reaches the pending order at payment initiation. The paid-order database function calculates line commissions into `reseller_commissions`. [referral.ts](../../src/routes/api/reseller/referral.ts#L40), [initiate.ts](../../src/routes/api/payment/initiate.ts#L317), [reseller commission migration](../../supabase/migrations/20260907190100_reseller_commission_engine.sql#L79). |
| Affiliate | **Partially connected** | Approved affiliate can generate an `SV…` code; referral capture and order attribution exist. The inspected migrations expose affiliate analytics reading `partner_commissions`, but no affiliate-specific paid-order commission writer/trigger was found. Attribution and analytics alone do not demonstrate sale accrual. [account.ts](../../src/routes/api/affiliate/account.ts#L31), [core.ts](../../src/lib/affiliate/core.ts#L264), [aggregate reads migration](../../supabase/migrations/20261108T143000_marketplace_aggregate_reads.sql#L14). The deployed database may differ; UNVERIFIED. |
| Influencer | **Connected** | Active influencers create `SVI…` codes. Referral sessions are attributed to orders, and `influencer_commissions_for_order` writes per-line `partner_commissions` with self-referral/active-profile checks. [referral.ts](../../src/routes/api/influencer/referral.ts#L35), [influencer sale commission migration](../../supabase/migrations/20261103T110000_influencer_sale_commission.sql#L81). |
| Influencer QR | **Connected in source** | Authenticated active influencer can create/reuse a product QR tied to the referral code; scan route registers a scan and redirects to the target carrying attribution. [qr.ts](../../src/routes/api/influencer/qr.ts#L104), [scan route](../../src/routes/api/qr/scan/$code.ts#L70), [QR migration](../../supabase/migrations/20261103T131000_influencer_qr.sql#L17). QR migration deployment and scan analytics are UNVERIFIED. |
| Franchise | **Missing / incomplete** | No franchise-specific referral code/QR path was found. Franchise product wall labels its source pending; no marketplace inventory assignment flow was found. The partner quote route reads a franchise/territory record but states marketplace checkout does not apply a franchise discount. [products.tsx](../../src/components/franchise/walls/products.tsx#L8), [partner quote.ts](../../src/routes/api/partner/quote.ts#L99), [franchise-store.ts](../../src/lib/franchise-store.ts#L253). |
| Awards / AMS badges | **Missing in the traced sale path** | No call from marketplace payment settlement/fulfillment or paid-order commission handlers to AMS award/badge granting was identified. This is a static absence in the inspected sale path, not proof that no unrelated award automation exists elsewhere. |

### Referral and order-attribution path

The root mounts `ReferralCapture`; `ref` (or legacy `aff`) is posted to `/api/track/ref`, which resolves an active code and creates/refreshes a `marketplace_referral_sessions` record. It returns a first-party, `HttpOnly`, `SameSite=Lax`, `Secure` cookie with a 60-day lifetime. On payment initiation, the cookie is resolved and `marketplace_order_attributions` is written once per order before checkout is handed off to PayU; attribution failures are logged and do not block payment. [__root.tsx](../../src/routes/__root.tsx#L199), [ReferralCapture.tsx](../../src/components/affiliate/ReferralCapture.tsx#L28), [track ref.ts](../../src/routes/api/track/ref.ts#L38), [affiliate core.ts](../../src/lib/affiliate/core.ts#L264), [initiate.ts](../../src/routes/api/payment/initiate.ts#L317).

`/api/affiliate/attribute` separately exists and validates ownership/order state, but no frontend caller was identified; payment initiation performs the observed attribution stamp itself. [attribute.ts](../../src/routes/api/affiliate/attribute.ts#L14).

## 3. Manager-by-Manager Connection Status

| Manager | Status | Evidence and limits |
|---|---|---|
| Finance Manager | **Partially connected** | Paid-order fulfillment calls `createInvoiceForOrder`, which writes `finance_invoices`; Finance Manager exposes invoice resources. The traced settlement path does not call `recordInvoiceForOrder` or another writer to `finance_transactions`, `finance_wallets`, or `finance_wallet_transactions`. A separate commerce helper can write a finance transaction, but no caller from fulfillment was found. Thus invoice visibility is wired; sale ledger/wallet credit is not evidenced. [fulfilment.ts](../../src/lib/commerce/fulfilment.ts#L350), [invoices.ts](../../src/lib/commerce/invoices.ts#L73), [invoicing.ts](../../src/lib/commerce/invoicing.ts#L208), [resource.ts](../../src/routes/api/manager/resource.ts#L2926), [FinanceLedger.tsx](../../src/components/finance/FinanceLedger.tsx#L25). |
| Marketplace Manager | **Connected** | Moderation functions call manager RPCs against Marketplace products; category rows use `marketplace_categories`. Order Center exposes refund-request and dispute RPCs/tables. Full refunds have a separate settlement migration that reverses order access and commissions. Actual provider refund execution and deployed migration status are UNVERIFIED. [moderation.functions.ts](../../src/lib/marketplace-manager/moderation.functions.ts#L10), [rows.functions.ts](../../src/lib/marketplace-manager/rows.functions.ts#L477), [orders.functions.ts](../../src/lib/marketplace-manager/orders.functions.ts#L138), [orders center migration](../../supabase/migrations/20260906270000_marketplace_orders_center.sql#L380), [refund settlement migration](../../supabase/migrations/20261107T130000_marketplace_refund_settlement.sql#L42). |
| Lead Manager | **Connected for enquiries; no sale handoff found** | Marketplace lead capture writes `leads` and best-effort calls lead intake for scoring/routing/SLA. Lead Manager reads through `lead_manager_list_leads`. The traced order/settlement path does not create a lead on product view or purchase. [lead.ts](../../src/routes/api/marketplace/lead.ts#L321), [lead-manager api.ts](../../src/lib/lead-manager/api.ts#L191). |
| SEO Manager | **Connected** | Product route loads SEO/indexing data and renders canonical/meta plus `SoftwareApplication` JSON-LD. Category SEO reads category SEO metadata and `seo_keywords`; product sitemap uses the indexing gate. Missing gate decisions remain unverified/non-indexable; whether current pages have the intended saved decisions is UNVERIFIED. [product route](../../src/routes/marketplace.product.$slug.tsx#L70), [category-seo.ts](../../src/lib/seo/category-seo.ts#L46), [sitemap route](../../src/routes/sitemap-products/$page.ts#L24), [sitemap gate](../../src/lib/seo/sitemap-gate.ts#L70). |
| Demo Manager | **Connected to product/demo data; no sale handoff found** | Marketplace demo reads join `product_demo_urls` with Marketplace product/category identity. Demo categories derive from Marketplace categories. No paid-order handoff to Demo Manager was found. [marketplace-demo.functions.ts](../../src/lib/marketplace-demo.functions.ts#L176), [demo categories migration](../../supabase/migrations/20261103T096000_demo_categories_from_marketplace.sql#L14). |
| Task Manager | **Missing sale-triggered connection** | Task Manager has `tm_tasks` and a shared `openTask` service, but no call from Marketplace payment settlement/fulfillment to task creation was found. A custom-work task may be created through other flows, but this sale path does not evidence it. [tm api.ts](../../src/lib/tm/api.ts#L32), [task-service.functions.ts](../../src/lib/tm/task-service.functions.ts#L193). |

## 4. Core Marketplace Flow

### Homepage, search, product page

- The `/` route renders the Sapphire homepage. Its prominent search filters the imported `allDemos` array locally by name/description/category; it is not a request to Marketplace search. Homepage cards link to `/marketplace/product/$slug`, and Buy Now adds `?buy=1`. [index.tsx](../../src/routes/index.tsx#L9), [HomeIndex.tsx](../../src/components/sapphire-home/HomeIndex.tsx#L190).
- Homepage country rails use `GET /api/marketplace/catalog`; the server reads `mm_row_products`/`marketplace_products` and filters for public/approved/published rows. Failed rail reads leave the shelf unchanged. [HomeIndex.tsx](../../src/components/sapphire-home/HomeIndex.tsx#L121), [catalog.ts](../../src/routes/api/marketplace/catalog.ts#L40), [catalog.server.ts](../../src/lib/marketplace/catalog.server.ts#L146).
- A separate `GET /api/marketplace/search` reads published `marketplace_products`, but the canonical homepage search does not call it. This is a data-path inconsistency, not evidence that the search endpoint itself is broken. [search.ts](../../src/routes/api/marketplace/search.ts#L186).
- Product detail loads a public slug through `getPublicProduct`, combines demo and SEO data, and enforces visibility, moderation, publish status and publish-window checks. The route can produce 404 on a successfully completed not-found lookup. [marketplace product route](../../src/routes/marketplace.product.$slug.tsx#L53), [marketplace.functions.ts](../../src/lib/marketplace.functions.ts#L427).

### Checkout, payment, fulfillment

1. Product page calls authenticated `addMarketplaceCartItem`, backed by `marketplace_add_to_cart`, and navigates to checkout. Checkout reads cart/items/pricing and uses `marketplace_cart_quote`, `marketplace_set_cart_item_pricing`, and `marketplace_create_checkout`. [ProductDetail.tsx](../../src/components/marketplace-home/ProductDetail.tsx#L65), [marketplace-commerce.functions.ts](../../src/lib/marketplace-commerce.functions.ts#L30).
2. The checkout SQL creates `marketplace_orders`, `marketplace_order_items`, and `marketplace_payment_intents`, and marks the cart checked out. This is checked-in migration behavior, not live schema verification. [checkout migration](../../supabase/migrations/20261103T141000_checkout_currency_and_publish_window.sql#L29).
3. Checkout posts the order ID to `POST /api/payment/initiate`. The handler checks authentication, ownership, pending status, amount, line currencies and nonempty line items; it persists the attempt and creates PayU form fields. [checkout.tsx](../../src/routes/checkout.tsx#L27), [initiate.ts](../../src/routes/api/payment/initiate.ts#L114).
4. PayU success/failure returns and webhook share settlement logic. It validates the callback signature, transaction/order association, charged amount and provider verification before changing an order to paid. [success.tsx](../../src/routes/payment/success.tsx#L6), [fail.tsx](../../src/routes/payment/fail.tsx#L6), [webhook.ts](../../src/routes/api/payment/webhook.ts#L15), [payu-settle.ts](../../src/lib/commerce/payu-settle.ts#L181).
5. Paid-order flow issues/repairs licenses and entitlements, attempts author commission recording, creates/reads an invoice, and queues/sends the license email. Reseller and influencer commissions are defined in paid-order database logic; the flow does not evidence a Finance wallet credit. [fulfilment.ts](../../src/lib/commerce/fulfilment.ts#L140), [influencer commission migration](../../supabase/migrations/20261103T110000_influencer_sale_commission.sql#L144), [reseller commission migration](../../supabase/migrations/20260907190100_reseller_commission_engine.sql#L177).

## 5. Database & API Dependencies

### Primary APIs and functions identified

**Marketplace browsing/product authoring**

- `GET /api/marketplace/catalog`, `GET /api/marketplace/search`
- `/marketplace/product/$slug` route and `getPublicProduct`
- `GET/POST /api/author/products`
- Manager moderation/category functions, including `mm_moderation`, `mm_product_moderate`, and `mm_row_products`

**Cart, checkout, and payments**

- `addMarketplaceCartItem` and other `src/lib/marketplace-commerce.functions.ts` server functions
- `marketplace_add_to_cart`, `marketplace_cart_quote`, `marketplace_set_cart_item_pricing`, `marketplace_create_checkout`
- `POST /api/payment/initiate`, PayU return routes, `POST /api/payment/webhook`
- `settlePayuCallback`, `recordPaymentIntent`, `fulfilOrder`

**Attribution and partner APIs**

- `POST /api/track/ref`
- `GET/POST /api/affiliate/account`, `POST /api/affiliate/attribute`
- `GET/POST /api/reseller/referral`
- `GET/POST /api/influencer/referral`, `POST /api/influencer/qr`, `/api/qr/scan/$code`
- `GET /api/partner/quote`
- `influencer_commissions_for_order`, `reseller_commissions_for_order`, `marketplace_referral_link_analytics`

**Manager and adjacent module interfaces**

- `POST /api/marketplace/lead` and `runLeadIntake`
- `mm_refund_request`, `mm_dispute_open`, `mm_dispute_resolve`, `revoke_order_access`
- `createInvoiceForOrder`; separate `recordInvoiceForOrder` helper
- Marketplace demo functions, SEO product/category functions and sitemap routes
- `ayra_commercial_summary` via AYRA commercial retrieval

This list covers the identified Marketplace ecosystem boundaries and named APIs/functions in this audit; it is not a complete inventory of every unrelated route or RPC in the repository.

### Database tables and relationships identified

| Area | Tables / records | Dependency |
|---|---|---|
| Catalogue and authoring | `marketplace_products`, `marketplace_categories`, `marketplace_sellers` | Author API creates/updates seller-owned drafts; manager review and public reader visibility/status gates determine catalogue availability. |
| Cart and purchase | `marketplace_carts`, `marketplace_cart_items`, `marketplace_product_pricing`, `marketplace_orders`, `marketplace_order_items` | Cart/pricing functions produce order and canonical product-line records. |
| Payment | `marketplace_payment_intents`, `marketplace_payment_events`, payment logs | Order transaction IDs and callback verification associate the provider result with the order; event and intent persistence are separate from the order transition in the traced PostgREST flow. |
| Product access | `licenses`, `entitlements`, `marketplace_licenses`, `marketplace_entitlements` | Fulfillment grants customer access; revocation/refund paths must coordinate both marketplace and general license/entitlement records. |
| Referral and commissions | `marketplace_referral_codes`, `marketplace_referral_sessions`, `marketplace_order_attributions`, `marketplace_referral_link_analytics`, `resellers`, `reseller_commissions`, `influencer_profiles`, `influencer_compensation_rules`, `partner_commissions` | Referral cookie/session attaches partner attribution to an order; reseller/influencer paid-order logic consumes the attribution and records commissions. Affiliate writer absence is noted above. |
| Finance | `finance_invoices`, `finance_transactions`, `finance_wallets`, `finance_wallet_transactions` | Current fulfillment writes/reads the invoice. The traced sale path does not evidence corresponding ledger/wallet movement. |
| Leads | `leads` | Marketplace enquiry form writes leads; Lead Manager queries and processes them. No purchase-created lead was found. |
| Demos and SEO | `product_demo_urls`, `seo_keywords`, Marketplace category SEO fields, indexing/gate records | Product and category pages source demo/SEO data; sitemap inclusion is gated by an indexing decision. Exact live schema/data is UNVERIFIED. |
| Refunds / disputes | `marketplace_order_refunds`, `marketplace_disputes` | Manager RPCs record requests/cases; settlement/reversal behavior is defined separately in migrations. |
| AI / tasks | `marketplace_orders`, `ayra_orders`, `ayra_order_steps`, `founder_reports`, `tm_tasks` | AYRA reads a per-caller Marketplace order aggregate. No Marketplace sale-to-Task Manager creation call was found. |

**Database platform:** source code and migrations indicate PostgreSQL exposed through Supabase/PostgREST (Supabase URL/service-role usage, `supabase/migrations`, and PostgREST paths). Repository working notes describe separate VPS and Supabase cloud databases, with differing migration currency. Neither live database was queried for this audit; provider deployment, object presence, constraints, policies, and actual consistency are UNVERIFIED.

## 6. AYRA / AI Connection

AYRA’s commercial question flow calls `loadCommercialSummary`, which invokes the authenticated PostgREST RPC `ayra_commercial_summary`. The migration groups the current caller’s `marketplace_orders` by status and currency, excluding soft-deleted rows; the resulting aggregate is supplied as trusted context to AYRA. This is a **per-buyer order summary**, not a marketplace-wide sales/commission/product report. AYRA’s separate order-history records use `ayra_orders` and `ayra_order_steps`; no general AI reporting capability over Marketplace catalogue or seller data was evidenced. [ayra.functions.ts](../../src/lib/founder/ayra/ayra.functions.ts#L193), [analyse.server.ts](../../src/lib/founder/intelligence/analyse.server.ts#L164), [commercial retrieval](../../src/lib/founder/intelligence/commercial-retrieval.server.ts#L57), [AYRA aggregate migration](../../supabase/migrations/20261108T132000_ayra_commercial_summary.sql#L19).

The AYRA aggregate migration is dated **2026-11-08**, after the audit date. Its presence in the repository does not establish that it is applied or that the RPC is available in any environment. AI model availability and successful live retrieval were not tested.

## 7. UI/UX Issues Found

| Finding | Status / impact | Evidence |
|---|---|---|
| Homepage search and Marketplace search are separate paths | **Inconsistent**: homepage search only filters `allDemos`; the Marketplace search API is not wired to that control, so results may not reflect the same database catalogue. | [HomeIndex.tsx](../../src/components/sapphire-home/HomeIndex.tsx#L190), [search.ts](../../src/routes/api/marketplace/search.ts#L186). |
| Homepage/rail read failures can look like ordinary absence | **Partial error visibility**: route loader falls back to null after a 1.5-second cap, and rail failures preserve the previous shelf without an explicit user-facing error. | [index.tsx](../../src/routes/index.tsx#L96), [country-rail.ts](../../src/lib/marketplace/country-rail.ts#L79). |
| Reseller wall does not render its loading/error state | **Confirmed in inspected component**: loading and load-error state are set, but the shared wall's visible output can show an empty-state message instead of distinguishing read failure. | [wall.tsx](../../src/components/manager-suite/wall.tsx#L230), [wall.tsx](../../src/components/manager-suite/wall.tsx#L683). |
| Affiliate report controls are not wired in the inspected route | **Confirmed in component**: Export All, PDF/Excel/CSV, and Schedule are rendered without handlers. | [affiliate-manager.reports.tsx](../../src/routes/affiliate-manager.reports.tsx#L24). |
| Reseller report action implies queued export despite missing backing source | **Misleading UX**: source notes no scheduled-report table/seed, while a detail action displays a success toast that export was queued. | [reports.tsx](../../src/components/reseller/walls/reports.tsx#L12), [reports.tsx](../../src/components/reseller/walls/reports.tsx#L60). |
| Affiliate order email search has no source column | **Incomplete filter**: email is intentionally blank in the order row and search fields do not include a stored email value; the wall treats it as unsourced. | [affiliate-manager.orders.tsx](../../src/routes/affiliate-manager.orders.tsx#L8), [EntityWall.tsx](../../src/components/affiliate/EntityWall.tsx#L146). |
| Checkout/product views have more explicit states | **Appears implemented statically**: product loading/not-found and checkout empty, pricing, mixed-currency, sign-in and order/payment error states are present. Runtime rendering remains UNVERIFIED. | [ProductDetail.tsx](../../src/components/marketplace-home/ProductDetail.tsx#L181), [checkout.tsx](../../src/routes/checkout.tsx#L94). |

Role experiences are not one shared Marketplace UI: customer/product checkout, author tools, reseller walls, influencer panels, affiliate manager and franchise panels use separate routes/components. The code therefore does not establish consistent loading/error conventions across all roles.

## 8. Priority Remediation Recommendations

1. **Complete sale-to-Finance reconciliation.** Define the authoritative accounting event and, if a sale should credit finance ledger/wallets, call an idempotent writer from the paid-order transaction/fulfillment boundary. Add reconciliation for orders with invoices but no ledger entries. Do not infer amounts or currencies from display totals.
2. **Verify and complete affiliate commission accrual.** Confirm whether a writer/trigger exists in the live schemas not represented by the inspected repository migrations. If absent, add an idempotent paid-order commission path and tests for attribution, self-referral, multi-currency rules, refund reversal, and retries.
3. **Choose and wire one canonical catalogue search path.** Either connect the homepage search to `/api/marketplace/search` or clearly scope the local demo search; align filters and empty/error messaging.
4. **Resolve franchise Marketplace requirements.** Implement or explicitly declare out of scope franchise inventory assignment, price/discount application, referral attribution and permissions; avoid presenting list-price quotation as an applied franchise price.
5. **Decide whether Marketplace purchases earn AMS awards or create service tasks.** If required, define the event/eligibility contract and idempotent handoff; otherwise document that these modules are intentionally disconnected.
6. **Improve manager UI feedback.** Render reseller wall loading/error/retry states, wire or disable affiliate report controls, avoid success-shaped “queued” messages where no queue write occurs, and remove unsupported email filters.
7. **Validate deployment parity before asserting live connectivity.** Compare cloud/VPS schemas, migration state, RLS policies, RPC availability, PayU configuration, and SEO gate records in an authorized read-only/live verification process. This static audit did not do so.

## 9. Coverage and Limitations

- **Requested connection categories traced:** 11/11 (five named role connections: reseller, affiliate, influencer, franchise, awards; six named managers: Finance, Marketplace, Lead, SEO, Demo, Task). Core Marketplace flow and AYRA were additionally traced.
- **Coverage definition:** this is coverage of the explicit categories in the request, not a percentage of repository files, all API routes, all database objects, or all integrations.
- **Inspection evidence:** focused static inspection of the Marketplace homepage/product/checkout/payment and author boundaries; referral/role APIs and commission migrations; manager integration functions/migrations; AYRA reporting and selected role UI states.
- **Not audited exhaustively:** every route, component, migration, schema constraint/index/RLS policy, background job, payment-provider configuration, unrelated dashboard, every possible author/vendor frontend caller, and every cross-module call outside the traced paths.
- **Not verified:** runtime UI behavior, external provider responses, actual database contents or integrity, migration application, live role permissions/RLS, production error rates, real sale-to-ledger/commission writes, sitemap decisions, AI availability, QR scans, refunds, and task/award behavior.
- **No 100% repository coverage claim:** the 11/11 figure covers only the requested named role/manager categories; repository-wide Marketplace ecosystem coverage is not measurable from this focused static trace.

## Phases 06–10 Continuation (2026-10-26)

This is an addendum to the Phase 01–05 evidence above, not a replacement or a claim that earlier open findings passed. The existing issue register is [marketplace-ledger.md](../audits/marketplace-ledger.md). Inspection was static except for local automated tests, typecheck, lint, and build. No browser session, live database, production API, payment provider, or production data was accessed.

### Phase 06 — Security and authorization

**SEC-06-01 — HIGH — FIXED & VERIFIED LOCALLY; NOT DEPLOYED.** The Marketplace Manager generic service-role API previously delegated to `requireInternalOperator`, which admitted `developer` accounts even though the manager page did not grant them access. The generic `customers` resource exposes contact name, email, and phone (`src/routes/api/manager/resource.ts:3429-3472`); hiding the UI was therefore not an authorization boundary.

The manager `resource` GET/POST/PATCH/DELETE handlers, `bulk` POST, and `row-action` POST now scope their server-side role check to `boss`, `admin`, `super_admin`, and `owner`. The internal API token path is unchanged. Evidence: `src/lib/auth/marketplace-manager-roles.ts:1`, `src/lib/auth/internal-guard.ts:60-62,119-126`, `src/routes/api/manager/resource.ts:4218-4221,4369-4372,4484-4487,4550-4553`, `src/routes/api/manager/bulk.ts:82-85`, `src/routes/api/manager/row-action.ts:155-158`. Regression cases deny developer-only access before service-role reads and preserve access for the existing operator roles (`src/routes/api/manager/-resource.influencer-security.test.ts:102-124`; `src/lib/auth/internal-guard.test.ts:51-95`). The focused Marketplace Manager tests passed: 286 tests across six files.

**RBAC-04 remains OPEN / NEEDS-OWNER.** This closes the developer-only API exposure in these routes only. The manager page and backend policy still do not have a complete role-parity contract. Marketing/SEO access was not added to a generic API capable of reading and mutating 154 distinct tables; per-resource authorization is a prerequisite to expanding it. No direct-URL or cross-tenant production test was performed.

**SEC-06-02 — MEDIUM — FIXED & VERIFIED LOCALLY; NOT DEPLOYED.** The remaining-route review found that developer-only callers passed the default operator gate on `GET`, `PATCH`, and `PUT /api/marketplace/rows`. The GET could return hidden categories; PATCH could change category visibility, featured status, or ordering; PUT could reorder categories. Evidence before the fix: `src/routes/api/marketplace/rows.ts:118-120,199-201,216-250,261-284`; default roles are in `src/lib/auth/demo-roles.ts:15-21` and selected by `src/lib/auth/internal-guard.ts:119-120`. All three methods now pass `MARKETPLACE_MANAGER_API_ROLES` and a route-specific denial message (`rows.ts` GET cache and uncached branches, PATCH, and PUT). New tests verify hidden rows are not returned to a denied developer-only request and both write methods deny before any database fetch (`src/routes/api/marketplace/-rows.test.ts`).

The delegated remaining-API review inventoried 13 marketplace control APIs (automation, colour, deployment, developer, integrations, integrity, media, micro-interactions, permissions, rows, security, support, system) and nine public marketplace endpoints (activity, catalog, contact, country, lead, proof, search, track, translate). Most control APIs use the shared operator guard and additional permission checks for sensitive actions; `/api/marketplace/rows` was the confirmed exception. Public endpoints were reviewed as public-facing surfaces; no additional confirmed cross-tenant exposure or secret disclosure was identified in the inspected code. Five `src/lib/marketplace/*.functions.ts` read-only server functions were also reviewed; no state-changing function was found there.

The security reviewer inventoried all 24 `src/lib/marketplace-manager/*.functions.ts` modules, their exported server functions, caller-token usage, validation patterns, and direct service-role call sites. The RPC inventory contains 155 distinct names: 149 definitions in `public-schema.sql` and six migration-only definitions; no name was missing from both sources. However, the automated inventory did **not** fully verify definition and effective grants for any of the 155 RPCs (0/155); deployed ACLs remain **UNVERIFIED**. `topbar.functions.ts:49-60,75-114,120-143,152-165` opts four operations into anonymous calls. The checked-in `mm_topbar_items_set` definition is in `supabase/migrations/20261019T090000_topbar_dropdown_items.sql:75-137`, checks `mm_is_operator()`, and the same migration grants `PUBLIC` execute. Its body is guarded in source, but whether that migration and effective ACL are deployed remains **UNVERIFIED**.

The review concluded SEC-06-01 correctly gates requests authenticated solely as developer before Marketplace Manager data access (confidence 9/10). It also confirmed `requireInternalOperator` accepts a valid `x-internal-token` independently of user roles (`src/lib/auth/internal-guard.ts:69`); this is a separate shared-secret path, not proof of a developer-role bypass. Token distribution/rotation and secret exposure in the deployed environment were not verified. The 24 module wrapper inventory is now complete, but the exhaustive database-side authorization review remains incomplete because RPC definitions/grants are missing or not fully traced and no live policy was accessed.

**SEC-06-03 — MEDIUM — MITIGATION IMPLEMENTED IN MIGRATION; NOT APPLIED / NOT VERIFIED.** Direct anonymous access to `POST /rest/v1/rpc/mm_demo_eligibility` exposed product moderation status, deleted/merged state, blocked or quarantined asset counts, branding case counts, and unresolved legal state for a known product UUID. The wrapper `src/lib/marketplace-manager/demodomain.functions.ts:101-104` validates only UUID shape and calls the RPC as the caller; the checked-in definition is `supabase/migrations/20260907260100_demo_lifecycle_engine.sql:100-160`, and the checked-in schema grants `anon` execute (`supabase/schema/public-schema.sql:63044-63049`). New migration `supabase/migrations/20261108T152000_mm_demo_eligibility_operator_gate.sql:9-75` adds `mm_is_operator()` before reading product/gate data, revokes `public`/`anon`, and grants authenticated/service execution. Static regression tests check the guard precedes the first data read and assert the ACL changes (`src/lib/marketplace-manager/demo-rpc-security.test.ts`). The migration has not been applied or executed against a database; this is **not yet FIXED & VERIFIED** in either database.

**SEC-06-04 — MEDIUM — MITIGATION IMPLEMENTED IN MIGRATION; NOT APPLIED / NOT VERIFIED.** An anonymous caller knowing a sandbox UUID could invoke `POST /rest/v1/rpc/mm_sandbox_activity` and extend `last_activity_at`, `expires_at`, and `cleanup_after`, or reactivate an expiring sandbox. The function performs no identity/ownership check (`supabase/migrations/20260907270100_sandbox_engine.sql:135-169`) and the checked-in schema grants `anon` execute (`supabase/schema/public-schema.sql:63910-63915`). The new migration adds `mm_is_operator()` and removes anonymous execution (`supabase/migrations/20261108T152000_mm_demo_eligibility_operator_gate.sql:77-132`). The user was unavailable to choose the activity authorization contract. Given that no sandbox runtime caller is wired in this repository, the pragmatic local default is operator-only; anonymous sandbox telemetry now requires a separately designed per-sandbox capability before it can safely renew expiry. Static regression tests assert the guard precedes the first data read and ACL update. The four focused files pass **40/40 tests**, including these migration-shape checks; the migration is unapplied, so the finding is **not yet FIXED & VERIFIED** in either database. This is a source-level regression check, not proof of database enforcement.

**SEC-06-05 — YELLOW / DEPLOYMENT VERIFICATION PENDING; NO SOURCE-LEVEL EXPLOIT CONFIRMED.** `setTopBarItems` opts into anonymous RPC use (`src/lib/marketplace-manager/topbar.functions.ts:120-143`). The checked-in definition is present in `supabase/migrations/20261019T090000_topbar_dropdown_items.sql:75-137`; it checks `mm_is_operator()` before reading or mutating the configuration. The migration grants `PUBLIC` execute at line 150, but the body-level check rejects nonoperators. The deployed definition, migration state, and effective ACLs remain unverified. Do not describe this as a confirmed exploitable anonymous mutation without live evidence.

**SEC-06-06 — MEDIUM — MITIGATION IMPLEMENTED IN MIGRATION; NOT APPLIED / NOT VERIFIED.** The checked-in `mm_audit` is a `SECURITY DEFINER` function that inserts caller-supplied action, entity, before/after state, and reason without checking operator status (`supabase/schema/public-schema.sql:6619-6655`). Its historical migration grants `authenticated` execution (`supabase/migrations/20260906210000_marketplace_homepage_rows.sql:150-151`); the schema snapshot also grants authenticated execution (`supabase/schema/public-schema.sql:62830-62832`). A signed-in nonoperator could therefore fabricate append-only Marketplace audit entries through the RPC. New migration `supabase/migrations/20261108T153000_mm_audit_operator_gate.sql` revokes direct authenticated execution, retains service-role execution, and adds `mm_audit_operator`, which checks `mm_is_operator()` before delegating. Direct application RPC callers now use the gated function, including the approval-export server function. Static inventory found two unique `SECURITY INVOKER` SQL functions that also called `mm_audit`; the migration rewrites those calls to the gated wrapper while preserving their existing admin check. Other SQL callers remain owner/service-side calls. Static contract tests cover the ACL, gate ordering, wrapper grant, invoker-function rewiring, and approval-export caller. Function ownership, nested-call privilege behavior, and all runtime effects have not been database-tested. The migration is unapplied, so the mitigation is **not FIXED & VERIFIED in either database**.

### Phase 07 — Database and data integrity

Static inventory reviewed all 24 Marketplace Manager server-function modules, the three manager API route files, their resource configuration, and related migration definitions. It found 162 configured resource mappings to 154 unique tables. This does not prove the migrations are applied or that live database constraints match the source.

| ID | Severity / status | Route, role, reproduction and evidence | Recommended remediation |
|---|---|---|---|
| PH07-MM-01 | MEDIUM — OPEN | Route: manager resource write handlers (`POST`, `PATCH`, `DELETE`). Roles: authorized Marketplace Manager API roles or internal token. Reproduction: cause the `mm_audit` RPC to reject/fail after a resource mutation; `recordAudit` logs at `src/routes/api/manager/resource.ts:162-224` and returns normally, so the write response can succeed without an audit record. Write and audit are separate operations. | Make the data mutation and audit event atomic where feasible, or provide an observable reconciliation mechanism and an explicit operator-visible audit failure outcome. |
| PH07-MM-02 | MEDIUM — OPEN | Route: `POST /api/manager/bulk`. Roles: authorized Marketplace Manager API roles or internal token. Reproduction: submit a mixed list containing valid and invalid UUIDs; `src/routes/api/manager/bulk.ts:137` silently removes invalid IDs before processing. The caller gets no explicit outcome for discarded inputs and may mistake a partial selection for a complete operation. | Reject the entire invalid selection before any write, or return a per-input outcome that includes invalid IDs. |
| PH07-MM-03 | MEDIUM — OPEN | Route: `POST /api/manager/row-action`, which delegates writes to the resource API. Roles: authorized Marketplace Manager API roles or internal token, subject to the permission matrix. Reproduction: submit two competing transitions for the same product after both requests read the same state; `src/routes/api/manager/row-action.ts:174-183,252-276` validates the state, then `src/routes/api/manager/resource.ts:4631-4645` writes by ID without an expected-state predicate. Both requests can pass the earlier check and race. | Use a conditional update with the expected prior state or a database operation that validates and writes atomically; test competing transitions. |

Static safeguards observed include capped/paged reads with deterministic ordering, a bulk operation cap and preview default, explicit per-row outcomes for processed IDs, payment/order uniqueness definitions, a payment transition guard, a refund transaction, and append-only audit migration definitions. These are source-level observations only; migration deployment, constraints, transaction execution, row-level security, data quality, orphan counts, and concurrent behavior are **UNVERIFIED**. No production rows were read or changed.

### Phase 08 — Edge cases and resilience

The earlier focused Marketplace Manager regression suites passed (286 tests, six files). The final targeted security rerun passed **40/40 tests across four files**: the two authorization suites, category rows API, and migration SQL contract tests. The full-suite command was `npx.cmd vitest run --maxWorkers=2 --exclude '.kilo/**' --exclude 'releases/**'`. It did not pass: **2,160 passed, 11 failed, 12 skipped; six test files failed and 195 passed, one skipped**. Failures were:

- `src/components/marketplace-manager/LiveTable.filters.test.tsx` failed during import protection (`home-catalog.functions.ts` imported a server-only module in the client test environment); this manager test gap is not treated as passing.
- Two Lead Manager suites could not load because `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` were unavailable.
- Lead Inbox and Sales Support Dashboard tests failed because their test context lacked `AuthProvider`.
- One i18n CI-check test failed on unused translation keys.

The repository typecheck still reports the unrelated existing `convertLeadToClient` error in `src/components/lead-manager/screens/ActionsScreen.tsx`. The latest ESLint run over all locally changed source files reports **504 errors and 0 warnings**; the directly changed security helper, approval caller, and migration contract test pass targeted lint. A baseline comparison for this expanded source-file set was not run, so the full-scope findings are not attributed as entirely pre-existing and lint is not a pass. No safe authenticated test account or isolated database environment was available, so expired sessions, network/database failures, duplicate submissions, stale state, race conditions, and full persisted workflows remain **BLOCKED / NEEDS VERIFICATION**. No live data or production workflows were used as test fixtures.

### Phase 09 — Cross-module connectivity and lifecycle

The existing Phase 01–05 map above remains the source-level dependency map; this continuation did not invent new integrations. The traced Marketplace Manager surfaces are the manager server functions and resource/bulk/row-action APIs. Existing neighboring flows include catalog/product review, orders/payments, reseller/influencer commissions, lead intake, SEO, demos, and AYRA summaries. Their source references do not prove end-to-end persistence or deployment. No sale-to-AMS award, sale-to-task handoff, franchise price enforcement, or sale-triggered wallet posting was established by the earlier trace; those statuses remain unresolved unless separately documented in the historical findings.

Cross-module identity/ownership checks against live records, webhook/queue retries, provider settlement, notification delivery, and full initiation-to-persisted-outcome testing are **UNVERIFIED**. No unrelated module was changed.

### Phase 10 — Performance, regression, and release readiness

- Production build: **PASS** (`npm run build`).
- Focused Marketplace Manager regressions: **PASS**, historical 286 tests across six files; latest targeted security/routing/migration rerun **91/91** across seven files.
- Full test suite: **FAIL**, with counts and blockers recorded in Phase 08 above.
- Typecheck (`npx.cmd tsc --noEmit`): **FAIL**, one unrelated Lead Manager error.
- Targeted ESLint over the security helper, approval caller, and migration contract test: **PASS**. ESLint over all locally changed source files: **NOT PASS**, 504 errors and 0 warnings; no same-scope baseline comparison or whole-repository lint pass is claimed.
- Static performance evidence: `src/components/marketplace-manager/LiveTable.tsx:181-183` builds list requests with a page limit and offset; `src/lib/marketplace-manager/rows.functions.ts:297-301` applies a default row limit; reseller history and audit-history reads have explicit 200- and 50-row caps at `src/lib/marketplace-manager/resellers.functions.ts:130-135` and `src/lib/marketplace-manager/rows.functions.ts:491-494`. These are code-level bounds only; no timing or query plan was measured.
- End-to-end/browser, accessibility, responsive layout, query-plan, load, and runtime performance measurements: **NOT RUN**. No performance threshold or production-scale behavior is claimed.
- Migration parity, deployment, production health, and live role/RLS verification: **NOT RUN / UNVERIFIED**.

**Tooling follow-up (2026-10-26):** ESLint initially found 504 errors in the changed-source scope. ESLint autofix resolved 503; the remaining intentional ANSI escape-sanitizing regex in `src/routes/api/marketplace/deployment.ts` has a narrowly scoped `no-control-regex` suppression. ESLint now passes on all 28 changed source files. The sole `convertLeadToClient` TypeScript error came from an unsupported Lead Manager UI action with no matching API/RPC implementation; that button and action metadata were removed rather than inventing a persistence contract. The production build passes, the fresh full TypeScript check exits 0, and the focused security suite passes 91/91 across seven files; the Lead Manager API suite passes 4/4. The earlier full-suite result remains 2,160 passed, 11 failed, 12 skipped; it was not rerun to completion in this tooling pass. `git diff --check` passes.

**Release assessment: NOT READY TO CLAIM PRODUCTION READINESS.** Two authorization fixes are local and regression-tested but uncommitted/undeployed; two SQL migration files contain the three mitigations and remain unapplied; the top-bar deployment state and 155-RPC database authorization set are not exhaustively verified. Three medium data-integrity findings remain open, broad role parity requires an owner decision, and runtime/database validation is blocked. No commit, push, migration application, or deployment was performed in this audit continuation.

### Coverage, limitations, and resume checklist

- **Coverage calculation for the static manager configuration inventory:** 162 audited configured resource mappings / 162 discovered configured resource mappings × 100% = **100%**. These mappings reference 154 unique tables.
- **Database-schema coverage:** **not calculable** from repository evidence. The total live schema objects and constraints were not discovered or verified; the 154 referenced tables are not a denominator for all database objects. No live database was accessed.
- **Uninspected / blocked:** live schemas and data; deployed migration state; exact live RLS and grants; production role assignments; safe authenticated E2E flows; browser behavior; provider/webhook outcomes; query plans and production-scale performance; verification of schema-wide constraints, indexes, orphan records, and state distributions.
- [x] Continue from the recorded Phase 01–05 artifacts and preserve unresolved prior findings.
- [x] Complete local role restriction for the identified developer-only service-role access and verify focused regressions.
- [x] Inventory and review Marketplace control/public API routes plus five public catalogue read server functions; fix SEC-06-02 and verify it locally.
- [x] Inventory all 24 Marketplace Manager server-function modules and review wrapper authentication, validators, and direct service-role usage; record confirmed RPC authorization gaps.
- [ ] Inspect the authoritative authorization and effective grants for all 155 called RPCs (149 in the schema snapshot and six migration-only); verify the deployed definition/grants for `mm_topbar_items_set`.
- [ ] Apply and validate SEC-06-03/SEC-06-04/SEC-06-06 migrations in authorized, isolated database environments before marking them FIXED & VERIFIED.
- [x] Enumerate manager resource mappings and record three new integrity findings.
- [x] Run the production build and bounded/full test checks; record failures without treating them as passes.
- [ ] Resolve PH07-MM-01 through PH07-MM-03 and add regression coverage.
- [ ] Obtain owner decision for RBAC-04 before expanding or changing role parity.
- [ ] Re-run full tests/typecheck/lint and perform authenticated isolated E2E plus authorized read-only schema/RLS parity verification.
- [ ] Commit and deploy the local security repair only after explicit release authorization; verify it on the target environment.

This coverage is limited to the configured Marketplace Manager mapping inventory, not the whole Marketplace repository or live database. Overall audit status remains **INCOMPLETE / PRODUCTION UNVERIFIED**.
