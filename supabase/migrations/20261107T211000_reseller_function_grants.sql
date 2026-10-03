-- Reseller-side functions anyone on the internet could call (reseller audit L1/L2).
--
--   reseller_rate_for(reseller, product, category)
--       returned any reseller's commission rule and rate to an anonymous
--       caller. Its only caller is reseller_commissions_for_order, which runs
--       as the owner.
--   finance_invoice_belongs_to(invoice, user)
--       answered yes/no for any invoice and any user. Its only caller is
--       /api/account/invoice/$id, which calls it with the service key.
--   payment_intent_amount(...)
--       broken (reads a column and a table that do not exist), unused, and
--       let anon read any order's total.
-- Each is now executable by the service role only.

begin;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('reseller_rate_for', 'finance_invoice_belongs_to', 'payment_intent_amount')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

commit;
