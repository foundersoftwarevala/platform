-- Conversions are wired now. /api/payment/initiate stamps the attribution while
-- the buyer's referral cookie is still on the request, so a sale through a
-- creator's link is credited from the next checkout onward. The count being
-- zero today means no referred order has been paid yet, not that it cannot be.
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
    'declared_followers', (select coalesce(sum(followers),0)
                             from public.influencer_social_accounts),
    'verified_accounts', (select count(*) from public.influencer_social_accounts
                           where verification_status = 'verified'),
    'agreements',    (select count(*) from public.influencer_agreements),
    'assignments',   (select count(*) from public.influencer_campaign_assignments),

    'earnings_gross', (select coalesce(sum(gross_amount),0) from public.influencer_earnings),
    'earnings_net',   (select coalesce(sum(net_amount),0) from public.influencer_earnings),
    'payouts_total',  (select coalesce(sum(amount),0) from public.influencer_payouts),
    'payouts_paid',   (select coalesce(sum(amount),0) from public.influencer_payouts
                        where status = 'paid'),
    'payouts_pending',(select coalesce(sum(amount),0) from public.influencer_payouts
                        where status in ('pending','approved','processing')),

    'referral_codes', (select count(*) from public.marketplace_referral_codes
                        where influencer_profile_id is not null),
    'sessions',       (select count(*) from public.marketplace_referral_sessions
                        where influencer_profile_id is not null),
    'conversions',    (select count(*) from public.marketplace_order_attributions
                        where influencer_profile_id is not null),

    'unavailable', jsonb_build_object(
      'verified_reach', 'Follower and engagement figures are the creator''s own declaration from their application. No social platform API is connected, so none of them has been confirmed or refreshed since.',
      'roi',            'ROI compares attributed revenue against recorded spend. Attribution now runs at checkout, so this fills in once a referred order is paid.'),

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
