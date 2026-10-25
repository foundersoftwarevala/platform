# Influencer Ecosystem Audit

**Audit type:** source, migration, and targeted test review with security remediation  
**Baseline revision:** `feature/marketplace-fixes` at `214107336b5501e7fb3314bce0de3826b0468d4d`  
**Current worktree:** same branch and HEAD; changes are uncommitted.  
**Worktree:** pre-existing unrelated changes were present and left untouched.  
**Production:** no migration, production-data write, deployment, or live acceptance was performed. Read-only database access was unavailable.

## 1. Executive summary

The repository contains an influencer application/review path, database-backed dashboard data, referral links and product QR creation, tracking endpoints, lead attribution, and a paid-order commission trigger. Source-level security changes now narrow the service-role resource endpoint and align UI role gates; a new migration narrows influencer manager RPC/RLS authorization. Focused tests verify the source behavior, but the migration is unapplied and no end-to-end production journey has been verified.

**Overall readiness: 🔴 NOT READY for production sign-off.** The local code/test evidence verifies the resource API changes, but deployment and database authorization remain unverified. Important user flows are still partial or missing. Unavailable production systems are not treated as proof of failure or success.
**Staging readiness: 🟡 BLOCKED — no isolated staging environment is documented or accessible.** The process name `softwarevala-staging` is used by the production deployment on `/var/www/softwarevala`; it is not evidence of a staging system. No staging database or staging-only credentials/configuration were found. No staging connection, database check, deployment validation, or end-to-end staging test has occurred.

Top findings:

1. **🟢 VERIFIED in local source/tests; 🟡 production UNVERIFIED — resource API security.** Influencer PII and payout resources now require verified `admin`/`boss` roles; the generic application PII resource is removed; the legacy payout resource is read-only; canonical payout writes enforce allowed source-state transitions. The shared `partner_commissions` resource now excludes influencer rows so broader partner walls cannot read or approve influencer commissions. The unapplied SQL migration also narrows direct table updates and enforces payout transition rules in the database.
2. **🟡 UNVERIFIED — RPC/RLS database authorization.** The new migration changes manager RPC checks, grants, influencer payout RLS and legacy policies to the admin/boss helper, but it has not been executed or checked against a database.
3. **🟢 VERIFIED in local source/tests — generic lifecycle bypass closed.** Generic profile status edits are no longer allowed; status changes remain on the dedicated lifecycle path.
4. **🟠 MEDIUM — no influencer payout request UI/API was found.** Influencer manager payout lists remain display-only; the creator dashboard has no payout-request action.
5. **🟠 MEDIUM — approved application data is not projected into social-account records.**
6. **🟠 MEDIUM — influencer manager navigation substantially overstates connected functionality.**
7. **🟠 MEDIUM — referral analytics still mask some read failures as zeros/empty collections.**
8. **🟢 VERIFIED in local source/tests — manager page roles now match the admin/boss resource policy;** application-manager roles explicitly match `application_staff()`. Deployed role assignments remain unverified.
9. **🟡 UNVERIFIED — sales/leads summary correction.** Client code now uses persisted summary metrics and no longer hardcodes zero; a new SQL migration counts distinct attributed orders only when paid. It is not applied, so deployed counts remain unverified.

Final validation results and limitations are recorded in Sections 9 and 13. Tests do not prove deployed database/RLS behavior, live referral tracking, QR scans, paid commission creation, or payouts.

## 2. Scope and evidence limits

Reviewed route definitions, UI registries/components, server/API handlers, shared manager resource definitions, relevant SQL migrations and targeted tests. Security code/tests and two new migrations were changed; no production/staging data, deployed configuration, or running service was changed.

The worktree already contained unrelated modified/untracked files (franchise, author, seller, media, marketplace guard and manager-resource work). They were neither staged nor reverted. The dirty `src/routes/api/manager/resource.ts` diff was inspected: its changes concern franchise royalties and formatting, not the influencer resource definitions or the endpoint authorization branch cited below.

The recovery attempt established that required VPS/database credentials were unavailable and SSH was not authorized/reachable; a previous public-site request returned HTTP 403 and `www` had a TLS name mismatch. Those observations are not current functional tests. Accordingly:

- Migration files establish intended/repository SQL only; **whether each migration is applied to either production database is unverified**.
- Code paths establish implementation evidence only; **deployed application version, runtime environment, RLS state, persisted records and real user outcomes are unverified**.
- No live test was run. In particular, `scripts/ops/influencer-e2e.mjs` was not executed because it creates an application, referral code, session and lead and performs live browser/database actions.

Status legend:

- 🔴 **HIGH**: high-severity security finding.
- 🟠 **MEDIUM**: medium-severity or significant functionality/integration gap.
- 🟡 **UNVERIFIED**: not proven against a running authorized database or deployment.
- 🟢 **VERIFIED**: reproducible local source/test evidence only; not a deployment claim.

## 3. Route and module inventory

### Routes

| Route / surface | Intended role | Implementation and audit status |
|---|---|---|
| `/apply` | Browse role programmes | Role-selection entry to the application pages. UI only; live navigation not browser-tested. |
| `/apply/$role` (influencer: `/apply/influencer`) | Apply and attach documents | Shared form and server submission route. Influencer form is persisted through `submit_influencer_application`; document upload is a separate authenticated flow. Code path present; deployed persistence unverified. |
| `/dashboard/influencer` | Influencer self-service dashboard | Route role guard requires `influencer` (or configured platform operator). KPI summary is loaded from `/api/influencer/metrics`; only referral links have a dedicated influencer action screen. Other modules are source-mapped read-only records or explicit not-connected states. |
| `/influencer-manager` | Influencer programme operations | UI gate is now exact `admin`/`boss`; loader/data functions and manager resources have separate checks. Database RPC/RLS alignment is pending the unapplied migration. |
| `/application-manager` | Cross-role application operations | UI gate explicitly matches the `application_staff()` role set; consumes the shared application queue API. Deployed policy remains unverified. |
| `/marketplace-manager` → Growth → Influencer | Marketplace operator roster | Separate operator dashboard, not the `/influencer-manager` workspace. Shows roster, summary metrics, referral-code action and status selector. Uses `mm_influencers`, `mm_influencer_code_create`, and `mm_influencer_status`. |
| `/api/applications/submit` | Persist applicant submission | Authenticates applicant and calls role-specific RPC with caller token. |
| `/api/applications/documents` | Upload/read application evidence | Upload restricted to owner and open application; read restricted to applicant or application staff. |
| `/api/applications/queue` | Review and decide applications | Application-staff gate, valid transition checks, required reasons for rejection/suspension, role-specific review RPC. |
| `/api/influencer/apply` | Legacy influencer submission compatibility | Delegates to the same authenticated `submitApplication()` path; no separate submit implementation identified. |
| `/api/influencer/applications` | Legacy influencer review queue | Caller-bearer-token GET relies on RLS; POST delegates to the review RPC with its own staff check. Database policy behavior is unverified; current review UI uses `/api/applications/queue`. |
| `/api/influencer/metrics` | Creator KPI data | Caller-token RPC to `influencer_self_summary`; unauthorized/no-profile returns 401/403; database errors return 502. |
| `/api/influencer/referral` | Create/list/toggle referral links | Requires active influencer profile; server-side ownership checks; queries canonical referral and commission tables. Read failures can become apparent zeroes. |
| `/api/influencer/qr` | Create/list product QR | Requires an active influencer for creation, validates visible product, uses canonical QR register and unique influencer/product pair. GET relies on caller token/RPC. |
| `/api/track/ref` | Track referral visits | Public, rate-limited endpoint. Resolves code server-side, writes/refreshed session and sets HttpOnly referral cookie. Existing-session update result is not checked before success response. |
| `/api/qr/$code` | Render QR image | Resolves active QR target and renders image; rendering does not itself record a scan. |
| `/api/qr/scan/$code` | Record scan and redirect | Service-role scan RPC records event/counter and redirects to product destination. Unknown/inactive code falls back to marketplace. |
| `/api/marketplace/lead` | Capture Marketplace lead | Server writes lead and resolves influencer identity from referral cookie/session; attribution errors are logged and lead remains saved without attribution. |
| `/api/payment/initiate` | Begin payment for owned order | Verifies user/order ownership and pending-payment state; resolves referral cookie and writes attribution before returning PayU request. Commission trigger is a separate paid-order transition. |
| `/api/manager/resource` | Shared operator CRUD/read endpoint | Internal guard then service-role PostgREST. Influencer PII/canonical payout resources require verified admin/boss roles; generic application PII is removed; legacy payout records are read-only; canonical payout updates have conditional state transitions. Endpoint tests cover unauthorized, spoofed-role and authorized cases. |

### Influencer dashboard modules

The six configured KPI cards are **Followers, Campaigns, Brands, Content, Revenue, and Engagement**. The module navigation adds **Referral Links**, plus the KPI-related Followers/Campaigns/Brands/Content/Revenue/Engagement screens and the shared Achievements/AMS entries.

| Dashboard module | Data/source | Status |
|---|---|---|
| Followers | `influencer_social_accounts` rows for caller’s profile | 🟠 Read path exists; application review does not seed these rows from submitted social data, and no creator-side social-account edit/verification action is exposed. |
| Campaigns | `influencer_campaign_assignments` joined to `campaigns` | 🟠 Read-only assignment list; no influencer-side acceptance/deliverable action established. |
| Brands | Explicitly no brand-deal record source | 🔴 Not connected; no brand data to display. |
| Content | Explicitly no influencer content table/source | 🔴 Not connected; no content workflow. |
| Revenue | `influencer_earnings` | 🟠 Read-only records and summary; commission/payout persistence not live-tested. |
| Engagement | `influencer_social_accounts.engagement_rate` | 🟠 Reads recorded figures, but there is no social-platform API verification/refresh. |
| Referral Links | Dedicated UI and `/api/influencer/referral`; link creation, copy, toggle, click/visitor/conversion displays | 🟠 Real path in code; live attribution and data accuracy unverified. |
| Marketplace Manager operator summary | `influencerProgrammeQueryOptions()` | 🟡 Source now reads persisted sales/leads; sales SQL counts attributed orders only when paid. The SQL migration is unapplied, so deployed values remain unverified. |
| Achievements / AMS | Shared platform module | 🟡 Outside the influencer-specific flow; not validated in this audit. |

### Influencer Manager navigation: every configured item

`workflowWall` sections below are data-backed only when `resourceFor()` recognizes the named table. Their shared wall is read-only (`creatable: false`, no row/bulk actions). The `existingMarketingWall()` helper does **not** set `resource`; its table-name argument is only descriptive and these sections are not connected to that table by the wall.

| Group | Navigation entries and actual implementation |
|---|---|
| Primary | **Dashboard** and **Manager Console** → operator summary dashboard; **Influencers** and **Creator Profiles** → same influencer profile wall; **Campaigns** → empty/disconnected campaign wall; **Commissions** → the same menu label also appears under Finance and maps to campaign `influencer_earnings`; **AI Studio** → risk-review wall names a resource not allowlisted by `resourceFor`, therefore disconnected. |
| Influencer Manager | **Influencers**, **Creator Profiles** → `influencer_profiles` resource; generic status edits are now rejected; **Applications** → dedicated role application queue override; **Onboarding** → fallback disconnected; **Assignments** → `influencer_campaign_assignments`, read-only; **Verification** → social-account records, read-only (no verify action); **Compliance**, **Performance** → marketing wall or profile wall respectively (not a real compliance/performance workflow); **Tiers & Levels** → `influencer_tiers`, read-only. |
| Campaigns | **Campaigns**, **Collaborations** → same empty wall without a resource; **Brands**, **Marketplace Promotions**, **Coupons**, **Content Calendar**, **Contracts** → fallback disconnected wall. The dashboard shortcut “Create a Campaign” points to `/marketing/campaign-builder`, outside this influencer manager wall. |
| Content | **Content Library**, **Media Assets**, **Content Approval**, **Reviews** → helper names marketing resources but does not attach them to the shared wall; disconnected; **Social Accounts** → connected read-only influencer social-account list. |
| Growth | **Leads** → empty wall without a resource; **Customers**, **Sales**, **Affiliate Links**, **Referral Links**, **QR Center**, **Performance Insights** → fallback disconnected; **Analytics** → marketing wall without a resource. Creator referral/QR functionality exists separately on the creator dashboard, not through these manager sections. |
| Finance | **Commissions**, **Wallet** → read-only `influencer_earnings`; **Commission Rules** → read-only compensation rules; **Order Commissions** → read-only, influencer-scoped `partner_commissions`; **Order Payouts** → read-only, influencer-scoped `partner_payouts`; **Payouts**, **Withdrawals** → read-only legacy `influencer_payouts`; **Invoices** → read-only invoices; **Subscriptions** → fallback disconnected. No payout-request or payout-approval action appears in these walls. |
| Rank & Rewards | **Leaderboard**, **Achievements**, **Rewards**, **Challenges** → fallback disconnected. |
| Operations | **Notifications** names a table not allowlisted; **Communication**, **Calendar** use disconnected marketing walls; **Inbox**, **Support**, **Documents**, **Products**, **Settings** → fallback disconnected; **Audit Trail** names a table not allowlisted. |
| AI | **AI Chat**, **Brand Matching AI**, **Reports Builder** → fallback disconnected. |

The registry is exhaustive for the current `navigation.ts` configuration. It contains visible labels that are not implemented as influencer workflows; these should not be interpreted as available functionality simply because they appear in navigation.

