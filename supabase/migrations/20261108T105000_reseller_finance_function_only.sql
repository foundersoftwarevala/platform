-- Reseller money changes only through the functions that enforce its ledger.
--
-- The finance write policies on commissions, payouts, payout schedules and
-- commission rules used FOR ALL. A finance session could therefore bypass the
-- canonical RPCs and write a payout already marked paid, without a provider
-- reference, without settling its commission lines and without a ledger or
-- audit entry. The manager API remains able to maintain rules and schedules
-- through its authenticated server gate because it writes with the service
-- role; payout state continues through mm_reseller_payout_status.
--
-- reseller_membership_orders had a direct admin/boss UPDATE policy as well.
-- It allowed a pending order to be changed to paid/SUCCESS, including changing
-- its server-priced amount, without verify_reseller_membership_payment or
-- activate_reseller_membership. Reads remain covered by the existing owner,
-- manager and finance policies; all legitimate writes are SECURITY DEFINER
-- functions.

begin;

drop policy if exists reseller_commission_rules_finance_write
  on public.reseller_commission_rules;
drop policy if exists reseller_commissions_finance_write
  on public.reseller_commissions;
drop policy if exists reseller_payout_schedules_finance_write
  on public.reseller_payout_schedules;
drop policy if exists reseller_payouts_finance_write
  on public.reseller_payouts;
drop policy if exists reseller_membership_orders_manager_approval
  on public.reseller_membership_orders;

do $$
declare
  direct_write text;
begin
  select tablename || '.' || policyname
    into direct_write
    from pg_policies
   where schemaname = 'public'
     and tablename in (
       'reseller_commission_rules',
       'reseller_commissions',
       'reseller_payout_schedules',
       'reseller_payouts',
       'reseller_membership_orders'
     )
     and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
     and roles::text like '%authenticated%'
   limit 1;

  if direct_write is not null then
    raise exception 'A direct authenticated reseller-money write policy remains: %',
      direct_write;
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.mm_reseller_payout_status(uuid,text,text,text)',
    'EXECUTE'
  ) then
    raise exception 'Authenticated payout-status RPC access was not preserved';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.mm_reseller_payout_create(uuid,text)',
    'EXECUTE'
  ) then
    raise exception 'Authenticated payout-create RPC access was not preserved';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.create_reseller_membership_order(text,text)',
    'EXECUTE'
  ) or not has_function_privilege(
    'authenticated',
    'public.submit_reseller_membership_payment(uuid,text,text,text)',
    'EXECUTE'
  ) or not has_function_privilege(
    'authenticated',
    'public.verify_reseller_membership_payment(uuid,text,text)',
    'EXECUTE'
  ) then
    raise exception 'A reseller membership payment RPC grant was not preserved';
  end if;

  if not exists (
    select 1
      from pg_policies
     where schemaname = 'public'
       and tablename = 'reseller_payouts'
       and policyname = 'reseller_payouts_own_read'
       and cmd = 'SELECT'
  ) or not exists (
    select 1
      from pg_policies
     where schemaname = 'public'
       and tablename = 'reseller_membership_orders'
       and policyname = 'reseller_membership_orders_finance_read'
       and cmd = 'SELECT'
  ) then
    raise exception 'Required reseller finance read access is missing';
  end if;
end
$$;

commit;
