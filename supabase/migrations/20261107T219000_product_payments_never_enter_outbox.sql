-- A 'product' payment row never enters the settlement queue.
--
-- Follows 20261107T217000. That migration stopped the outbox processor from
-- completing a marketplace order from a payments row, and stopped users from
-- inserting anything but a pending, non-auto-verified row. One step remained:
-- when a finance operator approved such a row, enqueue_payment_success() still
-- queued a PAYMENT_SUCCESS event for it, which the processor then refused.
-- Marketplace orders are settled only by a verified PayU callback
-- (src/lib/commerce/payu-settle.ts), so a product payment has no business in
-- the queue at all.
--
-- The only change is one condition on the existing IF: item_type must not be
-- 'product'. Plan, subscription and wallet_topup payments are queued exactly
-- as before. The trigger, the policies and process_payment_success_events()
-- are not touched.

begin;

create or replace function public.enqueue_payment_success()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.status in ('approved', 'completed')
     and (tg_op = 'INSERT' or old.status is distinct from new.status)
     -- Marketplace orders settle only through a verified PayU callback.
     and new.item_type is distinct from 'product' then
    insert into public.payment_event_outbox (event_type, payment_id, payload)
    values ('PAYMENT_SUCCESS', new.id, jsonb_build_object('payment_id', new.id, 'order_id', new.order_id, 'amount', new.amount, 'currency', new.currency))
    on conflict (event_type, payment_id) do nothing;
  end if;
  return new;
end;
$function$;

commit;