### Marketplace Manager influencer module actions

| Visible control | Intended behavior | Handler/data path | Status |
|---|---|---|---|
| Search | Filter roster by name/email/niche | `getInfluencers` → `mm_influencers` | 🟠 Code path; backend read permissions and live query unverified. |
| Status filter | Filter roster statuses | `mm_influencers(p_query)` | 🟠 Code path. |
| Status select | Change influencer lifecycle status | `setInfluencerStatus` → `mm_influencer_status` | 🟡 Dedicated RPC handles associated referral-code status/audit, but its new admin/boss authorization migration is not applied or database-verified. |
| Referral link / Create / Cancel | Open optional code field, mint code, cancel entry | `createInfluencerCode` → `mm_influencer_code_create` | 🟠 Code path writes canonical `marketplace_referral_codes`; not live-tested. |
| Copy | Copy minted share URL | `navigator.clipboard.writeText` | 🟠 Browser permission/device dependent; errors are not explicitly handled in this button. |
| KPI cards | Display creators, referral codes, earnings, pending payout, applications, accounts, declared followers, paid-out amount | `mm_influencers` response | 🟡 Repository SQL backs the summary, but RPC grants and persisted values are not live-verified; manager RPC authorization migration is unapplied. |

## 4. Button and action matrix

| Surface / action | Intended behavior and trace | Result |
|---|---|---|
| Application role selection / “All applications” / Cancel / Home | Route between application selection, role form, and home | 🟡 Source links are present; no browser navigation test. |
| Agreement checkbox and Submit Application | Require agreement, require sign-in, validate role form, POST `/api/applications/submit`, invoke role-specific RPC as applicant, show number/status or an explicit error | 🟠 Implemented; SQL enforces required acknowledgements, open-application dedupe and audit/notification. Live row creation not verified. |
| Upload ID/selfie documents | Client file check; POST multipart document only after application exists | 🟠 Owner/open-status check, server content sniffing/type/size checks are present. Onboarding does not mark these file fields required; approval can therefore happen without those uploads. |
| Retry failed uploads | Re-upload selected pending form documents | 🟠 Per-file outcome is shown; retry is UI-level and can be retried only while page state/files remain. No live storage check. |
| Application queue search/filter/open details | Search in loaded rows; query counts and queue; detail reads documents/history | 🟠 Authenticated queue API and visible loading/error/empty states exist. Queue data is refreshed every 15 seconds. Live authorization not tested. |
| Review / approve / reject / suspend controls | Ask for required reason where applicable; POST decision; update query cache; notify reviewer on email delivery issue | 🟡 UI/API source checks staff, transition, self-review and required rejection/suspension reason; SQL policy is not runtime-verified. No production decision performed. |
| Manager wall Export / search / filter / sort / select / clear | Export currently filtered rows; filter, search, local sort; select page rows | 🟡 Generic wall behavior present. Export is a browser-side CSV of rows currently loaded (resource fetch is capped at 200) rather than an unbounded report. |
| Manager wall Create / Edit / row/bulk actions | Save resource-backed rows, perform server mutation, re-read; disabled on no-resource/read-only walls | 🟠 Wall implementation reports write errors and re-reads after success. Most influencer workflow walls have no create/edit/action configured. Generic profile status writes are now rejected by the API. |
| Creator referral Create Link | Mint active code for active signed-in influencer, capped at 50 links | 🟠 Ownership/status checks and canonical table writes present. Limit check is a count-then-insert rather than an atomic limit; simultaneous requests could exceed 50. No concurrency test/live verification. |
| Creator referral Copy | Copy absolute `/?ref=CODE` link | 🟠 Clipboard errors are surfaced; browser permission not verified. |
| Creator referral Active/Off toggle | Activate/deactivate owned referral code | 🟠 Server verifies code belongs to caller and checks PATCH result; live behavior unverified. |
| Product search / Get promotion | Search Marketplace products, create/reuse influencer referral code and unique product QR | 🟠 Search is debounced by submit and requires two chars; QR handler validates UUID, active profile, visible product. No live product/QR test. |
| QR image / Copy link / PNG / SVG | Render QR image, copy scan URL, download image files | 🟠 Image/scan routes and download links are wired; scan event and redirect not live-tested. |
| Referral click/conversion displays | Read session metadata and attributed sessions/commission ledger | 🟠 Source tables exist, but failed reads can be rendered as empty/zero; cap-based aggregation can undercount at high volume. |
| Influencer manager profile status | Change profile status through the dedicated lifecycle RPC | 🟢 Generic `PATCH` status edits are rejected by the service-role resource API; status changes remain on the dedicated RPC path, which synchronizes referral-code state and lifecycle audit. The local endpoint regression verifies the generic bypass is refused; deployed RPC behavior remains unverified. |
| Campaign / collaboration / lead / content create controls | Create actual operational records | 🔴 Shared influencer walls are disconnected/read-only; no persisted action wired for these workflows. |
| Payout request/approval | Request payout as creator; approve/process payout as operator | 🟠 No influencer creator request action/API and no manager payout transition UI; payout sections are read-only lists. Generic API payout status edits are restricted and conditional transitions are tested, but the complete payout workflow is missing. |
| QR scan tracking | Increment scan counter, record event and redirect | 🟠 Service-role RPC atomically writes scan event/counter; code falls back to Marketplace on database/RPC failure. Not live tested. |

## 5. End-to-end influencer journey

| Transition | Code/schema evidence | Status |
|---|---|---|
| Register/apply | `/apply/influencer` → `/api/applications/submit` → validation → `submit_influencer_application`; applicant token identifies owner | 🟠 Implementation present; deployed acceptance unverified. |
| Document evidence | `/api/applications/documents`; applicant owns application and it remains open; staff can read | 🟠 Secure code path present. ID/selfie fields are not required by form/schema transition. |
| Review/approve/reject | Staff-gated queue → `review_influencer_application`; rejects require reason; self-review blocked; approval inserts `influencer_profiles`, marks active, assigns `influencer` role, audit/notification | 🟠 Repository SQL and code align; live database/migration state unverified. |
| Profile and social links | Application keeps `social_profiles` and full JSON; approval creates base profile only | 🟠 Social URLs/follower declaration are not transformed into `influencer_social_accounts`; later self-summary reads that table, and no complete profile/social editing flow was found. This is an incomplete integration, not evidence of an authorization defect. |
| Campaign discovery/assignment | Creator reads `influencer_campaign_assignments` and joined `campaigns`; manager section lists assignments read-only | 🟠 Read-only linkage exists; accept/decline, deliverable upload, content approval and assignment lifecycle are not present in the reviewed influencer surfaces. |
| Marketplace product discovery | Creator product search endpoint, product visibility validated on QR creation | 🟠 Path exists; no live Marketplace query tested. |
| Promotion URL/code | Referral API generates canonical code; QR promotion stores code/profile/product relation and scan URL | 🟠 Implemented in code; persistence/deployed uniqueness unverified. |
| Click/session | `/api/track/ref` resolves active code, stores session and HttpOnly cookie | 🟠 Implementation present. Returning-session PATCH failures can still return `tracked: true`; no live traffic test. |
| Lead attribution | `/api/marketplace/lead` resolves the server cookie/session and writes influencer/referral IDs; attribution lookup failure logs and keeps lead without partner attribution | 🟠 Partial by design: lead survives, but a saved lead may be unattributed. No live lead test. |
| Checkout/order attribution | `/api/payment/initiate` reads referral cookie and writes canonical order attribution before returning payment request; failures are logged and payment continues | 🟠 Current source path exists. The standalone `/api/affiliate/attribute` endpoint is not the only route: payment initiation also calls the attribution helper. Order attribution is immutable once present, so attribution can be pinned at initiation rather than successful payment. |
| Paid conversion/commission | SQL trigger calls `influencer_commissions_for_order` only on transition to paid; tier/product/category/programme rule resolution; unique idempotency key; rejects inactive profile and self-referral; commission row in `partner_commissions` | 🟠 Strong code/schema design, but no configured rate or paid event/commission row verified in an accessible DB. |
| Earnings/analytics | Creator summary reads profile-linked earnings, payouts, followers, campaigns; referral page sums partner ledger; manager summary aggregates program | 🟠 Source consumes persisted metrics; a new migration changes sales to paid attributed orders while retaining attributed leads. Migration is unapplied; social-profile projection, read limits and referral error masking remain. |
| Payout request/approval/payment | DB schema/policies include payout records and partner payout state; influencer surfaces only display lists | 🔴 Application UI/API transition is missing from reviewed influencer implementation; cannot verify request, approval, provider transfer or settlement. |
| Reports/notifications/settings | Some registry items point to potential tables, but are not attached as shared-wall resources; other items fallback disconnected | 🔴 No complete influencer reporting, notifications, support, settings, or content/campaign operations through the listed manager modules. |

## 6. Marketplace tracking, attribution, commissions, payout

### Tracking and attribution

- Referral code, session, order attribution and influencer profile IDs use the existing canonical marketplace tables rather than a second influencer-specific tracking system.
- Referral visits use last eligible click within the 60-day constant. The referral cookie is first-party and HttpOnly; tracking data avoids directly storing IP/UA in referral session rows.
- QR scan handling records a QR event/counter through one RPC, then redirects to the QR target; the QR target adds the referral code and shares the normal tracking path.
- Lead intake derives influencer attribution from the visitor cookie/session on the server; browser-supplied attribution does not select the partner.
- Payment initiation similarly resolves attribution from the cookie. It records attribution before payment settlement. If payment fails, the attribution remains on the pending order; the trigger creates commission only once the order transitions to paid.
- `attributeOrder()` is idempotent at order level: if an order already has attribution it will not be changed. Thus retries or later referral visits cannot replace an attribution pinned at an earlier payment-initiation attempt. Whether this is intended product policy is unverified.

### Commissions and earnings

- SQL sale commission path reads attributed paid order line items, uses product/category/tier/programme rates and stores a snapshot; missing rate yields no commission rather than an invented amount.
- Trigger only fires on non-paid → paid transition; duplicate line processing is guarded by an idempotency key.
- Creator view exposes campaign earnings separately from order commissions; manager has separate read-only walls for these ledgers.
- No live rate configuration, paid order, commission, reversal or earnings balance was queried. All persistence and actual amount calculations remain yellow/unverified.

### Payouts

- Legacy `influencer_payouts` and canonical `partner_payouts` resources appear in manager views, but configured influencer walls set `creatable: false`, have empty row/bulk actions, and are read-only.
- The creator referral page displays commission state, not payout request controls. No influencer payout request route/server function was found in the reviewed source search.
- Repository SQL policies describe partner-owned payout inserts and operator updates, but that is not an implemented/verified influencer workflow.
- Before remediation, the generic resource endpoint could update payout status without applying a payout transition workflow, combined with the broad operator guard (F-1). The local handler now enforces conditional transitions; database enforcement is only proposed in an unapplied migration (F-2).

## 7. API, database, RLS, authentication and authorization

### Confirmed authorization findings

**F-1 — HIGH finding; 🟢 VERIFIED in local source/tests, production 🟡 UNVERIFIED — service-role resource API authorization and payout transitions.**  
Before remediation, the shared service-role endpoint accepted any role admitted by the internal-operator guard, exposed generic influencer application PII, and allowed payout-state edits outside a lifecycle transition. It now requires a server-verified `admin` or `boss` role for influencer and payout resources; client-supplied roles and the shared internal token do not establish those roles. The generic `influencer_applications` resource is removed, profile `status` is not an editable field, legacy `influencer_payouts` is read-only, and `influencer_order_payouts`/`partner_payouts` transitions use a conditional source-state update. Endpoint tests cover no-auth, developer/marketing, spoofed request roles, authorized admin/boss access, PII resource denial and payout transitions. These tests verify local handler behavior only; deployed source and real production role assignments are unverified.

**F-2 — HIGH finding; 🟡 UNVERIFIED — influencer manager RPC, grant and RLS authorization.**  
The prior migration definitions use `mm_is_operator()` (including `marketing` and `seo`) where the later policy helper is admin/boss-only. New migration `20261108T114000_influencer_manager_authorization.sql` changes the three manager RPC checks to `influencer_manager_access()`, revokes public/anon/authenticated/service-role EXECUTE before granting authenticated execution, and replaces the broad legacy profile/earnings/payout policies. It also narrows influencer-row update RLS on shared `partner_payouts`, removes broad authenticated UPDATE privileges, and installs a database transition trigger; other partner-kind RLS access remains under the existing platform-operator helper. Contract tests assert the function checks, grants and policy/trigger source. The migration has not been executed or parsed by PostgreSQL against either database; actual function owners, grants, RLS, and production migration state remain unverified. Do not describe the database finding as fixed until the migration is safely applied and verified.

### Other integration findings

**F-3 — MEDIUM finding; 🟢 VERIFIED in local source/tests — direct generic profile status edit skipped lifecycle side effects.**  
The generic resource no longer permits profile `status` edits. Status transitions remain on the dedicated manager RPC, which synchronizes referral-code activity and lifecycle audit. API tests verify direct generic edits cannot use this bypass. Runtime database enforcement of the dedicated RPC awaits F-2 migration verification.

