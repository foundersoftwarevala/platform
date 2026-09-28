-- What one influencer sees in their own portal.
--
-- /dashboard/influencer renders its six KPI cards - Followers, Campaigns,
-- Brands, Content, Revenue, Engagement - from lib/metrics.ts, which is a
-- seeded random-number generator keyed on the role name and the KPI name. Every
-- influencer account saw the same invented figures, and they were invented: the
-- portal never read the influencer tables at all, while the programme holds
-- their real followers, assignments and earnings.
--
-- This is the influencer's own question, the counterpart to
-- influencer_programme_summary(), which answers the operator's. It resolves the
-- caller's profile through user_id = auth.uid() and counts only that profile's
-- rows, so an influencer can never read another influencer's figures through
-- it.
--
-- Where the platform has no source for a card, the value is null and the card
-- shows a dash and says "not tracked yet". Brands and Content are null for a
-- real reason: there is no brand behind a campaign in this schema, and no table
-- that holds an influencer's content items. A missing capability should look
-- missing rather than be filled in with a number from somewhere else.

create or replace function public.influencer_self_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  -- v_ prefixed: a local named `followers` collides with the column of that name
  -- in the subqueries below, and Postgres refuses the ambiguity (42702).
  p public.influencer_profiles%rowtype;
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

  -- A signed-in account that holds no influencer profile is a real answer, not
  -- an error: the portal shows dashes rather than a failure.
  if not found then
    return jsonb_build_object('profile', null, 'metrics', jsonb_build_object());
  end if;

  select coalesce(sum(s.followers), 0)::bigint,
         -- Engagement is an average across accounts weighted by the audience
         -- each one carries, so a large account does not count the same as a
         -- handle with fifty followers. Null when there is nothing to average.
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
        select coalesce(sum(net_amount), 0)::numeric
          from public.influencer_earnings
         where profile_id = p.id and status <> 'reversed'),
      'earnings-pending', (
        select coalesce(sum(net_amount), 0)::numeric
          from public.influencer_earnings
         where profile_id = p.id and status = 'payable'),
      'payouts', (
        select coalesce(sum(amount), 0)::numeric
          from public.influencer_payouts where profile_id = p.id),
      'invoices', (
        select count(*) from public.influencer_invoices where profile_id = p.id),
      'engagement', v_engagement,
      -- No source exists for these. A dash is the honest answer.
      'brands', null,
      'content', null
    )
  );
end;
$$;

revoke all on function public.influencer_self_summary() from public;
grant execute on function public.influencer_self_summary() to authenticated;

comment on function public.influencer_self_summary() is
  'One influencer''s own figures, resolved from auth.uid(). The counterpart to influencer_programme_summary(), which answers the operator''s question about the whole programme.';
