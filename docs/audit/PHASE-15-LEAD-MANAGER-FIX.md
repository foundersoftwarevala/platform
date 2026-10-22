# Phase 15 — Lead Manager assignment security

## Status and scope

The Lead Manager implementation and migration are prepared in source. The
migration has **not** been applied to either database, and no live database
transaction was run. Therefore live RLS behavior, account-to-agent mappings,
and persisted workflow acceptance remain **UNVERIFIED**.

This extends the existing `public.leads` system; it does not create a second
leads table or replace the established status type. It adds `qualified` and
`proposal` while retaining the existing `interested`, `follow_up`,
`negotiation`, and `spam` statuses.

## Migration and access boundary

Migration: `supabase/migrations/20261108T160000_lead_manager_assignment_security.sql`

- Adds `leads.assigned_to` referencing `auth.users`, backfilled by matching the
  existing `lead_agents.email` to `auth.users.email`. Leads without a matching
  account remain unassigned and are visible only to managers.
- Adds the indexed `(assigned_to, status, created_at DESC)` access path.
- Enables RLS on `leads`. The SELECT and UPDATE policies permit a manager or
  the authenticated owner (`assigned_to = auth.uid()`); anonymous access is
  revoked. Sales users cannot read or update another user's lead.
- Revokes direct INSERT and DELETE. Direct UPDATE grants exclude `status`,
  `assigned_agent_id`, `assigned_at`, and `assigned_to`. Creation, status
  changes, and assignment go through authenticated, role-checking database
  functions.
- Adds append-only `lead_activities`, with actor ID, timestamp, action, note,
  and before/after state. Its rows are readable only by managers and the lead's
  assigned user. The state-change functions add matching central `audit_logs`
  rows in the same transaction.
- Manager roles in this migration are `admin`, `super_admin`, `boss`,
  `boss_owner`, `founder`, `sales_support_manager`, `support`, and `marketing`.
  A `sales` user may create a lead only when their account email matches a
  `lead_agents` profile; the new lead is assigned to that account. A manager
  can create an unassigned lead and can assign only to a `lead_agents` profile
  linked to a user with the `sales` role.

## Server functions and UI wiring

In `src/lib/lead-manager/core.functions.ts`:

- `getLeadRecords` ([line 113]) — authenticated, paginated (maximum 200 per
  request), and filtered by caller-visible rows through RLS.
- `createLeadRecord` ([line 161]) — validates the payload and calls the atomic
  database creation function.
- `updateLeadRecordStatus` ([line 183]) — validates the status and calls the
  atomic status/audit function.
- `assignLeadRecord` ([line 199]) — calls the manager-only assignment function.
- `getLeadActivityRecords` ([line 215]) — returns up to 100 persisted activity
  events for an authorized lead.
- `canAssignLeadRecords` ([line 223]) and `getAssignableLeadAgents`
  ([line 230]) — resolve assignment capability and linked sales-agent choices
  server-side.

`src/lib/lead-manager/api.ts` uses these functions for lead listing ([line 168]),
creation ([line 651]), assignment ([line 736]), and status changes ([line 760]);
`src/lib/lead-manager/queries.ts` wires the list and activity queries. The Lead
Detail sheet displays persisted state-change activity ([line 302]) and only
shows assignment controls to managers ([line 375]). The destructive Delete
controls were removed; lead records are retained ([line 496]). Ordinary
editable lead fields and related notes, communications, and follow-ups
continue to use their existing paths, subject to the new RLS/column grants.

## Agent isolation test and verification limits

`src/lib/lead-manager/core.test.ts` checks the expected Agent A / Agent B /
manager access decisions and asserts that the migration declares matching RLS
scopes and denies direct inserts. This is a **unit/static policy test**, not a
live PostgreSQL RLS test. The actual database result is not claimed until the
migration is applied and tested with distinct authenticated accounts.

The database functions fail closed when an agent has no matching `lead_agents`
profile or a manager selects an agent without a linked `sales` account. The
current account/profile mapping was not read from a live database, so the
availability of assignable agents is **UNVERIFIED**.

## Verification

- Focused tests: 17 passed across 2 test files.
- ESLint: 0 errors; `shared.tsx` reports 8 React Fast Refresh warnings.
- Full TypeScript check: PASS (`npx tsc --noEmit -p .`).
- Migration application, live RLS checks, and production acceptance: not run.
