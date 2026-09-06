-- The role chain, with real eligibility states.
--
-- This is what the collection UI asks for when a role is selected: the whole
-- ten-stage chain for that role, each stage carrying its trophy, award, badge
-- and achievement, and each of those carrying the state this person is
-- actually in.
--
-- The five states are computed, never stored as a guess:
--
--   LOCKED       the person has not reached the stage below it either
--   IN PROGRESS  they are working toward it and real XP has moved
--   ELIGIBLE     the requirement is met but the asset has not been issued yet
--                (the window between an event landing and the sweep running)
--   EARNED       issued, and recorded in a user_* table
--   CLAIMED      the person has claimed it
--
-- Nothing here invents progress. Every number comes from xp_transactions,
-- which come from ams_activity_events, which come from real platform work. A
-- person with no activity gets a chain of LOCKED stages and zero progress —
-- the honest empty state, not a demonstration.

-- The state rule, in one place so trophy, award, badge and achievement cannot
-- drift apart.
create or replace function public.ams_asset_state(
  p_user     uuid,
  p_xp       bigint,
  p_min_xp   bigint,
  p_stage    int,
  p_earned   boolean,
  p_claimed  boolean
) returns text
language sql immutable as $$
  select case
    when p_user is null            then 'locked'
    when p_claimed                 then 'claimed'
    when p_earned                  then 'earned'
    -- Requirement met, issuance not yet run.
    when p_xp >= p_min_xp          then 'eligible'
    -- Working toward it: any XP at all counts as started, and stage 1 is
    -- always the one in progress for a new person.
    when p_xp > 0 or p_stage = 1   then 'in_progress'
    else 'locked'
  end;
$$;

