-- Influencer Manager, on the tables and the attribution engine that exist.
--
-- Nothing is duplicated here. The brief's list would have created
-- influencer_tracking_links, influencer_conversions and an attribution engine,
-- and all three already exist in a better place:
--
--   marketplace_referral_codes      carries affiliate_partner_id AND
--                                   influencer_profile_id — built for both
--   marketplace_referral_sessions   the visit, with a first-party session key
--   marketplace_order_attributions  which order belongs to whom, last-click
--
-- Section 35 says exactly this: do not build a second attribution engine. So
-- influencers are given codes in the canonical table rather than a parallel one.
--
-- Two honest gaps are recorded rather than papered over.
--
-- First: not one of the six referral codes belongs to an influencer. Every one
-- is an affiliate's. An influencer therefore cannot be tracked at all today,
-- which is what mm_influencer_code_create fixes.
--
-- Second, and not fixable here: no paid order carries an attribution. The
-- engine is complete — /api/track/ref records the visit and attributeOrder
-- writes the attribution — but attributeOrder is only reachable through
-- /api/affiliate/attribute, and nothing calls it, because there is no checkout
-- in this project to call it from. marketplace_referral_sessions has no user
-- column either, so the database cannot join a session to a buyer on its own;
-- that has to happen in the request that carries the cookie. Until a checkout
-- exists, a click can be recorded and a conversion cannot.

/* ------------------------------------------------------------ the overview */

create or replace function public.mm_influencers(p_query jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_search text := nullif(btrim(coalesce(p_query->>'search','')), '');
  v_status text := nullif(p_query->>'status','');
  v_limit  integer := least(greatest(coalesce((p_query->>'limit')::int, 50), 1), 200);
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  return jsonb_build_object(
    'ok', true,
    'creators',      (select count(*) from public.influencer_profiles),
    'by_status', coalesce((
      select jsonb_object_agg(coalesce(status,'unknown'), n)
        from (select status, count(*) n from public.influencer_profiles group by status) t),
      '{}'::jsonb),
    'applications',  (select count(*) from public.influencer_applications),
    'social_accounts', (select count(*) from public.influencer_social_accounts),
    -- Declared by the creator on their application. No platform API has
    -- confirmed these, which is what 'declared' in the name is there to say.
    'declared_followers', (select coalesce(sum(followers),0)
                             from public.influencer_social_accounts),
    'verified_accounts', (select count(*) from public.influencer_social_accounts
                           where verification_status = 'verified'),
    'agreements',    (select count(*) from public.influencer_agreements),
    'assignments',   (select count(*) from public.influencer_campaign_assignments),

    -- Money, from the tables that record it rather than a headline figure.
    'earnings_gross', (select coalesce(sum(gross_amount),0) from public.influencer_earnings),
    'earnings_net',   (select coalesce(sum(net_amount),0) from public.influencer_earnings),
    'payouts_total',  (select coalesce(sum(amount),0) from public.influencer_payouts),
    'payouts_paid',   (select coalesce(sum(amount),0) from public.influencer_payouts
                        where status = 'paid'),
    'payouts_pending',(select coalesce(sum(amount),0) from public.influencer_payouts
                        where status in ('pending','approved','processing')),

    -- Tracking, through the canonical referral tables.
    'referral_codes', (select count(*) from public.marketplace_referral_codes
                        where influencer_profile_id is not null),
    'sessions',       (select count(*) from public.marketplace_referral_sessions
                        where influencer_profile_id is not null),
    'conversions',    (select count(*) from public.marketplace_order_attributions
                        where influencer_profile_id is not null),

    -- What cannot be answered, and why. Each of these needs something that is
    -- genuinely absent, and a zero on its own would read as "none happened".
    'unavailable', jsonb_build_object(
      'conversions', 'No paid order carries an attribution. attributeOrder() exists but is only reachable through /api/affiliate/attribute, and nothing calls it because there is no checkout to call it from.',
      'verified_reach', 'Follower and engagement figures are the creator''s own declaration from their application. No social platform API is connected, so none of them has been confirmed or refreshed since.',
      'roi',         'ROI needs attributed revenue against recorded spend; attribution does not complete yet.'),

    'profiles', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'name', p.full_name, 'email', p.email,
               'country', p.country, 'region', p.region, 'niche', p.niche,
               'status', p.status, 'created_at', p.created_at,
               'social_accounts', (select count(*) from public.influencer_social_accounts s
                                    where s.profile_id = p.id),
               'referral_codes', (select count(*) from public.marketplace_referral_codes c
                                   where c.influencer_profile_id = p.id),
               'earnings_net', (select coalesce(sum(e.net_amount),0)
                                  from public.influencer_earnings e where e.profile_id = p.id),
               'payouts_paid', (select coalesce(sum(o.amount),0)
                                  from public.influencer_payouts o
                                 where o.profile_id = p.id and o.status='paid'))
             order by p.created_at desc)
        from (select * from public.influencer_profiles p2
               where (v_status is null or p2.status = v_status)
                 and (v_search is null
                      or p2.full_name ilike '%'||v_search||'%'
                      or coalesce(p2.email,'') ilike '%'||v_search||'%'
                      or coalesce(p2.niche,'') ilike '%'||v_search||'%')
               order by p2.created_at desc limit v_limit) p), '[]'::jsonb));
