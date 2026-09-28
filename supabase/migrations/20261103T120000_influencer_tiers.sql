-- Influencer tiers: the influencer equivalent of the reseller's three plans.
--
-- Influencer Manager has carried a "Tiers & Levels" section since it was built,
-- with nothing behind it, because the platform had no idea of a tier. This is
-- that idea, modelled on how creator programmes actually work rather than on
-- how the reseller programme works, because the two are not the same shape:
--
--   reseller_membership_plans  Starter $99 / 20%, Professional $249 / 30%,
--                              Master $499 / 40% - the reseller BUYS a margin.
--
--   influencer tiers           free, and EARNED. No global creator programme
--                              charges the creator: YouTube's Partner Programme
--                              qualifies on subscribers and watch hours, TikTok
--                              Creator Rewards on 10,000 followers and 100,000
--                              views in 30 days, Amazon Influencer on an
--                              existing audience - and each pays a rising share
--                              as the creator delivers more.
--
-- So a tier is a qualification and a rate, not a price. The thresholds below
-- follow the lines the industry actually uses - 10,000 for the first paid tier
-- and 100,000 for the macro tier - and the rates sit deliberately below the
-- reseller ladder, because a reseller pays between $99 and $499 for their margin
-- and an influencer pays nothing for theirs.
--
-- Every figure is a column, editable from Influencer Manager. None of it is
-- hardcoded anywhere in the application, so the owner can change a rate or a
-- threshold without a deployment.

create table if not exists public.influencer_tiers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  -- What a referred, paid sale pays at this tier.
  commission_percent numeric(6,3) not null check (commission_percent >= 0 and commission_percent <= 100),
  -- How the influencer reaches it. Either threshold qualifies, not both.
  min_verified_followers bigint not null default 0,
  min_sales_90d integer not null default 0,
  min_revenue_180d numeric(20,4) not null default 0,
  -- How long a commission is held before it can be paid, and the smallest
  -- payout that will be raised. Both tighten as the tier rises.
  hold_days integer not null default 30 check (hold_days >= 0),
  payout_floor numeric(20,4) not null default 0,
  currency char(3) not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  benefits jsonb not null default '[]'::jsonb,
  recommended boolean not null default false,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.influencer_tiers is
  'What an influencer earns and what they had to do to earn it. Free and qualified, the way YouTube, TikTok and Amazon run their creator programmes - not bought, the way a reseller membership is.';

-- The three tiers. Inserted once; an existing row is left exactly as the owner
-- has it, so re-running this never overwrites a rate he has changed.
insert into public.influencer_tiers
  (code, name, commission_percent, min_verified_followers, min_sales_90d, min_revenue_180d,
   hold_days, payout_floor, currency, benefits, recommended, enabled, sort_order)
values
  ('creator', 'Creator', 8, 0, 0, 0, 30, 2000, 'INR',
   '["One verified social account", "Referral links for the whole catalogue", "Campaign briefs open to all creators", "Monthly payout"]'::jsonb,
   false, true, 1),
  ('pro_creator', 'Pro Creator', 12, 10000, 5, 0, 21, 1000, 'INR',
   '["Everything in Creator", "Priority on paid campaign briefs", "Custom coupon code", "Shorter 21 day hold", "Fortnightly payout"]'::jsonb,
   true, true, 2),
  ('elite_partner', 'Elite Partner', 18, 100000, 0, 100000, 14, 500, 'INR',
   '["Everything in Pro Creator", "Named partner manager", "First look at new products", "Co-branded landing pages", "14 day hold, weekly payout"]'::jsonb,
   false, true, 3)
on conflict (code) do nothing;

-- ------------------------------------------------------------ who is on which
alter table public.influencer_profiles
  add column if not exists tier_code text references public.influencer_tiers(code) on delete set null,
  add column if not exists tier_since timestamptz;

create index if not exists influencer_profiles_tier_idx on public.influencer_profiles(tier_code);

-- Everyone already approved starts on the entry tier. Nobody is promoted here;
-- promotion is earned and is decided by the function below.
update public.influencer_profiles
   set tier_code = 'creator', tier_since = coalesce(tier_since, created_at)
 where tier_code is null;

alter table public.influencer_profiles
  alter column tier_code set default 'creator';

