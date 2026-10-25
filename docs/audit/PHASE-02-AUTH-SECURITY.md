# Phase 02 — Authentication and Authorization Security Audit

**Audit date:** 2026-10-22
**Scope:** Repository auth/session/RBAC code and read-only production metadata from VPS database `sv_platform`.
**Changes made:** This audit document only. No application source, tests, production data, or database schema was changed. No test identities were created.

## 1. Status legend

| Status | Meaning |
|---|---|
| **GREEN: Verified** | Confirmed by inspected code or read-only production query. This does not imply an end-to-end user-flow test unless stated. |
| **ORANGE: Finding** | A concrete weakness or risky configuration is visible in source or production metadata. |
| **YELLOW: Not tested** | Requires a test account, browser session, external provider, or a mutation that was out of scope. |
| **RED: Confirmed exploitable** | Reproduced safely against the actual target. No live exploit was attempted in this audit. |

## 2. Executive result

- **YELLOW:** No valid/invalid credential login, signup, duplicate signup, logout, password reset, token-expiry, or browser-cookie flow was executed.
- **GREEN (source):** The login UI validates empty email/password; the auth middleware rejects missing, malformed, and unverifiable bearer tokens.
- **ORANGE (source defect):** A repository migration defines `handle_new_user()` to copy `raw_user_meta_data.role` into `user_roles` ([20260902035917_c4286b03-2fd3-46f8-b0e5-1c5f7aada6ea.sql:274-287](../../supabase/migrations/20260902035917_c4286b03-2fd3-46f8-b0e5-1c5f7aada6ea.sql)). If that definition is applied, signup metadata can grant a caller-selected enum role.
- **GREEN (production snapshot):** Read-only inspection of `sv_platform` found a different `handle_new_user()` implementation that does not assign a role from metadata. This specific signup-role defect was **not present in the function definition inspected live**; migration/trigger drift remains a deployment risk.
- **ORANGE (production bootstrap condition):** The live `bootstrap_first_admin()` trigger grants `admin` if there are no role rows and at most one auth user. This is a one-time bootstrap condition, not proof of current exploitability; the function was inspected, but no signup was attempted.
- **GREEN (production metadata):** RLS is enabled on the 15 inspected relations. Effective policy composition and row-level behavior were not tested with authenticated identities.
- **YELLOW:** No role-forgery, direct API call, cross-user access, or browser local-storage/cookie tampering test was run.
- No automated permission tests were added or executed because the explicit rule prohibited source changes and production mutations.

## 3. Authentication and session flow review

| Flow | Evidence in source | Status / limits |
|---|---|---|
| Empty login | `CanonicalLogin.tsx:148-155` rejects blank trimmed email or password before calling Auth. The alternate `/auth` route uses form-required controls (`auth.tsx:114-153`). | **GREEN (source only).** No browser submission was run. |
| Valid/invalid login | `CanonicalLogin.tsx:158-181` uses `signInWithPassword`, displays an error on failure, and routes after success. `/auth` also calls `signInWithPassword` (`auth.tsx:89-92`). | **YELLOW:** No credentials or login request was supplied; valid and invalid cases not executed. |
| Registration | `/auth` calls `signUp` with email, password, display name, and redirect URL (`auth.tsx:78-87`). It does not include a `role` field in its own UI payload. | **YELLOW:** No new or duplicate account attempted. A caller can construct a request that differs from this UI; see finding 1. |
| Logout | `auth-bridge.ts:88-100` clears a legacy browser value and calls `supabase.auth.signOut()`, propagating an error. | **GREEN (source call), YELLOW (effect):** No live session was available to verify refresh-token revocation or already-issued access-token behavior. |
| Password reset | `CanonicalLogin.tsx:199-205` calls `resetPasswordForEmail()` and redirects to `/login`. | **YELLOW:** No reset email was requested. Token generation, expiry, recovery-link handling, and provider settings are not established by this code. |
| Session storage/refresh | `integrations/supabase/client.ts:51-55` sets `persistSession: true` and `autoRefreshToken: true`; `previewAuthStorage.ts:1-8,35-40` selects storage behavior for preview contexts. | **GREEN (configuration source), YELLOW (browser behavior):** No storage mutation or browser inspection was run. |
| Server token validation | `integrations/supabase/auth-middleware.ts:52-105` requires an Authorization bearer header, checks JWT shape, calls `getClaims(token)`, and requires `claims.sub`. | **GREEN (source).** No expired, forged, or revoked token was submitted. This middleware authenticates; it does not itself authorize a role. |
| Cookies / CSRF | The inspected client persists the Supabase session through its configured storage; no application-managed HttpOnly cookie is evidenced in the reviewed auth path. `start.ts:23-26` configures CSRF middleware for server functions. | **YELLOW:** Cookie attributes, browser cookie behavior, and live CSRF enforcement were not tested. |

