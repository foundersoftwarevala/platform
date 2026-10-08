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

## Follow-up scan and production verification — 2026-10-08

- Payment health no longer converts failed or incomplete database counts to
  zero; the route's existing error path reports a failed measurement. Regression
  tests cover successful counts, database errors, and missing exact counts.
- SEO credential writes now use the existing AES-256-GCM credential format.
  SEO and Cloudflare readers upgrade legacy plaintext/Base64 rows on read.
- Paged product/slot sitemap routes use valid `$page` parameters while
  continuing to serve numeric `.xml` pages; malformed page segments return 404.
- Local verification: production build passed, all 1,112 tests passed, the
  focused TypeScript check passed for modified business-logic modules,
  changed-file ESLint passed, and `i18n:check` passed. Full-repository lint
  remains noisy (34,500 errors in the earlier run, mostly formatting); the
  earlier full TypeScript run exceeded 13 minutes without output.
- Release `bd36dc354fc518c0a3e1900b13f918929e824269` was pushed to `main` and
  deployed using `scripts/ops/sv-deploy.sh`. The VPS source is clean at that
  commit; PM2 `softwarevala-staging` is online (PID 292759), with the new build
  timestamped `2026-10-08 11:57:18 UTC`. The deployment manifest check passed,
  the spare-port homepage returned 200, and the live homepage returned 200.
  Three rollback builds remain; no old build was retired.
- Live smoke: `softwarevala.net/`, `/api/i18n/pack?lang=hi`, `/sitemap.xml`,
  `/sitemap-products/1.xml`, and `/sitemap-slots/1.xml` return 200; malformed
  product and slot sitemap pages return 404. The anonymous i18n session
  endpoint returns `authenticated=false`, `tier=anonymous`. The deployment
  smoke also verified English, Hindi, and Arabic SSR/cache behavior.
- Read-only VPS database verification connected to `sv_platform` (PostgreSQL
  17.11): 101 migrations are recorded, latest `20261004181500`; this release
  applied no database migration or data write. RLS is enabled on the checked
  high-impact profile, payment, order, API key/service, demo credential, and
  SEO integration tables, with policies present.
- `AI_API_CREDENTIAL_ENCRYPTION_KEY` is present in the running app process and
  PM2 configuration, but absent from `/var/www/softwarevala/.env`. The
  deployed restart retained it; keep the PM2 configuration backed up and
  provision the key there for any future replacement process.
- The public `seo_api_*` relations are absent from `sv_platform`. The only
  source references are in currently unreferenced legacy SEO credential
  functions; active SEO provider execution uses the central `api_services` /
  `api_keys` path. Do not reactivate those legacy functions without either
  removing them or designing and applying their schema intentionally.
- The original local `ChatManagerWorkspace.tsx` edit and untracked `.kilo/`
  were preserved and excluded from the release. No production data was
  modified.

## Public-write RLS closure — 2026-10-08

- The follow-up RLS scan found public INSERT paths on `marketplace_events`,
  `affiliate_clicks`, `demo_clicks`, `demo_requests`, and marketplace `leads`.
  The `marketplace_events` path was closed by
  `20261008T130000_marketplace_events_server_writes.sql`; the remaining four
  were closed by `20261008T130100_public_writes_server_only.sql`.
- Public demo-click recording now uses a dedicated service-role client,
  verifies the requested demo is active and belongs to the supplied product,
  and applies the existing bounded sliding-window limiter at 30 requests per
  client address per minute. Invalid demos and database failures are reported
  rather than counted as successful writes.
- The migration was applied transactionally to the VPS `sv_platform` database
  after the new app build was live. Post-apply checks confirm anonymous INSERT
  is denied on all five tables, authenticated INSERT is denied on both click
  analytics tables, service-role INSERT remains allowed, and authenticated
  staff-management policies remain on `demo_requests` and `leads`. The
  `marketplace_events` staff-read policy remains; no public INSERT policy
  remains on any of the five tables. The direct SQL apply does not advance the
  Supabase migration-history table.
- Commit `5f798538752fa73f31813f603bdff0549994e4aa` was pushed to `main`,
  fast-forwarded on the VPS, and deployed with `scripts/ops/sv-deploy.sh`.
  Manifest references resolved, the spare-port smoke passed, the live
  homepage returned 200, and PM2 reported the deployed app online. Three
  rollback builds remain.
- Post-deployment smoke returned 200 for the homepage, Hindi language pack,
  sitemap index, product sitemap, slot sitemap, and published demo page
  `/demo/admissionschool-console`. No synthetic click, lead, or demo-request
  rows were inserted.
- Final local validation: production build passed; all 77 test files and
  1,112 tests passed; focused rate-limiter tests passed; changed-module ESLint
  passed with the repository's pre-existing `no-explicit-any` and unsafe
  function-type findings excluded. The repository-wide lint and long-running
  TypeScript limitations documented above remain.
- The local Chat Manager edit and untracked `.kilo/` remained untouched and
  were excluded from both commits and deployment.

## 2026-10-08 - Platform data integrity and audit-trail fixes (`73068d6`)

Scope for this pass was the Software Vala platform only. No marketplace
product, demo application, or catalogue record was opened or inspected.