end;
$$;

/* -------------------------------------------------- referral code creation */

-- Give an influencer a referral code, in the canonical table.
--
-- The code is unguessable and collision-checked, and it is written to
-- marketplace_referral_codes with influencer_profile_id set — the same table
-- and the same column the attribution engine already reads, so a code created
-- here is tracked by the machinery that is already running rather than by a
-- second one built alongside it.
create or replace function public.mm_influencer_code_create(
  p_profile uuid, p_code text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp, extensions
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_name text;
  v_code text;
  v_bytes bytea;
  i integer;
  v_row jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select full_name into v_name from public.influencer_profiles where id = p_profile;
  if v_name is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_influencer');
  end if;

  if p_code is not null and btrim(p_code) <> '' then
    v_code := upper(regexp_replace(btrim(p_code), '[^A-Za-z0-9-]', '', 'g'));
    if length(v_code) < 3 then
      return jsonb_build_object('ok', false, 'reason', 'code_too_short');
    end if;
    if exists (select 1 from public.marketplace_referral_codes where upper(code) = v_code) then
      return jsonb_build_object('ok', false, 'reason', 'code_taken',
        'message', 'Another referral code already uses that word.');
    end if;
  else
    -- Eight characters over an alphabet with no I, L, O, 0 or 1, so a creator
    -- can read it out on camera without it being mistyped.
    for attempt in 1..10 loop
      v_code := '';
      v_bytes := gen_random_bytes(8);
      for i in 0..7 loop
        v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % length(v_alphabet)) + 1, 1);
      end loop;
      exit when not exists (
        select 1 from public.marketplace_referral_codes where upper(code) = v_code);
      v_code := null;
    end loop;
    if v_code is null then
      return jsonb_build_object('ok', false, 'reason', 'could_not_generate');
    end if;
  end if;

  insert into public.marketplace_referral_codes (influencer_profile_id, code, active)
  values (p_profile, v_code, true)
  returning to_jsonb(marketplace_referral_codes) into v_row;

  perform public.mm_audit('influencer.code_created', 'influencer_profile',
                          p_profile::text, null,
                          jsonb_build_object('code', v_code, 'influencer', v_name), null);

  return jsonb_build_object('ok', true, 'code', v_code, 'row', v_row,
    -- The link a creator actually shares.
    'share_url', 'https://softwarevala.net/?ref=' || v_code);
end;
$$;