## 4. Role-by-role matrix

The production `public.app_role` enum returned 24 labels in the read-only query documented below. The page column means a route rule in the current repository’s `RouteAccessGate.tsx`, not a claim that the deployed frontend is on this exact revision or that every endpoint was enumerated. **“Operator”** for client routes means the five-role `RequireRole` bypass (`boss`, `boss_owner`, `admin`, `super_admin`, `founder`; `RequireRole.tsx:13-15`). Server helpers use different allowlists; those differences are called out.

| Role (production enum) | Allowed page surfaces visible in code | API/server authorization evidence | Live RLS / behavior |
|---|---|---|---|
| `admin` | Operator-only pages, Control Panel, manager, task manager, and other guarded routes | Admitted by `requireOperator`; role-management policy permits admins to manage `user_roles` ([20260809100007_0d3a5b09-2f33-4853-a346-e387fde9ee57.sql:31-33](../../supabase/migrations/20260809100007_0d3a5b09-2f33-4853-a346-e387fde9ee57.sql)) | **YELLOW:** RLS enabled on inspected tables; no role-authenticated behavior test |
| `boss` | Operator-only pages and guarded task/control surfaces | Admitted by `requireOperator`; `dev-manager.functions.ts:25-47` has a separate operator list | **YELLOW** |
| `founder` | Operator-only pages and guarded task/control surfaces | Admitted by `requireOperator`; also in Developer Manager’s five-role guard | **YELLOW** |
| `super_admin` | Operator-only pages and guarded task/control surfaces | Admitted by `requireOperator`; production `user_roles` SELECT policy also names `super_admin` | **YELLOW** |
| `boss_owner` | Operator-only pages and guarded task/control surfaces | Admitted by `requireOperator`; also in Developer Manager’s five-role guard | **YELLOW** |
| `developer` | Developer dashboard, Bidding, Task Manager, Vala AI, marketplace recovery, AMS, selected operational routes | Bidding functions check developer/operator role and active developer task membership (`bidding/core.functions.ts:59-75`); task service uses task-staff checks (`task-service.functions.ts:82-90`) | **YELLOW:** RLS policies inspected for task/bid tables; no account-based cross-user test |
| `employee` | No explicit employee-only route found in the route list; operator-only server APIs may admit employee | `requireOperator` includes `employee` (`require-operator.server.ts:16-27`); Developer Manager does not | **YELLOW** |
| `vendor` | Vendor Manager route | Route rule `RouteAccessGate.tsx:65-69`; seller-specific server authorization must be checked per endpoint | **YELLOW** |
| `author` | Author routes are outside the inspected route-prefix matrix; author APIs have dedicated guards | Existing author guard tests are in `marketplace/__tests__/author-guard.test.ts:56-91`; no complete endpoint inventory here | **YELLOW** |
| `affiliate` | Affiliate Manager route | No all-API inventory or per-endpoint test in this audit | **YELLOW** |
| `influencer` | Influencer Manager route and influencer dashboard mapping | No all-API inventory or per-endpoint test in this audit | **YELLOW** |
| `reseller` | Reseller Manager route | No all-API inventory or per-endpoint test in this audit | **YELLOW** |
| `franchise` | Franchise Manager route | Tenant RLS migration defines owner/member/staff scoping (`20260919080000_franchise_tenant_access.sql:26-45,68-108`); production row behavior not tested | **YELLOW** |
| `seo` | SEO Manager, Keywords, Pages, Marketplace Manager | `requireOperator` can admit SEO only when an endpoint explicitly lists it in `alsoAllow`; test evidence in `server-fn-callers.test.ts:54-63,82-95` | **YELLOW** |
| `marketing` | Application Manager, SEO Manager, Marketplace Manager, Keywords, Pages | Same per-handler `alsoAllow` pattern; no general server operator grant | **YELLOW** |
| `sales` | Sales CRM, Sales workspace, Task Manager, Sales Support Manager | Sales workspace functions require sales role or manager (`sales-support/core.functions.ts:99-120`); `requireOperator` also includes sales | **YELLOW** |
| `finance` | Control Panel, Manager, Finance Manager, selected support/partner pages | Admitted by Control Panel role list; `requireOperator` includes finance | **YELLOW** |
| `support` | Control Panel, Sales/Support workspace, Support Agent/Operations, Chat Manager, Task Manager, AMS | Support workspace functions check support role or manager (`sales-support/core.functions.ts:99-120`); `requireOperator` includes support | **YELLOW** |
| `customer` | No privileged manager route explicitly grants this role | Not admitted by `requireOperator`; negative test exists (`server-fn-callers.test.ts:65-74`) | **YELLOW:** test source exists; not run here |
| `marketplace-user` | No privileged manager route explicitly grants this role | No general operator access visible | **YELLOW** |
| `sales_support_manager` | Control Panel, Sales/Support workspaces, Sales CRM, lead/sales-support manager surfaces | Included in Control Panel and `requireOperator` allowlists; Sales/Support server functions treat configured manager roles specially | **YELLOW** |
| `client` | No privileged manager route explicitly grants this role | No general operator access visible | **YELLOW** |
| `legal` | No explicit route/API allowlist found in inspected route matrix | No general operator access visible | **YELLOW** |
| `finance_manager` | Control Panel, Sales/Support workspaces, Support Operations, Chat Manager | Explicitly listed in route rules; **not** in `requireOperator`’s base set. Control Panel route admits it, but cockpit API role list does not (`RouteAccessGate.tsx:25-29`; `control-panel/cockpit.ts:15-25`; `control-panel/access.server.ts:13-27`). | **YELLOW / ORANGE mismatch** |