**F-12 — MEDIUM finding; 🟢 VERIFIED in local source/tests — generic partner commissions resource crossed the influencer authorization boundary.**  
The shared `partner_commissions` resource was not included in the admin/boss name-based guard and returned the full shared ledger, with status approval/rejection enabled. Broader internal-operator roles could therefore read influencer commission rows and attempt to approve/reject them. The resource is now scoped to `partner_kind=neq.influencer`; the dedicated influencer commission resource remains within the restricted `influencer_*` boundary. Endpoint regressions verify the scope is present on reads and both pre-read/update URLs, and that an out-of-scope status update matches no row. This is local service-role request construction evidence, not a substitute for database RLS verification.

**F-4 — MEDIUM — social/application data does not populate creator account metrics.**  
Review inserts profile fields only; application social profiles and follower declaration remain on the application. `influencer_self_summary()` computes followers/engagement/accounts from `influencer_social_accounts`, and tier qualification uses verified social-account followers. The manager’s social-account wall is read-only. This can leave approved creators with zero accounts/followers in the dashboard and no exposed way to correct/verify them.

**F-5 — MEDIUM — referral read failures become false zero/empty metrics.**  
`/api/influencer/referral` treats non-OK code/session/ledger responses as empty arrays. The UI then renders zero codes/clicks/conversions/commissions as if the read succeeded. This hides persistence/read failures and can misstate earnings and performance. In contrast, some other endpoints return explicit 502 errors.

**F-6 — MEDIUM — returning referral-session write can report success when PATCH failed.**  
When an existing session is found, `/api/track/ref` does not inspect the PATCH response and returns `tracked: true` with cookie regardless. A visitor may receive successful UI/network behavior while repeat-click metadata and `last_seen_at` were not saved; attribution window/count can be stale. No live failure injection was performed.

### Areas with protective code evidence (not live verification)

- Applicant submission requires a bearer-authenticated user; role-specific submission RPC uses caller token.
- The dedicated applications queue calls `isApplicationStaff`, limits transitions, blocks self-review and requires rejection/suspension reason.
- Document uploads check ownership, open status, size and content signature; document reads require applicant or application staff.
- Creator metrics resolve profile from `auth.uid()` in `influencer_self_summary()`.
- Referral code ownership is checked server-side before toggle; inactive influencer accounts cannot mint links or QRs.
- QR creation validates the product is visible; QR scan destination is constrained to a relative destination.
- Commission creator functions are service-role-only in the later lockdown migration and SQL commission trigger is paid-order-gated.
- The new `influencer_manager_access()` migration narrows manager RPCs, grants and legacy policies in source. It is unapplied, so this is not evidence of current database access behavior.

These are source/migration findings only; none demonstrates current production grants or deployed policy state.

## 8. Dead, dummy, mock and placeholder inventory

No influencer demo fixtures were observed in the reviewed current dashboard path; unsupported creator brands/content intentionally return `null`/dash. **Former exception:** operator sales/leads were hardcoded to zero. Client code now consumes persisted counts and treats missing/invalid metrics as unavailable. New migration `20261108T115000_influencer_paid_sales_metrics.sql` counts distinct attributed orders only when paid while retaining attributed lead counts. It is unapplied, so deployed metrics remain unverified.

Confirmed disconnected or misleading surfaces:

- Influencer Manager’s campaign/collaboration wall has no resource; the visible Campaigns/Create Campaign copy is not wired to this wall. Dashboard’s campaign CTA opens Marketing Campaign Builder instead.
- `existingMarketingWall()` accepts a marketing table name but does not attach a `resource`, so Compliance, Content Library, Media Assets, Content Approval, Analytics, Reports, Communication and Calendar cannot read those tables through the shared wall.
- Many fallback menu labels are rendered as “no connected resource” empty states: onboarding, customers, sales, affiliate/referral links in manager, QR center, performance insights, subscriptions, rank/rewards/challenges, inbox/support/documents/products/settings and AI items.
- Connected Assignment, Verification, commission, payout, invoices, tiers and audit-like sections are list-only; they have no action wiring in the influencer manager registry. Some named tables (`influencer_activity`, `influencer_notifications`, `influencer_risk_reviews`, `influencer_audit_logs`) are not in `INFLUENCER_RESOURCES`, so those sections are disconnected despite a plausible table name.
- The dedicated application queue is an exception: its decision controls use the review API rather than the generic wall.
- Application “Identity Verification” lists ID/selfie fields, but those uploads are not marked required by the form’s fields, and the review path does not enforce their presence.

## 9. Test results

Remediation validation command:

```text
npm test -- --run src/components/influencer/sectionRegistry.test.tsx src/components/applications/RoleApplicationsQueue.test.tsx src/routes/api/applications/-queue.test.ts src/lib/applications/applications.test.ts src/lib/commerce/payment-initiate.test.ts src/lib/commerce/commission.test.ts src/lib/marketplace/__tests__/attribution.test.ts src/lib/marketplace/__tests__/lead-attribution.test.ts src/lib/marketplace/__tests__/lead-intake.test.ts src/lib/auth/server-fn-callers.test.ts src/lib/influencer/analytics.test.ts src/lib/influencer/authorization.test.ts src/routes/api/manager/-resource.influencer-security.test.ts
```

**Result after the final commission-scope fix: 13 test files passed, 131 tests passed, 0 failed.** The latest rerun took 10.78 seconds. The additional regressions verify generic partner commission reads and status updates are constrained to `partner_kind=neq.influencer`. The suite also covers manager resource authorization and payout transitions, exact auth-role allowlists, application UI/API validation, dashboard metric values/errors, static RPC/grant/RLS migration contracts, paid-order summary SQL semantics, referral attribution, commission logic, and payment initiation.

Additional auth-boundary regression:

```text
npm test -- --run src/lib/auth/internal-guard.test.ts
```

**Result: 1 test file passed, 4 tests passed, 0 failed.** This separately checks operator role resolution and the server-side guard. Together, the two Vitest runs passed **135 tests across 14 files**.

Additional validation:

- `npx tsc --noEmit -p .` — **PASS**, fresh full check, exit code 0, no diagnostics.
- `npm run build` — **PASS**, fresh build, exit code 0. Build emitted existing chunk-size/target and `vite-tsconfig-paths` notices; it did not fail.
- Scoped ESLint on changed TypeScript files with the repository's existing Prettier rule disabled — **PASS**, exit code 0.
- `npx prettier --check` on the three focused/new regression test files — **PASS**. The modified pre-existing `server-fn-callers.test.ts` was excluded because two unrelated long lines were deliberately preserved; scoped ESLint still checked it.
- `git -c core.whitespace=cr-at-eol diff --check` — **PASS**; the touched dashboard source uses tracked CRLF line endings.

Exact scoped lint/format commands:

```text
npx eslint src/lib/auth/internal-guard.ts src/lib/auth/require-operator.server.ts src/lib/auth/server-fn-callers.test.ts src/routes/api/manager/resource.ts src/routes/api/manager/-resource.influencer-security.test.ts src/routes/influencer-manager.tsx src/routes/application-manager.tsx src/lib/influencer/programme.functions.ts src/lib/influencer/analytics.ts src/components/influencer/InfluencerReferenceDashboard.tsx src/lib/influencer/analytics.test.ts src/lib/influencer/authorization.test.ts --rule 'prettier/prettier: off'
npx prettier --check src/routes/api/manager/-resource.influencer-security.test.ts src/lib/influencer/analytics.test.ts src/lib/influencer/authorization.test.ts
git -c core.whitespace=cr-at-eol diff --check
```

These checks did **not** include a live browser run, production/staging persistence, PostgreSQL execution of either new migration, runtime RLS/grant verification, referral clicks, QR scans, lead insertion, paid-order commission trigger, or payout settlement. An initial test-runner integration attempt reported “No tests found”; the repository’s configured `npm test` command was used successfully and is the result above.

## 10. Findings ranked by severity

| ID | Severity / current status | Finding and current result | Evidence |
|---|---|---|---|
| F-1 | HIGH finding; 🟢 VERIFIED locally; production 🟡 UNVERIFIED | Service-role resource API formerly exposed influencer PII and unrestricted payout status updates. Now exact server-verified admin/boss roles are required, generic application PII access is removed, legacy payout writes are blocked, and canonical payout updates use conditional transitions. The database policy/trigger correction is unapplied. | `src/lib/auth/internal-guard.ts:38, 113-127`; `src/lib/auth/require-operator.server.ts:31-66`; `src/routes/api/manager/resource.ts:529-544, 597-612, 2696-2732, 2833-2868, 4202-4205`; `src/routes/api/manager/-resource.influencer-security.test.ts:84-290` |
| F-2 | HIGH finding; 🟡 UNVERIFIED | Manager RPC checks, EXECUTE grants, payout RLS and legacy policies are corrected in a new migration and covered by static contract tests. Migration is not executed; database security remains open. | `supabase/migrations/20261108T114000_influencer_manager_authorization.sql:6-18, 86-103, 151-165, 215-334`; `src/lib/influencer/authorization.test.ts:7-80` |
| F-3 | MEDIUM finding; 🟢 VERIFIED locally | Generic profile status edits are no longer permitted, preventing bypass of the dedicated code-state/audit lifecycle. | `src/routes/api/manager/resource.ts:529-544`; `src/routes/api/manager/-resource.influencer-security.test.ts:156-167` |
| F-4 | 🟠 MEDIUM — OPEN | Approval stores applicant social data but creates only a base profile; self-summary and tier calculations read social-account rows. | `supabase/migrations/20260920130000_role_applications.sql:250-282, 324-326`; `supabase/migrations/20261103T100000_influencer_self_summary.sql`; `supabase/migrations/20261103T121000_influencer_self_tier.sql` |
| F-5 | 🟠 MEDIUM — OPEN | Referral API maps failed code/session/ledger reads to empty arrays, rendering zero-like counts. | `src/routes/api/influencer/referral.ts:92-145` |
| F-6 | 🟠 MEDIUM — OPEN | Existing-session referral PATCH result is not checked before `tracked: true`. | `src/routes/api/track/ref.ts:90-103` |
| F-7 | 🟠 MEDIUM — OPEN | No influencer payout request UI/API or manager payout approval/settlement actions were found. Resource-level payout writes are constrained, but the business workflow remains absent. | `src/components/influencer/InfluencerReferralLinks.tsx:84-271`; `src/components/influencer/sectionRegistry.tsx:227-238`; `src/routes/api/manager/resource.ts:2833-2868` |
| F-8 | 🟠 MEDIUM — OPEN | Numerous influencer menu sections remain disconnected while navigation/copy implies workflows. | `src/components/influencer/sectionRegistry.tsx:141-150, 194-246`; `src/components/influencer/navigation.ts:20-80` |
| F-9 | 🟠 MEDIUM — OPEN | Attribution is stored before payment settlement and immutable once present; a failed first payment attempt may pin attribution. | `src/routes/api/payment/initiate.ts:254-315`; `src/lib/affiliate/core.ts:338-373` |
| F-10 | MEDIUM finding; 🟢 VERIFIED in source/tests; deployment 🟡 UNVERIFIED | `/influencer-manager` page now matches admin/boss resource access; `/application-manager` matches `application_staff()` roles. Deployed identity-role and DB policy behavior remain unverified. | `src/routes/influencer-manager.tsx:57-69`; `src/routes/application-manager.tsx:37-42`; `src/lib/influencer/authorization.test.ts:83-115` |
| F-11 | MEDIUM finding; 🟡 UNVERIFIED end-to-end | Client no longer hardcodes sales/leads to zero. Summary migration counts paid attributed orders and attributed leads; no deployed metric is verified until migration application. | `src/lib/influencer/analytics.ts:14-52, 111-112, 162-163`; `src/lib/influencer/programme.functions.ts:42-43`; `supabase/migrations/20261108T115000_influencer_paid_sales_metrics.sql:51-57, 177-183`; `src/lib/influencer/analytics.test.ts:90-150` |
| F-12 | MEDIUM finding; 🟢 VERIFIED locally | Generic `partner_commissions` formerly exposed the shared ledger and permitted pending commission status changes to broader internal operators; it is now scoped away from influencer rows. | `src/routes/api/manager/resource.ts:2660-2690, 4202-4205`; `src/routes/api/manager/-resource.influencer-security.test.ts:193-227` |

## 11. Phased remediation recommendations

The local source remediation is complete and tested. Remaining steps:

1. **Database migration verification:** after an isolated staging project exists, inspect dependencies read-only, then (only after explicit staging authorization) test both migrations in filename order on a disposable staging clone with synthetic data. Because the migration files contain their own `BEGIN`/`COMMIT`, do not wrap the unchanged files in an assumed outer rollback transaction. Verify exact function definitions and owners, `has_function_privilege` for anon/authenticated/service roles, RLS policies under representative roles, and paid/unpaid order metric behavior. Neither migration has been run.
2. **Provision a truly isolated staging environment first:** do not use `scripts/ops/sv-deploy.sh` or `scripts/ops/db.mjs` for this. The former builds a temporary tree with the production `/var/www/softwarevala/.env` and later stops/replaces the PM2 app on port 3000; the latter accepts only `vps` (default) or `hosted`, not a staging target. Provision a separate app host/process and separate staging database/project with credentials that cannot access production.
3. **Staging integration:** after isolation is proven and staging migration execution is separately authorized, test anonymous, applicant, influencer, application-staff, marketing, SEO, developer, finance, admin and boss access; application review; referral/code lifecycle; paid-order attribution/commission; payout transition race/denial; and user-visible metric errors. Use disposable, non-production records and documented cleanup.
4. **Production release:** requires separate explicit authorization after staging evidence. Do not claim any production remediation or metric change before deployment and direct verification.
5. **Remaining product work:** implement the payout request/approval process; project and verify application social data; surface referral read/write failures; resolve attribution pinning policy; connect or visibly disable disconnected navigation workflows.

