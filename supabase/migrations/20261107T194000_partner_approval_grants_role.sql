-- M6: an approved partner gets the role their dashboard requires.
--
-- /dashboard/<role> admits only an account holding the matching app_role
-- (src/routes/dashboard.$role.tsx, DASHBOARD_ROLE_REQUIREMENT). Reseller and
-- influencer approval grant theirs (mm_reseller_status,
-- review_influencer_application: insert ... on conflict do nothing). Author,
-- vendor and affiliate approval did not - review_seller_application,
-- mm_seller_status and review_affiliate_application only set the status - so
-- an approved author, vendor or affiliate was refused by their own dashboard.
-- Today 3 approved authors, 1 approved vendor and 3 approved affiliates have
-- no matching role.
--
-- The rule is put where every approval passes: when a seller or affiliate
-- record becomes 'approved' and has an owner, the matching role is granted,
-- exactly as the reseller and influencer approvals do. A seller with no
-- seller_kind gets no role (which one is not known). Roles are never removed
-- here; suspension is handled by status checks, as before. Existing approved
-- records are not backfilled by this migration - they are reported for a
-- decision.

begin;

create or replace function public.partner_approval_grants_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid;
  v_role text;
begin
  if new.status is distinct from 'approved'
     or (tg_op = 'UPDATE' and old.status is not distinct from 'approved') then
    return new;
  end if;
  if tg_table_name = 'marketplace_sellers' then
    v_user := new.owner_user_id;
    v_role := case new.seller_kind when 'author' then 'author' when 'vendor' then 'vendor' end;
  else
    v_user := new.user_id;
    v_role := 'affiliate';
  end if;
  if v_user is not null and v_role is not null then
    insert into public.user_roles (user_id, role) values (v_user, v_role::app_role)
    on conflict do nothing;
  end if;
  return new;
end $$;

revoke all on function public.partner_approval_grants_role() from public, anon, authenticated;

drop trigger if exists partner_approval_grants_role on public.marketplace_sellers;
create trigger partner_approval_grants_role
  after insert or update of status on public.marketplace_sellers
  for each row execute function public.partner_approval_grants_role();

drop trigger if exists partner_approval_grants_role on public.marketplace_affiliate_partners;
create trigger partner_approval_grants_role
  after insert or update of status on public.marketplace_affiliate_partners
  for each row execute function public.partner_approval_grants_role();

commit;
