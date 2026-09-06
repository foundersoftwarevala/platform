-- Close the marketing tables that were open to every signed-in account.
--
-- Eighteen of the twenty-six marketing tables carried a proper role check.
-- Eight did not: they kept the source repository's original policy, written as
-- FOR ALL TO authenticated, anon USING (true), which grants everything to
-- everybody who is signed in. A restrictive deny policy kept anonymous callers
-- out, so this never showed up as an open API - but a customer account with no
-- marketing role could read and write the marketing audit log, the automation
-- rules, the SEO keyword set, the lead sources, the KPI snapshots, the location
-- targets and the message templates. That was verified against the live API
-- before this was written, not inferred.
--
-- Rather than copy the working expression an eighteenth time, the role test
-- becomes one function. All twenty-six tables call it, so the next person to
-- add a marketing table cannot get it subtly wrong, and changing who counts as
-- marketing staff is a single edit.
--
-- The role list is exactly the one the working tables already used, so no
-- existing access changes: this only removes access that should never have
-- been granted.

create or replace function public.marketing_is_operator()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.has_role(auth.uid(), 'admin'::app_role)
    or public.has_role(auth.uid(), 'boss'::app_role)
    or public.has_role(auth.uid(), 'founder'::app_role)
    or public.has_role(auth.uid(), 'super_admin'::app_role)
    or public.has_role(auth.uid(), 'boss_owner'::app_role)
    or public.has_role(auth.uid(), 'marketing'::app_role)
    or public.has_role(auth.uid(), 'influencer'::app_role)
    or public.has_role(auth.uid(), 'developer'::app_role);
$$;

revoke all on function public.marketing_is_operator() from public, anon;
grant execute on function public.marketing_is_operator() to authenticated;

do $$
declare
  t text;
  tables text[] := array[
    'marketing_ad_groups','marketing_ai_recommendations','marketing_alerts',
    'marketing_approvals','marketing_audit_logs','marketing_automations',
    'marketing_budgets','marketing_campaigns','marketing_channel_performance',
    'marketing_compliance_records','marketing_content_items','marketing_creatives',
    'marketing_influencers','marketing_kpi_snapshots','marketing_lead_sources',
    'marketing_leads','marketing_locations','marketing_messages','marketing_offers',
    'marketing_regions','marketing_reports','marketing_schedules',
    'marketing_seo_keywords','marketing_seo_pages','marketing_social_posts',
    'marketing_templates'
  ];
begin
  foreach t in array tables
  loop
    -- Nothing on this module is reachable without an account.
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('alter table public.%I enable row level security', t);

    -- Replace whatever was there with one rule, named the same everywhere.
    execute format('drop policy if exists "Marketing console full access" on public.%I', t);
    execute format('drop policy if exists "Influencer manager access" on public.%I', t);
    execute format('drop policy if exists marketing_operator_access on public.%I', t);
    execute format($p$
      create policy marketing_operator_access on public.%I
      for all to authenticated
      using (public.marketing_is_operator())
      with check (public.marketing_is_operator())
    $p$, t);

    -- Keep the restrictive deny: belt as well as braces, and it is what kept
    -- anonymous callers out while the permissive policy was wrong.
    execute format('drop policy if exists anon_write_denied on public.%I', t);
    execute format($p$
      create policy anon_write_denied on public.%I
      as restrictive for all to anon
      using (false) with check (false)
    $p$, t);
  end loop;
end $$;

-- Section 25: audit history is immutable. A policy alone would not do it, since
-- a role that bypasses policies would still get through; the trigger holds for
-- everyone.
create or replace function public.marketing_audit_is_append_only()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'the marketing audit log is append-only; % is not permitted', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists marketing_audit_no_rewrite on public.marketing_audit_logs;
create trigger marketing_audit_no_rewrite
before update or delete on public.marketing_audit_logs
for each row execute function public.marketing_audit_is_append_only();

-- Reading the trail is for marketing staff; writing to it is for anyone whose
-- action needs recording, which is why insert stays open to authenticated.
drop policy if exists marketing_operator_access on public.marketing_audit_logs;
drop policy if exists marketing_audit_read on public.marketing_audit_logs;
drop policy if exists marketing_audit_insert on public.marketing_audit_logs;
create policy marketing_audit_read on public.marketing_audit_logs
for select to authenticated using (public.marketing_is_operator());
create policy marketing_audit_insert on public.marketing_audit_logs
for insert to authenticated with check (true);

drop trigger if exists marketing_audit_no_rewrite on public.marketing_audit_logs;
CREATE TRIGGER marketing_audit_no_rewrite BEFORE DELETE OR UPDATE ON public.marketing_audit_logs FOR EACH ROW EXECUTE FUNCTION marketing_audit_is_append_only();
