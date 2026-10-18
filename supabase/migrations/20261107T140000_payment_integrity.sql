-- Payment, order and licence integrity that the database itself enforces.
--
-- H4  An order's status could be moved anywhere by any writer: a late failure
--     callback, a script or a manager edit could put a paid order back to
--     pending_payment, or a refunded order back to paid. The application now
--     only ever moves forward, and this makes the database refuse the moves
--     that cannot be right whoever asks:
--       * nothing returns to pending_payment;
--       * refunded and cancelled are final;
--       * paid is reached only from pending_payment (a payment) or disputed
--         (a dispute settled for the merchant).
--     Every recorded transition so far (5, all "new -> pending_payment") and
--     every writer in code and in the database already follows this.
--
-- M5  Natural keys that were unique only by luck (no duplicates exist today):
--       * one order per PayU payment id (the transaction id already had
--         marketplace_orders_txnid_key);
--       * one payment intent per provider reference;
--       * one partner commission per partner and order line (the reversing
--         rows carry a negative amount and are left out).
-- M2  One invoice per order: invoicing checked and then inserted, so two
--     concurrent calls could both insert. The code now returns the existing
--     invoice when this index refuses a second one.
-- M3  One licence per order in `licenses`: the existing (order_id, product_id)
--     index let NULL product ids repeat. Fulfilment issues one licence per
--     order and already treats a unique violation as "already issued".

begin;

create or replace function public.marketplace_order_status_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if new.status = 'pending_payment' then
    raise exception 'order % cannot go back from % to pending_payment', old.id, old.status
      using errcode = 'check_violation';
  end if;
  if old.status in ('refunded', 'cancelled') then
    raise exception 'order % is %, which is final', old.id, old.status
      using errcode = 'check_violation';
  end if;
  if new.status = 'paid' and old.status not in ('pending_payment', 'disputed') then
    raise exception 'order % cannot become paid from %', old.id, old.status
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

revoke all on function public.marketplace_order_status_guard() from public, anon, authenticated;

drop trigger if exists marketplace_order_status_guard on public.marketplace_orders;
create trigger marketplace_order_status_guard
  before update of status on public.marketplace_orders
  for each row execute function public.marketplace_order_status_guard();

create unique index if not exists marketplace_orders_payu_txn_id_once
  on public.marketplace_orders (payu_txn_id) where payu_txn_id is not null;
create unique index if not exists marketplace_payment_intents_provider_ref_once
  on public.marketplace_payment_intents (provider, provider_intent_id) where provider_intent_id is not null;
create unique index if not exists partner_commissions_one_per_line
  on public.partner_commissions (partner_kind, partner_id, order_item_id)
  where order_item_id is not null and commission_amount >= 0;
create unique index if not exists finance_invoices_one_per_order
  on public.finance_invoices ((line_items -> 'meta' ->> 'order_id'))
  where doc_type = 'invoice' and (line_items -> 'meta' ->> 'order_id') is not null;
create unique index if not exists licenses_one_per_order
  on public.licenses (order_id);

commit;
