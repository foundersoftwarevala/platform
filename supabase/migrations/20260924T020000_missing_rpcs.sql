-- Two functions every screen calls and neither of which existed.
--
-- claim_influencer_profile() runs after every single sign-in, from the login
-- page itself. It answered 404, the page treated that as a failure, showed the
-- error and sent the person to the home page instead of their dashboard - so
-- nobody was ever routed anywhere by role.
--
-- get_my_permissions() is what the Affiliate Manager asks before deciding
-- which of its controls a person may use. It answered 404 too, so the query
-- threw, every permission read as absent, and the console's actions were shut
-- to everyone including the owner.

-- ------------------------------------------------- what this account may do
--
-- Rules, not hard-coded logic, so the Control Panel can change who may do what
-- without a deployment.
create table if not exists public.affiliate_role_permissions (
  role public.app_role not null,
  permission text not null,
  primary key (role, permission)
);
grant select on public.affiliate_role_permissions to authenticated;
grant all on public.affiliate_role_permissions to service_role;
alter table public.affiliate_role_permissions enable row level security;

do $$ begin
  create policy "affiliate permissions readable" on public.affiliate_role_permissions
    for select to authenticated using (true);
exception when duplicate_object then null; end $$;

-- Whoever runs the platform may do all of it.
insert into public.affiliate_role_permissions (role, permission)
select r, p
  from unnest(array['boss','boss_owner','founder','admin','super_admin']::public.app_role[]) r
 cross join unnest(array[
   'affiliates.read','affiliates.write','affiliates.approve','affiliates.suspend','affiliates.terminate',
   'campaigns.read','campaigns.write',
   'commissions.read','commissions.write','commissions.approve',
   'payouts.read','payouts.write','payouts.issue',
   'wallet.read','wallet.write',
   'bulk.execute','import.execute','export.execute',
   'messaging.send','settings.write','roles.assign'
 ]) p
on conflict do nothing;

-- Finance decides about money, and nothing else.
insert into public.affiliate_role_permissions (role, permission)
select 'finance'::public.app_role, p
  from unnest(array[
    'affiliates.read','campaigns.read',
    'commissions.read','commissions.write','commissions.approve',
    'payouts.read','payouts.write','payouts.issue',
    'wallet.read','wallet.write','export.execute'
  ]) p
on conflict do nothing;

-- Support and sales can see the channel and talk to it.
insert into public.affiliate_role_permissions (role, permission)
select r, p
  from unnest(array['support','sales','sales_support_manager']::public.app_role[]) r
 cross join unnest(array[
   'affiliates.read','campaigns.read','commissions.read','payouts.read','wallet.read','messaging.send'
 ]) p
on conflict do nothing;

-- Marketing runs the campaigns.
insert into public.affiliate_role_permissions (role, permission)
select 'marketing'::public.app_role, p
  from unnest(array['affiliates.read','campaigns.read','campaigns.write','messaging.send','export.execute']) p
on conflict do nothing;

-- An affiliate sees their own side of it and nothing about anyone else.
insert into public.affiliate_role_permissions (role, permission)
select 'affiliate'::public.app_role, p
  from unnest(array['campaigns.read','commissions.read','payouts.read','wallet.read']) p
on conflict do nothing;

create or replace function public.get_my_permissions()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'roles', coalesce((
      select json_agg(distinct ur.role::text order by ur.role::text)
        from public.user_roles ur
       where ur.user_id = auth.uid()
    ), '[]'::json),
    'permissions', coalesce((
      select json_agg(distinct arp.permission)
        from public.user_roles ur
        join public.affiliate_role_permissions arp on arp.role = ur.role
       where ur.user_id = auth.uid()
    ), '[]'::json),
    'is_boss', exists (
      select 1 from public.user_roles ur
       where ur.user_id = auth.uid()
         and ur.role in ('boss','boss_owner','founder','admin','super_admin')
    )
  )
$$;
revoke all on function public.get_my_permissions() from public, anon;
grant execute on function public.get_my_permissions() to authenticated;

-- ------------------------------------------------ the influencer's own record
--
-- Called on every sign-in by every account, so it must be harmless to anyone
-- who is not an influencer: it says what it did and changes nothing else.
--
-- An influencer whose application was approved has a profile already; one who
-- signed up with the role and has no profile yet gets one, keyed to them, so
-- their dashboard has a record to stand on. A profile already claimed by
-- somebody else is never taken.
create or replace function public.claim_influencer_profile()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  my_email text;
  claimed uuid;
begin
  if me is null then
    return json_build_object('claimed', false, 'reason', 'not signed in');
  end if;

  if not exists (select 1 from public.user_roles where user_id = me and role = 'influencer') then
    return json_build_object('claimed', false, 'reason', 'not an influencer');
  end if;

  select id into claimed from public.influencer_profiles where user_id = me limit 1;
  if claimed is not null then
    return json_build_object('claimed', true, 'profile_id', claimed, 'reason', 'already held');
  end if;

  select email into my_email from auth.users where id = me;

  -- A profile created from their application, waiting to be claimed.
  update public.influencer_profiles
     set user_id = me, updated_at = now()
   where user_id is null
     and my_email is not null
     and lower(email) = lower(my_email)
  returning id into claimed;

  if claimed is null then
    insert into public.influencer_profiles (user_id, full_name, email, status)
    values (me, coalesce(split_part(my_email, '@', 1), 'Influencer'), my_email, 'pending')
    returning id into claimed;
  end if;

  return json_build_object('claimed', true, 'profile_id', claimed, 'reason', 'created or linked');
end;
$$;
revoke all on function public.claim_influencer_profile() from public, anon;
grant execute on function public.claim_influencer_profile() to authenticated;