## 12. Overall disposition

Local resource API access, generic profile status writes, role-aligned route gates, and metric consumers have been updated with regression coverage. The two HIGH findings are **not both production-verified**: F-1 is verified only against local code/tests; F-2's corrective migration is unexecuted. The end-to-end programme remains not ready for sign-off because payout operations are missing and multiple integrations remain partial. Production state, deployed migration state, payment/commission records, and live user outcomes remain unverified.

**Staging readiness:** BLOCKED. A staging endpoint, deployment profile, and authorized staging database credentials were not available in this environment. Do not apply migrations or begin live workflow tests until these are supplied and the target is confirmed isolated from production.

## 13. Remediation evidence and remaining blockers

This section distinguishes verified local behavior from migration intent and unverified deployment state. Tests that read SQL files are source-contract tests; they do not execute PostgreSQL, prove actual object owners/grants, or prove either database has applied the migration.

| Finding | Root cause and before → after behavior | Fix/evidence and test result | Remaining blocker / next safe verification |
|---|---|---|---|
| **F-1 — HIGH; 🟢 local source/API tests, 🟡 deployed behavior** | A service-role-backed generic endpoint relied on a broad internal-operator guard, accepted caller-supplied role data in some paths, exposed application PII, and permitted payout edits outside a transition sequence. It now requires roles resolved from the authenticated user's server-verified role records (`admin`/`boss`); caller role fields and the internal shared token do not qualify. Generic application PII access was removed, profile status is not generically editable, legacy payouts are read-only, and canonical payout writes check the current status before changing it. | `src/lib/auth/internal-guard.ts:38, 113-127`; `src/lib/auth/require-operator.server.ts:31-66`; `src/routes/api/manager/resource.ts:529-544, 597-612, 2696-2732, 2833-2868, 4202-4205`; endpoint regressions in `src/routes/api/manager/-resource.influencer-security.test.ts:84-290`. The targeted suite covers unauthenticated and non-allowlisted roles, role spoofing, shared-token denial, admin/boss and multi-role access, PII denial, direct profile-status denial, ordered payout transitions, stale-state conflicts, timestamps, and legacy payout read-only behavior. | No deployment or live identity-role check was performed. Verify deployed code and representative authenticated roles on isolated staging; check both direct API and UI behavior. |
| **F-2 — HIGH; 🟡 UNVERIFIED** | Manager RPCs previously used a broader operator predicate, and legacy profile/earnings/payout policies plus direct `partner_payouts` UPDATE rights could differ from the intended admin/boss policy. The new migration replaces those checks/policies, revokes broad EXECUTE and table/column UPDATE grants, grants only intended update columns, and adds a database transition/reassignment guard for influencer payouts. | `supabase/migrations/20261108T114000_influencer_manager_authorization.sql:6-18, 86-103, 151-165, 215-334`; static assertions in `src/lib/influencer/authorization.test.ts:7-80` verify RPC predicates/grants, policy replacement, payout grants, and transition cases. | Migration is unapplied and has not been parsed/executed by PostgreSQL. Before any production consideration, obtain authorized staging access; inspect actual table/function definitions, owners, grants and policies; dry-run transactionally; test anon/authenticated/service-role privileges and RLS as representative roles; prepare and verify rollback. No production migration is authorized by this task. |
| **F-3 — MEDIUM; 🟢 VERIFIED locally** | Generic profile updates could skip referral-code activation and lifecycle-audit side effects. Generic profile `status` edits are now rejected; the dedicated manager status RPC remains the transition path. | `src/routes/api/manager/resource.ts:529-544`; endpoint regression `src/routes/api/manager/-resource.influencer-security.test.ts:156-167`. The dedicated RPC's deployed enforcement still depends on F-2. | Stage-test the dedicated RPC and confirm referral-code state and audit persistence; do not directly update production data for verification. |
| **F-4 — MEDIUM; 🟠 OPEN** | Application review persists a base influencer profile but does not create the social-account rows consumed by account/follower and tier calculations. | Application decision/profile SQL: `supabase/migrations/20260920130000_role_applications.sql:250-282, 324-326`; consumers: `supabase/migrations/20261103T100000_influencer_self_summary.sql` and `supabase/migrations/20261103T121000_influencer_self_tier.sql`. No fix was made; no test currently proves an application social profile reaches those rows. | Define and approve how submitted URLs/follower declarations are verified and mapped before implementing; staging acceptance must confirm approved profile/account/tier consistency. |
| **F-5 — MEDIUM; 🟠 OPEN** | Some referral API read failures are converted to empty collections, which can appear as zero activity rather than an unavailable/error state. | `src/routes/api/influencer/referral.ts:92-145`. No remediation or failure-injection test was added for this gap. | Propagate upstream errors or return an explicit unavailable response and add tests for each failed read; verify the dashboard distinguishes unavailable data from genuine zero. |
| **F-6 — MEDIUM; 🟠 OPEN** | The existing-session tracking branch does not validate the PATCH response before reporting `tracked: true`. | `src/routes/api/track/ref.ts:90-103`. No remediation or live persistence failure test was added. | Check persistence response and avoid a success-shaped result on failure; add a deterministic failed-PATCH regression and verify repeat-click/session fields on staging. |
| **F-7 — MEDIUM; 🟠 OPEN** | Payout list screens are read-only and no creator payout-request UI/API or manager approval/settlement action was found. Generic resource hardening does not create a payout workflow. | Creator link/commission surface: `src/components/influencer/InfluencerReferralLinks.tsx:84-271`; manager payout wall: `src/components/influencer/sectionRegistry.tsx:227-238`; constrained resource config: `src/routes/api/manager/resource.ts:2833-2868`. No payout-request/settlement integration test exists. | Product and finance must define/approve the payout workflow and authorization before implementation. The new DB transition guard is only migration source; no payout can be called end-to-end verified. |
| **F-8 — MEDIUM; 🟠 OPEN** | Navigation exposes sections whose wall registry has no resource/actions or whose marketing wall omits the requested resource; some surfaces resolve to disconnected/empty states. | `src/components/influencer/sectionRegistry.tsx:141-150, 194-246`; configured navigation: `src/components/influencer/navigation.ts:20-80`. Existing section-registry tests cover rendering/dispatch, not all implied backend workflows. No redesign or new functionality was introduced. | Complete a section-by-section acceptance map with the owner; connect only approved existing workflows and test each action through its API/persistence path. |
| **F-9 — MEDIUM; 🟠 OPEN** | Referral attribution is written during payment initiation and is not replaced once present; if the first payment attempt fails, the early association may persist and affect later attribution. | `src/routes/api/payment/initiate.ts:254-315`; persistence/immutability logic in `src/lib/affiliate/core.ts:338-373`. Existing attribution/payment tests cover current behavior, not retry/failed-payment cleanup semantics. | Owner must choose attribution semantics for failed/retried payments; test idempotency and competing referrals before changing persistence. No production orders were created or altered. |
| **F-10 — MEDIUM; 🟢 VERIFIED in local source/tests, 🟡 deployed state** | UI role gates did not consistently reflect the intended manager and application-staff role sets. `/influencer-manager` now uses exact `admin`/`boss`; `/application-manager` explicitly matches `application_staff()` and disables implicit operator bypass. | Routes: `src/routes/influencer-manager.tsx:57-69`, `src/routes/application-manager.tsx:37-42`; consistency tests: `src/lib/influencer/authorization.test.ts:83-115`, including the dedicated application queue override and compatibility API/RLS source contract. | Verify effective role assignments and RLS/API results under staging identities. UI gates alone do not prove server/database authorization. |
| **F-11 — MEDIUM; 🟢 client behavior/tests, 🟡 database metric result** | Dashboard code previously supplied hardcoded zero sales/leads. It now reads persisted counts, validates them, and surfaces invalid/missing metrics as unavailable. The new summary migration counts distinct attributed orders only when `marketplace_orders.status = 'paid'`; attributed-lead logic remains unchanged. | Consumer: `src/lib/influencer/analytics.ts:14-52, 111-112, 162-163`; operator summary role check: `src/lib/influencer/programme.functions.ts:54-69`; SQL: `supabase/migrations/20261108T115000_influencer_paid_sales_metrics.sql:51-57, 177-183`; tests: `src/lib/influencer/analytics.test.ts:90-150` plus SQL contract in `src/lib/influencer/authorization.test.ts:117-135`. | Both metrics and the migration remain unverified against deployed records. On staging, compare summary output with independently counted paid attributed orders and attributed leads, including no-data and missing/error cases. |
| **F-12 — MEDIUM; 🟢 VERIFIED locally** | The shared `partner_commissions` resource omitted influencer from its role-name restrictions and had no row scope, so broader internal operators could read the shared ledger and attempt pending influencer commission decisions. It now applies `partner_kind=neq.influencer` to reads and updates. | Config at `src/routes/api/manager/resource.ts:2660-2690`; resource restriction helper at `4202-4205`; runtime tests at `src/routes/api/manager/-resource.influencer-security.test.ts:193-227` verify read filter and both prior-row/update URLs carry the exclusion and an unmatched update conflicts. | No live service-role/PostgREST request or database test was run. Verify the deployed API, broader partner-role access, and influencer ledger isolation on staging. |

### Required verification sequence and deployment prerequisites

1. **Keep production unchanged.** This audit performed no production/staging migration, database write, application deployment, or service restart. No credential or authorized database session was available.
2. **Prepare an isolated staging database.** Confirm both migration dependencies and current function/table schemas; inspect actual grants, object owners, RLS policies, and `partner_payouts` column privileges. Capture a restorable backup and rollback script before any authorized staging execution.
3. **Dry-run and validate migrations in filename order.** Test `20261108T114000_influencer_manager_authorization.sql` first, then `20261108T115000_influencer_paid_sales_metrics.sql`, on a disposable staging clone because each file controls its own transaction. Review resulting function definitions, exact grants, RLS behavior, trigger behavior, and paid/unpaid summary counts before any persistent staging application.
4. **Deploy source only to authorized staging after migration validation.** Exercise unauthenticated, influencer, marketing, SEO, developer, finance, admin, and boss identities against manager/resource APIs, `/influencer-manager`, `/application-manager`, and application compatibility endpoints. Confirm no client-supplied role or internal token elevates access; confirm direct influencer payout writes cannot bypass allowed transitions.
5. **Run non-destructive end-to-end checks with isolated fixtures.** Verify application review, social-account projection (currently a known gap), referral creation/click/session update, lead attribution, paid-order commission idempotency, sales/leads summary, and payout request/approval/settlement. Do not create or alter production business records.
6. **Production remains a separate approval.** A successful staging run is not authorization to apply migrations or deploy to production. Production rollout requires explicit owner approval, a production backup/rollback plan, post-apply privilege verification, and separate live acceptance evidence.

**Final status:** local tests/build/typecheck support the code-level changes, but F-2 and F-11 database effects remain **UNVERIFIED**. F-4 through F-9 remain open integration/functionality findings. The ecosystem is not production-ready for sign-off.

## 14. Deep diff review and final verification

The security-remediation scope comprises 15 files: the source/API changes, four focused regression files, two new migrations, and this report. The current worktree also contains unrelated pre-existing franchise, author, marketplace-media and seller changes; these were not reverted or folded into this review. The shared `src/routes/api/manager/resource.ts` file contains an unrelated franchise-royalty diff in addition to the influencer changes; it was preserved and is not attributed to this remediation.

Reviewed scope:

- `src/lib/auth/internal-guard.ts`
- `src/lib/auth/require-operator.server.ts`
- `src/lib/auth/server-fn-callers.test.ts`
- `src/routes/api/manager/resource.ts`
- `src/routes/api/manager/-resource.influencer-security.test.ts`
- `src/routes/influencer-manager.tsx`
- `src/routes/application-manager.tsx`
- `src/lib/influencer/programme.functions.ts`
- `src/lib/influencer/analytics.ts`
- `src/components/influencer/InfluencerReferenceDashboard.tsx`
- `src/lib/influencer/analytics.test.ts`
- `src/lib/influencer/authorization.test.ts`
- `supabase/migrations/20261108T114000_influencer_manager_authorization.sql`
- `supabase/migrations/20261108T115000_influencer_paid_sales_metrics.sql`
- `docs/audits/influencer-ecosystem-audit.md`

### Security conclusions