-- ------------------------------------------------- what an influencer qualifies for
--
-- Returns the highest tier the influencer has actually earned, from their own
-- verified followers and their own delivered sales. Nothing is assumed and no
-- tier is granted for signing up: the entry tier is the floor.
create or replace function public.influencer_tier_earned(p_profile uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with mine as (
    select
      (select coalesce(sum(followers), 0)::bigint
         from public.influencer_social_accounts
        where profile_id = p_profile and verification_status = 'verified') as followers,
      (select count(*)
         from public.marketplace_order_attributions a
         join public.marketplace_orders o on o.id = a.order_id
        where a.influencer_profile_id = p_profile
          and o.status = 'paid'
          and a.attributed_at > now() - interval '90 days') as sales_90d,
      (select coalesce(sum(c.gross_amount), 0)::numeric
         from public.partner_commissions c
        where c.partner_kind = 'influencer' and c.partner_id = p_profile
          and c.status <> 'reversed'
          and c.earned_at > now() - interval '180 days') as revenue_180d
  )
  select t.code
    from public.influencer_tiers t, mine m
   where t.enabled
     and (
       (t.min_verified_followers > 0 and m.followers >= t.min_verified_followers)
       or (t.min_sales_90d > 0 and m.sales_90d >= t.min_sales_90d)
       or (t.min_revenue_180d > 0 and m.revenue_180d >= t.min_revenue_180d)
       or (t.min_verified_followers = 0 and t.min_sales_90d = 0 and t.min_revenue_180d = 0)
     )
   order by t.commission_percent desc
   limit 1;
$$;

-- ------------------------------------------------------------- the promotion run
--
-- Promotes every influencer who has earned a higher tier, and records each
-- promotion in the audit log and as a notice to the influencer. It never
-- demotes: an influencer who reached a tier keeps it, because taking away a
-- rate someone earned is a business decision and not something a nightly job
-- should do on its own.
create or replace function public.influencer_tier_evaluate()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  v_earned text;
  v_promoted integer := 0;
begin
  for r in
    select p.id, p.user_id, p.full_name, p.tier_code,
           coalesce(t.commission_percent, 0) as current_percent
      from public.influencer_profiles p
      left join public.influencer_tiers t on t.code = p.tier_code
     where p.status = 'active'
  loop
    v_earned := public.influencer_tier_earned(r.id);
    if v_earned is null then continue; end if;

    if (select commission_percent from public.influencer_tiers where code = v_earned)
       > r.current_percent then
      update public.influencer_profiles
         set tier_code = v_earned, tier_since = now(), updated_at = now()
       where id = r.id;
      v_promoted := v_promoted + 1;

      perform public.mm_audit('influencer.tier_promoted', 'influencer', r.id::text, null,
        jsonb_build_object('from', r.tier_code, 'to', v_earned), null);

      if r.user_id is not null then
        perform public.mm_notify('influencer.tier',
          'You have reached a new tier',
          format('You are now %s. Your commission on a referred sale rises to %s%%.',
                 (select name from public.influencer_tiers where code = v_earned),
                 (select commission_percent from public.influencer_tiers where code = v_earned)),
          r.user_id, null, '/dashboard/influencer', 'View', 5, 'success');
      end if;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'promoted', v_promoted, 'evaluated_at', now());
end;
$$;

revoke all on function public.influencer_tier_evaluate() from public;
grant execute on function public.influencer_tier_evaluate() to service_role;
grant execute on function public.influencer_tier_earned(uuid) to authenticated, service_role;

