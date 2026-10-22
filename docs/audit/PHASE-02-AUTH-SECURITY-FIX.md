# Phase 02 — Authentication and Role Security Fix

**Date:** 2026-10-22
**Scope:** Signup role assignment, role-management authorization, Control Panel API roles, and developer task update privileges.
**Production target:** VPS PostgreSQL `sv_platform` only.

## Changes made

### Signup and role promotion

- Added [`20261108T180000_auth_security_fixes.sql`](../../supabase/migrations/20261108T180000_auth_security_fixes.sql).
- `public.handle_new_user()` now creates a profile and assigns the fixed `customer` role; it does not use caller metadata to select a role.
- Removed the signup-triggered first-admin bootstrap trigger. This prevents an ordinary public signup from receiving an administrator role when role state is empty.
- Removed the `Admins manage all roles` policy. Authenticated role inserts, role changes, and deletes are now allowed only by `super_admin` policies, including restrictive guards against another permissive policy widening writes.
- `user_roles` write grants are limited to inserting `user_id`/`role`, updating `role`, and deleting rows; identity and creation-time columns are not writable by authenticated clients.
- **Important provisioning condition:** a read-only production role count found **zero `super_admin` assignments** before migration. No user was promoted automatically. Until an owner provisions the first super-admin through an authorized out-of-band database operation, authenticated users cannot promote roles. Current admins no longer have that ability.

### Control Panel authorization

- Added `finance_manager` to [`COCKPIT_ROLES`](../../src/lib/control-panel/cockpit.ts), matching the route allowlist in [`RouteAccessGate.tsx`](../../src/components/auth/RouteAccessGate.tsx).
- Also removed `developer` and the obsolete `owner` alias from the API allowlist to match the guarded route’s actual roles. Without this alignment, a developer could call the cockpit API directly even when the UI route denied entry.

### Developer task updates

- Removed table-wide `UPDATE` for `PUBLIC`, `anon`, and `authenticated` on `developer_tasks`; removed any existing per-column update grants for those roles before regranting a narrow allowlist.
- Authenticated users can update only `status`, `progress_percent`, `progress_note`, `links`, `attachments`, `tech_stack`, and `delivery_notes`, subject to the existing developer-owned-row RLS policy and status guard.
- `developer_tasks` has no `assigned_to` or `payment_status` column. The corresponding critical fields are `developer_id` and `task_amount`; neither is granted for authenticated updates. Service-role server operations retain their existing privileges.

## Automated tests and SQL assertions

- [`cockpit.test.ts`](../../src/lib/control-panel/cockpit.test.ts) checks that `finance_manager` is included in both route and API role lists, and that `developer` and `owner` are not accepted by the API list.
- [`security-migration.test.ts`](../../src/lib/auth/security-migration.test.ts) checks signup role, super-admin-only policy, and task column grant contracts.
- Focused Vitest: **5 tests passed across 2 files**.
- Focused ESLint with the repository’s existing Prettier-rule exception: **passed with 0 errors and 1 existing React Fast Refresh warning** in `RouteAccessGate.tsx`.
- The migration includes PostgreSQL postcondition assertions for the effective function definition, dropped bootstrap trigger, role-policy write scope, exact task column privileges, and retained service-role access. These assertions passed during the production apply and a subsequent rollback-only rerun.

## Production change and verification

- Connected as the local PostgreSQL administrator and asserted `current_database() = 'sv_platform'` before applying the migration.
- Migration applied within a single transaction and committed; its postconditions passed. A second run inside `BEGIN … ROLLBACK` passed, confirming repeatability without persisting a second application.
- No signup, role promotion, task update, or business-row test was performed. No rows were inserted, updated, or deleted by the migration.
- Production backup: `/root/sv-seo-backup/auth-security-20261022T232329Z/`. The directory is mode `0700`; the custom-format dump covers `user_roles` and `developer_tasks`, was validated by `pg_restore -l`, and has SHA-256 `e85af799f9f791c8897ddc11ded6c34831f8e9b9948ac442b98f98d6a48d56b6`. A targeted rollback SQL script and pre-change function/policy snapshots are retained alongside it.
- Production app build/restart and live HTTP verification: **pending** at time of this report update.
- The separate `softwarevala` database was not targeted.

## Verification boundaries and follow-up

- The database migration’s grant/policy assertions are direct PostgreSQL checks. The unit tests are source-contract tests; they do not replace authenticated integration tests using separate developer, manager, and super-admin identities.
- No current production super-admin exists. The owner must choose and provision the first super-admin out of band before normal role promotion can resume.
- The first-super-admin provisioning procedure should be documented and independently reviewed; do not restore the former first-signup admin trigger.
