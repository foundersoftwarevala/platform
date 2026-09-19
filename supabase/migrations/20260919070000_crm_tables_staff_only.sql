-- CRM, sales, support and lead tables: staff only.
--
-- Every signed-in account - and anyone can sign up - could read the CRM
-- customers, sales leads, deals and commissions, support tickets and
-- escalations, live-chat sessions and messages, the outgoing e-mail queue, call
-- logs and the team list (policies "read <table>", SELECT, qual true), and could
-- read, create, change and delete every row of the fifteen lead_* tables
-- (policies "open_*", ALL, qual true, with check true). Anonymous callers were
-- already refused by the restrictive "anon_write_denied" policies; signed-in
-- customers were not.
--
-- These tables are read and written by staff screens only - the Sales & Support
-- dashboard, Sales CRM, Lead Manager, AMS chat and the Manager - and by the
-- website's lead intake, which runs on the server with the service role and is
-- not affected by RLS. The staff roles below are exactly the roles the route
-- gate admits to those screens (src/components/auth/RouteAccessGate.tsx) plus
-- the operator roles RequireRole always admits, so no staff screen loses
-- access. Writes on the CRM/support tables stay as they were
-- ("staff write <table>", is_support_staff).

create or replace function public.is_crm_staff(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id
      and role in (
        'boss', 'boss_owner', 'admin', 'super_admin', 'founder',
        'sales_support_manager', 'support', 'sales', 'marketing',
        'developer', 'finance'
      )
  );
$$;

revoke all on function public.is_crm_staff(uuid) from public, anon;
grant execute on function public.is_crm_staff(uuid) to authenticated, service_role;

-- Reads on the CRM / support tables.
do $$
declare
  t text;
begin
  foreach t in array array[
    'crm_customers', 'sales_leads', 'sales_deals', 'sales_commissions',
    'support_tickets', 'support_escalations', 'chat_messages', 'chat_sessions',
    'email_queue', 'call_logs', 'team_members', 'automation_rules',
    'wiki_articles', 'chatbots'
  ] loop
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'read ' || t) then
      execute format('alter policy %I on public.%I using (public.is_crm_staff(auth.uid()))', 'read ' || t, t);
    end if;
  end loop;
end $$;

-- The lead manager's tables: staff read and write.
do $$
declare
  p record;
begin
  for p in
    select tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename like 'lead\_%'
      and policyname like 'open\_%'
      and cmd = 'ALL'
  loop
    execute format(
      'alter policy %I on public.%I to authenticated using (public.is_crm_staff(auth.uid())) with check (public.is_crm_staff(auth.uid()))',
      p.policyname, p.tablename
    );
  end loop;
end $$;
