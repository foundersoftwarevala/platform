-- The influencer's own tier, and what the next one asks of them.
--
-- A tier the influencer cannot see is a tier that motivates nobody. Every
-- creator programme worth copying shows the same two things: where you are, and
-- the exact number that moves you up. This returns both, from their own rows.

create or replace function public.influencer_self_tier()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  p public.influencer_profiles%rowtype;
  cur public.influencer_tiers%rowtype;
  nxt public.influencer_tiers%rowtype;
  v_followers bigint;
  v_sales integer;
  v_revenue numeric;
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '28000';
  end if;

  select * into p from public.influencer_profiles
   where user_id = auth.uid() order by created_at limit 1;
  if not found then return jsonb_build_object('tier', null); end if;

  select * into cur from public.influencer_tiers where code = p.tier_code;

  -- The cheapest tier above the one they are on. Null when they are at the top.
  select * into nxt from public.influencer_tiers
   where enabled and commission_percent > coalesce(cur.commission_percent, -1)
   order by commission_percent asc limit 1;

  select coalesce(sum(followers), 0)::bigint into v_followers
    from public.influencer_social_accounts
   where profile_id = p.id and verification_status = 'verified';

  select count(*) into v_sales
    from public.marketplace_order_attributions a
    join public.marketplace_orders o on o.id = a.order_id
   where a.influencer_profile_id = p.id and o.status = 'paid'
     and a.attributed_at > now() - interval '90 days';

  select coalesce(sum(gross_amount), 0)::numeric into v_revenue
    from public.partner_commissions
   where partner_kind = 'influencer' and partner_id = p.id
     and status <> 'reversed' and earned_at > now() - interval '180 days';

  return jsonb_build_object(
    'tier', case when cur.code is null then null else jsonb_build_object(
      'code', cur.code, 'name', cur.name,
      'commission_percent', cur.commission_percent,
      'hold_days', cur.hold_days, 'payout_floor', cur.payout_floor,
      'currency', cur.currency, 'benefits', cur.benefits,
      'since', p.tier_since) end,
    'standing', jsonb_build_object(
      'verified_followers', v_followers,
      'sales_90d', v_sales,
      'revenue_180d', v_revenue),
    -- Said as a number they can act on, not as "keep going".
    'next', case when nxt.code is null then null else jsonb_build_object(
      'code', nxt.code, 'name', nxt.name,
      'commission_percent', nxt.commission_percent,
      'needs_followers', greatest(nxt.min_verified_followers - v_followers, 0),
      'needs_sales', greatest(nxt.min_sales_90d - v_sales, 0),
      'needs_revenue', greatest(nxt.min_revenue_180d - v_revenue, 0),
      'either', 'Any one of these is enough.') end);
end;
$$;

revoke all on function public.influencer_self_tier() from public;
grant execute on function public.influencer_self_tier() to authenticated;

comment on function public.influencer_self_tier() is
  'Where this influencer stands and the exact number that moves them to the next tier. Resolved from auth.uid(), so it can only ever answer about the caller.';