### Role boundary caveats

- `RequireRole` checks roles in the browser and is a UI gate, not a substitute for server authorization (`RequireRole.tsx:23-50`).
- The route gate passes paths not matched by `PROTECTED` through (`RouteAccessGate.tsx:174-196`). This audit did not enumerate every file route or every API endpoint; “not explicitly listed” does not mean public access.
- Server-side operator roles differ: `requireOperator` admits ten roles (`require-operator.server.ts:16-27`), the shared route component’s operator bypass admits five (`RequireRole.tsx:13-15`), and Developer Manager admits five (`dev-manager.functions.ts:25-47`). A visible page and its API can therefore differ; verify each handler rather than relying on hidden navigation.
- The Control Panel route rule admits `finance_manager` (`RouteAccessGate.tsx:25-29`), while its cockpit handler checks `COCKPIT_ROLES` (`control-panel/access.server.ts:13-27`) and that list omits `finance_manager` (`control-panel/cockpit.ts:15-25`). **ORANGE: MEDIUM availability/authorization mismatch**—a finance-manager user may reach the page but have its cockpit API refused. This was not exercised with a finance-manager JWT.
- Example positive server guards: all exported Developer Manager handlers call `requireDevManager` before admin-client operations (`dev-manager.functions.ts:52-54,62-64,79-91,104-115,121-133,146-157,163-175,181-183,190-202,215-226,244-249,324-327`); Control Panel API routes call `controlPanelCaller` (`routes/api/control-panel/cockpit.ts:19`, `feed.ts:23`, `partners.ts:42`).

## 5. Production RLS and database evidence

### Read-only verification performed

