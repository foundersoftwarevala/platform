-- A row in public.payments can no longer pay for a marketplace order.
--
-- Reproduced in a rolled-back transaction on 2026-10-01: a signed-in affiliate
-- inserted a payments row (status 'completed', amount 1, item_id = another
-- buyer's 249 USD order). The trigger queued it, process_payment_success_events
-- set that order to 'paid' and issued a licence; the paid-order triggers then
-- run commissions and AMS. /usr/local/bin/sv-sweeps.sh drains the queue every
-- five minutes, so this was reachable on production. It had never been used
-- (0 outbox events, 0 PAYMENT_SUCCESS_PROCESSED audit rows).
--
-- Two changes, nothing else:
--
-- 1. payments_owner_insert: a user may still record their own payment, but
--    only as 'pending' and not auto-verified. Approval stays with the
--    existing finance update policy (admin, boss, finance).
--
-- 2. process_payment_success_events: the branch that set a marketplace order
--    to 'paid' and issued its licence is removed. Marketplace orders are
--    settled only by a verified PayU callback (src/lib/commerce/payu-settle.ts:
--    reverse hash, amount, and PayU's own verify API) - a payments row is not
--    evidence of any of that, whoever approved it. Such an event is closed as
--    failed with the reason, never retried, and the refusal is written to
--    payment_audit_logs. Every other item type is handled exactly as before.
--
-- The PayU path does not use public.payments or the outbox, so it is untouched.

begin;

alter policy payments_owner_insert on public.payments
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and coalesce(auto_verified, false) = false
  );

create or replace function public.process_payment_success_events(p_limit integer default 25)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_event public.payment_event_outbox%rowtype;
  v_payment public.payments%rowtype;
  v_done integer := 0;
  v_refused integer := 0;
begin
  for v_event in
    select * from public.payment_event_outbox
     where status in ('pending', 'failed') and available_at <= now()
     order by created_at
     for update skip locked
     limit greatest(1, least(p_limit, 100))
  loop
    update public.payment_event_outbox set status = 'processing', attempts = attempts + 1 where id = v_event.id;
    select * into v_payment from public.payments where id = v_event.payment_id for update;
    if not found or v_payment.status not in ('approved', 'completed') then
      update public.payment_event_outbox
         set status = 'failed', last_error = 'Payment is not approved', available_at = now() + interval '5 minutes'
       where id = v_event.id;
      continue;
    end if;

    -- A marketplace order is paid only by a verified PayU callback. This queue
    -- never changes an order, issues a licence or an entitlement.
    if v_payment.item_type = 'product' then
      update public.payment_event_outbox
         set status = 'failed',
             last_error = 'Marketplace orders are settled only by a verified PayU callback; a payments row cannot complete one.',
             available_at = 'infinity'
       where id = v_event.id;
      insert into public.payment_audit_logs (action, payment_id, amount, status, metadata)
      values ('PAYMENT_SUCCESS_REFUSED', v_payment.id, v_payment.amount, 'refused',
              jsonb_build_object('event_id', v_event.id, 'item_type', v_payment.item_type, 'item_id', v_payment.item_id,
                                 'reason', 'product orders settle only through verified PayU callbacks'));
      v_refused := v_refused + 1;
      continue;
    end if;

    update public.payment_event_outbox set status = 'completed', processed_at = now(), last_error = null where id = v_event.id;
    insert into public.payment_audit_logs (action, payment_id, amount, status, metadata)
    values ('PAYMENT_SUCCESS_PROCESSED', v_payment.id, v_payment.amount, 'completed', jsonb_build_object('event_id', v_event.id));
    v_done := v_done + 1;
  end loop;
  return jsonb_build_object('processed', v_done, 'refused', v_refused, 'processed_at', now());
end;
$function$;

commit;