create or replace function public.mm_influencer_status(
  p_profile uuid, p_to text, p_reason text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_before jsonb; v_after jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  -- These four are what influencer_profiles_status_check permits.
  if p_to not in ('pending','active','suspended','inactive') then
    return jsonb_build_object('ok', false, 'reason', 'unknown_status');
  end if;

  select to_jsonb(p) into v_before from public.influencer_profiles p where p.id = p_profile;
  if v_before is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_influencer');
  end if;

  update public.influencer_profiles
     set status = p_to, updated_at = now()
   where id = p_profile
  returning to_jsonb(influencer_profiles) into v_after;

  -- A suspended or terminated creator's codes stop working, or the tracking
  -- would keep crediting somebody who is no longer active.
  if p_to in ('suspended','inactive') then
    update public.marketplace_referral_codes
       set active = false, updated_at = now()
     where influencer_profile_id = p_profile and active;
  elsif p_to = 'active' then
    update public.marketplace_referral_codes
       set active = true, updated_at = now()
     where influencer_profile_id = p_profile and not active;
  end if;

  perform public.mm_audit('influencer.' || p_to, 'influencer_profile',
                          p_profile::text, v_before, v_after, p_reason);

  -- The creator is told, through the notification engine rather than a second
  -- one. It reaches their bell if they have an account.
  if (v_after->>'user_id') is not null then
    perform public.mm_notify(
      'influencer.' || p_to,
      case p_to when 'active' then 'Your creator account is approved'
                when 'suspended' then 'Your creator account is suspended'
                when 'inactive' then 'Your creator account is now inactive'
                else 'Your creator account status changed' end,
      coalesce(p_reason, ''),
      (v_after->>'user_id')::uuid, null, '/influencer-manager', 'Open',
      5,
      case p_to when 'active' then 'success'
                when 'suspended' then 'danger'
                when 'inactive' then 'warning' else 'info' end);
  end if;

  return jsonb_build_object('ok', true, 'influencer', v_after);
end;
$$;

/* --------------------------------------------------------------------- RLS */

alter table public.influencer_profiles enable row level security;
alter table public.influencer_earnings enable row level security;
alter table public.influencer_payouts  enable row level security;

-- A creator sees their own record and nothing else; operators see all. Never
-- USING(true) on a table carrying earnings.
drop policy if exists influencer_profiles_own on public.influencer_profiles;
create policy influencer_profiles_own on public.influencer_profiles
  for select to authenticated
  using (user_id = auth.uid() or public.mm_is_operator());

drop policy if exists influencer_profiles_operator on public.influencer_profiles;
create policy influencer_profiles_operator on public.influencer_profiles
  for all to authenticated
  using (public.mm_is_operator()) with check (public.mm_is_operator());

drop policy if exists influencer_earnings_own on public.influencer_earnings;
create policy influencer_earnings_own on public.influencer_earnings
  for select to authenticated
  using (public.mm_is_operator()
         or exists (select 1 from public.influencer_profiles p
                     where p.id = influencer_earnings.profile_id and p.user_id = auth.uid()));

drop policy if exists influencer_payouts_own on public.influencer_payouts;
create policy influencer_payouts_own on public.influencer_payouts
  for select to authenticated
  using (public.mm_is_operator()
         or exists (select 1 from public.influencer_profiles p
                     where p.id = influencer_payouts.profile_id and p.user_id = auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['influencer_profiles','influencer_earnings','influencer_payouts'] loop
    execute format('drop policy if exists %I on public.%I', t || '_anon_sel', t);
    execute format('create policy %I on public.%I as restrictive for select to anon using (false)',
                   t || '_anon_sel', t);
    execute format('drop policy if exists %I on public.%I', t || '_anon_ins', t);
    execute format('create policy %I on public.%I as restrictive for insert to anon with check (false)',
                   t || '_anon_ins', t);
    execute format('drop policy if exists %I on public.%I', t || '_anon_upd', t);
    execute format('create policy %I on public.%I as restrictive for update to anon using (false) with check (false)',
                   t || '_anon_upd', t);
  end loop;
end;
$$;

create index if not exists influencer_profiles_user_idx on public.influencer_profiles (user_id);
create index if not exists influencer_earnings_profile_idx on public.influencer_earnings (profile_id);
create index if not exists influencer_payouts_profile_idx on public.influencer_payouts (profile_id, status);
create index if not exists referral_codes_influencer_idx
  on public.marketplace_referral_codes (influencer_profile_id) where influencer_profile_id is not null;
