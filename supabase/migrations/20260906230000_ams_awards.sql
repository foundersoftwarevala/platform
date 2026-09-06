-- Awards, and the eligibility states the collection UI needs.
--
-- src/lib/ams/awards.api.ts carries the comment "TODO: replace with
-- supabase.from(\"awards\")… once the schema lands", and serves an in-memory
-- store that forgets everything on reload. The Award Management Center is
-- therefore a real screen editing nothing. This is the schema it was waiting
-- for, shaped to the Award interface already declared in src/lib/ams/types.ts
-- rather than to a new one, so the existing UI can be pointed at it without
-- changing its presentation layer.
--
-- Awards were also the one missing link in the per-stage chain. Trophies,
-- badges and achievements already exist at 180 each (18 roles x 10 stages);
-- awards did not exist at all.

create table if not exists public.awards (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  name              text not null,
  description       text not null default '',
  type              text not null default 'trophy',
  category          text,
  rarity            text not null default 'common',
  department        text,
  priority          int  not null default 0,
  status            text not null default 'published',
  visibility        text not null default 'public',
  media             jsonb not null default '{}'::jsonb,
  unlock_conditions jsonb not null default '[]'::jsonb,
  eligibility_rules jsonb not null default '[]'::jsonb,
  supported_modules jsonb not null default '[]'::jsonb,
  supported_roles   jsonb not null default '[]'::jsonb,
  rewards           jsonb not null default '{"xp":0,"coins":0,"rankImpact":0,"levelImpact":0,"monetaryValue":0}'::jsonb,
  -- The stage this award belongs to, so the chain can be assembled without
  -- parsing the slug.
  conditions        jsonb not null default '{}'::jsonb,
  versions          jsonb not null default '[]'::jsonb,
  audit             jsonb not null default '[]'::jsonb,
  created_by        uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists awards_role_stage_idx
  on public.awards ((conditions->>'role'), ((conditions->>'stage')::int));

-- Earned and claimed are different facts, so they are different columns rather
-- than one status that has to be interpreted.
create table if not exists public.user_awards (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  award_id   uuid not null references public.awards(id) on delete cascade,
  earned_at  timestamptz not null default now(),
  claimed_at timestamptz,
  unique (user_id, award_id)
);

alter table public.awards      enable row level security;
alter table public.user_awards enable row level security;

drop policy if exists awards_read on public.awards;
create policy awards_read on public.awards
  for select to authenticated using (true);

drop policy if exists awards_write on public.awards;
create policy awards_write on public.awards
  for all to authenticated
  using (public.ams_is_operator()) with check (public.ams_is_operator());

-- A person sees their own awards, an operator sees everyone's. Nobody may
-- insert their own: issuance belongs to the engine.
drop policy if exists user_awards_read on public.user_awards;
create policy user_awards_read on public.user_awards
  for select to authenticated
  using (user_id = auth.uid() or public.ams_is_operator());

do $$
declare t text;
begin
  foreach t in array array['awards','user_awards'] loop
    execute format('drop policy if exists %I on public.%I', t || '_anon_denied', t);
    execute format(
      'create policy %I on public.%I as restrictive to anon using (false) with check (false)',
      t || '_anon_denied', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- The stage awards themselves — the missing fourth asset class.
-- ---------------------------------------------------------------------------
-- Named from the curated stage titles already in production, so a person's
-- award, trophy, badge and achievement for a stage all say the same thing.

insert into public.awards
  (slug, name, description, type, category, rarity, priority, status, visibility,
   supported_roles, conditions, rewards)
select
  st.role || '-award-' || lpad(st.stage::text, 2, '0'),
  st.title || ' Award',
  'Awarded on reaching stage ' || st.stage || ' of the ' || initcap(st.role) || ' progression.',
  'achievement',
  case when st.role in ('developer','reseller','franchise','author','vendor','affiliate',
                        'influencer','support','manager')
       then st.role else 'global' end,
  case
    when st.stage <= 2 then 'common'
    when st.stage =  3 then 'uncommon'
    when st.stage =  4 then 'rare'
    when st.stage =  5 then 'epic'
    when st.stage =  6 then 'elite'
    when st.stage <= 8 then 'legendary'
    when st.stage =  9 then 'mythic'
    else 'founder'
  end,
  st.stage,
  'published',
  'role-restricted',
  jsonb_build_array(st.role),
  jsonb_build_object('role', st.role, 'stage', st.stage),
  jsonb_build_object('xp', 0, 'coins', 0, 'rankImpact', 0,
                     'levelImpact', 0, 'monetaryValue', 0)
from public.ams_role_stages st
on conflict (slug) do nothing;
-- Issue stage awards alongside the trophies and badges.
--
-- ams_evaluate_user already granted the trophy, badge and achievement for every
-- stage a person has reached. Awards did not exist as a table when it was
-- written, so the fourth asset class was silently absent from the chain. This
-- adds it in the same shape as the others: everything at or below the stage
-- actually reached, never anything above it.
--
-- Issuing is separate from claiming. The engine marks an award earned; only the
-- person can claim it, through ams_claim_award.

create or replace function public.ams_issue_awards(p_user_id uuid, p_role text, p_stage int)
returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.user_awards (user_id, award_id, earned_at)
  select p_user_id, a.id, now()
  from public.awards a
  where a.conditions->>'role' = p_role
    and (a.conditions->>'stage')::int <= p_stage
    and a.status = 'published'
    and not exists (select 1 from public.user_awards ua
                    where ua.user_id = p_user_id and ua.award_id = a.id)
  on conflict (user_id, award_id) do nothing;
  get diagnostics n = row_count;

  insert into public.ams_award_ledger (user_id, role, asset_kind, asset_slug, reason)
  select p_user_id, p_role, 'certificate', a.slug, 'stage ' || (a.conditions->>'stage')
  from public.awards a
  join public.user_awards ua on ua.award_id = a.id and ua.user_id = p_user_id
  where a.conditions->>'role' = p_role
    and ua.earned_at > now() - interval '5 seconds';

  return n;
end $$;

revoke all on function public.ams_issue_awards(uuid,text,int) from public;
revoke all on function public.ams_issue_awards(uuid,text,int) from anon;
revoke all on function public.ams_issue_awards(uuid,text,int) from authenticated;
