-- Whose invoice is this?
--
-- /api/account/invoice/{id} refused an invoice only when it carried a user id
-- and that id did not match:
--
--   if (meta.user_id && meta.user_id !== user.id) -> 403
--
-- Three of the 131 invoices carry one. The other 128 fell straight through the
-- check, so any signed-in account could open any of them by id - including
-- reseller membership invoices, which live in the same table. A financial
-- document that opens for the wrong person is the plainest kind of breach, and
-- this one needed nothing more than a guessed id.
--
-- The fix has to fail closed without locking out the people who legitimately
-- own the other 128, so ownership is established from whatever the platform
-- actually knows, in one question to the database rather than three round trips
-- from the route:
--
--   1. the invoice names the user outright;
--   2. the invoice names an order, and that order's buyer is this user;
--   3. a reseller membership order points at this invoice, and that reseller
--      belongs to this user.
--
-- None of those matching means the caller cannot be shown to own it, and it is
-- refused. Operators are handled in the route, not here: this function answers
-- only the ownership question, so it cannot accidentally become an
-- authorisation bypass of its own.

create or replace function public.finance_invoice_belongs_to(p_invoice uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.finance_invoices i
     where i.id = p_invoice
       and (
         -- 1. Named on the invoice.
         (i.line_items->'meta'->>'user_id') = p_user::text

         -- 2. The order it was raised for belongs to this buyer.
         or exists (
           select 1 from public.marketplace_orders o
            where o.id::text = (i.line_items->'meta'->>'order_id')
              and o.buyer_id = p_user)

         -- 3. A reseller membership order points at it, and the reseller is
         --    this user.
         or exists (
           select 1
             from public.reseller_membership_orders mo
             join public.resellers r on r.id = mo.reseller_id
            where mo.finance_invoice_id = i.id
              and r.user_id = p_user)
       )
  );
$$;

revoke all on function public.finance_invoice_belongs_to(uuid, uuid) from public;
grant execute on function public.finance_invoice_belongs_to(uuid, uuid) to authenticated, service_role;

comment on function public.finance_invoice_belongs_to(uuid, uuid) is
  'True when this invoice can be shown to belong to this user, by the invoice itself, by the order it was raised for, or by the reseller membership order that points at it. Ownership only - operator access is decided by the caller.';