- **🔴 Confirmed vulnerabilities in the pre-remediation source:** the baseline manager resource path used the broad internal-operator guard for influencer PII and payout resources; it exposed generic application data and allowed profile-status/payout edits without the dedicated workflow. The baseline RPC and direct-table policies also had a broader operator boundary than the intended admin/boss policy. These are historical code findings, not evidence of current production state.
- **🟠 Confirmed medium-severity vulnerability in the pre-final-review source (F-12):** the generic `partner_commissions` resource exposed the shared ledger to broader internal operators and permitted pending-status decisions without an influencer exclusion. The independent review identified it. The resource now applies a server-constructed `partner_kind=neq.influencer` scope to list, pre-read and update operations. New endpoint tests verify the filter and reject an update that matches no scoped row.
- **🟢 Locally fixed and tested:** the manager resource now consumes only roles returned by the server-side identity/role guard and restricts influencer/payout resources to `admin`/`boss`; client-supplied role fields do not grant access. Generic application PII is no longer an exposed resource, generic profile status edits are rejected, legacy `influencer_payouts` is read-only, canonical payout writes use conditional source-state filters, and the shared commission resource excludes influencer rows. Endpoint tests verify denied roles do not issue service-role fetches, allowed admin/boss access, role spoofing denial, generic PII/status denial, the commission scope, and payout transition/conflict behavior.
- **🟡 Database remediation not verified:** the new migration describes stricter RPC grants, RLS and the payout transition trigger, but it has not been applied or run by PostgreSQL. The source fix is not a claim that deployed RPCs, grants, owners, RLS, trigger behavior, or direct table privileges are now secure.
- **🟠 Remaining implementation risks:** F-4 through F-9 remain open. The compatibility application GET carries the caller token and relies on the `application_staff()` RLS policy; the POST calls a review RPC that checks that policy. This is a server-side database boundary in repository source, but its deployed state is unverified and local static tests do not simulate live RLS.
- **🟡 Attribution/commission facts:** influencer sales and leads are sourced from persisted summary/RPC values; the new sales query counts distinct attributed orders whose marketplace order is paid, and leads count attributed lead rows. Existing commission calculation reads persisted paid-order attribution/line items and commission rules. No fabricated sales/leads are introduced by these changes, but deployed rows, values, commission writes, and actual payout settlement were not inspected.

### Migration review

The filenames sort after the existing `20261108T113000_marketplace_demo_click_and_recovery.sql` migration and in the intended order: `20261108T114000_influencer_manager_authorization.sql`, then `20261108T115000_influencer_paid_sales_metrics.sql`. The authorization migration uses transactional `CREATE OR REPLACE`, `DROP POLICY IF EXISTS`/recreate, `REVOKE`/`GRANT`, and drop/recreate trigger operations; the metrics migration replaces functions and comments and makes no row-data changes. Static review found no duplicate new migration or data backfill. These are source-level ordering/idempotency observations only; SQL parsing, dependencies in the deployed cloud/VPS schemas, live privileges and rollback behavior still require authorized staging execution.

### Independent review and final command results

- An initial independent read-only security review identified the F-12 generic commission resource omission. The finding was confirmed against source and fixed with a row scope; new regression tests cover both reads and updates. A final independent read-only review found no remaining source vulnerabilities in the reviewed changes. Both reviews lacked live database/deployment access; deployed RPC/RLS/column privilege state and compatibility RLS remain unverified.
- The exact 13-file focused regression command in Section 9: **13 files, 131 tests passed, 0 failed**.
- `npm test -- --run src/lib/auth/internal-guard.test.ts`: **1 file, 4 tests passed, 0 failed**.
- `npx tsc --noEmit -p .`: **PASS**, exit code 0, no diagnostics.
- `npm run build`: **PASS**, exit code 0. Existing Vite/Nitro notices and chunk-size/target warnings were non-failing.
- Scoped ESLint on changed TypeScript implementation/test files with the existing Prettier rule disabled: **PASS**, exit code 0.
- `npx prettier --check` on the focused/new API security, analytics and authorization regression files: **PASS**. The existing `server-fn-callers.test.ts` was excluded from Prettier because its two unrelated pre-existing long lines were intentionally preserved; it was included in scoped ESLint.
- `git -c core.whitespace=cr-at-eol diff --check`: **PASS**. CRLF is preserved in the dashboard component.

No production/staging credentials or authorized database session were available. No database migration, production/staging data change, deployment, service restart, commit, or secret access occurred. Required next step is staging-only migration dry-run/rollback rehearsal followed by privilege/RLS/trigger checks under representative roles; a separate explicit owner authorization is required before any production migration or deploy.

## 15. Controlled staging blocker and setup requirements (2026-10-21)

**Decision: 🔴 NO-GO for live staging validation, migration execution, or staging sign-off at this time.** This is an access/configuration blocker, not evidence that staging is insecure or that any workflow fails.

### Safe environment checks

- Checked local environment-variable **names only** for staging, database, Supabase, Postgres, SSH, Hostinger, and deployment configuration; no staging/database connection variable was present. Secret values were not read or printed.
- Checked presence only (contents not read) for `.env.staging`, `.env.ops`, `.env.production`, `deploy/staging.env`, and `deploy/staging/`; none was present. No local staging deployment profile was found.
- Repository documentation and deployment source show that `softwarevala-staging` is a PM2 **process name on the production host**, not a separate staging environment: `deploy/production/README.md` maps it to `/var/www/softwarevala`, production nginx port 3000, and the production domain; `scripts/ops/sv-deploy.sh` sets `APP="softwarevala-staging"` and `LIVE="/var/www/softwarevala"` (lines 17-20), reads `$LIVE/.env` (lines 30-40), tests the candidate build at port 3011 (line 78), then stops that app and starts the swapped build on live port 3000 (lines 160-178, 203 onward). The temporary build tree at `/var/www/sv-build` is build isolation only; it inherits production configuration and is not safe staging.
- `scripts/ops/db.mjs` reads `.env.ops`, defaults to `vps`, and accepts only `vps` or `hosted` (lines 38-48); `vps` is explicitly the source of truth, while `hosted` is the project named by `.env.ops` (lines 108-115). It has no staging-target guardrail. **Do not invoke it for this task**, because its available targets are not an authorized isolated staging target.
- The available browser attachment identifies a Hostinger VPS panel, not a separate staging account/host/database. Did not open the panel, connect to the VPS, or query any database.
- No migration, deployment, restart, database write, test fixture, or production/staging data operation was performed.

### Exact staging provisioning and access requirements

There is no repository-defined safe mechanism to provision isolated staging. This report defines a proposed architecture below; it has not been provisioned, tested, or approved. The owner/platform operator must provision and document all of the following before validation:

1. **Infrastructure isolation:** a separate staging host/account and hostname, separate process manager and ports, and a separate database/project. Confirm staging cannot write to or read from production; do not merely rename the production PM2 process or use the spare-port build smoke. Demonstrate the resolved staging host, database/project identifier, and application build target through a redacted deployment manifest or provider console evidence, without exposing secrets.
2. **Staging application configuration:** a staging-only secret-manager/environment profile containing the staging-specific `SUPABASE_URL`, `SUPABASE_PROJECT_ID`, `SUPABASE_ANON_KEY`/publishable key, `SUPABASE_SERVICE_ROLE_KEY`, corresponding `VITE_SUPABASE_*` values, `INTERNAL_API_TOKEN`, `SITE_URL`/`APP_BASE_URL`, and any required staging database connection setting. Generate distinct credentials in the staging project; do not copy production keys or reuse `.env.ops`. Provide only the secret names/presence and a redacted project/host identity for review.
3. **Database access:** a staging-only, least-privilege read-only SQL/catalog identity for initial schema/grant/RLS inspection, followed—only after a separate staging migration authorization—by a staging migration executor with the exact required DDL grants. Provide a staging backup/restore point and rollback procedure. No production SSH key, VPS database route, production database password, or production Supabase project credential is acceptable.
4. **Application test identities:** distinct disposable accounts for anonymous/no-session, applicant, influencer A, influencer B (cross-user isolation), application staff, and operator roles `marketing`, `seo`, `developer`, `finance`, `admin`, and `boss`. The application-staff policy in `20260920130000_role_applications.sql` and `20261108T112000_homepage_application_lifecycle.sql` admits `admin`, `boss`, `super_admin`, `boss_owner`, `founder`, `owner`, and `marketing`; include each relevant identity, not just an admin. Create role grants only in staging and record the authenticated user IDs/role assignments in the test evidence, not secrets.
5. **Non-production financial integration:** use a provider sandbox or an existing stage-only settlement harness that executes the real application webhook/settlement path. No mocked success, manual production-like database status edits, real payment credentials, or actual transfers. If no supported sandbox exists, mark payment/paid-order/payout end-to-end cases UNVERIFIED.
6. **Named accountable owners:** platform/VPS owner provisions and proves isolation; database owner supplies the stage-only access and migration executor; application/security owner runs role and API tests; finance/product owner approves test payout semantics and disposable fixture cleanup. Production approval is a separate decision.

See Section 16 for the proposed architecture, named owner roles, controlled commands, and migration rollback plan. These are instructions for a future authorized staging setup, not executed actions.

### Finding disposition

- **🔴 Historical security findings F-1/F-2:** F-1's manager API controls and F-12's shared commission exclusion have local source/test evidence; F-2 remains **🟡 UNVERIFIED** because migration execution and real grants/RLS/RPC permissions were not checked. No current deployed security claim is made.
- **🟢 Local-only evidence:** F-1, F-3, F-10, and F-12 have source and focused regression evidence as described above. These results are not live role-boundary verification.
- **🟠 Open implementation/integration findings:** F-4 through F-9 remain open, including profile/social projection, referral read/write failure handling, missing payout workflows, disconnected sections, and attribution policy semantics.
- **🟡 Financial/database evidence:** F-11's paid-sales metric SQL and client handling have source-contract/test evidence only. No actual staging rows, dashboard values, commission ledger, earnings, or payout state was queried or reconciled.

### Exact blocker and next authorized step

The blockers are: (a) no dedicated staging host/database/project is documented; (b) the only `softwarevala-staging` deployment process is on the production VPS and consumes production configuration; (c) the database helper routes only to production VPS or the configured hosted project; (d) no staging-only credentials or authorized role identities are present; and (e) no sandbox payment/payout integration has been evidenced. The owner/platform operator must provision the isolated target and supply the requirements above. After that, first perform read-only target/schema identity checks; request separate approval before any staging migration execution or fixture writes.

### Staging acceptance checklist (not executed)

No item below is marked passed. Require timestamped output tied to the verified staging host/project and build revision; redact secrets and personal data.

1. **Isolation gate:** confirm the app's runtime URLs, project/database ID, host, process, and egress point all identify staging; prove production endpoints/credentials are absent from the runtime; verify staging test writes are visible only in staging. Abort on any ambiguity.
2. **Migration preflight:** compare required tables, columns, function signatures/owners, enum types, indexes, triggers, policies, and grants to both migration dependencies. Review rollback scripts and staging backup restore. Dry-run on a disposable staging clone (the migration files include `BEGIN`/`COMMIT`, so an assumed outer rollback is unsafe); inspect expected object diffs. Only after separate authorization, apply to persistent staging in filename order and verify effects and idempotency on a fresh clone.
3. **Privileges/RLS/RPCs (F-2):** query actual `pg_proc` definitions/owners, `has_function_privilege` and table/column grants for `anon`, `authenticated`, `service_role`, and representative role identities; enumerate policies and test with caller JWTs. Confirm unauthorized roles cannot execute manager RPCs or read/update influencer profiles, earnings, applications, or payouts; authorized admin/boss operations follow policy. Verify application compatibility GET/POST uses the intended applicant/staff policy. Confirm the payout trigger rejects illegal transitions/reassignment and allows only valid transitions.
4. **Manager/API role boundary (F-1/F-3/F-10/F-12):** exercise unauthenticated, influencer A/B, marketing, SEO, developer, finance, admin, and boss against manager resource GET/PATCH, `/influencer-manager`, `/application-manager`, compatibility endpoints, and generic `partner_commissions`. Assert 401/403 where required, no PII or cross-user rows, client-supplied role spoofing has no effect, profile status cannot be changed through generic PATCH, valid payout transitions work conditionally, and every generic commission query/update is server-scoped away from `partner_kind=influencer`.
5. **Applications and profile projection (F-4):** submit one synthetic application through the UI/API; prove only its applicant can read it; approve/reject through the authorized review path; verify status, audit, notification and role persistence. Compare submitted social URLs/follower declarations with `influencer_social_accounts` and dashboard output; because projection is a known gap, keep F-4 open unless persisted rows and correct values are demonstrated end-to-end.
6. **Referral and tracking reliability (F-5/F-6):** create/toggle a code for influencer A, prove B cannot read/change it, generate a link/QR, record first and repeat clicks through real endpoints, and inspect persisted session/click fields. Inject a staging-only read failure and failed PATCH; verify neither is reported as successful zero/`tracked: true`. Confirm cookies, expiration, attribution windows, QR scan and redirect behavior.
7. **Lead, paid sale, commission and metric reconciliation (F-9/F-11):** create a stage lead through the actual API and verify its persisted influencer attribution. Use the provider sandbox to pay an isolated order through the real settlement path; verify unpaid orders do not count, a paid attributed order counts once, repeated settlement does not duplicate commission, and refund/cancellation behavior follows the existing rules. Independently query persisted paid attributed order IDs and lead IDs, then compare exact counts/amounts with the dashboard/RPC output, including empty, missing, and error states. Verify attribution pinning after a failed first payment against owner-approved policy; retain F-9 if policy or expected result is unresolved.
8. **Earnings, payout, reports:** reconcile persisted commission rows and currency/amount snapshots with earnings views and summary data. Verify payout eligibility, request, approval, processing, completion, denial and duplicate/race handling through supported UI/API/provider sandbox paths; no direct row edits to simulate success. The audit found no influencer payout request/approval workflow, so keep this acceptance item blocked and F-7 open until the actual product workflow is implemented and tested. Verify report filters/exports against the same bounded persisted fixture set.
9. **Regression/build gate:** run the focused suites listed in Section 9, full relevant regression suites, TypeScript, production build, scoped lint/format, and `git diff --check` against the exact staging candidate revision. Record command, exit code and counts; do not count mocks/static SQL assertions as persisted-data validation.
10. **Cleanup/closure:** remove only documented stage fixtures using approved cleanup paths; independently verify no production mutation occurred. Update each finding status with reproducible evidence. No staging or production sign-off until all security/database gates pass and remaining product gaps have explicit disposition.