create or replace function public.ams_role_chain(
  p_role    text,
  p_user_id uuid default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_target  uuid;
  v_xp      bigint := 0;
  v_stage   int := 0;
  v_chain   jsonb;
begin
  -- Default to the caller. An operator may ask about somebody else; nobody
  -- else can, so a role filter cannot become a way to read a colleague's
  -- standing.
  v_target := coalesce(p_user_id, auth.uid());
  if v_target is distinct from auth.uid() and not public.ams_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  if v_target is not null then
    select coalesce(total_xp, 0), coalesce(current_level, 0)
      into v_xp, v_stage
    from public.user_xp where user_id = v_target;
    v_xp := coalesce(v_xp, 0);
    v_stage := coalesce(v_stage, 0);
  end if;

  select jsonb_agg(row_to_json(s)::jsonb order by s.stage) into v_chain
  from (
    select
      st.stage,
      st.title,
      st.tagline,
      st.min_xp,
      -- What it takes to finish this stage, so the UI can draw a real bar.
      (select min_xp from public.ams_role_stages n
        where n.role = st.role and n.stage = st.stage + 1) as next_min_xp,
      case
        when v_target is null then 0
        when v_xp >= coalesce((select min_xp from public.ams_role_stages n
                               where n.role = st.role and n.stage = st.stage + 1),
                              st.min_xp) then 100
        when v_xp <= st.min_xp then 0
        else floor(
          (v_xp - st.min_xp)::numeric * 100
          / nullif((select min_xp from public.ams_role_stages n
                    where n.role = st.role and n.stage = st.stage + 1) - st.min_xp, 0)
        )::int
      end as progress_pct,

      -- Each asset class, with the state this person is in for it.
      jsonb_build_object(
        'slug',  t.slug,
        'name',  t.name,
        'tier',  t.tier,
        'state', public.ams_asset_state(
                   v_target, v_xp, st.min_xp, st.stage,
                   exists (select 1 from public.user_trophies ut
                           where ut.user_id = v_target and ut.trophy_id = t.id),
                   false)
      ) as trophy,

      jsonb_build_object(
        'slug',  aw.slug,
        'name',  aw.name,
        'rarity', aw.rarity,
        'state', public.ams_asset_state(
                   v_target, v_xp, st.min_xp, st.stage,
                   exists (select 1 from public.user_awards ua
                           where ua.user_id = v_target and ua.award_id = aw.id),
                   exists (select 1 from public.user_awards ua
                           where ua.user_id = v_target and ua.award_id = aw.id
                             and ua.claimed_at is not null))
      ) as award,

      jsonb_build_object(
        'slug',  b.slug,
        'name',  b.name,
        'rarity', b.rarity,
        'state', public.ams_asset_state(
                   v_target, v_xp, st.min_xp, st.stage,
                   exists (select 1 from public.user_badges ub
                           where ub.user_id = v_target and ub.badge_id = b.id),
                   false)
      ) as badge,

      jsonb_build_object(
        'slug',  ac.slug,
        'name',  ac.name,
        'rarity', ac.rarity,
        'state', public.ams_asset_state(
                   v_target, v_xp, st.min_xp, st.stage,
                   exists (select 1 from public.user_achievements ua
                           where ua.user_id = v_target and ua.achievement_id = ac.id
                             and ua.unlocked_at is not null),
                   false)
      ) as achievement,

      -- Rank and level share the stage number, and the passport records the
      -- stage a person actually holds.
      jsonb_build_object(
        'rank',  (select name from public.ranks  where rank_number  = st.stage),
        'level', (select name from public.levels where level_number = st.stage)
      ) as standing

    from public.ams_role_stages st
    left join public.trophies     t  on t.conditions->>'role'  = st.role
                                    and (t.conditions->>'stage')::int  = st.stage
    left join public.awards       aw on aw.conditions->>'role' = st.role
                                    and (aw.conditions->>'stage')::int = st.stage
    left join public.badges       b  on b.conditions->>'role'  = st.role
                                    and (b.conditions->>'stage')::int  = st.stage
    left join public.achievements ac on ac.conditions->>'role' = st.role
                                    and (ac.conditions->>'stage')::int = st.stage
    where st.role = p_role
  ) s;

  return jsonb_build_object(
    'ok', true,
    'role', p_role,
    -- Null when nobody is signed in: the UI shows the chain as a catalogue
    -- rather than pretending it belongs to someone.
    'user_id', v_target,
    'total_xp', v_xp,
    'current_stage', v_stage,
    'passport', (select jsonb_build_object('passport_no', passport_no,
                                           'verification', verification,
                                           'issued_at', issued_at)
                 from public.ams_passports where user_id = v_target),
    'stages', coalesce(v_chain, '[]'::jsonb));
end $$;


grant execute on function public.ams_asset_state(uuid,bigint,bigint,int,boolean,boolean) to authenticated;
grant execute on function public.ams_role_chain(text,uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Claiming.
-- ---------------------------------------------------------------------------
-- A person may claim what they have already earned, and nothing else. This is
-- the one AMS write a signed-in person is allowed, and it can only move an
-- award they already hold from earned to claimed.

create or replace function public.ams_claim_award(p_award_slug text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_award uuid; v_row public.user_awards;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;

  select id into v_award from public.awards where slug = p_award_slug;
  if v_award is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_award');
  end if;

  select * into v_row from public.user_awards
  where user_id = auth.uid() and award_id = v_award;

  -- Not earned means not claimable. There is deliberately no branch here that
  -- creates the row.
  if v_row.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_earned');
  end if;
  if v_row.claimed_at is not null then
    return jsonb_build_object('ok', true, 'already_claimed', true);
  end if;

  update public.user_awards set claimed_at = now()
  where id = v_row.id;

  insert into public.ams_award_ledger (user_id, role, asset_kind, asset_slug, reason)
  select auth.uid(), coalesce(a.conditions->>'role','-'), 'certificate', a.slug, 'claimed'
  from public.awards a where a.id = v_award;

  return jsonb_build_object('ok', true, 'claimed', p_award_slug);
end $$;

grant execute on function public.ams_claim_award(text) to authenticated;
