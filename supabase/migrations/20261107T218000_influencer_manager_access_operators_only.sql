-- Influencer-manager access belongs to the platform's operators, not to
-- influencers, marketing or developers.
--
-- influencer_manager_access() admitted admin, boss, marketing, influencer and
-- developer, and it is the USING/WITH CHECK of an all-commands policy on
-- eleven influencer tables (payouts, earnings, compensation rules, invoices,
-- agreements, profiles, audit logs, ...) and the gate of
-- approve_influencer_earning, calculate_influencer_earning and
-- create_influencer_payout. Reproduced in a rolled-back transaction on
-- 2026-10-01 as a real influencer account: it read all six payouts (five of
-- other influencers), marked the three pending ones paid, and created a
-- 999,999 payout for itself.
--
-- 1. The function now admits admin and boss only - the two operator roles it
--    already named. No role is added. Finance keeps its existing read
--    policies (influencer_finance_read, influencer_payout_finance_read).
--
-- 2. The influencer portal (src/components/influencer/InfluencerPortalDashboard.tsx)
--    reads five tables in the browser with the influencer's own session.
--    Those tables had no "own rows" policy - influencers could read them only
--    through the manager function, which showed them everyone's rows. Each
--    now gets a read policy limited to the influencer's own profile, so the
--    portal keeps showing exactly its own data and nothing else. Earnings,
--    payouts, profiles and notifications already had own-row policies.
--
-- Nothing is granted that was not readable before, and nothing is writable
-- by an influencer, marketing or developer account after this.

begin;

create or replace function public.influencer_manager_access()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'boss');
$function$;

create policy influencer_social_accounts_own_read on public.influencer_social_accounts
  for select to authenticated
  using (exists (select 1 from public.influencer_profiles p
                  where p.id = influencer_social_accounts.profile_id and p.user_id = auth.uid()));

create policy influencer_campaign_assignments_own_read on public.influencer_campaign_assignments
  for select to authenticated
  using (exists (select 1 from public.influencer_profiles p
                  where p.id = influencer_campaign_assignments.profile_id and p.user_id = auth.uid()));

create policy influencer_agreements_own_read on public.influencer_agreements
  for select to authenticated
  using (exists (select 1 from public.influencer_profiles p
                  where p.id = influencer_agreements.profile_id and p.user_id = auth.uid()));

create policy influencer_invoices_own_read on public.influencer_invoices
  for select to authenticated
  using (exists (select 1 from public.influencer_profiles p
                  where p.id = influencer_invoices.profile_id and p.user_id = auth.uid()));

create policy influencer_activity_own_read on public.influencer_activity
  for select to authenticated
  using (exists (select 1 from public.influencer_campaign_assignments a
                   join public.influencer_profiles p on p.id = a.profile_id
                  where a.id = influencer_activity.assignment_id and p.user_id = auth.uid()));

commit;