The following read-only catalog queries were executed against the configured VPS URL; the database returned `current_database() = 'sv_platform'`. Each query ran within `BEGIN READ ONLY` and ended with `ROLLBACK`. No rows were selected from business tables.

```sql
SELECT t.tablename, t.rowsecurity, c.relforcerowsecurity
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
JOIN pg_namespace n ON n.oid = c.relnamespace
                 AND n.nspname = t.schemaname
WHERE t.schemaname = 'public'
  AND t.tablename IN (
    'user_roles', 'audit_logs', 'developers', 'developer_tasks',
    'tm_tasks', 'tm_activity', 'leads', 'lead_activities',
    'sales_leads', 'sales_deals', 'sales_quotes',
    'support_tickets', 'support_replies', 'task_promises', 'tm_task_bids'
  )
ORDER BY t.tablename;
```

**Observed:** all 15 relations reported `rowsecurity = true`; none had `FORCE ROW LEVEL SECURITY` enabled. Policies were read from `pg_policies`; `user_roles` has self-role SELECT, `super_admin` SELECT, admin ALL, and an anon-deny policy. Production role grants for `anon` or `authenticated` on the selected business relations produced no rows in `information_schema.role_table_grants`. This is metadata, not a proof that every service role, inherited privilege, RPC, or column grant is safe.

Selected observed policies:

| Relation | Production policy evidence | Limitation / risk |
|---|---|---|
| `user_roles` | Self SELECT, `super_admin` SELECT, admin ALL, anon denied | Admin role assignment remains highly privileged. Signup behavior depends on trigger function and bootstrap state. |
| `developers` | Own-profile SELECT plus operator SELECT | No cross-user identity test; service role bypasses RLS. |
| `developer_tasks` | Developer own-task SELECT and UPDATE; operator SELECT; admin/boss reviewer UPDATE | UPDATE row policy is not column-scoped in the observed definition. **ORANGE: MEDIUM review priority** because row ownership alone does not establish which task fields may be changed. Actual exploitability is untested and may be constrained by triggers/server paths. |
| `tm_tasks` / `tm_activity` | Member/operator task reads, member UPDATE policy, scoped activity read/insert; anon denied | Broad table update privileges were not behavior-tested as an authenticated member. |
| `tm_task_bids` | Bidder/operator SELECT policy; RLS enabled | No other authenticated client table grants were reported; application writes use server functions. No unauthorized direct-call test performed. |
| `leads` / `lead_activities` | Assigned-user or manager read/update scope; activities scoped through assigned lead | RLS enabled; no two-agent test identity was used. |
| Sales tables | Manager or owned team-member read policies | RLS enabled; write authorization was not tested with authenticated identities. |
| Support tables | Manager or assigned support-agent reads; replies scoped through assigned ticket | RLS enabled; assignment/cross-agent behavior not tested. |
| `audit_logs` | Authenticated SELECT limited by operator or actor; INSERT/UPDATE/DELETE deny policies observed | RLS is enabled. This audit did not inspect all triggers or prove tamper-evidence across every write path. |
| `task_promises` | Developer/manager/finance-manager read scope | RLS enabled; no payment or promise mutation was run. |

Production enum evidence query:

```sql
SELECT e.enumlabel AS role
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public' AND t.typname = 'app_role'
ORDER BY e.enumsortorder;
```

It returned the 24 roles in the matrix. No account was impersonated, and no row-level test query was run under a developer, manager, support, or sales JWT.

Production policy query:

```sql
SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'user_roles', 'audit_logs', 'developers', 'developer_tasks',
    'tm_tasks', 'tm_activity', 'leads', 'lead_activities',
    'sales_leads', 'sales_deals', 'sales_quotes',
    'support_tickets', 'support_replies', 'task_promises', 'tm_task_bids'
  )
ORDER BY tablename, policyname;
```

Production signup function and trigger query:

```sql
SELECT p.oid::regprocedure AS function_name, pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('handle_new_user', 'bootstrap_first_admin', 'chat_provision_new_user');

SELECT tgname, pg_get_triggerdef(t.oid)
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'auth' AND c.relname = 'users' AND NOT t.tgisinternal
ORDER BY tgname;
```

