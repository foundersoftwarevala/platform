-- What an operator sees in Influencer Manager.
--
-- The manager console rendered zeros for everything while the programme holds
-- ten influencer profiles, seven applications, six payouts and two earnings
-- rows. The cause was not missing data and not a failed request - there were no
-- failed requests at all - it was the query:
--
--   InfluencerReferenceDashboard (the operator console) used
--   influencerDashboardQueryOptions(), which is the *creator's own* view. It
--   looks up influencer_profiles by user_id = auth.uid() and, finding none,
--   returns emptyDashboardAnalytics(). Only two of the ten profiles carry a
--   user_id at all, and the owner's account is not one of them, so the console
--   showed an empty programme to the person who runs it.
--
-- This is the operator's question instead: how is the whole programme doing.
--
-- Every number is computed in SQL. The creator view reads its lists with
-- .limit(2000) and counts them in the browser, which is the shape that goes
-- quietly wrong the day the programme passes two thousand of anything - and a
-- console that under-reports is worse than one that errors.
--
-- Nothing is invented. Where a number cannot honestly be produced yet - sales
-- and leads attributed to an influencer, which need a referral chain nothing
-- writes to - it is returned as zero with the reason recorded beside it, not
-- borrowed from a count of something else.

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
    -- Said plainly rather than filled in with something else.
    'unattributable', jsonb_build_object(
      'sales', 'marketplace_order_attributions carries no influencer reference yet',
      'leads', 'the leads table carries no influencer or campaign column yet')
  );
$$;

revoke all on function public.influencer_programme_summary() from public;
grant execute on function public.influencer_programme_summary() to authenticated, service_role;

comment on function public.influencer_programme_summary() is
  'The whole influencer programme in one row, for the operator console. Counted in SQL so the figures cannot drift from a list that happened to be capped.';
