-- Order attribution is recorded when payment starts. Count a sale only after
-- the corresponding order is paid; leads remain counted from attributed leads.

begin;

create or replace function public.influencer_programme_summary()
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'influencers', (select count(*) from public.influencer_profiles),
    'influencers_active', (select count(*) from public.influencer_profiles where status = 'active'),
    'applications_total', (select count(*) from public.influencer_applications),
    'applications_pending', (
      select count(*) from public.influencer_applications
       where status in ('pending', 'in_review', 'submitted')),
    'assignments', (select count(*) from public.influencer_campaign_assignments),
    'assignments_active', (
      select count(*) from public.influencer_campaign_assignments where status = 'active'),
    'social_accounts', (select count(*) from public.influencer_social_accounts),
    -- Followers are only claimable where the account's ownership has been
    -- verified; the rest is a number the influencer told us.
    'followers_total', (
      select coalesce(sum(followers), 0)::bigint from public.influencer_social_accounts),
    'followers_verified', (
      select coalesce(sum(followers), 0)::bigint from public.influencer_social_accounts
       where verification_status = 'verified'),
    'earnings_net', (
      select coalesce(sum(net_amount), 0)::numeric from public.influencer_earnings),
    'payouts_total', (
      select coalesce(sum(amount), 0)::numeric from public.influencer_payouts),
    'payouts_paid', (
      select coalesce(sum(amount), 0)::numeric from public.influencer_payouts
       where status in ('paid', 'completed')),
    'payouts_pending', (
      select count(*) from public.influencer_payouts
       where status not in ('paid', 'completed')),
    'invoices', (select count(*) from public.influencer_invoices),
    'compensation_rules', (select count(*) from public.influencer_compensation_rules),

    -- The referral chain, counted where it now records an influencer.
    'referral_codes', (
      select count(*) from public.marketplace_referral_codes
       where influencer_profile_id is not null),
    'referral_sessions', (
      select count(*) from public.marketplace_referral_sessions
       where influencer_profile_id is not null),
    'referral_clicks', (
      select coalesce(sum(coalesce((metadata->>'clicks')::int, 1)), 0)::bigint
        from public.marketplace_referral_sessions
       where influencer_profile_id is not null),
    'leads', (
      select count(*) from public.leads where influencer_profile_id is not null),
    'sales', (
      select count(distinct a.order_id)
        from public.marketplace_order_attributions a
        join public.marketplace_orders o on o.id = a.order_id
       where a.influencer_profile_id is not null and o.status::text = 'paid'),
    -- The canonical partner ledger. A reversal is a negative row in it, so
    -- summing gives the net rather than a total that ignores cancelled sales.
    'commission_pending', (
      select coalesce(sum(commission_amount), 0)::numeric from public.partner_commissions
       where partner_kind = 'influencer' and status = 'pending'),
    'commission_approved', (
      select coalesce(sum(commission_amount), 0)::numeric from public.partner_commissions
       where partner_kind = 'influencer' and status = 'approved'),
    'commission_paid', (
      select coalesce(sum(commission_amount), 0)::numeric from public.partner_commissions
       where partner_kind = 'influencer' and status = 'paid'),
    'commission_lines', (
      select count(*) from public.partner_commissions where partner_kind = 'influencer'),

    -- What still cannot be answered, and why. Kept as a field rather than
    -- filled in with something else.
    'unattributable', (
      select case
        when not exists (select 1 from public.influencer_compensation_rules
                          where metric = 'sale_percent' and active)
        then jsonb_build_object(
          'commission', 'No active sale_percent rule exists, so a referred sale records no commission. The rate is a business decision and is not assumed.')
        else '{}'::jsonb
      end)
  );
$$;

comment on function public.influencer_programme_summary() is
  'The influencer programme summary, with leads counted at attribution and sales counted only after the attributed order is paid.';

create or replace function public.influencer_self_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  p public.influencer_profiles%rowtype;
  -- v_ prefixed: a local named `followers` collides with the column of that name
  -- in the subqueries below, and Postgres refuses the ambiguity (42702).
  v_followers bigint;
  v_engagement numeric;
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '28000';
  end if;

  select * into p
    from public.influencer_profiles
   where user_id = auth.uid()
   order by created_at
   limit 1;

  if not found then
    return jsonb_build_object('profile', null, 'metrics', jsonb_build_object());
  end if;

  select coalesce(sum(s.followers), 0)::bigint,
         case when coalesce(sum(s.followers), 0) > 0
              then round(sum(s.engagement_rate * s.followers) / sum(s.followers), 2)
              else null end
    into v_followers, v_engagement
    from public.influencer_social_accounts s
   where s.profile_id = p.id
     and s.followers is not null;

  return jsonb_build_object(
    'profile', jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'status', p.status,
      'niche', p.niche,
      'country', p.country,
      'since', p.created_at
    ),
    'metrics', jsonb_build_object(
      'followers', coalesce(v_followers, 0),
      'followers-verified', (
        select coalesce(sum(followers), 0)::bigint
          from public.influencer_social_accounts
         where profile_id = p.id and verification_status = 'verified'),
      'accounts', (
        select count(*) from public.influencer_social_accounts where profile_id = p.id),
      'campaigns', (
        select count(*) from public.influencer_campaign_assignments
         where profile_id = p.id and status = 'active'),
      'campaigns-total', (
        select count(*) from public.influencer_campaign_assignments where profile_id = p.id),
      'revenue', (
        -- Campaign activity earnings and marketplace commission are two
        -- different things the same person earns, so the figure they see is both.
        (select coalesce(sum(net_amount), 0)::numeric
           from public.influencer_earnings
          where profile_id = p.id and status <> 'reversed')
        + (select coalesce(sum(commission_amount), 0)::numeric
             from public.partner_commissions
            where partner_kind = 'influencer' and partner_id = p.id)),
      'earnings-pending', (
        select coalesce(sum(net_amount), 0)::numeric
          from public.influencer_earnings
         where profile_id = p.id and status = 'payable'),
      'commission-pending', (
        select coalesce(sum(commission_amount), 0)::numeric
          from public.partner_commissions
         where partner_kind = 'influencer' and partner_id = p.id and status = 'pending'),
      'payouts', (
        select coalesce(sum(amount), 0)::numeric
          from public.influencer_payouts where profile_id = p.id),
      'invoices', (
        select count(*) from public.influencer_invoices where profile_id = p.id),
      'engagement', v_engagement,

      -- The referral chain, for this influencer only.
      'clicks', (
        select coalesce(sum(coalesce((metadata->>'clicks')::int, 1)), 0)::bigint
          from public.marketplace_referral_sessions where influencer_profile_id = p.id),
      'visits', (
        select count(*) from public.marketplace_referral_sessions where influencer_profile_id = p.id),
      'leads', (
        select count(*) from public.leads where influencer_profile_id = p.id),
      'sales', (
        select count(distinct a.order_id)
          from public.marketplace_order_attributions a
          join public.marketplace_orders o on o.id = a.order_id
         where a.influencer_profile_id = p.id and o.status::text = 'paid'),
      'conversions', (
        select count(*) from public.marketplace_referral_sessions
         where influencer_profile_id = p.id and converted_order_id is not null),
      -- No source exists for these. A dash is the honest answer.
      'brands', null,
      'content', null
    )
  );
end;
$$;

commit;
