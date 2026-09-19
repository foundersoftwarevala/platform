-- Reseller Manager: "What needs my attention right now?" from the database.
--
-- The banner showed fixed figures ("12 reseller registrations pending",
-- "₹3.8L across 31 resellers", "Q-target at 72%"). Each signal below is
-- counted from the table that owns it at the moment it is asked for. Signals
-- the platform has no data for (quarterly targets, support escalations, wallet
-- reconciliation) are not shown at all rather than invented.
--
-- Same gate as the Reseller Manager console (mm_reseller_operator).

create or replace function public.mm_reseller_attention()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.mm_reseller_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  return jsonb_build_object(
    'ok', true,
    'as_of', now(),
    'applications_pending', (select count(*) from public.resellers where status = 'pending'),
    'applications_kyc_unverified', (select count(*) from public.resellers
                                     where status = 'pending' and coalesce(kyc_status, 'unverified') <> 'verified'),
    'oldest_application_at', (select min(coalesce(applied_at, created_at)) from public.resellers where status = 'pending'),
    'membership_payments_to_verify', (select count(*) from public.reseller_membership_orders where status = 'processing'),
    'membership_orders_awaiting_payment', (select count(*) from public.reseller_membership_orders where status = 'pending'),
    'memberships_expiring_30d', (select count(*) from public.reseller_memberships
                                  where status = 'active' and expires_at between now() and now() + interval '30 days'),
    'commission_available', coalesce((
      select jsonb_agg(jsonb_build_object('currency', currency, 'amount', amount, 'resellers', resellers) order by currency)
        from (select currency, sum(commission_amount) as amount, count(distinct reseller_id) as resellers
                from public.reseller_commissions
               where status = 'available' and payout_id is null
               group by currency) c), '[]'::jsonb),
    'payouts_awaiting_action', (select count(*) from public.reseller_payouts where status in ('pending', 'approved', 'processing')),
    'suspended', (select count(*) from public.resellers where status in ('paused', 'suspended'))
  );
end;
$function$;

revoke all on function public.mm_reseller_attention() from public, anon;
grant execute on function public.mm_reseller_attention() to authenticated;
