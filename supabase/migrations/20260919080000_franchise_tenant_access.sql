-- Franchise data: each franchise sees its own, franchise staff see all.
--
-- The franchise tables already had a tenant model - franchise_has_access()
-- (the owner, or an active member of the franchise, or a franchise admin) and
-- owner/tenant policies on franchises, franchise_branches, franchise_employees,
-- franchise_leads and franchise_users. But blanket permissive policies sat
-- beside it - "franchise_authenticated_write" (ALL, true) and
-- "franchise_public_read" (SELECT, true) - and permissive policies are OR'ed,
-- so any signed-in account could read and change every franchise's contracts,
-- royalties, documents, compliance, fraud alerts, performance, notifications,
-- escalations and settings, the territories, and every franchise application.
-- Anonymous callers were already refused (restrictive "anon_write_denied").
--
-- The blanket policies are removed. Who keeps access:
--   - franchise staff: the roles the /franchise-manager route admits
--     (src/components/auth/RouteAccessGate.tsx) and the operator roles
--     RequireRole always admits - they manage every franchise;
--   - a franchise's owner and active members, for their own franchise's rows
--     (franchise_has_access).
-- The screens read these tables with the signed-in user's session
-- (src/lib/franchise/api.ts), so staff keep seeing everything and a franchise
-- owner sees their own.

create or replace function public.is_franchise_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
      and lower(role::text) in (
        'admin', 'boss', 'super_admin', 'boss_owner', 'founder',
        'finance', 'support', 'sales_support_manager'
      )
  );
$$;

revoke all on function public.is_franchise_staff() from public, anon;
grant execute on function public.is_franchise_staff() to authenticated, service_role;

-- 1. The blanket policies.
do $$
declare
  p record;
begin
  for p in
    select tablename, policyname from pg_policies
    where schemaname = 'public'
      and (tablename like 'franchise%' or tablename = 'territories')
      and policyname in (
        'franchise_authenticated_write', 'franchise_public_read',
        'franchise_applications_authenticated_write', 'franchise_applications_public_read',
        'franchise_audit_public_read'
      )
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- 2. Tables that belong to one franchise: its owner/members, and staff.
do $$
declare
  t text;
begin
  foreach t in array array[
    'franchise_compliance', 'franchise_contracts', 'franchise_documents',
    'franchise_escalations', 'franchise_fraud_alerts', 'franchise_notifications',
    'franchise_performance', 'franchise_royalties'
  ] loop
    execute format('drop policy if exists franchise_tenant_access on public.%I', t);
    execute format(
      'create policy franchise_tenant_access on public.%I for all to authenticated '
      'using (public.is_franchise_staff() or public.franchise_has_access(franchise_id)) '
      'with check (public.is_franchise_staff() or public.franchise_has_access(franchise_id))',
      t
    );
  end loop;
end $$;

-- 3. Franchises themselves: owners keep franchises_owner_access; staff manage all.
drop policy if exists franchises_staff_access on public.franchises;
create policy franchises_staff_access on public.franchises for all to authenticated
  using (public.is_franchise_staff()) with check (public.is_franchise_staff());

-- 4. Applications and the audit trail: staff only (the audit insert policy stays).
drop policy if exists franchise_applications_staff_access on public.franchise_applications;
create policy franchise_applications_staff_access on public.franchise_applications for all to authenticated
  using (public.is_franchise_staff()) with check (public.is_franchise_staff());
drop policy if exists franchise_audit_staff_read on public.franchise_audit_logs;
create policy franchise_audit_staff_read on public.franchise_audit_logs for select to authenticated
  using (public.is_franchise_staff());

-- 5. Network-wide reference data (no franchise_id): readable by signed-in
--    accounts, changed by staff only.
do $$
declare
  t text;
begin
  foreach t in array array['franchise_settings', 'territories'] loop
    execute format('drop policy if exists franchise_reference_read on public.%I', t);
    execute format('create policy franchise_reference_read on public.%I for select to authenticated using (true)', t);
    execute format('drop policy if exists franchise_reference_staff_write on public.%I', t);
    execute format(
      'create policy franchise_reference_staff_write on public.%I for all to authenticated '
      'using (public.is_franchise_staff()) with check (public.is_franchise_staff())',
      t
    );
  end loop;
end $$;
