-- Who may read the reseller membership records.
--
-- The Finance Manager verifies membership payments, but only admin and boss
-- could read reseller_membership_orders and resellers: a Finance Manager's
-- queue came back empty. A reseller could read their own orders but not the
-- invoice those orders point at, so the invoice number never showed.
--
-- Reads only. Every change still goes through the server functions in
-- 20260919100000_reseller_lifecycle.sql.

drop policy if exists reseller_membership_orders_finance_read on public.reseller_membership_orders;
create policy reseller_membership_orders_finance_read on public.reseller_membership_orders
  for select to authenticated using (public.finance_is_operator());

drop policy if exists resellers_finance_read on public.resellers;
create policy resellers_finance_read on public.resellers
  for select to authenticated using (public.finance_is_operator());

drop policy if exists finance_invoices_reseller_own_read on public.finance_invoices;
create policy finance_invoices_reseller_own_read on public.finance_invoices
  for select to authenticated using (
    exists (
      select 1 from public.reseller_membership_orders o
      where o.finance_invoice_id = finance_invoices.id
        and public.reseller_owned_by_user(auth.uid(), o.reseller_id)
    )
  );