No production authorization is requested or implied. Production remains **🔴 NO-GO** for migration/deployment. The next step is **NO-GO for staging execution** until a dedicated isolated target, redacted isolation evidence, stage-only access and test identities are provided; provisioning that environment is the next owner action.

## 16. Proposed isolated staging architecture and implementation plan

**Status: 🟡 PROPOSAL ONLY (rechecked 2026-10-21 16:21 IST).** No owner evidence establishing a cloud project, host, DNS record, database, credentials, service, or payment sandbox was supplied. This plan deliberately does not reuse the `softwarevala-staging` PM2 name, production VPS, production domain routing, production `.env`, current `supabase/config.toml` project ID, `.env.ops`, or production credentials.

### Target architecture

```text
reviewers/test accounts
        |
        v
https://influencer-staging.<owner-approved-domain>
        |
        v
separate staging app host/account (one app process, staging-only secret store)
        |
        +--> dedicated Supabase staging project/database (only staging API keys)
        |
        +--> approved PayU/provider sandbox only (or payments disabled)
        |
        +--> staging mail sink; no production mail, CDN/DNS credentials, or webhooks

Production host/VPS, database, project, credentials and payment merchant are not
reachable from the staging app through configuration, network policy, or IAM.
```

Provision the app host in a separate provider account/project or isolated staging account with no production SSH keys, service account, VPC route, database role, secret-store binding, or deploy permission. A separate machine/VM is preferred over container/PM2 separation on the production host. Use a dedicated hostname, DNS zone entry, and TLS certificate controlled by the staging owner; it must not proxy to production. If a shared parent DNS zone is unavoidable, restrict the staging automation token to the single staging record and never grant it production application/deploy or database access. Protect the hostname with staging authentication/IP allowlist and `noindex`; do not accept production user sessions.

Create a new Supabase project solely for staging. Do not branch/restore production data into it. Seed only synthetic, non-personal application, influencer, referral, order and commission fixtures through approved staging setup. Restrict project network access where supported. Production isolation is accepted only when both configuration inspection and negative connectivity checks prove the staging app's runtime and its service identity cannot resolve/authenticate to production resources. A process name, local dev server, spare build port or different URL path does not prove isolation.

The app candidate must be built from the reviewed commit in a clean staging workspace with the staging Vite variables present at build time; Vite values are bundled into browser code. Use a separate build directory/artifact and staging app config. Never copy production `.output`, `.env`, PM2 environment or deployment config. The existing `deploy/production/README.md` documents a production rebuild, not staging provisioning. `scripts/ops/sv-deploy.sh` must not be used: it swaps the live output and restarts the production PM2 process.

### Environment and access contract

Put values in the staging provider's secret manager, not git, `.env.ops`, shell command arguments or test logs. The names below come from `.env.example` and connected runtime source; provider-specific identifiers must be supplied by the owners.

| Purpose | Stage-only setting | Requirement |
|---|---|---|
| Client Supabase | `VITE_SUPABASE_URL`, exactly one of `VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_PROJECT_ID` | Dedicated staging project only; verify bundled client values resolve to the staging project. `VITE_USE_DEV_DB` must not enable an unintended local/production database. |
| Server Supabase | `SUPABASE_URL`, matching stage project ID, exactly one supported server key (`SUPABASE_SERVICE_ROLE_KEY` or approved `SUPABASE_SECRET_KEY`), `SUPABASE_PUBLISHABLE_KEY` or `SUPABASE_ANON_KEY` | Distinct stage keys. Service/secret key server-only, never Vite-prefixed or sent to browser. No production project key. |
| App/API | `NODE_ENV=production`, stage `SITE_URL`, stage `APP_BASE_URL`, assigned stage `PORT`/`NITRO_PORT`, `NITRO_PRESET`, a newly generated `INTERNAL_API_TOKEN` | Host/callback/cookie URLs must use the stage hostname. Do not copy production internal tokens. |
| Direct SQL | Stage-only libpq service entry `sv-stage-readonly` in a secret-managed `PGSERVICEFILE` and password in a mode-0600 `PGPASSFILE`; optional app `I18N_DATABASE_URL` if the stage needs native-language DB reads | Read-only catalog role for preflight. Do not pass a password-bearing connection URL on the command line. Never configure `VPS_DATABASE_URL`, `SV_SSH_HOST`, or `SV_DB_NAME` in the stage app. Do not use `scripts/ops/db.mjs` until it has a reviewed explicit staging target guard; current target choices are only VPS/hosted. |
| Payments | `PAYU_MERCHANT_KEY`, `PAYU_MERCHANT_SALT`, `PAYU_BASE_URL`, `PAYU_PAYMENT_ENDPOINT`, `PAYU_VERIFY_ENDPOINT`, `APP_BASE_URL`, optional `FX_API_URL` | Use sandbox-issued merchant credentials and provider-confirmed sandbox URLs only. **Current `payuConfig()` defaults `PAYU_BASE_URL` to `https://secure.payu.in` and uses production endpoint defaults. Thus staging must not set merchant credentials unless every PayU endpoint is explicitly pinned to a provider-confirmed sandbox and egress is restricted to it.** If unavailable, leave merchant key/salt unset; code then refuses online payments. Mark paid-order/payout provider flow UNVERIFIED. |
| Mail/external integrations | `MAIL_FROM`, `LEADS_NOTIFY_EMAIL`, `SMTP_RELAY_URL`, `SMTP_RELAY_TOKEN`, `RESEND_API_KEY`, Cloudflare/AI/translation settings only if strictly needed | Prefer a local mail sink. Otherwise disable/omit external senders and external API credentials. Never use production recipient lists, webhooks, Cloudflare DNS tokens, AI provider secrets or translation endpoints. |
| Encryption | `AI_API_CREDENTIAL_ENCRYPTION_KEY` only if required by staging features | Generate an independent stage key; never reuse production encryption material. |

Database access is split into principals, not one shared superuser credential:

- **Inspection principal:** `CONNECT` only to the staging database and the minimum `USAGE`/read rights needed for the specific catalog views and schema metadata queries in the approved preflight. No `pg_read_all_data`, user-table SELECT, role membership escalation, writes or DDL. Have the database owner generate and review exact grants against the queries before issuing the credential; do not guess blanket grants.
- **Migration principal:** time-limited staging-only DDL/ownership capability sufficient for the reviewed SQL, used only after explicit staging migration approval and backup. Revoke/disable after migration.
- **Application browser role:** Supabase `anon`/`authenticated` with the normal caller JWT and stage-project RLS; no elevated credentials.
- **Application server role:** stage-project service role held only by the stage server. It bypasses RLS by design, so project isolation and server auth tests are mandatory.
- **Test identities:** anonymous/no token; applicant; influencer A and influencer B; each application staff role as present in the SQL predicate (`admin`, `boss`, `super_admin`, `boss_owner`, `founder`, `owner`, `marketing`); and non-staff operator roles `seo`, `developer`, `finance`. Create only synthetic accounts in staging. Record IDs/role assignments in protected test output; never record passwords, JWTs or API keys.

The `SUPABASE_URL` and project ref are identifiers, not sufficient proof alone. The staging owner must supply a redacted deployment manifest showing application host/account, database host/project ref, DNS hostname, commit/build ID, and enabled external integrations. The security reviewer confirms each is staging-owned and none matches production before any SQL command or migration.

**Verified criteria vs. environment evidence:** source review confirms the existing deploy script points at `/var/www/softwarevala`, reads its `.env`, uses port 3011 only for a pre-deploy smoke, and later replaces/restarts the PM2 process on live port 3000; the database helper targets VPS by default or a hosted project and has no staging target. The `payuConfig()` source defaults to the production PayU base URL when unset. These are repository facts. No staging host, project, endpoint, role grant, DNS route, secret isolation, production-denial rule, or least-privilege database principal has been provisioned or independently verified. All environment isolation requirements therefore remain **🟡 UNVERIFIED**.

### Provisioning sequence and non-destructive commands

Provisioning is owned by the platform operator in the approved cloud/provider consoles; this repo has no staging creation command. **Do not run these commands until a separate stage host/project exist, the manifest is reviewed, and operator authorization is recorded.** Commands below are templates; replace only with owner-supplied stage values. They were not run for this report.

1. Create a dedicated staging Supabase project and separate app VM/account; enable backups/PITR as available, configure private ingress/egress rules, staging DNS/TLS, auth email sink and provider payment sandbox. Do not select an existing production project/host by accident.
2. Store the separate variables listed above in the staging secret manager. Build the app in a clean checkout of the approved commit on the staging host/CI runner. Keep production deployment credentials absent from that runner.
3. Before any connection, have the stage owner verify and sign the redacted target manifest. The operator may then establish a read-only SQL session by loading the secret into the shell without echoing it, and run only identity/catalog queries:

   ```sh
   set +x
   : "${PGSERVICEFILE:?stage-only libpq service config required}"
   : "${PGPASSFILE:?stage-only credential file required}"
   psql "service=sv-stage-readonly" -X -v ON_ERROR_STOP=1 -c \
     "select current_database(), current_user, inet_server_addr(), version();"
   ```

   The protected service file resolves only the stage host/database/user; the protected password file contains only the read-only stage credential. The operator must compare the result to the signed staging manifest and independently check no production host/project ID appears in process config or build metadata. Abort before further SQL if any identifier is ambiguous. Do not print either file or password.
4. After read-only identity confirmation, capture a staging-only custom-format backup using an allowlisted migration service alias or provider snapshot; write it to approved encrypted storage, record checksum and restore point, and rehearse restore into a disposable staging clone. Do not overwrite production backups.
5. Run the automated local test suite and build against staging endpoint variables only after verifying browser bundle references the staging URL/project. Execute server tests with stage-only credentials loaded via secret manager, not command-line literals.
6. Do not copy any production deployment command. A future staging-specific deployment script must have explicit allowlisted staging hostname/project IDs and abort on production identifiers, and must start a separate app process on a separate host. Script review and approval precede first use.

### Migration dry-run and rollback plan (not executed)

The candidate migrations are `20261108T114000_influencer_manager_authorization.sql` then `20261108T115000_influencer_paid_sales_metrics.sql`; they contain their own `BEGIN`/`COMMIT`. Do **not** wrap their unchanged full contents in another `BEGIN ... ROLLBACK` and assume that outer rollback is effective: nested transaction control can commit the session transaction. No production or staging migration has run.

1. Verify staging identity, source commit, base schema dependencies and currently installed function bodies/grants using the read-only role. Confirm migration filename order and compare existing data/schema.
2. Create a fresh disposable staging clone/project from the staging pre-migration baseline (synthetic data only), with a recoverable snapshot. Use the migration owner role only in that clone to test each unchanged migration in order. This is the dry-run; do not use production as the clone source.
3. Inspect changed functions, owners, EXECUTE grants, table/column grants, RLS policies, trigger definitions and metric query results. Run unauthorized/authorized JWT assertions and paid/unpaid synthetic order reconciliations. Capture logs without secrets.
4. Destroy/recreate only the disposable staging clone using its provider-documented reset process after owner approval. Verify the persistent staging baseline is unchanged. If provider supports a proven transactional migration preview without executing embedded commits, document and validate it before relying on it; do not improvise SQL rewriting of the migration files.
5. Before applying to the persistent staging project (a separate approval), take a fresh encrypted backup, record SHA256 and restore target, confirm restore rehearsal, apply the two migrations in order, inspect all expected objects and rerun tests. Re-run is required to prove intended idempotency in an isolated clone, not blindly on persistent data.
6. Rollback: stop stage traffic only; restore the pre-migration staging snapshot into the staging project or replace the project with the verified pre-migration clone. Restore the prior staging app build/config separately. Do not reverse-engineer ad hoc `DROP` statements for policy/function changes. Verify restored schema signatures, grants, RLS, health and metrics. Production resources are never a rollback target.

**Pre-execution checklist (all pending; no migration was run):**

- [ ] Platform owner signs the isolated stage host/project/DNS/runtime manifest; independent reviewer confirms it does not identify production.
- [ ] Database owner demonstrates the inspection principal is limited to catalog metadata and cannot read business tables, write data, create objects, or assume a stronger role.
- [ ] Database owner creates a synthetic-only disposable clone and proves backup restore into that clone; records snapshot ID/checksum and restore result.
- [ ] Migration owner reviews exact dependencies and required object ownership/grants for each SQL file; security reviewer approves the stage-only clone and time-limited executor.
- [ ] Run both unchanged migration files on the disposable clone in filename order; capture exit code and resulting function, owner, ACL, grants, RLS and trigger definitions; compare to expected source contract.
- [ ] Execute role/JWT security assertions and metric SQL against only synthetic clone fixtures; verify paid/unpaid outcomes independently.
- [ ] Discard/replace only the disposable clone using provider-supported reset; prove persistent stage baseline unchanged.
- [ ] Obtain separate written approval before persistent staging backup, migration execution, test writes or fixture creation.
- [ ] For rollback rehearsal, restore only the staging clone from its pre-migration snapshot; compare schema signatures, ACL/RLS and health. Do not run cleanup/restore commands against production.

### Automated staging test plan and objective acceptance