The live `handle_new_user()` definition inserts a profile and returns the new row; it does not assign an authorization role. The live `bootstrap_first_admin()` function assigns `admin` only if `user_roles` is empty and `auth.users` contains at most one row. The live trigger query returned the profile trigger, bootstrap trigger, and chat provisioning trigger. Current bootstrap eligibility could not be checked because the database connection was denied access to the `auth` schema.

Production grant query:

```sql
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'user_roles', 'leads', 'lead_activities', 'sales_leads',
    'sales_deals', 'sales_quotes', 'support_tickets',
    'support_replies', 'tm_task_bids'
  )
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;
```

It returned no rows for those role/table pairs. This view result alone does not exclude privileges inherited through other grants or access mediated by functions with elevated rights.

## 6. Failed cases and security flags

### Finding 1 — Signup role can be sourced from caller metadata in a repository migration

**Severity: HIGH (source/deployment risk); live exploitability: not confirmed.**

Migration `supabase/migrations/20260902035917_c4286b03-2fd3-46f8-b0e5-1c5f7aada6ea.sql:274-287` defines `public.handle_new_user()` to insert:

```sql
VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data ->> 'role')::public.app_role, 'customer'))
```

The sign-up form only sends `full_name` (`src/routes/auth.tsx:78-87`), but this does not constrain requests made directly to the Auth signup endpoint. If this migration definition becomes active, a caller can request a valid role value in signup metadata. That role is consumed by role-based authorization (`RequireRole.tsx:13-50`, `require-operator.server.ts:39-67`).

**Live qualification:** the read-only production definition of `public.handle_new_user()` on `sv_platform` inserts a profile and does not insert a role from metadata. The live trigger list showed `on_auth_user_created`, `on_auth_user_created_bootstrap_admin`, and `zz_chat_provision_user`. Thus this specific metadata role assignment was absent from the function inspected at audit time. No signup was submitted. **Do not treat the vulnerable migration as safe to apply/reapply.**

### Finding 2 — First-user admin bootstrap is a conditional trust boundary

**Severity: MEDIUM; current exploitability: not established.**

Production’s `bootstrap_first_admin()` trigger body returns early if `user_roles` contains a row or `auth.users` contains more than one row; otherwise it inserts the new user with `admin`. Its trigger is installed on `auth.users`. This may be an intentional bootstrap mechanism, but an uninitialized or manually cleared role table makes the first signup an administrator. The function body and trigger were read-only inspected; no signup or role-table change was performed. A read-only aggregate intended to verify whether the bootstrap condition is currently true was denied access to the `auth` schema, so current eligibility is **YELLOW: Not tested**.

### Finding 3 — Developer task update policy is row-scoped, not visibly column-scoped

**Severity: MEDIUM; exploitability: not tested.**

The production `developers_update_own_tasks` policy has both `USING` and `WITH CHECK` expressions requiring a linked developer row for `auth.uid()`, but it does not list allowed columns. A policy is a row boundary; it does not by itself ensure developers can change only harmless fields. Inspect table grants, triggers, and permitted update columns, then test in a disposable database using a developer JWT. No production UPDATE was attempted.

### No reproduced live bypasses

No bypass attempt was executed. The following are **YELLOW: Not tested**, not failed reproduction results:

- Developer calling a manager-only API with a real developer JWT.
- User A reading User B’s task, lead, ticket, bid, or profile data.
- Forged local storage or browser cookies.
- Unauthenticated direct calls to every protected route/API.
- Role metadata supplied directly during registration.

### Finding 4 — Control Panel route/API role lists disagree

**Severity: MEDIUM (authorization consistency / availability); live behavior not tested.**

The route gate admits `finance_manager` to `/control-panel`, but the cockpit API checks `COCKPIT_ROLES`, which does not include that role. Exact evidence: `src/components/auth/RouteAccessGate.tsx:25-29`, `src/lib/control-panel/access.server.ts:13-27`, and `src/lib/control-panel/cockpit.ts:15-25`. This is not evidence that an unauthorized person can read cockpit data; the observed mismatch is that a route-authorized role may be rejected by the API. No JWT call was made.

