-- Tell the seeded demo data apart from real marketing.
--
-- Every marketing table arrived pre-populated from the source repository's
-- migration, and between them those rows assert a spend of about 20.7 lakh, a
-- revenue of about 2.62 crore and 12,451 leads - behind which sit ten actual
-- lead records. The campaign owners are free-text names matching nobody, and
-- the channel revenue is a second fabricated total that happens to agree.
--
-- Every one of the briefs for this platform says the same thing about that:
-- performance figures must be real, revenue must not be hardcoded, and where
-- seed data is needed it must be clearly isolated from production. It is not
-- deleted here - nothing in this project is - but it stops being
-- indistinguishable from money the business actually made.
--
-- Two changes. Every seeded row is flagged, so a screen can say plainly what it
-- is showing and a query can exclude it. And campaigns gain a real owner
-- reference, so an owner is an account rather than a name typed into a column.

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
    execute format(
      'alter table public.%I add column if not exists is_seed boolean not null default false', t);
    -- Everything present at this moment came from the source migration; nothing
    -- real has been entered yet.
    execute format('update public.%I set is_seed = true where is_seed = false', t);
    execute format('create index if not exists %I on public.%I(is_seed)',
                   t || '_is_seed_idx', t);
  end loop;
end $$;

-- Audit rows are append-only, so the flag had to be added before the trigger
-- could refuse it; put it back the way it was.
alter table public.marketing_audit_logs alter column is_seed set default false;

-- Section 27 and 39: an owner is a person the platform already knows, not a
-- string. The name stays for display where it matches nobody.
alter table public.marketing_campaigns
  add column if not exists owner_id uuid,
  add column if not exists created_by uuid;

create index if not exists marketing_campaigns_owner_idx on public.marketing_campaigns(owner_id);

update public.marketing_campaigns c
   set owner_id = p.id
  from public.profiles p
 where c.owner_id is null
   and lower(p.full_name) = lower(c.owner);

-- What the console should say out loud.
create or replace function public.marketing_seed_summary()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- Deliberately counts rather than trusts: a screen asking "is any of this
  -- demonstration data?" gets the answer from the rows themselves.
  select jsonb_build_object(
    'seed_campaigns',      (select count(*) from public.marketing_campaigns where is_seed),
    'real_campaigns',      (select count(*) from public.marketing_campaigns where not is_seed),
    'seed_revenue',        (select coalesce(sum(revenue), 0) from public.marketing_campaigns where is_seed),
    'real_revenue',        (select coalesce(sum(revenue), 0) from public.marketing_campaigns where not is_seed),
    'seed_spend',          (select coalesce(sum(spend), 0) from public.marketing_campaigns where is_seed),
    'real_spend',          (select coalesce(sum(spend), 0) from public.marketing_campaigns where not is_seed),
    'seed_leads',          (select coalesce(sum(leads), 0) from public.marketing_campaigns where is_seed),
    'real_leads',          (select coalesce(sum(leads), 0) from public.marketing_campaigns where not is_seed),
    'lead_records',        (select count(*) from public.marketing_leads),
    'any_seed_present',    (select exists (select 1 from public.marketing_campaigns where is_seed))
  );
$$;

revoke all on function public.marketing_seed_summary() from public, anon;
grant execute on function public.marketing_seed_summary() to authenticated;