Existing local suites provide source regressions but do not exercise deployed Postgres. Add/enable a stage-only Playwright/API runner and SQL assertions with hard target allowlists; fail closed unless the decoded project ref, host and stage hostname match the approved manifest. The runner must create fixture IDs uniquely per run and clean them only through explicit staging cleanup paths. Record request IDs, non-sensitive DB row IDs, status codes and before/after counts.

| Area | Automated assertion and evidence required |
|---|---|
| RLS/grants/RPC (F-2) | Catalog snapshots of function identity arguments, owner, `prosecdef`, ACL, policies, grants, trigger; invoke each RPC as each JWT role. Unauthorized roles are denied and receive no protected rows; admin/boss can perform only documented actions; service role is not accepted from browser. Save SQL output and HTTP assertions. |
| Manager authorization (F-1/F-3/F-10/F-12) | Calls with no token, every non-allowed role, role-spoof payload, and allowed roles; direct API and UI routes; GET/PATCH `influencer`, payout resources, application compatibility, generic `partner_commissions`. Assert denial before service requests, zero cross-user PII, profile status requires lifecycle RPC, generic shared ledger always filters influencer partner_kind, stale/illegal payout transition returns conflict, valid transition writes audit/timestamp. |
| Application lifecycle and F-4 | Applicant submits using UI/API, owner-only read, staff queue, allowed approve/reject/suspend transitions, self-review denial and rejection reason validation. Verify exact persisted application/profile/status/audit/notification and role rows. Compare submitted socials to social-account records; if projection is absent or inaccurate, record F-4 open and do not claim profile flow complete. |
| Referral and F-5/F-6 | Influencer A creates/toggles code; B and non-influencer cannot view/update it. Click first visit and repeat visit via actual endpoint, verify cookie, persisted session and click counters. Inject stage-only upstream GET and PATCH failure; assert errors/unavailable state rather than empty/false success. Verify QR scan event and redirect with actual stored rows. |
| Leads/attribution and F-9 | Create synthetic lead through real route; compare `leads.influencer_profile_id`, referral session and dashboard count. Attempt competing referral and failed first payment using sandbox path; compare observed persisted attribution against owner-approved attribution policy; keep F-9 open if no policy or behavior mismatch. |
| Paid sales/commissions/earnings and F-11 | Use sandbox payment and actual webhook/verification endpoint; inspect paid status and attributed order. Independently query order IDs, attribution rows, commission ledger and earning aggregates. Assert unpaid order excluded, paid order included once, duplicate webhook idempotent, amount/currency/rate snapshot matches active rule, refund/reversal behavior matches implemented logic, UI summary matches exact DB results and handles empty/errors as unavailable. No synthetic mocked success may count. |
| Payouts | Exercise only the implemented payout UI/API/provider path using sandbox. Assert eligibility and all allowed/forbidden transitions, duplicate/race idempotency, identity/audit, ledger linkage and exact payout totals. Current audit found no complete influencer request/approval/settlement workflow; until that is implemented, record F-7 as BLOCKED/OPEN and payout E2E as NOT RUN. Never update a payout row directly to manufacture proof. |
| Reports and regression | Reconcile filtered/exported report rows and totals to fixture queries. Run local focused Vitest suites and stage acceptance runner, full TypeScript, build, scoped ESLint/Prettier and whitespace check on the same commit. Archive actual output and exit codes. |

**Acceptance is GO for staging sign-off only if**: manifest is signed; app and database are demonstrably isolated; no production credentials/routes exist in staging; migrations are backed up, dry-run reviewed and applied only with staging authorization; role/RLS/RPC assertions all pass; actual persisted fixture data reconciles with API/dashboard/report values; payment tests use confirmed sandbox; no unauthorized or cross-user data leaks; and all open items F-4–F-9 have either evidence-supported closure or explicit accepted product blockers. Current state does not meet these criteria.

### Owners and current blockers

| Owner | Required action | Exact evidence required before stage access is granted | Status |
|---|---|---|---|
| Platform/cloud owner | Provision a separate staging app host/account, process, secret-manager scope and deploy identity. Exclude production SSH keys, IAM roles, VPC routes, database access and deploy permissions. | Signed redacted topology with provider account/project and resource IDs; host identity and build revision; IAM/secret-store policy export showing no production grants; staging process/port map; egress-deny results for production app/database/payment endpoints; evidence staging write probes cannot reach production. | 🟡 BLOCKED — not provisioned or verified. |
| DNS/network owner | Create a dedicated staging hostname/TLS route that terminates at the staging host only. Restrict DNS automation to the staging record; add staging authentication/IP allowlist and `noindex`. | DNS resolution and certificate inspection output; reverse-proxy/ingress config showing only the stage upstream; negative route test demonstrating no production upstream; redacted DNS-token scope. | 🟡 BLOCKED — no staging hostname or route evidence. |
| Supabase/database owner | Create a new staging project/database; configure isolated auth, synthetic-only data, backup/PITR, read-only inspection role and temporary migration role. Keep production project credentials and routes inaccessible. | Redacted project ref/region/account; read-only identity query (`current_database`, `current_user`, server address) matching signed manifest; production-vs-stage identifier comparison; `pg_roles`, `pg_database`, schema/table grants, function ACL/owner and RLS inventory; proof inspection role cannot write or read unrelated personal data; backup checksum and successful restore rehearsal into a disposable stage clone. | 🟡 BLOCKED — no stage project, credentials or evidence. |
| Secret-management owner | Create distinct staging-only server/client keys and app settings, provision only to the stage app and authorized operator roles. | Secret-name/presence attestation and policy showing staging identities only; redacted runtime/build manifest showing `SUPABASE_URL`, project ID and `VITE_SUPABASE_*` all point to staging; no production-key fingerprints or production secrets in stage process/build; `SUPABASE_SERVICE_ROLE_KEY` absent from client artifacts. Never provide secret values in the audit or chat. | 🟡 BLOCKED — no stage secret profile. |
| Application/security owner | Build the approved commit in a clean staging workspace and create disposable no-token, applicant, influencer A/B, application-staff and operator role identities. | Commit/build hash; automated bundle/config scan for production URL/project IDs and secret-key patterns; role/user ID matrix (IDs only, no passwords/JWTs); authorization test output for no-auth, cross-user, role-spoof and each allowed/denied role; approved fixture creation/cleanup plan. | 🟡 BLOCKED — no stage build or accounts. |
| Finance/product owner | Supply PayU/provider sandbox settings or explicitly approve payment-disabled validation; define payout semantics and synthetic fixture cleanup. | Provider documentation and confirmed sandbox base/payment/verify endpoints; secret names/presence only; network egress allowlist to sandbox endpoints; test receipt and verified callback evidence. Alternatively, written payment-disabled decision and explicit mark of paid-sale/payout E2E as unverified. Record owner decision for payout request/approval behavior. | 🟡 BLOCKED — sandbox and payout decision absent. |
| Migration/change owner | Review dependencies, grant a time-limited stage-only migration principal, and authorize dry-run and persistent staging application as separate changes. | Signed ticket/approval scoped to staging project ID and exact migration filenames; base-schema diff; clone snapshot/restore evidence; dry-run SQL diff and function/ACL/policy/trigger assertions; independent rollback rehearsal record. Separate approval is required before applying migrations to persistent staging. | 🟡 BLOCKED — no approval or staging target. |
| Independent security reviewer | Verify staging identity/isolation and least privilege before any staging database access; independently review test evidence afterward. | Signed checklist confirming account/project/host IDs, DNS/upstream, runtime configuration, browser bundle, egress, database roles, no production credentials, and no write-capable access before authorization; final review of actual test outputs. | 🟡 BLOCKED — no manifest or target to verify. |

**Outstanding now:** no isolated host/project, staging DNS, stage-only credentials or role identities, stage-specific deploy runner, sandbox endpoint/merchant, backup/restore rehearsal, migration approval, or provider/owner sign-off. Proposed architecture and checklists are documentation only. Staging migration status remains **NOT APPLIED / NOT VERIFIED**. Production remains **NO-GO**.

**Evidence status reviewed 2026-10-21:** no new owner-provided infrastructure manifest, credentials attestation, backup/restore evidence, test identity list, sandbox documentation or approval was supplied in this task. “Not supplied” is not treated as proof that the resource does not exist externally.

## 17. Staging implementation execution attempt (2026-10-21)

**Execution protocol result: PLAN complete from Section 16; VERIFY ACCESS failed; stopped safely before PROVE ISOLATION. Overall: 🔴 NO-GO.** The requested implementation cannot proceed until staging infrastructure and authorized access exist. This is not evidence of a staging application or database failure.

**Latest gate recheck (2026-10-21 16:21 IST):** one purported influencer test login and the URL `https://softwarevala.net` were supplied. The URL is the production domain, not an isolated staging host, and was not visited. No staging-owned host URL/project ref, staging-only credential package and disposable identity matrix, production-isolation evidence and backup/restore plan, or finance sandbox/payment-disabled approval was supplied. The credential was not stored or used; rotation/revocation is **PENDING / NOT VERIFIED** because no evidence was supplied. Local checks show `.env.staging`, `.env.ops`, `.env.production`, `deploy/staging.env`, and `deploy/staging/` absent; `scripts/ops/db.mjs` exists but is the previously reviewed VPS/hosted helper, not staging configuration. An environment-variable-name scan for `STAG|SUPABASE|DATABASE|POSTGRES|SSH|HOSTINGER|DEPLOY` found only generic `SSH_ASKPASS`, with no staging-specific names. Stop before any external connection, provisioning, migration, deployment, or write.

### Access check evidence

- Rechecked environment variable **names only** for `STAG|SUPABASE|DATABASE|POSTGRES|SSH|HOSTINGER|DEPLOY`. Only generic `SSH_ASKPASS` matched; no staging-specific variable name was found. Secret values were not inspected.
- Checked only file/directory presence: `.env.staging`, `.env.ops`, `.env.production`, `deploy/staging.env`, and `deploy/staging/` are absent. `scripts/ops/db.mjs` is present but is the previously reviewed VPS/hosted helper, not a staging target. No file contents or secret values were read.
- The earlier repository inspection remains controlling: the only checked-in app deploy path uses the production host/app and production env; the DB helper has only `vps` and `hosted` targets. Neither is a safe staging target.
- No Hostinger panel interaction, SSH, HTTP request, Supabase connection, DNS operation, provisioning, build deployment, DB query, migration, fixture creation, test execution against a live target, or persistent write was attempted. No secrets were printed.

### Protocol gates and results

| Gate | Result | Evidence / blocker |
|---|---|---|
| PLAN | 🟢 DOCUMENTED | Proposed architecture, roles, variables, migration plan, rollback and acceptance tests are in Section 16. |
| VERIFY ACCESS | 🔴 BLOCKED | No isolated staging host/project, stage-only credentials, role identities, sandbox settings, provider owner authorization, or staging deployment profile is available. |
| PROVE ISOLATION | 🟡 NOT RUN | Cannot identify a live staging host/database or demonstrate production separation without an authorized target manifest and credentials. |
| BACKUP / ROLLBACK CHECK | 🟡 NOT RUN | No staging database exists/access is available; no backup or restore point was created. |
| MIGRATION DRY-RUN | 🟡 NOT RUN | Neither migration was executed. Their embedded `BEGIN`/`COMMIT` means an assumed outer rollback is not a safe substitute for a disposable staging clone. |
| AUTHORIZED STAGING MIGRATION | 🟡 NOT RUN | No staging migration authorization can be meaningfully applied until an isolated project exists; no migration was applied anywhere. |
| E2E / REGRESSION / INDEPENDENT LIVE VERIFICATION | 🟡 NOT RUN | No live staging system exists in evidence. Prior local-only test counts in Section 9 are not staging results and are not repeated as execution evidence here. |

### Required handoff and next action

1. **Platform/cloud owner:** provision a separate application host/account, staging hostname/TLS, isolated network/identity and a redacted manifest. Do not use the production Hostinger VPS, production `/var/www/softwarevala/.env`, spare-port smoke server, or PM2 process named `softwarevala-staging`.
2. **Supabase/database owner:** create a new staging project/database, separate API keys, backup/PITR and restore rehearsal; provide the stage-only read-only catalog principal. Do not use `.env.ops`, production SSH/database access, or the current VPS/hosted DB helper targets.
3. **Application/security owner:** provision distinct test identities and role assignments in staging, plus a separate staging build/config. Demonstrate that browser bundle and server runtime point only at the staging project.
4. **Finance/product owner:** supply confirmed sandbox payment endpoints/credentials or approve payment-disabled testing, define payout test semantics, and approve synthetic fixture creation/cleanup. Never use production PayU defaults/merchant credentials or actual transfers.
5. **Change/security owner:** review the redacted manifest and independent isolation proof before authorizing read-only staging catalog checks. Provide separate explicit approval before disposable-clone migration dry-run and before persistent staging migration/data writes.

Access must not be issued merely because staging resources exist. Before the first operator connection, the independent reviewer must receive the redacted infrastructure manifest, DNS/upstream proof, runtime and client-bundle target proof, production egress denial, stage-project identity, and least-privilege catalog role grants. The reviewer must affirm each target identifier is staging-owned and not a production host, project, or secret. Migration principal access is withheld until the disposable clone and backup/restore evidence are reviewed; persistent staging writes require another explicit approval.

Until those actions are complete, there are no migration results, live test counts, RLS/grant/RPC findings, persisted metric reconciliation, backup/rollback evidence, or independent staging verification to report. **Staging implementation is BLOCKED; no GO is granted. Production remains NO-GO and untouched.**