-- ------------------------------------------- the rate an influencer is actually paid
--
-- influencer_rate_for() answered from a single programme-wide rule, which was
-- the right shape when there were no tiers. Now the tier decides, and a rule in
-- influencer_compensation_rules can still override it for one product or one
-- category - a launch, an exclusive, a category the margin will not carry.
--
-- Order of precedence, most specific first:
--   1. a product rule      2. a category rule      3. the influencer's tier
--
-- If the influencer somehow has no tier and no rule matches, nothing is
-- credited and the reason is returned. It never guesses a rate.
create or replace function public.influencer_rate_for(
  p_product uuid,
  p_category uuid,
  p_profile uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  t record;
begin
  select rr.id, rr.rate, rr.fixed_amount, rr.currency, rr.eligibility,
         case when rr.product_id is not null and rr.product_id = p_product then 3 else 2 end as specificity
    into r
    from public.influencer_compensation_rules rr
   where rr.active
     and rr.metric = 'sale_percent'
     and rr.campaign_id is null
     and ((rr.product_id is not null and rr.product_id = p_product)
       or (rr.category_id is not null and rr.category_id = p_category))
   order by specificity desc, rr.priority desc
   limit 1;

  if found then
    return jsonb_build_object(
      'rule_id', r.id, 'rate_percent', r.rate, 'fixed_amount', r.fixed_amount,
      'currency', r.currency, 'eligibility', r.eligibility,
      'matched', case r.specificity when 3 then 'product rule' else 'category rule' end);
  end if;

  if p_profile is not null then
    select ti.code, ti.name, ti.commission_percent, ti.currency, ti.hold_days
      into t
      from public.influencer_profiles p
      join public.influencer_tiers ti on ti.code = p.tier_code
     where p.id = p_profile and ti.enabled;

    if found then
      return jsonb_build_object(
        'rate_percent', t.commission_percent, 'fixed_amount', 0,
        'currency', t.currency, 'tier', t.code, 'hold_days', t.hold_days,
        'matched', format('tier %s', t.name));
    end if;
  end if;

  -- A programme-wide rule, if the owner has set one, is the last word before
  -- giving up.
  select rr.id, rr.rate, rr.fixed_amount, rr.currency, rr.eligibility into r
    from public.influencer_compensation_rules rr
   where rr.active and rr.metric = 'sale_percent' and rr.campaign_id is null
     and rr.product_id is null and rr.category_id is null
   order by rr.priority desc
   limit 1;

  if found then
    return jsonb_build_object(
      'rule_id', r.id, 'rate_percent', r.rate, 'fixed_amount', r.fixed_amount,
      'currency', r.currency, 'eligibility', r.eligibility, 'matched', 'programme rule');
  end if;

  return jsonb_build_object(
    'rate_percent', null,
    'reason', 'this influencer is on no enabled tier and no rule matched, so nothing was credited');
end;
$$;

revoke all on function public.influencer_rate_for(uuid, uuid, uuid) from public;
grant execute on function public.influencer_rate_for(uuid, uuid, uuid) to authenticated, service_role;

-- The engine asks with the influencer, so the tier can decide.
create or replace function public.influencer_commissions_for_order(p_order uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_att record; v_item record; v_rate jsonb; v_amount numeric;
  v_created integer := 0; v_skipped integer := 0;
  v_user uuid; v_buyer uuid; v_notes text[] := '{}';
  v_key text;
begin
  select a.*, p.user_id as influencer_user, p.status as influencer_status
    into v_att
    from public.marketplace_order_attributions a
    join public.influencer_profiles p on p.id = a.influencer_profile_id
   where a.order_id = p_order and a.influencer_profile_id is not null
   limit 1;

  if not found then
    return jsonb_build_object('ok', true, 'created', 0,
      'reason', 'no influencer attribution on this order');
  end if;

  select buyer_id into v_buyer from public.marketplace_orders where id = p_order;
  v_user := v_att.influencer_user;

  if v_user is not null and v_user = v_buyer then
    perform public.mm_audit('influencer.self_referral_blocked', 'marketplace_order',
      p_order::text, null,
      jsonb_build_object('influencer_profile_id', v_att.influencer_profile_id, 'buyer_id', v_buyer),
      'The buyer owns the referring influencer account.');
    return jsonb_build_object('ok', false, 'created', 0, 'reason', 'self_referral');
  end if;

  if v_att.influencer_status <> 'active' then
    return jsonb_build_object('ok', false, 'created', 0, 'reason', 'influencer_not_active');
  end if;

  for v_item in
    select i.id, i.product_id, i.line_total, i.currency, pr.category_id
      from public.marketplace_order_items i
      left join public.marketplace_products pr on pr.id = i.product_id
     where i.order_id = p_order
  loop
    v_key := 'influencer_commission:' || v_item.id::text || ':' || v_att.influencer_profile_id::text;

    if exists (select 1 from public.partner_commissions
                where partner_kind = 'influencer'
                  and partner_id = v_att.influencer_profile_id
                  and idempotency_key = v_key) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_rate := public.influencer_rate_for(v_item.product_id, v_item.category_id, v_att.influencer_profile_id);
    if (v_rate->>'rate_percent') is null then
      v_skipped := v_skipped + 1;
      v_notes := v_notes || (v_rate->>'reason');
      continue;
    end if;

    v_amount := round(
      coalesce(v_item.line_total, 0) * (v_rate->>'rate_percent')::numeric / 100
      + coalesce((v_rate->>'fixed_amount')::numeric, 0), 2);

    insert into public.partner_commissions
      (partner_kind, partner_id, order_id, order_item_id, attribution_id,
       gross_amount, commission_amount, currency, rule_snapshot, status, idempotency_key)
    values ('influencer', v_att.influencer_profile_id, p_order, v_item.id, v_att.id,
            coalesce(v_item.line_total, 0), v_amount,
            upper(coalesce(nullif(v_item.currency, ''), v_rate->>'currency', 'INR')),
            v_rate, 'pending', v_key)
    on conflict do nothing;

    if found then v_created := v_created + 1; else v_skipped := v_skipped + 1; end if;
  end loop;

  if v_created > 0 then
    perform public.mm_audit('influencer.commission_recorded', 'influencer',
      v_att.influencer_profile_id::text, null,
      jsonb_build_object('order_id', p_order, 'lines', v_created), null);

    if v_user is not null then
      perform public.mm_notify('influencer.commission',
        'You earned commission on a sale',
        format('%s line(s) from a new order have been credited to you, and enter the holding period now.', v_created),
        v_user, null, '/dashboard/influencer', 'View', 5, 'success');
    end if;
  end if;

  return jsonb_build_object('ok', true, 'created', v_created, 'skipped', v_skipped,
    'influencer_profile_id', v_att.influencer_profile_id,
    'notes', to_jsonb(v_notes));
end;
$$;

revoke all on function public.influencer_commissions_for_order(uuid) from public;
grant execute on function public.influencer_commissions_for_order(uuid) to service_role;

-- --------------------------------------------------------------- who may read
alter table public.influencer_tiers enable row level security;

drop policy if exists influencer_tiers_readable on public.influencer_tiers;
create policy influencer_tiers_readable on public.influencer_tiers
  for select to authenticated using (true);

grant select on public.influencer_tiers to authenticated;
grant all on public.influencer_tiers to service_role;
