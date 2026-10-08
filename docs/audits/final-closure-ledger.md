# Final closure ledger — 2026-10-04

One row per issue, one status each. A later scan adds only rows not already here.

Statuses: FIXED · FIXED-NOT-APPLIED (code/migration ready, live apply pending) ·
OWNER-DECISION · EXTERNAL-BLOCKER · NOT-AN-ISSUE.

## Refreshed state (2026-10-04)

- Local `main`, `origin/main`, VPS source, and the running release are aligned at
  `d97abd5900a96dc71ca93c314f395d9982eb9296`; the VPS tracked worktree is clean.
  The verified deployment script built and swapped this source successfully.
- Live route verification: `/` returns 200, `/marketplace` returns 301 to `/`,
  and `/marketplace/` is normalized (307) before the permanent redirect; both
  old paths finish at `/` with 200. VPS PostgreSQL is `sv_platform`.
- Applied and postcondition-verified on VPS `sv_platform`: migrations
  `192000`, `233000`, `234000`, `238000`, `238100`, `239040`, `239050`,
  `239060`, and `239070`. Hosted Supabase received and verified `239050`,
  `239060`, and `239070`. The migration-history table still reports
  `20260920150000`; these direct SQL applies were not registered there.
- On both databases, authenticated and anonymous insert to
  `franchise_audit_logs` is denied, service-role insert is allowed, and all six
  active Realtime tables are published. On hosted Supabase, anonymous execute
  on `mm_row_analytics` is denied; authenticated execute remains but the
  function enforces `mm_is_operator()`. Supabase Auth, Storage, and Realtime
  remain in service.
- Latest validation: 984 tests pass across 60 files; production build passes;
  full and production dependency audits report zero vulnerabilities;
  `i18n:check` passes (3,202 keyed strings, 164 exempt, no new hardcoded
  strings). Changed files have no ESLint errors (one existing Fast Refresh
  warning). A fresh serialized 40-module post-deployment scan is running;
  the previous 45-row scan against `8547c35` found six configured entries
  explicitly marked not built, no page JavaScript errors or mobile overflow,
  and remaining axe issues in contrast, progress naming, scroll focus, and
  SVG alternatives. Those accessibility findings are not yet fully closed.
  Full-repository ESLint still reports repo-wide formatting/type-rule errors;
  the CLI TypeScript check did not finish within the bounded run. Production
  cold/warm homepage sanity: LCP 2,772/2,516 ms, no failed requests.
- One local branch, 13 tags (10 archive tags and 3 other preserved tags), no
  stashes, and one worktree.

## Rows

