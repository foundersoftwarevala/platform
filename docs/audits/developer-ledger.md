# Developer ecosystem ledger

Scope: Developer Management (`/dev-manager`, DMFullLayout and its 17 screens)
and the Developer Dashboard (`/dashboard/developer`, generic role dashboard),
plus every module they hand work to. The existing UI is the specification: the
work below connects it to real data and real actions, it does not redesign it.

Opened 2026-10-02. Evidence: source in the working tree, read-only SQL on
sv_platform (counts and catalog only), plain GETs to the live site. One
rolled-back transaction on sv_platform proved the self-update findings (DEV-SEC-1
to DEV-SEC-3) before and after the fix.

Statuses: FIXED (code or migration in the repo, not yet live), VERIFIED (proven
live), OPEN, MISSING, DISCONNECTED, NEEDS-OWNER, BLOCKED, PRE-EXISTING,
UNVERIFIED.

## Correction to the starting premise

The browser `supabase` client is not the wrong database in production. The
live bundle (`/assets/client-*.js`) is built with
`VITE_SUPABASE_URL = https://softwarevala.net`, so browser reads and writes go
to the VPS PostgREST with the user's token under VPS row-level security. Only
the local `.env` points at the hosted project. Browser paths below are
classified by their VPS policies, not as "wrong DB".

## Real data today (sv_platform, 2026-10-02)

| What | Count |
|---|---|
| Users holding the developer role | 15 |
| `developers` rows | 1 (14 developer-role users have none) |
| `developer_tasks` | 10, all with `developer_id` NULL, no deadline, no amount; all 10 carry `tm_task_id` |
| `tm_tasks` / with `assigned_to` | 30 / 0 |
| `tm_members` | 0 |
| `developer_code_submissions`, `developer_messages`, escalations, internal notes, activity logs | 0 each |
| `promises`, `promise_links` | 0 |
| Notifications addressed to a developer | 0 |
| Projects / requirements tables | none exist |

## Lifecycle chain

| Arrow | Status | Evidence |
|---|---|---|
| Lead → Requirement | PARTIAL | only `leads.requirements` free text |
| Requirement → Project | MISSING | no projects table; `tm_tasks.project_name` text, 0 of 30 filled; a won lead only sets `closed_at` (`lib/lead-manager/api.ts:805`) |
| Project → Developer | MISSING | no project entity |
| Developer → Task | DISCONNECTED in data | FKs exist (`developer_tasks.developer_id`, `tm_tasks.assigned_to → tm_members`), but 0 members and 0 assigned tasks |
| Task → Chat | DISCONNECTED | `developer_messages` (FK to task) has no reader or writer in `src`; chat uses `conversations` with a free-text `reference_code` |
| Task → Assist | PARTIAL | `assist_sessions.task_id` uuid, no FK, 0 rows |
| Task → Promise | PARTIAL | `promise_links` + `tm_task_completion_to_promises` trigger; 0 links |
| Task → Progress | CONNECTED (DB) | `tm_sync_to_developer_task` / `tm_sync_from_developer_task` |
| Progress → Review/QA | PARTIAL | two unlinked review stores: `developer_code_submissions` and `tm_reviews` |
| Review → Approval | PARTIAL | `review_developer_submission` sets completed; no approval record |
| Approval → Payment | MISSING | no developer payout table; `partner_kind` has no developer; `finance_payouts` keyed by name text |
| → Performance | PARTIAL | AMS triggers exist; 0 developer events |

## Findings

### Security and data integrity

| ID | Where | Finding | Status |
|---|---|---|---|
| DEV-SEC-1 | `developer_tasks` policy `developers_update_own_tasks` | A developer could update every column of their own task: set `task_amount`, and set `status='completed'` without review. The mirror trigger then carried "completed" into `tm_tasks` past `tm_enforce_transition` (depth 2) and settled linked promises. Proven in a rolled-back transaction: "set own task_amount ALLOWED", "status -> completed ALLOWED". | FIXED in migration `20261107T230000_developer_tasks_self_update_guard.sql` (trigger: developers keep progress fields and statuses accepted…submitted; assignment, scope, money and terminal statuses stay with operators, service key and the Task Manager sync). Rolled-back trial: amount, completion and unassign BLOCKED; progress, in_progress, submitted, service key and mirror still ALLOWED. APPLIED AND VERIFIED LIVE (2026-10-02, authorized by the owner) — see "Production security migration" below |
| DEV-SEC-2 | `developer_code_submissions` policy `developers_insert_own_submissions` | `review_status` unconstrained: a developer could insert a submission already "approved". Proven: ALLOWED before. | FIXED in the same migration (must start unreviewed); trial BLOCKED after, normal submission ALLOWED. APPLIED AND VERIFIED LIVE (2026-10-02, authorized by the owner) |
| DEV-SEC-3 | `pt_task_completed`, `pt_notify`, `tm_run_automations` | SECURITY DEFINER, no caller check, executable by `authenticated`: anyone signed in could fulfil every promise linked to any task, or send any notification text to managers and admins. Proven: all three ALLOWED before. | FIXED in the same migration (EXECUTE revoked from public/anon/authenticated; all callers are postgres-owned definer functions; no app code calls them). Trial: permission denied after. APPLIED AND VERIFIED LIVE (2026-10-02, authorized by the owner) |
| DEV-SEC-4 | `tm_tasks_member_update`, `tm_reviews_write`, `tm_approvals_write` | An assignee can edit billing fields (`cost`, `billing_status`, `payment_reference`, `settled_at`) and review/approve their own task; any signed-in user can write reviews/approvals on pool tasks. Not exploitable today (0 members). Task Manager owns these tables. | OPEN (policy text; Task Manager scope) |
| DEV-SEC-5 | `promises` RLS, `pt_is_manager()` | employee, sales, support, finance, sales_support_manager can UPDATE `tip_amount`, `fine_amount` and their statuses directly, bypassing `pt_apply_fine` / `pt_release_tip`. Who may set money is business policy. | NEEDS-OWNER |
| DEV-SEC-6 | `tm_members` RLS | every signed-in user can read all members (emails); members can update their own `role`. | OPEN (Task Manager scope) |
| DEV-SEC-7 | `developer_activity_logs` policy `developers_insert_own_activity` | a developer can write their own activity rows (self-forgeable trail). No app code writes them as a developer. | OPEN (low) |
| DEV-SEC-8 | `/dev-manager` gate vs server | The route admits role `developer` (`dev-manager.tsx:67`, `RouteAccessGate.tsx:96`); every server function refuses it (`dev-manager.functions.ts:45`). The developer dashboard's Command Center and Performance modules send developers there. Which surface a developer should land on is an owner decision. | NEEDS-OWNER |
| DEV-SEC-9 | `review_developer_submission` | Only admin/boss can approve; founder, super_admin, boss_owner see the queue but are refused. Review decisions write `developer_activity_logs`, not `audit_logs`. | NEEDS-OWNER (who reviews) / OPEN (audit) |