## 18. Owner evidence review (2026-10-21)

**Mode: read-only planning.** No server, database, provider console, DNS endpoint, or payment system was contacted.

| Owner | Evidence reviewed in this task | Verified result | Status / next action |
|---|---|---|---|
| Platform/cloud owner | No staging host/account manifest, IAM export, network policy, egress-deny result, or host build identity supplied. | No new infrastructure evidence can be independently verified. The repository’s existing `softwarevala-staging` path is production, per Section 15. | 🔴 BLOCKED. Provision separate staging host/account and submit redacted signed topology plus isolation evidence. |
| DNS/network owner | No staging hostname, DNS resolution, TLS, reverse-proxy or DNS-token scope evidence supplied. | No staging DNS/upstream can be verified. | 🔴 BLOCKED. Submit DNS/TLS and upstream proof before access. |
| Supabase/database owner | No staging project reference, identity query, grants/RLS export, read-only principal, backup checksum or restore rehearsal supplied. | No database target or database privilege state can be verified. No SQL connection was attempted. | 🔴 BLOCKED. Create isolated project and provide redacted identity/catalog/least-privilege and backup/restore evidence. |
| Secret-management owner | No staging-only secret-name/presence attestation, policy, or redacted app/runtime manifest supplied. | Rechecked environment variable names only: no names matching staging, database, Supabase, or payment configuration were present; `SSH_ASKPASS` was also absent. Presence-only checks show `.env.staging`, `deploy/staging.env`, `deploy/staging/`, and `config/staging` are absent in this workspace. No secret values were read. | 🔴 BLOCKED. Create separate stage profile and provide name/policy attestation without values. |
| Application/security owner | No stage build hash, client-bundle scan, disposable role IDs, JWT/API test output, or fixture cleanup plan supplied. | No stage identity or application behavior can be verified. No tests against staging were run. | 🔴 BLOCKED. Provide stage-only build and disposable identity/test evidence after environment isolation. |
| Finance/product owner | No PayU/provider sandbox endpoint proof, egress allowlist, sandbox receipt/callback, payment-disabled decision, or payout semantics decision supplied. | No payment or payout sandbox is verified; no payment endpoint was contacted. | 🔴 BLOCKED. Supply provider-confirmed sandbox evidence or approve payment-disabled testing and keep affected E2E status unverified. |
| Migration/change owner | No staging-scoped approval, disposable-clone ID, migration review, or backup/rollback authorization supplied. | Neither migration was executed; no dry-run or rollback rehearsal exists. | 🔴 BLOCKED. Authorize disposable-clone dry-run separately from any persistent stage migration; attach clone/backup and approval evidence first. |
| Independent security reviewer | No signed target manifest, no-production-access proof, or review sign-off supplied. | Isolation and least privilege have not been independently verified. | 🔴 BLOCKED. Review all preceding owners’ evidence before any access is granted. |

### Current run record

- **Checks actually performed:** local environment-variable names only; presence-only checks of listed local staging config paths; report/worktree review.
- **Checks not performed:** server/database/provider/DNS access, backup or restore, migrations, staging writes, API/UI E2E, database/RLS/grant/RPC tests, or staging test suite.
- **Tests executed this task:** none. Previous local source test counts remain historical and do not constitute staging evidence.
- **Rollback readiness:** 🟡 NOT VERIFIED. No staging backup, restore point, or restore rehearsal exists in evidence; do not attempt migration.
- **Report validation:** this report is untracked, so `git diff --check` does not include it. Direct inspection resolved 40 of 43 path-like references; the other three (`config/staging`, `deploy/staging.env`, `deploy/staging/`) are intentionally absent paths recorded as blockers. The report has 11 intentional two-space Markdown hard breaks and no other trailing whitespace. The worktree diff check reports trailing whitespace at line 87 of the separately modified `src/components/influencer/InfluencerReferenceDashboard.tsx`; that unrelated file was not changed here. Do not treat the full-worktree whitespace check as clean.
- **Worktree:** unrelated existing changes remain untouched; no application code, migration, deployment or data was changed in this task.

**Decision:** staging remains **🔴 NO-GO** until each blocking owner supplies the evidence above and the independent reviewer verifies isolation/least privilege. Production remains **🔴 NO-GO** independently; this task grants no production access or authorization.

## 19. Blocker review and owner actions (rechecked 2026-10-21 16:21 IST)

**Scope:** review of Sections 16–18 and evidence supplied through 2026-10-21 16:21 IST. Mode remains read-only. One purported influencer credential was supplied in chat; it is not reproduced or stored and was not used. Rotation/revocation is **PENDING / NOT VERIFIED**; the owner must revoke it and provide non-secret confirmation, then issue any replacement through the approved secret manager. The supplied `softwarevala.net` URL is the production domain, not a staging host; it was not opened. The subsequent status message lists four required evidence categories but does not supply actual platform identifiers, security authorization/credential attestation/role matrix, database isolation/restore evidence, or the finance sandbox/payment-disabled decision. The shared browser attachment identifies a Hostinger page at `/vps/1917987/overview`; it is not staging evidence and was not accessed.

| Owner | Blocker | Required evidence | Verified status | Action taken | Test evidence | Next action |
|---|---|---|---|---|---|---|
| Platform/cloud owner | No staging host URL, dedicated Supabase project ref, account/network boundary, stage app host, or egress policy was supplied. | Written staging host URL and project ref in a redacted signed topology; IAM/service identities; route/security-group/egress policy; negative checks demonstrating no route or credentials to production; staging build ID. | **BLOCKED.** The supplied `softwarevala.net` login URL is production, not staging; no stage URL/project ref or isolation manifest was provided. The shared Hostinger VPS page is excluded and not inspected. | Classified the supplied URL as production based on the project context; did not visit it or provision anything. | **NOT TESTED:** host ownership, IAM, routes, egress, isolation. | Platform/cloud owner must provide a distinct staging host URL and dedicated project ref plus signed isolation manifest. |
| DNS/network owner | No staging hostname, DNS record, TLS binding, upstream mapping, or DNS token scope evidence was supplied. | DNS/TLS and reverse-proxy evidence tying approved staging hostname only to staging host; token limited to that record; auth/IP restriction and `noindex` proof. | **BLOCKED.** No staging DNS evidence supplied. | No DNS or network request made. | **NOT TESTED:** DNS resolution, TLS, upstream, token scope. | Submit redacted DNS/upstream evidence after host provisioning. |
| Supabase/database owner | No staging project identity, actual isolation proof, schema/grant/RLS export, stage-only principals, or backup/restore plan/evidence supplied. | Project ref/host matched to manifest; production-isolation proof; actual function/owner/ACL, grant, policy and dependency evidence; least-privilege inspection role; synthetic-only data declaration; written backup/restore rehearsal plan followed by authorized restore evidence on a disposable staging clone. | **BLOCKED.** The status message calls for isolation proof and a backup/restore rehearsal plan but supplies neither. No DB connection; schema, privileges, backup and restore not verified. | Did not connect or query. | **NOT TESTED:** grants/RLS/RPCs, backup, restore, migration. | Database owner provides isolation proof and plan; execute rehearsal only after written authorization and verified target. |
| Security/secret-management owner | No written staging-operation authorization, staging-only credentials, or complete disposable test identities were supplied; one purported test credential was exposed in chat. | Written scope/authorization naming staging target and allowed operations; redacted attestation of stage-only secret names/policy proving distinct keys/tokens and server-only service role; non-secret revocation confirmation for exposed credential; disposable role identity matrix and fixture cleanup process. Never supply secret values/passwords/JWTs. | **BLOCKED.** Rotation/revocation is **PENDING / NOT VERIFIED**. Local scan found only generic `SSH_ASKPASS`, no staging-specific variable names; local staging paths are absent. | Did not use or record the credential; checked local variable names and path presence only. | **VERIFIED locally:** listed paths absent and no staging-specific variable names. **NOT TESTED:** rotation, external secret store, identities, or auth. | Revoke/rotate immediately; provide non-secret confirmation and reissue any test credential only through approved secret management. Then provide written scope/authorization and role identities. |
| Application/security owner | No isolated stage build/config, deployment identity, browser target scan, or runtime target proof supplied. | Reviewed commit/build hash; separate output/config; redacted runtime manifest; bundle scan proving staging Supabase target only; server identity proof; negative production connection checks. Do not use `scripts/ops/sv-deploy.sh`. | **BLOCKED.** Existing checked-in deploy path targets production; `scripts/ops/db.mjs` exists but only supports previously reviewed VPS/hosted targets; no stage build/deployment performed. | Inspected local configuration indicators; no deploy attempted. | **NOT TESTED:** stage build/bundle/runtime or production egress denial. | Provide staging-only deployment path/artifact and target/isolation evidence. |
| Supabase/application test owner | A single purported influencer login was supplied, but no stage-project mapping, identity provenance, secure credential attestation, or remaining role identities were supplied. | Staging-only anonymous, applicant, influencer A/B; policy staff roles (`admin`, `boss`, `super_admin`, `boss_owner`, `founder`, `owner`, `marketing`); non-staff `seo`, `developer`, `finance`; protected role mapping and fixture cleanup process. Do not provide passwords/JWTs in chat/report; issue credentials through an approved secret channel. | **BLOCKED.** The account is not verified as staging-scoped and its password was exposed in chat; it must not be used until rotated/reissued securely. | Did not authenticate, save, or use the credential; no accounts or fixtures created. | **NOT TESTED:** account target, authentication, JWT/RLS/API role tests. | Rotate/revoke the exposed password. After target isolation and written authorization, provide verified identity IDs/roles and short-lived credentials through the approved secure channel. |
| Finance/product owner | No sandbox payment configuration or written payment-disabled mode approval supplied. | Provider confirmation of sandbox endpoints; redacted sandbox merchant config and outbound allowlist, or written payment-disabled decision; approved synthetic payout semantics; proof production endpoints/merchant are unreachable. | **BLOCKED.** The status message identifies these as alternatives but supplies neither. No payment endpoint contacted. | No payment or provider contact. | **NOT TESTED:** callbacks, paid-order attribution, payout provider flow. | Finance/product owner provides sandbox-only evidence or written payment-disabled approval; never use production defaults/transfers. |
| Backup/change owner | No authorized disposable-clone dry-run or persistent staging migration approval; no backup/rollback rehearsal. | Separate written approvals for read-only catalog, disposable-clone dry-run, persistent staging writes; pre-migration snapshot ID/checksum; successful restore to staging-only target; reviewed rollback plan/owner. | **BLOCKED.** Both listed migrations remain **NOT APPLIED**; dry-run/rollback not verified. | Did not run migrations or write data. | **NOT TESTED:** migration, snapshot, restore, rollback. | Prove isolation; obtain dry-run and backup approval; rehearse on clone; seek separate persistent-stage approval. |
| Independent security reviewer | No complete redacted manifest or verified isolation/least-privilege evidence supplied. | Independently review host/account, DNS/upstream, app targets, production egress denial, DB identity/grants, secret scope, backup/restore and payment separation; record each gate before access. | **BLOCKED.** Cannot approve isolation from a VPS page or local source alone. | Reviewed supplied evidence boundary; no external review evidence to assess. | **NOT TESTED:** independent isolation/security acceptance. | Review owner evidence and authorize access only after all criteria pass. |

### Verified vs. blocked vs. not tested

- **VERIFIED (local only, rechecked 16:21 IST):** `.env.staging`, `.env.ops`, `.env.production`, `deploy/staging.env`, and `deploy/staging/` are absent; `scripts/ops/db.mjs` exists but is the previously reviewed VPS/hosted helper. The env-name scan found only generic `SSH_ASKPASS`, not staging-specific names. Secret values were not read.
- **BLOCKED:** no stage-owned host, DNS, Supabase project, secret store, verified stage identity set, or sandbox evidence is available. The supplied `softwarevala.net` login URL is production and was not accessed. A purported influencer credential was exposed in chat, not used or saved, and must be rotated; completion is unverified. The supplied Hostinger VPS page is not staging evidence and was not accessed.
- **NOT TESTED (not failed):** F-2, F-4–F-9, and F-11 against an actual staging database/runtime; production-isolation probes; external environment/credential verification; database grants/RLS/RPC state; backup/restore; migrations; staging API/UI, referral, attribution, commission, earnings, payout or report flows; payment callbacks; regression suites against staging.
- **Tests executed this turn:** none. Historical local regression evidence remains **131/131 focused tests** and **4/4 auth-guard tests** as recorded in Section 9; these are not staging tests and were not rerun for this status update. No access, migration, deployment, restart, database query/write, payment request, or fixture operation was performed. No explicit staging-operation approval was supplied; no such action was attempted.
- **Report validation:** 43 path-like references were checked; 40 resolve to existing files and three intentionally absent staging paths remain blockers, with no other missing references. The audit has 11 intentional Markdown hard breaks and no other trailing whitespace. CRLF-aware `git diff --check` passed. Plain `git diff --check` still reports the previously identified trailing whitespace at `src/components/influencer/InfluencerReferenceDashboard.tsx:87`; that unrelated change was preserved.

**Decision:** **STAGING 🔴 NO-GO; PRODUCTION 🔴 NO-GO.** Do not connect to any host or database until the independent reviewer verifies the staging-owned manifest and isolation evidence. After that, obtain explicit approval for each staged read/write boundary before dry-run, migration, or acceptance testing.