- **AI API Manager showed figures no row supported.** The overview chart was
  built from `summary.active * 120`, `summary.cost * 1.15` and an error
  count rather than dated usage, billing rows used `(index + 1) * 500 + 600`,
  and role-wise quotas repeated global totals under Founder/Reseller/Franchise
  labels. `listAiRegistry` now queries `usage_events` over a trailing
  seven-day window (`occurred_at >= window start`, served by the existing
  `usage_events_occurred_idx`) and aggregates rows by UTC calendar day, so
  the chart, the request/cost tiles and per-service figures all come from
  persisted rows. `buildUsageDailySeries` is covered by
  `src/lib/ai-api.usage.test.ts` (4 tests), including that out-of-window,
  undated and unparsable rows contribute nothing.
- **Partial query failures no longer look like zero usage.** The registry
  handler previously converted a failed providers/usage/capabilities query
  into an empty array, which rendered as a successful screen reporting no
  traffic. Those failures now propagate, and the panel renders an explicit
  error instead of a success-shaped empty state.
- **Controls that did nothing no longer imply work.** `Rotate Keys` and
  `Run Audit` had no handlers and are disabled with a reason. Hardcoded
  optimisation advice, modality badges and "automations enabled" claims were
  replaced with what the registry actually returns.
- **Safe Assist AI-log forgery.** `Participants insert ai logs` only checked
  `auth.uid() is not null`, so any authenticated user could insert an AI risk
  log naming another user's session. Migration
  `20261108T100000_safe_assist_ai_logs_session_scoped.sql` scopes inserts to
  that session's user or support agent, or support staff, matching
  `safe_assist_events` and the `log_safe_assist_ai_event` authorization.
  Applied to `sv_platform`; `pg_policies` confirms the new check
  references `safe_assist_sessions`.
- **Assist audit actor forgery.** `assist_audit_insert` used
  `WITH CHECK (true)`. The actor-stamping trigger overwrites only
  `actor_user_id`; `actor`, `actor_role`, `action`, `result` and
  `severity` were kept as submitted, and the table is append-only, so a
  forged row could not be corrected. Migration
  `20261108T101000_assist_audit_logs_function_only.sql` removes the
  permissive policy. The sole writer, `public.assist_audit(...)`, is
  SECURITY DEFINER and owned by `postgres` while the table is owned by
  `postgres` with `relforcerowsecurity = false`, so it bypasses RLS and
  continues to work; no application code inserts into the table directly.
  Verified by catalogue inspection, without writing a test row into an
  append-only audit trail.
- **Validation.** Production build passed. Targeted suites passed (AI usage
  aggregation, payment jobs, payment initiation, PayU settlement, AI credential
  encryption, sitemap page routes - 45 tests). ESLint on the changed files
  reported no new findings; the pre-existing `no-explicit-any` findings in
  `ai-api.functions.ts` and the pre-existing Prettier findings in untouched
  Safe Assist hooks remain.
- **Deployment.** `73068d6` was pushed to `main`, fast-forwarded on the
  VPS, and deployed with `scripts/ops/sv-deploy.sh`: manifest references
  resolved, spare-port homepage smoke returned 200, the live site returned
  200, PM2 `softwarevala-staging` is online as PID 368287, nginx is active,
  three rollback builds remain and the disk is 145G free (26% used). The VPS
  source is clean at `73068d6` and the deployed build is dated
  `2026-10-08T14:04:15Z`. Post-deploy smoke returned 200 for the homepage,
  login, control panel, marketplace manager, Product & Demo Manager, developer
  manager, chat, task manager, Assist Manager, Promise Tracker, Lead Manager,
  SEO Manager, sitemap index, robots.txt and the Hindi language pack.
- The local Chat Manager edit and untracked `.kilo/` remained untouched.

## 2026-10-08 — Database authorization and deployment-key closure

- Removed direct authenticated writes to `assist_audit_logs` and
  `promise_audit_logs`; their SECURITY DEFINER audit functions remain the only
  application writers. Restricted Legal, Marketing and Promise health audit
  inserts to the same staff predicates that govern their manager screens.
- Restricted direct `assist_emergency_stops` inserts to Assist staff. A
  participant stopping their own session continues through
  `assist_emergency_stop`, which performs the actual access revocation and
  writes the record with the caller identity.
- Enabled `security_invoker` on the five API-exposed reporting views that were
  bypassing their base-table RLS. A production non-staff account could read
  rows through four of the views before the migration; afterwards it received
  no protected rows, while the service-role self-healing worker retained its
  required access.
- A rolled-back database authorization test confirmed that a non-staff
  authenticated identity cannot insert into any of the six hardened audit or
  emergency-stop tables. No unconditional authenticated INSERT policy remains.
- Persisted `AI_API_CREDENTIAL_ENCRYPTION_KEY` from the existing PM2
  environment into `/var/www/softwarevala/.env` without displaying it and set
  the file mode to `0600`. The persisted value is valid and exactly matches the
  running process value. `scripts/ops/sv-deploy.sh` now aborts before staging a
  build if that key is missing or not a valid 32-byte hex/Base64 key; valid and
  invalid guard cases and shell syntax were verified.
- Commits `cc74edf`, `a471a0e`, `dc91120`, and `c50ab1c` contain only
  migrations and this ledger and were applied directly to PostgreSQL, so no
  application rebuild or deployment was required.