## 7. Automated permission test coverage

Existing test evidence found:

- `src/lib/auth/server-fn-callers.test.ts:40-74` tests `requireOperator` for signed-out, operator, explicitly permitted roles, and customer refusal.
- `src/lib/auth/server-fn-callers.test.ts:76-99` checks selected service-role server-function callsites for an authorization guard.
- `src/lib/auth/internal-guard.test.ts:21-45` tests a narrower operator set and denial cases.
- `src/lib/auth/internal-path.test.ts:5-25` covers safe post-login redirect paths.
- `src/lib/marketplace/__tests__/author-guard.test.ts:56-91` tests selected author endpoint rules.

No existing test was found that exercises a forged signup `raw_user_meta_data.role`, performs a real protected route/API request as a developer, or checks cross-user database rows under two different JWTs.

**Tests run for this audit: 0. Tests added: 0.** Automated permission tests were not added because the higher-priority rule said not to modify source code. Existing test files were inspected but not executed. A reliable percentage of total repository RBAC coverage cannot be calculated from these selective tests. For this audit checklist, **5/5 auth-flow categories were source-reviewed (100% source review); 0/5 were executed against live accounts (0% live execution).** This is a checklist measure, not a code coverage percentage.

## 8. Recommended fixes and safe next steps

1. **Before any migration replay/deployment:** replace the metadata-based role assignment with a server-controlled `customer` assignment, and require a separately authorized admin workflow for privileged roles. Add a regression test that submits `role: "admin"` metadata and confirms the assigned role remains nonprivileged.
2. Confirm and document the intended first-user bootstrap procedure. Restrict it to an out-of-band owner-controlled setup if possible; verify it cannot be re-enabled by deleting role rows.
3. Review developer task column privileges and triggers. Explicitly allow only intended developer-editable columns; test status, assignee, payment, verification, and ownership fields with a disposable developer account.
4. Add non-production integration tests for developer-vs-manager direct API calls and User A-vs-User B RLS cases on tasks, leads, support tickets, bids, profiles, and audit records.
5. Verify production reset-email provider configuration and expiry/recovery behavior in a test Auth project; do not send reset messages to real users for audit purposes.
6. Keep server authorization checks on every service-role-backed handler. Treat route guards and hidden UI as presentation only.
7. Compare deployed function/policy definitions with migration history before applying historical migrations. Production `handle_new_user()` already differs from the risky repository migration definition.

## 9. Verification boundaries

- Production connection was read-only and confirmed as `sv_platform`; no command targeted the `softwarevala` database.
- The live database inspection read catalog metadata, role labels, policies, grants, trigger definitions, and function definitions only.
- No business data was read; no data was inserted, updated, or deleted.
- No valid or invalid login attempt, signup, duplicate signup, password reset, logout, direct endpoint call, role spoof, cookie/local-storage mutation, or JWT expiry test was performed.
- UI/API coverage is partial: representative route guards and high-impact server authorization helpers were traced. This is not an exhaustive inventory of all application endpoints, all table policies, external providers, or deployed frontend behavior.
- Production frontend revision and browser behavior were not authenticated or verified during this audit.

## 10. Test coverage percentage

| Measurement | Result |
|---|---:|
| Requested auth-flow categories inspected in source (login, logout, registration, reset, token/session) | **5/5 = 100% source review** |
| Requested auth-flow categories executed against a live account/provider | **0/5 = 0% live execution** |
| Role enum labels confirmed by production catalog query | **24/24 returned** |
| Per-role authenticated route/API behavior tested live | **0/24 = 0%** |
| Production selected-table RLS-enabled flags inspected | **15/15 = 100% metadata inspection** |
| Cross-user / role-boundary RLS behavior tested with JWTs | **0 cases** |
| Automated tests run or added in this audit | **0 / 0** |

These percentages describe this audit’s checklist execution, not repository-wide code coverage.