| ID    | Area                         | Issue                                                                                                                                                                                                              | Status            | Evidence / fix                                                                                                                                                                                                                                                                                                                                                                      |
| ----- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FC-01 | Payments / Buy Server        | `server_purchases_write` lets a server owner or any infrastructure operator insert a purchase as `paid`/`completed` or flip a pending order to paid with no verified payment                                       | FIXED             | `20261107T238000_server_purchase_payment_guard.sql` applied on VPS `sv_platform`; the trigger keeps browser-created purchases pending, freezes amount/method/code, and allows only pending→cancelled. Postconditions were verified live.                                                                                                                                               |
| FC-02 | Payments / Buy Server        | The UI created orders with no payment provider configured                                                                                                                                                          | FIXED             | `SMBuyServer` reads the enabled `finance_payment_rails` server-side and blocks the order with "Payment provider not configured" (all 4 rails disabled live).                                                                                                                                                                                                                        |
| FC-03 | Tests                        | 5 failing suites: missing `@testing-library/react`, `jsdom`, `jsqr`, `jest-dom`; a `src/test/utils` helper that was never committed; a stale `_authenticated` route path; i18n CI check failing on API routes      | FIXED             | Dev dependencies added; `src/test/utils.tsx` written; AMS route path corrected; API errors marked with the repo's `i18n-ignore` convention.                                                                                                                                                                                                                                         |
| FC-04 | Demo health                  | Browser "check" used `fetch(url, {mode:"no-cors"})` and stored every reachable address as HTTP 200 / working, 404s and 500s included                                                                               | FIXED             | New `POST /api/demo/check` (operator-gated, SSRF-safe, real status + TLS days). It writes the same columns as `demo_monitor.py`, plus `demo_health` and the audit log. `runCheck` uses it.                                                                                                                                                                                          |
| FC-05 | Demo health                  | `supabase.functions.invoke("health-check")` returns 404 in production (no `/functions/v1` route; no edge-function source in the repo)                                                                              | FIXED             | `useHealthCheck` (ids path) and `useDemoOps` re-check now call `/api/demo/check`.                                                                                                                                                                                                                                                                                                   |
| FC-06 | Demo Ops                     | Restart / rebuild / renew / lifecycle updated the legacy `demos` table (0 rows; the real demos are `product_demo_urls`) and then reported success; regenerate-branding etc. only wrote a "completed" log row       | FIXED             | Actions with no host control connection now fail with the reason; lifecycle switches `product_demo_urls.status` through the operator resource API and records it. Renew says there is no expiry to renew.                                                                                                                                                                           |
| FC-07 | Affiliate import             | Import Center invented a random row count, a fixed 93/5/2 % validation split and three fake "top issues"; Commit showed success without writing anything                                                           | FIXED             | Real CSV parser and schema validator (`affiliate-bulk.ts`, with tests). Real issues and a downloadable error report. Commit is disabled with the reason, because no import service exists.                                                                                                                                                                                          |
| FC-08 | Sales console                | Vala ID was `Math.random()` on every mount                                                                                                                                                                         | FIXED             | Derived from the signed-in account id.                                                                                                                                                                                                                                                                                                                                              |
| FC-09 | Safe Assist                  | Verification codes from `Math.random()`                                                                                                                                                                            | FIXED             | `crypto.getRandomValues` (the module is currently unreachable; see dead-code list).                                                                                                                                                                                                                                                                                                 |
| FC-10 | SEO                          | IndexNow submission id from `Math.random()`                                                                                                                                                                        | FIXED             | `crypto.randomUUID()`.                                                                                                                                                                                                                                                                                                                                                              |
| FC-11 | Dead code                    | Unreferenced root-level implementations `src/useNavigate.ts`, `use-toast.ts`, `useDataRetry.tsx`, `data-access.ts`, `src/GlobalNotificationHeader.tsx`, `src/api/apiService.ts` — no imports of these paths remain | FIXED             | Removed after confirming callers use the canonical hook/lib/component paths. These were not byte-identical to those implementations.                                                                                                                                                                                                                                                |
| FC-12 | Demo health / SSRF           | The first server-side reachability checker resolved and screened a host, then used native `fetch`, which performs its own DNS lookup; a rebinding response could change the connected address after validation.    | FIXED             | `safe-fetch.server.ts` now performs proxy requests through guarded socket-time DNS lookup, bounded response handling, and guarded redirects. The demo checker reuses that transport. Private-DNS regression and focused ESLint passed; deployed in the canonical source at `8547c35`.                                                                                                                                              |
| FC-13 | VPS SQL verification         | `scripts/ops/db.mjs` returned the status of `rm` after `psql`, masking database statement failures as success.                                                                                                     | FIXED             | Preserve and return `psql`'s exit status after deleting its remote scratch file. Verified that a deliberately missing relation now produces exit code 1.                                                                                                                                                                                                                            |
| FC-14 | Franchise audit integrity    | `franchise_audit_logs` allowed any franchise staff account to insert rows with a caller-supplied actor/action, contrary to its server-only audit contract.                                                         | FIXED             | `20261107T239060_franchise_audit_server_only.sql` applied to hosted Supabase and VPS. Live checks confirm anon/authenticated insert denied and service-role insert allowed; staff reads remain available.                                                                                                                                                                             |
| FC-15 | Public fetch resource limits | `safeFetch` capped compressed response bytes but decompressed gzip/Brotli/deflate bodies without a decoded-size limit, allowing a small response to expand into excessive memory use.                              | FIXED             | `safe-fetch.server.ts` passes the configured limit to each zlib decompressor's `maxOutputLength`; regression tests verify rejection above the cap and success below it.                                                                                                                                                                                                             |
| FC-16 | Supabase Realtime            | Six active affiliate/Safe Assist subscriptions targeted tables absent from the hosted `supabase_realtime` publication, so updates were not delivered.                                                              | FIXED             | `20261107T239070_active_realtime_publication.sql` applied to hosted Supabase and VPS, adding only `activity_logs`, `marketplace_affiliate_partners`, `partner_commissions`, `partner_payouts`, `safe_assist_notifications`, and `safe_assist_sessions`. Both publications now contain all six active tables with RLS and authenticated SELECT policies.                    |
| FC-17 | Retired marketplace landing  | The old `/marketplace` landing duplicated the live homepage at `/` and presented the obsolete design.                                                                                                               | FIXED             | The route permanently redirects to `/`. Production verifies `/` 200, `/marketplace` 301 to `/`, and `/marketplace/` normalizes before the same permanent redirect.                                                                                                                                                                                                                |
| FC-18 | Homepage accessibility       | Product-carousel labels were attached to generic `div` elements, which axe reports as prohibited ARIA attributes (56 instances on the homepage).                                                                   | FIXED             | The deployed carousel rail now declares `role="group"` for its accessible label and busy state. A fresh axe scan of the deployed commit is running.                                                                                                                                                                                                                              |
| FC-19 | Legal Manager accessibility  | The legal sidebar used 80% opacity for inactive navigation labels appearing among live contrast violations.                                                                                                         | FIXED             | Removed the opacity modifier from the inactive navigation-label color and deployed it. The current post-deployment scan will verify the remaining contrast findings.                                                                                                                                                                                                             |

## Follow-up local scan — 2026-10-08

This follow-up is local-only. It does not update or certify VPS, PostgreSQL, or
other hosted production state.

- Local `main`, the cached `origin/main` ref, and GitHub `main` were verified at
  `5a795c8b59d96f4974b89bdf45094a680e8b8f19` before these uncommitted changes.
- Payment health no longer converts failed or incomplete database counts to
  zero; the route's existing error path reports a failed measurement. Regression
  tests cover successful counts, database errors, and missing exact counts.
- SEO credential writes now use the existing AES-256-GCM credential format.
  SEO and Cloudflare readers upgrade legacy plaintext/Base64 rows on read;
  Cloudflare's consumer decrypts the same format. The production key and live
  rows were not inspected or changed.
- Paged product/slot sitemap routes use valid `$page` parameters while
  continuing to serve numeric `.xml` pages; malformed page segments return 404.
- Local verification: production build passed, 1,112 tests passed, focused
  TypeScript check passed for the modified business-logic modules, changed-file
  lint passed apart from pre-existing `no-explicit-any` violations excluded
  from that scoped run, and `i18n:check` passed.
- Full-repository lint remains noisy (34,500 errors in the prior run, mostly
  formatting); a full TypeScript run exceeded 13 minutes without output.
- No Git remote is configured in this checkout and `psql` is unavailable.
  VPS source/build, migrations, RLS, encryption-key availability, production
  smoke, and deployment therefore remain UNVERIFIED/BLOCKED. No deployment,
  database write, commit, or push was performed.
