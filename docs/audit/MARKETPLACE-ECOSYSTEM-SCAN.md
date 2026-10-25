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