### Developer Management (`/dev-manager`)

| ID | Where | Finding | Status |
|---|---|---|---|
| DEV-DM-0 | `dev-manager.server.ts` writeAudit / loadAuditTrail (committed code = production) | Writes `module`, `user_id`, `meta_json` and reads `module, user_id, role, meta_json, timestamp`; the live `audit_logs` has `entity_type, entity_id, actor, metadata, occurred_at, severity, ip`. On production every Dev Manager mutation makes its change and then throws "Audit log write failed" (the screen reports a failure for a change that happened), and Audit Logs cannot load. sv_platform holds 0 `dev_manager.*` audit rows. | FIXED_LIVE (aa9184b, verified on production 2026-10-03) — FIXED in the working tree by the other session's uncommitted change (not this audit's edit); DEV-DM-1 and DEV-DM-2 build on it. Not deployed |
| DEV-DM-1 | `dev-manager.functions.ts` | Every mutation except onboarding passed `userId = null`: audit actor fell back to a client-supplied label; `assigned_by`, `escalated_by`, note `author_id` stored NULL. | FIXED_LIVE (aa9184b, verified on production 2026-10-03) — the verified caller id from `requireDevManager()` goes to reassign, escalate, escalation update, internal note and status change (`setDeveloperStatusInDb` gained a `userId` parameter). Auto-escalation on the overview read stays a system action |
| DEV-DM-2 | `DMAuditLogs.tsx:26-32` | Module filter values (`dev_manager`, `escalations`, `tasks`, `auth`) never equalled a real `entity_type` (`dev_manager.tasks`, …, `developer_management`), so every filter returned 0. | FIXED_LIVE (aa9184b, verified on production 2026-10-03) — FIXED in `loadAuditTrail` (server maps each option to the real values; the dropdown is unchanged). `auth` still matches nothing: no module writes an auth audit row (OPEN) |
| DEV-DM-3 | `DMDeveloperRegistry.tsx` Assign | Browser INSERT into `developer_tasks` that RLS always refused, which would otherwise have created "Task assigned to <uuid>" junk tasks. | FIXED_LIVE (aa9184b, verified on production 2026-10-03) — picks an open task and moves it to this developer through the audited `reassignTask` server function (same path as Task Management) |
| DEV-DM-4 | Registry Suspend | Called the server and also wrote a second browser audit row with a hardcoded "active → suspended" and a success toast before the server answered. | FIXED_LIVE (aa9184b, verified on production 2026-10-03) — the duplicate log and early toast removed; the server result toasts |
| DEV-DM-5 | Registry Escalate | Writes an audit row only but said "Management has been notified". | FIXED_LIVE (aa9184b, verified on production 2026-10-03) — message now says it is recorded in the audit trail. No escalation record or notification exists for a developer-level escalation (OPEN) |
| DEV-DM-6 | Registry View | Toast "Developer profile loaded" with nothing shown. | FIXED_LIVE (aa9184b, verified on production 2026-10-03) — shows the developer's real record (status, onboarding, load, skills, joined) |
| DEV-DM-7 | `DMTaskManagement.tsx:62-63` | Reassign picker compared names with the row's Vala ID, so the current assignee was never excluded. | FIXED_LIVE (aa9184b, verified on production 2026-10-03) — compared by developer id |
| DEV-DM-8 | `DMTaskManagement.tsx:137` | "Title / " trailing slash on every task. | FIXED_LIVE (aa9184b, verified on production 2026-10-03) — FIXED |
| DEV-DM-9 | `developer_tasks` columns | Code reads `blocked_since`, `blocked_reason`, `escalate_threshold_hours`, `quality_score`, `promise_id`; none exist. Blocked tasks never show, blocked auto-escalation never fires, "AI Quality Score" always "—", promise link dead. | OPEN (schema decision: add the columns or drop the features) |
| DEV-DM-10 | Alerts & Escalation | `overview.escalations` loaded but not rendered; no UI to acknowledge/resolve an escalation or add an internal note (components orphaned in `src/components/dev-manager/`). | FIXED_LIVE (aa9184b, verified on production 2026-10-03) — Alerts lists open escalations (pending/acknowledged) in the same cards with Acknowledge and Resolve through the audited updateEscalation server function; the sidebar badge counts them |
| DEV-DM-11 | Task Management "Completed" tab | Can never populate (open-only overview). | FIXED_LIVE (aa9184b, verified on production 2026-10-03) — the Completed tab lists completed/delivered tasks from the full task list (useAllDeveloperTasks) with the completion date and no work actions; taskCode moved to dev-manager.types.ts so screen and server share it |
| DEV-DM-12 | Sprint/Milestone, Build Assignment, Compliance & NDA | No tables; empty constants; Build buttons toast-only. | MISSING |
| DEV-DM-13 | Settings | 12 uncontrolled switches, no persistence; copy claims IP/device binding and hour tracking that do not exist. | OPEN / NEEDS-OWNER (which settings are real) |
| DEV-DM-14 | Payment & Incentive | Sums `task_amount` (NULL everywhere); "approved in Finance" but no developer payout path exists. | MISSING (payment model is NEEDS-OWNER) |
| DEV-DM-15 | `getDeliveryOverview` (GET) | A read can insert auto-escalation rows every poll. | OPEN (by design; 0 today) |
| DEV-DM-16 | Shell | No back to Control Panel, bell always empty, no chat button; `DMFullSidebar.tsx` dead with typed-in badges. | FIXED_LIVE (aa9184b, verified on production 2026-10-03) — Back to Control Panel; the bell lists what waits on a manager (onboarding, reviews, alerts) from the same counts as the badges; the existing ChatAppButton in the top bar. The dead DMFullSidebar.tsx remains (OPEN, low) |
| DEV-DM-17 | Audit CSV export | Exports only the visible 25-row page. | FIXED_LIVE (aa9184b, verified on production 2026-10-03) — Export CSV reads every matching entry page by page through getAuditTrail, search and module filter applied |
| DEV-DM-18 | Hold / Pause / Close / Verify Fix / Temporary Grant / Submit | Toast-only buttons (several say where the action really lives). | OPEN |
| DEV-DM-19 | Labels | "Role" = first skill tag, "Level" = task load, "Location" = masked e-mail domain, "AI Quality Score" has no AI. | OPEN (copy) |

### Developer Dashboard (`/dashboard/developer`)

