# Phase 19 Live E2E Test — Post-deployment verification

## Scope and method

- **Target:** `https://softwarevala.net` production.
- **Run date:** 2026-10-23 (UTC browser event timestamps).
- **Method:** Browser automation against the live site. Checks were limited to
  page navigation, rendered text/data, console errors, HTTP responses, and
  non-mutating controls.
- **Data safety:** No create, update, approve, payment, or other data-changing
  action was performed.
- **Session limitation:** The browser already had an authenticated session.
  No credentials were entered in this verification pass, so a fresh login flow
  was not tested.

## 1. Home Page and Control Panel

| Check | Result | Evidence |
|---|---|---|
| Home page | **PASS** | `/` returned HTTP 200; title was “Software Vala — 7,536 Software Solutions Marketplace.” No console errors, HTTP responses at or above 400, or failed requests were captured during this page navigation. |
| Control Panel page | **PASS, with warning** | `/control-panel` returned HTTP 200 and rendered “Management Console.” No console errors or HTTP responses at or above 400 were captured. A reload also recorded an aborted `HEAD` request to the Supabase `marketplace_products` endpoint (`net::ERR_ABORTED`); it did not prevent the page from rendering. |
| Fresh Super Admin login | **NOT TESTED** | The existing browser session was reused. This run does not prove credentials, login validation, or the identity/role of the current session. |

## 2. Manager Panels

| Manager / route | Opened? | Data or empty state shown | Browser errors / notes |
|---|---|---|---|
| Marketplace Manager — `/marketplace-manager?section=Dashboard` | **Yes — HTTP 200** | Dashboard rendered “6 live signals,” “1 critical,” and “61 items pending action”; approval queue and vendor/inventory signals were visible. These are UI-rendered values; this pass did not independently reconcile them to database rows. | No console errors or HTTP responses at or above 400. |
| Marketplace Manager — Products section | **Yes — navigation click succeeded** | Opened the menu, clicked **Products**, and reached `?section=Products`. The page rendered “7,566 rows in the marketplace” and the product table. | No console errors or HTTP responses at or above 400. The Products item was not clickable while its menu drawer was closed; it worked after opening the menu. |
| AMS — `/ams` | **Yes — HTTP 200** | Redirected to `/ams/overview`; Command Center and role achievement showcase rendered. | No console errors or HTTP responses at or above 400. |
| AMS — Notifications | **Yes — link click succeeded; HTTP 200** | `/ams/notifications` rendered the Notification Engine. The page showed 0 templates, 0 sent in 7 days, 0 rules, 0 channels, and “No notification template has been set up yet.” | No console errors or HTTP responses at or above 400 on reload. One server-function GET was canceled during the preceding in-app route transition; a fresh reload recorded no failed requests. |

Only Marketplace Manager and AMS were inspected in this pass. Other manager
panels from the broader requested list are **NOT TESTED** here.

## 3. Non-mutating control checks

- Marketplace Manager’s **Open menu** and **Products** navigation worked.
- AMS **Notifications** navigation worked.
- The AMS **Channel** filter opened a menu containing **All**; selecting it
  closed the menu and preserved the empty state.
- AMS **Export**, **Prev**, and **Next** were disabled because the page showed
  zero notification templates. Their enabled/data-bearing behavior was not
  tested.
- No create/edit/approve/payment controls were exercised because they could
  modify production data.

## 4. Role assignment and security

The deployment-time read-only database verification recorded exactly one
`super_admin` assignment, belonging to the owner; the test Admin account
remained `admin`, and the Marketplace test account had `marketplace-user`.
Other test accounts retained their specific roles. The owner-only role guard
and role correction migration were applied to `sv_platform`.

**Live role-login check: NOT TESTED in this browser pass.** The test Admin and
other test accounts were not signed in, and no attempt was made to access the
Control Panel as those accounts. Therefore the database role state is verified
from deployment checks, but post-deployment UI role presentation and
role-based route denial were not independently re-exercised here.

## 5. Console and network errors

- No JavaScript console errors were captured on the tested page loads.
- No HTTP responses with status 400 or higher were captured on the tested
  pages.
- A Control Panel reload recorded an aborted `HEAD` request to
  `https://nosnfgbcgeybwjgnwlzh.supabase.co/rest/v1/marketplace_products?...`
  (`net::ERR_ABORTED`). The page continued rendering; the cause was not
  established.
- An AMS server-function GET was canceled during SPA navigation. A subsequent
  full reload had no failed requests.
- No 404 response was captured in this verification pass.

## 6. Deployment evidence and remaining work

Deployment evidence from the release operation:

- VPS source was advanced to commit
  `511914fc7b7f69b2ed92e84061a78e64642fdd51` on
  `deploy/auth-security-fixes-20261022`.
- `softwarevala-staging` was online after deployment; production HTTP checks
  returned 200.
- The Marketplace URL parsing fix is present in the deployed release. The
  Marketplace Manager dashboard and Products section loaded without the
  reported invalid-URL error in this run.
- The role-assignment migration was applied to `sv_platform`, not the
  `softwarevala` database.

Remaining verification:

1. Reauthenticate with authorized test accounts and verify their displayed
   roles and Control Panel denial; this report does not claim that login test.
2. Inspect the aborted Supabase `HEAD` request to determine whether it is an
   unnecessary prefetch or an application request that needs correction.
3. Test all other manager panels and role dashboards; they were outside this
   focused post-deployment pass.
4. Exercise write actions only in an approved non-production test environment.
5. AMS Notifications is empty in the live UI; no notification templates or
   channels were visible.

## Validation caveat

An unrelated VS Code test-runner invocation in the main workspace reported
1,987 passed and 2 failed tests: `src/lib/i18n/__tests__/messages.test.ts`
failed while invoking its command, and
`src/lib/i18n/__tests__/pipeline.test.ts` expected the Hindi title
“Software Vala भाषा” but received `null`. Those failures were not investigated
or attributed to this release; they are not live-browser results.