| ID | Where | Finding | Status |
|---|---|---|---|
| DEV-DD-1 | KPI cards ×8 | Generated by the seeded sample engine (`lib/metrics.ts`) with invented trends. | FIXED — `getDeveloperMetrics` (server, scoped to the signed-in developer) supplies Open Tasks, Tasks Completed and Open Bugs; the other five have no source on the platform and read "not tracked yet" |
| DEV-DD-2 | KPI clicks | Keys like `tasks-open` are not modules, so nothing opened. | FIXED — Open/Completed open Tasks, Open Bugs opens Bugs |
| DEV-DD-3 | Bugs module | Filtered `tm_tasks.assigned_to` by the user id; it holds a `tm_members.id`, so it could never return a row. | FIXED — resolves the user's Task Manager member first; without one it says no membership is linked |
| DEV-DD-4 | Tasks module | Correct and server-scoped, but empty: 0 assigned tasks, 14 of 15 developers have no `developers` row. | OPEN (data: onboarding/registry) |
| DEV-DD-5 | Code Submission | Read works; a developer cannot submit (CrudWorkspace strips create) although RLS allows it. | OPEN |
| DEV-DD-6 | Command Center, Performance, Hero CTAs, "Library" | All open `/dev-manager`, which refuses developers. | NEEDS-OWNER (DEV-SEC-8) |
| DEV-DD-7 | AI Chat / Support / AI Assistant / top-bar Messages | Canned reply (`AIChatWorkspace.tsx:57-69`). | OPEN |
| DEV-DD-8 | Wallet & Payout, top-bar Rank/XP/Wallet/Payout pills, profile Wallet | No developer wallet exists; pills "—"; menu items toast. | MISSING (payment model NEEDS-OWNER) |
| DEV-DD-9 | Promises, projects, task messages | No developer UI. | MISSING |
| DEV-DD-10 | Activity Feed, Hero right panel, "Recent Command Center" | Static; Hero says "Live workspace". | OPEN |
| DEV-DD-11 | Chat, Notifications, Task Manager timer, AMS Center | Browser client → VPS under RLS (not wrong DB). Task Manager timer has no member to act as. | PARTIAL — chat RLS verified (DEV-GAP-7); notifications list and Task Manager timer UNVERIFIED in a signed-in run |

## Verification of this pass (2026-10-02, local)

- Typecheck: no error in `dev-manager.functions.ts`, `DMDeveloperRegistry.tsx`,
  `DMTaskManagement.tsx`, `records.functions.ts`, `use-dashboard-records.ts`,
  `dashboard.$role.tsx` or the new test. `dev-manager.server.ts` keeps its
  pre-existing errors (the generated types have no developer tables); none is
  on a changed line. Total 4,838 (PRE-EXISTING baseline ~4,8xx–5,0xx).
- Tests: 875 of 876 pass, plus the new `dev-manager-audit-filter.test.ts` (3/3).
  Failures, all PRE-EXISTING: i18n CI check (none of the files above is
  listed), AMS credential-verification and operator-role e2e, and two
  sales-support suites missing `@testing-library/react` locally.
- Production build (node-server): passes, import protection clean.
- Live PostgREST accepts the Bugs filter (`status=not.in.(…)`, HTTP 200).
  The audit filter syntax could not be checked anonymously (`audit_logs` is
  401 to anon, correctly) — UNVERIFIED until a signed-in run after deploy.
- Nothing committed, pushed or deployed. (The migration was applied afterwards, on the owner's authorization - below.)

## Pass 2 (2026-10-02): layers not covered above

Read-only audits of the dashboard surfaces, the database (rolled-back role tests
with real accounts) and i18n/accessibility (live, writes blocked). Only rows not
already in this ledger.

### Dashboard surfaces, chat, assist, promise, routing

| ID | Where | Finding | Status |
|---|---|---|---|
| DEV-GAP-1 | `AIChatWorkspace` vs `src/lib/chat/ai.functions.ts` | A real, stored, audited AI chat exists (generateAiReply over conversations/messages) and a developer may call it. Its bot prompt is the customer sales persona ("Every Software Vala product is $249 one-time"), so wiring developers to it would give them a sales bot. | NEEDS-OWNER (which assistant a developer gets) |
| DEV-GAP-2 | `chatWithAi`, `routeAiRequest` | Stateless AI paths admit developers; the first speaks as the Marketplace Homepage Manager. | OPEN (not suitable as is) |
| DEV-GAP-3 | `useValaChat.ts:39-46` → `/api/chat` | The Control Panel's Vala AI chat sends no Authorization header to a route that requires one: by code every browser call is 401. | OPEN (Vala AI scope) |
| DEV-GAP-4 | Sidebar Marketplace | Explore and Marketplace both went to `/`. | FIXED (working tree) — Marketplace opens `/marketplace` |
| DEV-GAP-5 | Sidebar "Library" | Opens the role's first module; no library exists anywhere. | NEEDS-OWNER |
| DEV-GAP-6 | Command Center | No developer command-centre component exists; the dashboard home is the command surface. | NEEDS-OWNER (with DEV-SEC-8) |
| DEV-GAP-7 | chat RLS | A developer holds 15 chat permissions; can create, add, send and read own threads. | VERIFIED (policy) |
| DEV-GAP-8 | chat | No "message my assigner" path; only directory search. | MISSING |
| DEV-GAP-9 | `ChatAppButton` | No unread badge; chat messages create no notification row. | MISSING |
| DEV-GAP-10 | `chat-service.ts:94-114` | Unread counts computed from the 600 newest messages overall. | OPEN (0 data today) |
| DEV-GAP-11 | `profiles_select_authenticated` → `is_crm_staff()` | Developers count as CRM staff and can read every profile (e-mail, phone). | NEEDS-OWNER (privacy) |
| DEV-GAP-12 | `assist-manager/api.ts` createAssistSession | Never set `created_by`, which the insert policy requires: every session create was refused for every role. No code raises an assist request. | FIXED (working tree) — created_by = signed-in user. Request raising MISSING |
| DEV-GAP-13 | Promise Tracker | Route admits developers and RLS is correct; nothing links to it from the developer dashboard. | OPEN (navigation) |
| DEV-GAP-15 | `dashboard.$role.tsx` `"dev-manager": ["developer"]` | A developer could open `/dashboard/dev-manager` (sample-engine KPIs), contrary to the comment above the map. | FIXED (working tree) — operator-only |
| DEV-GAP-16 | `dashboard.$role.tsx` | The open module was React state: refresh, Back and shared links lost it. | FIXED (working tree) — `?module=` in the URL behind the same permission gate; role switches start clean |
| DEV-GAP-17 | `useDeveloperMetrics` | While loading, KPI cards drew sample-engine figures. | FIXED (working tree) — never undefined for a developer |
| DEV-GAP-18 | TopBar Profile / Account settings, Sidebar "Go Pro" | Toast-only; the upgrade offer has no plan behind it. | NEEDS-OWNER |
| DEV-GAP-19 | `RouteAccessGate`, `is_crm_staff`, `assist_is_agent` | The developer app_role is both the partner on this dashboard and internal staff (opens Control Panel, Manager, AI API Manager, Server Manager, Vala AI…). | NEEDS-OWNER (split partner vs staff developer) |

(DEV-GAP-14, promise owner updates, is DEV-GAP-DB-3 below.)

### Database (rolled-back tests with real accounts)

Cross-developer reads and writes, customer and anon access to developer tables,
and the developer ↔ Task Manager mirror all held (0 rows / 42501).

| ID | Object | Finding (proven) | Status |
|---|---|---|---|
| DEV-GAP-DB-1 | conversation_participants insert | Any signed-in user could join any conversation, read it, post and add others. | FIXED in migration `20261107T231000` (trial: BLOCKED; the app's create path ALLOWED). APPLIED AND VERIFIED LIVE (2026-10-02) |
| DEV-GAP-DB-2 | conversation_participants update | A member could set their own role_label. | FIXED in `20261107T231000` (column grants: last_read_at, favorite, muted). APPLIED AND VERIFIED LIVE (2026-10-02) |
| DEV-GAP-DB-3 | promises owner update | An owner set tip 100000 released and approval approved by themselves. | FIXED in `20261107T231000` for money, approval and ownership. Owner self-fulfil left as is — NEEDS-OWNER. APPLIED AND VERIFIED LIVE (2026-10-02) |
| DEV-GAP-DB-4 | promises insert | Any user inserted a fulfilled promise with a released tip "approved" by an admin. | FIXED in `20261107T231000` (non-managers start open, no tip, fine or approval). Who may name another owner — NEEDS-OWNER. APPLIED AND VERIFIED LIVE (2026-10-02) |
| DEV-GAP-DB-5 | assist_sessions insert | An agent created an active full-control session with forged target consent. | FIXED in `20261107T231000`. APPLIED AND VERIFIED LIVE (2026-10-02) |
| DEV-GAP-DB-6 | assist_sessions update | Either party rewrote consent, operator, target and access mode. | FIXED in `20261107T231000` for direct writes; the consent functions are unaffected (trial: assist_grant_consent ALLOWED). APPLIED AND VERIFIED LIVE (2026-10-02) |
| DEV-GAP-DB-7 | assist_session_requests insert | Inserted already approved. | FIXED in `20261107T231000`. APPLIED AND VERIFIED LIVE (2026-10-02) |
| DEV-GAP-DB-8 | tm_comments / tm_time_logs | Any user wrote, edited and deleted on pool tasks and posted as another member. | FIXED in `20261107T231000` (members write as themselves; the TM chat's null author kept). APPLIED AND VERIFIED LIVE (2026-10-02) |
| DEV-GAP-DB-9 | marketing_notify | Any user notified every admin. | FIXED in `20261107T231000` (revoked). APPLIED AND VERIFIED LIVE (2026-10-02) |
| DEV-GAP-DB-10 | pt_resolve_identity | Any user resolves an e-mail to a user id (used by Promise Tracker). | NEEDS-OWNER |
| DEV-GAP-DB-11 | pt_owner_scorecard | Anyone's totals, tips and fines; no caller. | FIXED in `20261107T231000` (revoked). APPLIED AND VERIFIED LIVE (2026-10-02) |
| DEV-GAP-DB-12 | log_safe_assist_ai_event | Any user can terminate any Safe Assist session. | OPEN (Safe Assist function body) |
| DEV-GAP-DB-13 | verify_safe_assist_connection | Codes for either side, no attempt limit. | OPEN (Safe Assist function body) |
| DEV-GAP-DB-14 | tm_member_for_developer, tm_developer_for_member, is_admin, is_support_staff, is_chat_participant | Executable by anon. | FIXED for the tm_* pair in `20261107T231000`; the other three appear in policies — OPEN (needs a policy-by-policy check). APPLIED AND VERIFIED LIVE (2026-10-02) |
| DEV-GAP-DB-15 | RLS helpers per row | Helpers evaluated per row (tm_tasks, developer_tasks, audit_logs, messages). | OPEN (scale; rewrite with sub-selects) |
| DEV-GAP-DB-16 | missing indexes | conversation_participants.user_id, developer_code_submissions(developer_id, created_at), audit_logs(entity_type, occurred_at), messages.sender_id, tm_comments.author_id, tm_time_logs.member_id. | FIXED in migration `20261107T232000` (CONCURRENTLY; none duplicates an existing index). APPLIED AND VERIFIED LIVE (2026-10-02) |
| DEV-GAP-DB-17 | loadDeliveryOverview | All task history with no limit (a 10k cap would drop the oldest open tasks); performance built developers × tasks. | PARTIAL — performance grouped once (working tree); open-only query OPEN |
| DEV-GAP-DB-18 | autoEscalate | One audit round trip per escalation during a GET. | FIXED_LIVE (aa9184b, verified on production 2026-10-03) — writeAuditMany, one insert |
| DEV-GAP-DB-19 | loadDeveloperRegistry / loadAuditTrail | No pagination; exact count with a prefix filter. | OPEN (the DB-16 index helps the count) |
| DEV-GAP-DB-20 | getDeveloperMetrics | Counted by fetching rows (capped at 5,000). | FIXED (working tree) — counted by the database (Prefer: count=exact; live header format checked) |
| DEV-GAP-DB-21 | sv-sweeps.sh | Success is not recorded (stopped looks healthy); no SLA sweep for developer_tasks; push has no outbox. | OPEN (ops) |
| DEV-GAP-DB-22 | user_notifications | 35 of 71 rows point at missing users (NOT VALID FK). | NEEDS-OWNER (deletion) |
| DEV-GAP-DB-23 | integrity | developers.current_task_id had no FK; operators could delete escalation and note history; one conversation has 0 participants. | FIXED in `20261107T231000` (FK; delete removed). Empty conversation OPEN. APPLIED AND VERIFIED LIVE (2026-10-02) |

Migration trials (all ROLLBACK): the audit's own proofs re-run with the guards
in place — every proven hole BLOCKED except the two left for the owner (owner
self-fulfil, e-mail lookup). 27 legitimate-flow checks pass: promise create
(active and draft), owner status change and deadline extension, assist session
open/start/end, pending assist request, member comments (with and without an
author id) and own time logs, conversation create with participants,
read/favourite/mute, consent through assist_grant_consent, admin tip and
comment, escalation acknowledge, service-key promise and escalation writes.

### Live UI, i18n, accessibility (production 50e446d, writes blocked)

No raw keys, page errors or HTTP ≥ 400 on any of the 17 screens; no overflow at
390 px in any language; focus ring visible; `he` renders `dir=rtl`.

| ID | Finding | Status |
|---|---|---|
| DEV-GAP-UI-1 | Dev Manager nav and brand labels are English literals the i18n check cannot see. | PARTIAL LIVE (aa9184b: English source keyed and verified; ta/he/zh translations missing — DEV-LIVE-1) — nav, brand, shell text through t() (devmanager.*) |
| DEV-GAP-UI-2 | `window.prompt` text is invisible to the i18n check (12 sites). | PARTIAL LIVE (aa9184b: English source keyed and verified; ta/he/zh translations missing — DEV-LIVE-1) — no window.prompt left (see UI-7) |
| DEV-GAP-UI-3 | All 17 screens: 0 translation keys (291 baseline literals). | PARTIAL LIVE (aa9184b: English source keyed and verified; ta/he/zh translations missing — DEV-LIVE-1) — 17 screens + route: 293 baseline literals → 0; ~330 keys in messages/devmanager.ts; baseline entries removed |
| DEV-GAP-UI-4 | Dashboard pieces: 0 keys; CrudWorkspace baseline stale (99 vs 48 measured). | FIXED (working tree, not deployed) for Sidebar, TopBar, Hero, KpiGrid, KpiToolbar, ContentRows (85 → 0, messages/dashboard.ts; developer role copy keyed in roles.ts with English fallback). CrudWorkspace/Widgets/AIChatWorkspace/DataTable and the shared ACHV/AMS module names remain OPEN; CrudWorkspace baseline still stale (99 vs 48) |
| DEV-GAP-UI-5 | Audit Logs timestamp shown as raw UTC. | FIXED_LIVE (aa9184b, verified on production 2026-10-03) — formatted through the i18n engine; still shown in UTC as before |
| DEV-GAP-UI-6 | Browser-locale dates and numbers; English fragments concatenated into text. | FIXED_LIVE (aa9184b, verified on production 2026-10-03) — formatDate/formatNumber from useTranslation; interpolation instead of glued English; amounts without a stored currency stay plain numbers |
| DEV-GAP-UI-7 | 12 native prompts used as dialogs (not themed, not translatable, type-a-number choices). | FIXED_LIVE (aa9184b, verified on production 2026-10-03) — DMPromptDialog (existing Dialog/Select/Textarea): reason with inline minimum, Select instead of type-a-number, translated, focus returns; same validation and mutations |
| DEV-GAP-UI-8 | Settings switches have no accessible name. | FIXED_LIVE (aa9184b, verified on production 2026-10-03) — every switch id + Label htmlFor |
| DEV-GAP-UI-9 | Dev Manager dashboard KPI cards are clickable divs, not keyboard reachable. | FIXED_LIVE (aa9184b, verified on production 2026-10-03) — cards keyboard-operable (role=button, tabIndex, Enter/Space) with label + value |
| DEV-GAP-UI-10 | No live regions for loading, error and empty states on 16 screens. | FIXED_LIVE (aa9184b, verified on production 2026-10-03) — role=status/aria-live on loading/empty, role=alert on errors, aria-busy on skeletons |
| DEV-GAP-UI-11 | Shell: no aria-current, unlabelled close button, no skip link. | FIXED_LIVE (aa9184b, verified on production 2026-10-03) — aria-current, labelled icon buttons, aria-expanded; main is #main-content so the site-wide skip link lands on it |
| DEV-GAP-UI-12 | Developer surfaces are absent from the language packs: English wherever the runtime translator is unavailable (hi: 99.4% English on /dev-manager with it blocked). | PARTIAL LIVE (aa9184b: English source keyed and verified; ta/he/zh translations missing — DEV-LIVE-1) — keyed strings ship in the catalogue; live pack check pending the release |
| DEV-GAP-UI-13 | Production /dev-manager still shows fabricated seed rows (ONB-001, "Project Alpha", DEV-001 "$4,500 160 hours", typed-in KPIs 24/18/5…); the working tree replaced them with live data. | FIXED_LIVE (aa9184b, verified on production 2026-10-03) — BLOCKED (release boundary) |

### Pass 2 verification (local, 2026-10-02)

- Typecheck 4,838 (PRE-EXISTING baseline); 0 errors in any changed file.
- Tests 875/876; the same five failing suites as before, all PRE-EXISTING
  (i18n CI check — now failing only on another session's api/demo,
  api/influencer and vala-tv files; two AMS tests; two sales-support suites
  missing @testing-library/react locally).
- Production build passes. i18n check: 0 hardcoded strings in every Developer
  file; 25 baseline entries removed by hand (the regenerate script was not run,
  so other sessions' new strings were not accepted into the baseline).
- Migrations 20261107T231000 and 20261107T232000: written and trialled
  (rolled back); applied afterwards on the owner's authorization (below).
- Nothing committed, pushed or deployed (release boundary above).

## Pass 3 (2026-10-02): migrations applied, Developer Management release

### Migrations 20261107T231000 and 20261107T232000 — APPLIED + VERIFIED LIVE

Applied on the owner's explicit authorization. Pre-check: neither applied
(0 guard triggers, 0 new policies, the 4 old FOR ALL policies present, no FK,
0 of the 6 indexes, marketing_notify executable by authenticated), no newer
migration, target sv_platform, 0 dangling current_task_id.

- 231000 applied as one transaction (ALTER/CREATE/DROP POLICY, two guard
  triggers, column grants, four REVOKEs, the FK), COMMIT.
- 232000 applied as written (CONCURRENTLY): all six indexes valid and ready on
  their intended tables, none duplicating an existing index; with sequential
  scans disabled the planner uses each one (conversation_participants user_id,
  developer_code_submissions developer+created, audit_logs entity_type prefix,
  messages sender, tm_comments author, tm_time_logs member).
- Live re-run of the audit's proofs (rolled back): chat self-join, reading a
  foreign conversation, adding others, posting — BLOCKED; promise tip by owner
  and forged approved promise — BLOCKED; forged assist consent (insert and
  update, both parties) — BLOCKED; pre-approved assist request — BLOCKED;
  comment as another member and time log for another member — BLOCKED;
  marketing_notify and pt_owner_scorecard — permission denied; role_label —
  permission denied. Left as is for the owner: promise owner self-fulfil,
  e-mail → user id lookup.
- The 27 legitimate flows: all PASS live.

### Release boundary — resolution

Developer Management isolates cleanly from origin/main; the Developer Dashboard
does not.

- Release candidate: branch `release/developer-management`, commit `ab3ba99`,
  tree `aa73796`, one commit on origin/main `50e446d`, 34 files — all Developer
  Management files, the Assist created_by hunk on main's own version of that
  file, the devmanager catalogue registration, the three migrations, this
  ledger, and 19 baseline entries removed. Not pushed, not deployed.
- Two adjustments to stay Developer-only: the top-bar chat button is left out
  (ChatAppButton exists only in the unpushed Chat commit); Registry Escalate
  uses a new operator-checked server function (escalateDeveloper) instead of
  another session's rewrite of the shared action logger (the working tree uses
  the same function).
- The Dev Manager parts of unpushed commit eb410f0 (the screens' move from
  typed-in rows to live data) and the other session's audit-column fix
  (DEV-DM-0) are in the release: both are Developer Management.
- Verification of the candidate against origin/main itself: build passes;
  typecheck 5,014 against 5,034 — no file gained an error (DMDeveloperRegistry
  8 → 0, dev-manager.server 143 → 132, dev-manager.functions 1 → 0); tests
  795/796 against 792/793 — the same five failing suites on both (i18n check
  on api/demo, api/influencer and vala-tv files; two AMS tests; two
  sales-support suites missing @testing-library/react); no sample row left
  (Project Alpha, $4,500, 160 hours, ONB-/TSK-/SPR-/BLD-/REV-/BUG-/ALT-/DEV-00x,
  192.168, MacBook: 0 matches).
- NOT isolatable — Developer Dashboard (DEV-DD-1/2/3, DEV-GAP-4/15/16/17,
  DB-20, and the dashboard i18n): its fixes sit on the role-dashboard records
  layer (records.functions, sources, CrudWorkspace) that unpushed commit
  eb410f0 introduced for every role, and dashboard.$role.tsx, Sidebar, TopBar,
  KpiToolbar carry four more unpushed commits plus other sessions' uncommitted
  reseller and chat changes. Production's developer dashboard meanwhile shows
  the local sample CRUD store and generated KPI figures (MOCK; fixed only in
  that layer). BLOCKED on the owner's release decision for the role-dashboard
  work.


## Pass 4 (2026-10-02): timer, code submission, achievements, notifications, settings

Rolled-back tests with the real developer and admin (a temporary Task Manager
membership for the developer inside the transaction). Only rows not above.

| ID | Where | Finding | Status |
|---|---|---|---|
| DEV-GAP-T-1 | `tm_tasks_member_update` | A Task Manager member completed their own task with no review; the developer mirror completed too and AMS issued awards — a way round DEV-SEC-1 once a developer is a member (0 members today). | FIXED in migration `20261107T233000` (member guard: assignee statuses only, closed tasks stay closed). Trial: BLOCKED. Not applied |
| DEV-GAP-T-2 | same | Assignee sets actual_minutes / total_paused_minutes freely (99999 / 5000), which also defeats SLA breach. | OPEN — needs a server-side timer (T-4); the browser timer writes these columns today |
| DEV-GAP-T-3 | `tm_time_logs` | Members wrote negative seconds and rewrote/deleted their own logs; manual entries of any size. | FIXED in `20261107T233000` (seconds ≥ 0; update/delete operator-only). Manual entries — NEEDS-OWNER. Not applied |
| DEV-GAP-T-4 | `tm/api.ts:418-470` timerAction | Elapsed minutes computed on the browser clock from a stale copy, rounded to whole minutes; task update and log insert are two requests. | OPEN (server timer RPC) |
| DEV-GAP-T-5 | `tm/api.ts:342-359` changeStatus | Status changes drop or double-count running time. | OPEN (server timer RPC) |
| DEV-GAP-T-6 | timerAction pause | Paused time never accrues, so SLA charges holds to the assignee. | OPEN (server timer RPC) |
| DEV-GAP-T-7 | tm_tasks timer | Two timers at once; a timer on a completed task; a closed browser keeps the timer running with no cap. | OPEN — idle cap NEEDS-OWNER |
| DEV-GAP-T-8 | `tm_notifications_write` | An assignee deleted / edited a manager's "SLA breached" alert. | FIXED in `20261107T233000` (assignee: insert and mark-read only; delete operator-only). Not applied |
| DEV-GAP-T-9 | `tm_sync_from_developer_task` | A developer_id-only change (Dev Manager reassign) never reached tm_tasks.assigned_to. | FIXED in `20261107T233000` (trial: assigned after assignment). Not applied |
| DEV-GAP-T-10 | `tm/api.ts:228` | Bucket "tm-attachments" does not exist on the VPS; Task Manager attachments fail. | OPEN (Task Manager scope) |
| DEV-GAP-T-11 | `developer_tasks_guard_self_update` | Checked only the new status: a developer reopened their own completed task (and its Task Manager twin) — live today. | FIXED in `20261107T233000` (closed tasks are not reopened by the developer). Trial: BLOCKED. Not applied |
| DEV-GAP-T-12 | `tm_status_from_developer` | 'reopened' (changes requested) showed as 'assigned' in the Task Manager. | FIXED in `20261107T233000` (→ in_progress). Not applied |
| DEV-GAP-T-13 | `developers_insert_own_submissions` | Submissions on closed tasks; two pending submissions on one task left one undecidable. | FIXED in `20261107T233000` (open task required; one pending per task). Not applied |
| DEV-GAP-T-14 | `file_urls`, bucket developer-task-files | No upload path; file_urls takes any external URL; one orphan object. GitHub is not required anywhere in the developer flow. | OPEN — repo URL requirement and orphan deletion NEEDS-OWNER |
| DEV-GAP-T-15 | `ams_on_task` + `ams_on_developer_task` | One completion counted twice (tm and developer side); each resubmit-approve adds another approved event. | OPEN (AMS scope) |
| DEV-GAP-T-16 | AMS self-award | Direct inserts into user_xp, ams_activity_events, ams_award_ledger refused; ams_ingest_event / ams_evaluate_user denied; duplicates blocked by unique keys. | VERIFIED (only T-1/T-11 led to awards; both fixed in the migration) |
| DEV-GAP-T-17 | `pt_notify`, `assist_request_from` | Write `notifications`, which the bell never reads (it reads user_notifications): promise and assist alerts never reach a developer. | OPEN (Promise / Assist scope) |
| DEV-GAP-T-18 | review, reassign, SLA sweep | No notification to the developer on review decision, reassignment or SLA breach. | FIXED for review (in `20261107T233000`; trial: one notice each for changes requested and approval) and reassignment (Dev Manager server, working tree and release candidate). SLA sweep OPEN. Review part not applied |
| DEV-GAP-T-19 | `developers` | No developer self-update (availability); no per-user timezone or language store. | MISSING — preferences store NEEDS-OWNER |

Migration `20261107T233000_developer_guard_followups.sql` trials (all ROLLBACK):
the audit's two proof files re-run with it — self-complete, cost/billing,
reopen closed work, duplicate and late submissions, alert edit/delete,
negative seconds, own-log rewrite/delete all BLOCKED; timer columns (T-2/T-7)
and manual entries (T-3) remain, as recorded. 28 legitimate checks pass:
member start/pause/progress/mark-read, own time log, developer work → submit,
changes requested (developer notified, Task Manager shows in_progress), rework
and resubmit, approval (developer notified, task completed), admin priority,
cost and alert delete, service-key reassignment.

## Pass 5 (2026-10-02): AMS, AMS Center, Support, Settings, Logout, dashboard numbers

Rolled-back tests with the developer, a customer, an admin and a support-only
user; two live runs with writes blocked. Only rows not above.

| ID | Where | Finding | Status |
|---|---|---|---|
| DEV-AMS-1 | `claims` `clm_self_insert` | A user inserted their own approved / fulfilled claims and duplicate pending ones past ams_request_claim; an admin approving a forged pending claim charged its 0 cost. | FIXED in migration `20261107T234000` (claims only through ams_request_claim; one pending per reward). Trial: all BLOCKED; real claim requested, approved, wallet charged 10 of 100. Not applied |
| DEV-AMS-2 | ams_chat_messages / ams_events / ams_comments / ams_attachments inserts | A developer posted a staff reply, a forged "resolved" event and an internal note on a ticket they could not read. | FIXED in `20261107T234000` (writing needs ticket membership; authored; staff voice and internal notes for the assignee or an admin). Not applied |
| DEV-AMS-3 | `ams_tickets` update | The requester self-assigned, resolved, and changed created_by / customer_id; a support user self-resolving earned 8 AMS awards. | FIXED in `20261107T234000` (guard trigger: requester path, no self-assignment, raised-by fixed; no award for resolving your own ticket). Not applied |
| DEV-AMS-4 | `tickets.functions.ts` | Developer (a staff role) moved their own ticket anywhere; archive / restore / pin unchecked. | FIXED (working tree) — the requester follows the requester path unless assignee or operator; archive and restore for the requester or staff working it; pin and internal notes staff-only |
| DEV-AMS-5 | ams_tickets read policies use is_admin | The support team cannot see developer tickets. | NEEDS-OWNER (who works AMS tickets) |
| DEV-AMS-6 | requester notifications | Reply and resolve told the developer nothing. | FIXED in `20261107T234000` (mm_notify on staff reply and on status change by someone else; trial: 3 notices). Not applied |
| DEV-AMS-7 | `TopBar.tsx` Award icon | "Achievement badges" opened the ticket desk. | FIXED (working tree) — opens Achievements |
| DEV-AMS-8 | production (origin/main) | AMS desk and AMS Center are browser-only sample stores; "Reward added to your wallet" when nothing was added. | BLOCKED (role-dashboard release, as DEV-GAP-UI-13) |
| DEV-AMS-9 | AMSEngine / AMS Center / summary card | Same tables, different counting (claims, missions hardcoded vs DB, stage 0 vs Level 1, placeholder leaderboard). | OPEN |
| DEV-AMS-10 | mission "Live AMS Verification Mission" | Looks like verification residue shown to every developer. | NEEDS-OWNER (not deleted) |
| DEV-AMS-11 | AMS IDOR | Another user's XP, wallets, ledger, claims, recognitions, role chain, tickets: 0 rows / not_permitted. | VERIFIED |
| DEV-AMSC-1 | `/ams-manager`, `requireAmsStaff` (developer is staff) | A developer reads every user's claims, passports, ledger and notifications through the service role and can run metered AI analysis; decide buttons always fail for non-admins. | NEEDS-OWNER (with DEV-GAP-19) |
| DEV-SUPPORT-1 | Sidebar Support | Fell back to the canned AI chat although the role has a ticket desk. | FIXED (working tree) — opens the role's AMS desk when it has one |
| DEV-SUPPORT-2 | ams_tickets vs support_tickets | Two unlinked ticket systems; Customer Support never sees developer tickets. | NEEDS-OWNER (one desk or mirroring) |
| DEV-SUPPORT-3 | `is_crm_staff` includes developer on support_tickets, chat_sessions, chat_messages, support_escalations | A developer reads every customer ticket, chat and escalation (12 / 5 / 11 / 5). | NEEDS-OWNER (with DEV-GAP-11 / DEV-GAP-19) |
| DEV-SETTINGS-1 | Sidebar Settings, settings module, ContentRows link, TopBar Account settings, AMS Profile | Several entry points, no developer settings implementation. | NEEDS-OWNER (DUPLICATE / MISSING) |
| DEV-SETTINGS-2 | whole app | No `auth.updateUser` anywhere: no password, e-mail or name change; the reset link signs the user in without setting a new password. | OPEN (SECURITY; platform auth, not Developer) |
| DEV-SETTINGS-3 | TopBar currency chip | Written, never read. | OPEN (UI-ONLY) |
| DEV-LOGOUT-1 | production `auth-bridge.ts` (origin/main) | **Logout is a stub on production**: no /auth/v1/logout call, the session stays in localStorage, Back and refresh show the signed-in user, the old JWT keeps working. Fixed only in unpushed eb410f0. Affects every role. | BLOCKED (release decision) — highest priority |
| DEV-LOGOUT-2 | PostgREST after a real logout | GoTrue refuses the revoked JWT; PostgREST still accepts it until expiry (60 min). | OPEN (SECURITY; platform auth — session check on db_pre_request or shorter expiry) |
| DEV-LOGOUT-3 | Sidebar / TopBar logout | No cache clear: a next user on the same tab could see the previous user's cached data. | FIXED (working tree) — queryClient.clear() in finally, then navigate |
| DEV-DASH-1 | `useDeveloperMetrics` | Errors and "no Task Manager membership" both read "not tracked yet". Values match the DB for the developer (0 / 0 / —); production shows sample numbers (971 / 699). | OPEN (low); production part BLOCKED with the dashboard release |
| DEV-DASH-2 | summary card, pills, KPI sort | Summary card matches the DB; pills "—" (known); label sort uses English. | VERIFIED / OPEN (low i18n) |

AMS migration trials (all ROLLBACK): the three audit probes with the guards —
forged claims, foreign-ticket writes, self-assignment, self-resolve, raised-by
changes all BLOCKED, 0 self-awards. 19 legitimate flows pass: raise, event,
own message and comment, real claim request, duplicate claim refused, admin
assign / reply / internal note / resolve / approve, developer notified 3×,
wallet charged at the reward price, close, reopen, submit draft, withdraw,
restore, edit details.

## Cross-connection matrix (2026-10-02)

| Arrow | Status | Evidence |
|---|---|---|
| Lead → Requirement | PARTIAL | `leads.requirements` text only |
| Requirement → Project | MISSING | no projects table |
| Project → Developer | MISSING | no project entity |
| Developer Management → Developer Dashboard | PARTIAL | same `developers` / `developer_tasks`; landing route NEEDS-OWNER (DEV-SEC-8) |
| Dashboard → Command Center | NEEDS-OWNER | no developer command centre (DEV-GAP-6) |
| Command Center → Tasks | NOT APPLICABLE | (no command centre) |
| Tasks ↔ Task Manager | CONNECTED (DB triggers) | mirror both ways; reassignment fixed (T-9, migration pending) |
| Tasks → Timer & Productivity | PARTIAL | timer persists on tm_tasks but browser-computed (T-2/T-4..T-7) |
| Tasks → Code Submission | CONNECTED | submission → review → completed / reopened (proven) |
| Tasks → Bugs & Issues | PARTIAL | Bugs read tm_tasks by member (fixed); no bug intake anywhere |
| Developer → AI Assistant / AI Chat | DISCONNECTED | canned reply; the real AI chat is a sales persona (DEV-GAP-1, NEEDS-OWNER) |
| Developer → Team Chat | CONNECTED | RLS verified; join-any-chat closed (DB-1, live) |
| Developer → Assist Manager | PARTIAL | sessions creatable (fixed); no request raising |
| Developer → Promise Tracker | PARTIAL | RLS correct; no link from the dashboard; alerts never reach the bell (T-17) |
| Work → Review → QA | PARTIAL | review RPC; two unlinked review stores (tm_reviews) |
| QA → Completion | CONNECTED | approval completes task + mirror + promise settlement (proven) |
| Completion → Wallet & Payout | MISSING | no developer payout (NEEDS-OWNER) |
| Work → Performance | PARTIAL | Dev Manager performance from completed tasks; dashboard performance not tracked |
| Performance → Achievements | CONNECTED | AMS triggers on task / submission; double count (T-15) |
| Achievements ↔ AMS ↔ AMS Center | PARTIAL | same tables; counting differs (DEV-AMS-9) |
| Developer → Support | CONNECTED (working tree) | AMS desk; Sidebar Support now opens it (DEV-SUPPORT-1) |
| Support → Customer Support | DISCONNECTED | two ticket systems (DEV-SUPPORT-2) |
| Support → staff reply → developer | CONNECTED after `20261107T234000` | trial: notified |
| Developer → Settings | MISSING | no settings backend (DEV-SETTINGS-1/2) |
| Developer → Logout | BROKEN on production / PARTIAL in the working tree | DEV-LOGOUT-1/2 |

## Release LIVE (2026-10-03): Developer Management aa9184b

- Pushed origin/main 50e446d..aa9184b (fast-forward). VPS checkout aa9184b (tree
  e003c6c), scripts/ops/sv-deploy.sh: build, manifest, homepage on 3011, swap,
  PM2 restart, LIVE OK http=200. Build 2026-10-03 06:00:46 UTC, PM2
  softwarevala-staging online pid 149780 (sole holder of :3000). Rollback build
  .output.prev-20261003-055917 (50e446d). Migrations not rerun.
- Live E2E (production, 06:06–06:25 UTC): 17 screens render, 0 raw keys, 0
  sample rows (Project Alpha, $4,500, 160 hours, ONB-/TSK-/…: none); KPIs,
  registry, badges and bell match the DB; Control Panel back works; every audit
  filter and search correct; CSV = filtered total (23 / 11); keyboard dialog
  trap and focus return PASS. Writes on one zz-e2e task: Assign, Escalate,
  Acknowledge, Resolve, Registry View and Escalate — each with the operator's
  user id as actor and one audit row; zz rows removed afterwards, 5 audit rows
  kept.
- Security regression live (rolled back): amount change, approved submission,
  chat self-join, marketing_notify, pt_task_completed — all BLOCKED.
- Live failures (OPEN):
  - DEV-LIVE-1: ta / he / zh-Hans / zh-Hant show the module in English — 0
    devmanager translation jobs exist; the message catalogue was not synced
    after the release (hi covers 294 / 405 through runtime translation).
  - DEV-LIVE-2: useActionLogger writes to action_logs, which does not exist
    (404 and an "Audit log failed" toast on Registry View / Escalate; the
    audited server write succeeds) — fixed only in another session's
    uncommitted useActionLogger rewrite.
  - DEV-LIVE-3: at 390 px the Registry row actions and the Task Management
    tabs/actions overflow inside main.
  - DEV-LIVE-4: the Registry escalate toast shows a raw id; resolving an
    escalation leaves the task 'escalated'.
  - The Team Chat button is intentionally not in this release.

## Status by layer

| Layer | Status |
|---|---|
| Code fixes | 14 FIXED in the working tree; NOT committed, NOT deployed — release BLOCKED by the base boundary below |
| Database (security) | APPLIED + VERIFIED LIVE: 20261107T230000 (task self-update guard), 20261107T231000 (write guards), 20261107T232000 (indexes) |
| Data | thin: 1 developer profile, 0 assigned tasks, 0 Task Manager members |
| Chain | Task ↔ Progress connected in the database; project and payment missing |
| Owner decisions | DEV-SEC-5, DEV-SEC-8, DEV-SEC-9, DEV-DM-13, DEV-DM-14 / payment model |

## Production security migration (2026-10-02)

Migration `20261107T230000_developer_tasks_self_update_guard.sql`, applied on
the owner's explicit authorization. Status: **APPLIED + VERIFIED LIVE**.

Pre-check: the file held only the guard function, its trigger on
`developer_tasks`, the tightened `developers_insert_own_submissions` check
and the three revokes; target `sv_platform` on the VPS; guard function and
trigger absent and `authenticated` still holding EXECUTE (not applied before);
no newer migration. `supabase_migrations.schema_migrations` has not been
maintained since 2026-09-20 (no later migration is recorded there), so it was
not written. Applied through `scripts/ops/db.mjs` as one transaction:
CREATE FUNCTION, DROP TRIGGER (absent, skipped), CREATE TRIGGER, ALTER POLICY,
three REVOKEs, COMMIT.

Verification, 29 checks in one rolled-back transaction with the real developer
account, a real admin, a signed-in user holding neither an operator nor the
developer role, anon and service_role:

| Check | Result |
|---|---|
| Developer sets own task_amount / unassigns self / sets completed_at | BLOCKED |
| Developer marks own task completed / delivered | BLOCKED |
| Developer calls pt_task_completed; completes the mirrored tm_task directly | BLOCKED (permission denied; 0 rows under RLS) |
| Linked promise after those attempts | still pending |
| Developer inserts an approved, or a self-reviewed, submission | BLOCKED (RLS) |
| pt_task_completed, pt_notify, tm_run_automations as signed-in user and as anon | BLOCKED (permission denied) |
| Developer progress update, in_progress, submitted, normal submission | ALLOWED |
| Admin approves through review_developer_submission | ALLOWED: task completed, mirrored tm_task completed, linked promise fulfilled |
| Service key (Dev Manager server functions) reassigns, sets amount and deadline | ALLOWED |
| tm_tasks progress change mirrors to the developer task | ALLOWED (25 = 25) |

After: the three functions executable by postgres and service_role only (anon
and authenticated false); trigger enabled; policy carries the review_status
check; no test residue (0 test promises, 0 submissions, 0 assigned tasks, 0 new
notifications).

## Release boundary (2026-10-02) — application fixes NOT released

Production runs `50e446d` (= origin/main): clean checkout, softwarevala-staging
online, build 2026-10-02 18:35 UTC. The local branch is 16 commits ahead of it
(Product Manager follow-up, Marketplace payment, Chat, AMS recognition, Reseller,
Control Panel, Applications) and none of them is deployed.

The 14 application fixes cannot be released alone:

- Fixes 9-14 (developer KPIs, KPI navigation, Bugs) change
  `records.functions.ts`, `use-dashboard-records.ts` and the developer sources,
  which exist only in unpushed commit `eb410f0` (Control Panel finishing pass);
  `dashboard.$role.tsx` also carries unpushed 42ba8af, a8b8fc1, 237c864, 9f28d12.
- Fixes 7-8 change the Task Management screen as rewritten in `eb410f0`.
- Fixes 1-2 build on the other session's uncommitted audit-column fix
  (DEV-DM-0) in `dev-manager.server.ts`; without it the audit trail cannot be
  written or read at all.
- `dashboard.$role.tsx` and `DMDeveloperRegistry.tsx` also carry the other
  session's uncommitted reseller and escalation changes. Those are separable
  line by line; the dependencies above are not.

Releasing any of this means releasing the 16 commits (and the other session's
audit-column fix) or re-implementing the fixes on origin/main's older code.
Both are owner decisions; nothing was committed, pushed or deployed.
