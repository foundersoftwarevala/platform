-- Reseller membership orders: write only values the finance tables accept.
--
-- The membership functions wrote values the finance tables' check
-- constraints refuse, so creating an order - and every verification outcome -
-- failed inside the database:
--   finance_invoices.doc_type    'reseller_membership'  (allowed: invoice, credit_note, debit_note, tax_invoice)
--   finance_invoices.status      'issued', 'failed', 'expired', 'refunded'
--                                (allowed: paid, unpaid, overdue, draft, cancelled)
--   finance_payment_intents.status 'success', 'refunded'
--                                (allowed: pending, processing, paid, failed, expired, cancelled)
--   reseller_membership_orders.status 'expired'
--                                (allowed: pending, processing, paid, failed, cancelled, refunded)
--
-- The invoice is an 'invoice' for client_type 'reseller' whose line items name
-- the membership plan. Outcomes map as:
--   SUCCESS   order paid,      intent paid,      invoice paid
--   FAILED    order failed,    intent failed,    invoice unpaid (still owed)
--   CANCELLED order cancelled, intent cancelled, invoice cancelled
--   EXPIRED   order cancelled, intent expired,   invoice cancelled
--   REFUNDED  order refunded,  intent cancelled, invoice cancelled
-- The order's payment_status keeps the decision as given (success, failed, ...).

create or replace function public.create_reseller_membership_order(p_plan_code text, p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_reseller public.resellers%rowtype;
  v_plan public.reseller_membership_plans%rowtype;
  v_order public.reseller_membership_orders%rowtype;
  v_invoice public.finance_invoices%rowtype;
  v_intent public.finance_payment_intents%rowtype;
  v_rail public.finance_payment_rails%rowtype;
  v_key text := trim(p_idempotency_key);
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if nullif(v_key, '') is null then raise exception 'Idempotency key required'; end if;
  select * into v_reseller from public.resellers where user_id = v_user and status = 'active' for update;
  if not found then raise exception 'Active reseller account required'; end if;
  -- The price comes from the plan, never from the caller.
  select * into v_plan from public.reseller_membership_plans where code = lower(trim(p_plan_code)) and enabled for share;
  if not found then raise exception 'Invalid membership plan'; end if;
  -- A retried request returns the same order, and only this reseller's.
  select * into v_order from public.reseller_membership_orders
   where idempotency_key = v_key and reseller_id = v_reseller.id;
  if found then
    return jsonb_build_object('order', to_jsonb(v_order),
      'invoice', (select to_jsonb(i) from public.finance_invoices i where i.id = v_order.finance_invoice_id),
      'payment_intent', (select to_jsonb(pi) from public.finance_payment_intents pi where pi.id = v_order.finance_intent_id),
      'duplicate', true);
  end if;
  if exists (select 1 from public.reseller_membership_orders where idempotency_key = v_key) then
    raise exception 'Idempotency key already used';
  end if;
  select * into v_rail from public.finance_payment_rails where code = 'bank_transfer' limit 1;
  if not found then raise exception 'Allowed payment rails are not configured'; end if;
  insert into public.finance_invoices (invoice_no, doc_type, client_name, client_type, subtotal, tax_amount, total, status, auto_generated, issue_date, due_date, line_items)
  values ('RMI-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)), 'invoice', v_reseller.name, 'reseller', v_plan.price_usd, 0, v_plan.price_usd, 'unpaid', true, current_date, current_date,
          jsonb_build_array(jsonb_build_object('kind', 'reseller_membership', 'plan_code', v_plan.code, 'description', v_plan.name, 'quantity', 1, 'unit_amount', v_plan.price_usd)))
  returning * into v_invoice;
  insert into public.finance_invoice_items (invoice_id, description, quantity, unit_amount, tax_amount, discount_amount)
  values (v_invoice.id, v_plan.name || ' annual reseller membership', 1, v_plan.price_usd, 0, 0);
  insert into public.reseller_membership_orders (order_number, reseller_id, plan_id, amount_usd, currency, status, idempotency_key, approval_status, finance_invoice_id, payment_status, proof_metadata)
  values ('RMO-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)), v_reseller.id, v_plan.id, v_plan.price_usd, 'USD', 'pending', v_key, 'pending', v_invoice.id, 'pending', '{}'::jsonb)
  returning * into v_order;
  insert into public.finance_payment_intents (invoice_id, rail_id, idempotency_key, amount, currency, status, client_reference)
  values (v_invoice.id, v_rail.id, 'membership-' || v_key, v_plan.price_usd, 'USD', 'pending', v_order.order_number)
  returning * into v_intent;
  update public.reseller_membership_orders set finance_intent_id = v_intent.id where id = v_order.id returning * into v_order;
  insert into public.reseller_membership_events (reseller_id, order_id, event_key, event_type, payload)
  values (v_reseller.id, v_order.id, 'order-created:' || v_order.id::text, 'order.created', jsonb_build_object('plan_code', v_plan.code, 'amount_usd', v_plan.price_usd));
  insert into public.reseller_notifications (title, type, audience, status, body, reseller_id)
  values ('Membership order created', 'order.created', 'reseller', 'sent', 'Your membership invoice is ready for payment.', v_reseller.id);
  return jsonb_build_object('order', to_jsonb(v_order), 'invoice', to_jsonb(v_invoice), 'payment_intent', to_jsonb(v_intent), 'duplicate', false);
end;
$function$;

create or replace function public.submit_reseller_membership_payment(p_order_id uuid, p_rail_code text, p_reference text, p_proof text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_order public.reseller_membership_orders%rowtype;
  v_rail public.finance_payment_rails%rowtype;
  v_intent public.finance_payment_intents%rowtype;
begin
  select o.* into v_order from public.reseller_membership_orders o
    join public.resellers r on r.id = o.reseller_id
   where o.id = p_order_id and r.user_id = v_user for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status not in ('pending','processing') then
    raise exception 'This order is % and cannot take a payment', v_order.status;
  end if;
  select * into v_rail from public.finance_payment_rails where code = lower(trim(p_rail_code)) and enabled;
  if not found then raise exception 'Payment rail is not configured'; end if;
  if nullif(trim(p_reference), '') is null then raise exception 'Payment reference required'; end if;
  update public.finance_payment_intents set rail_id = v_rail.id, client_reference = trim(p_reference), status = 'processing', updated_at = now()
   where id = v_order.finance_intent_id returning * into v_intent;
  update public.reseller_membership_orders
     set proof_reference = trim(p_reference), proof_metadata = jsonb_build_object('proof', nullif(trim(p_proof), '')),
         status = 'processing', payment_status = 'pending', updated_at = now()
   where id = v_order.id returning * into v_order;
  insert into public.reseller_membership_events (reseller_id, order_id, event_key, event_type, payload)
  values (v_order.reseller_id, v_order.id, 'payment-submitted:' || v_order.id::text || ':' || md5(trim(p_reference)), 'payment.pending',
          jsonb_build_object('rail', v_rail.code, 'reference', trim(p_reference)))
  on conflict (event_key) do nothing;
  return jsonb_build_object('order', to_jsonb(v_order), 'payment_intent', to_jsonb(v_intent));
end;
$function$;

create or replace function public.verify_reseller_membership_payment(p_order_id uuid, p_status text, p_provider_reference text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_actor uuid := auth.uid();
  v_status text := upper(trim(p_status));
  v_order public.reseller_membership_orders%rowtype;
  v_owner uuid;
  v_membership_id uuid;
  v_order_status text;
  v_intent_status text;
  v_invoice_status text;
begin
  if v_actor is null or not public.finance_is_operator() then raise exception 'Finance authorization required'; end if;
  if v_status not in ('SUCCESS','FAILED','CANCELLED','EXPIRED','REFUNDED') then raise exception 'Invalid payment status'; end if;
  select * into v_order from public.reseller_membership_orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  select r.user_id into v_owner from public.resellers r where r.id = v_order.reseller_id;
  if v_owner = v_actor then raise exception 'You cannot verify a payment for your own reseller account'; end if;

  -- Already verified: the same answer again, never a second activation.
  if v_order.status = 'paid' then
    if v_status = 'SUCCESS' then
      return jsonb_build_object('order', to_jsonb(v_order), 'membership_id', v_order.membership_id, 'duplicate', true);
    end if;
    raise exception 'This order is already paid';
  end if;
  if v_order.status in ('failed','cancelled','refunded') then
    raise exception 'This order is closed (%)', v_order.status;
  end if;
  -- A payment is verified against the evidence the reseller submitted.
  if v_status = 'SUCCESS' and (v_order.status <> 'processing' or nullif(trim(v_order.proof_reference), '') is null) then
    raise exception 'No payment has been submitted for this order';
  end if;

  v_order_status := case v_status when 'SUCCESS' then 'paid' when 'FAILED' then 'failed'
                                  when 'REFUNDED' then 'refunded' else 'cancelled' end;
  v_intent_status := case v_status when 'SUCCESS' then 'paid' when 'FAILED' then 'failed'
                                   when 'EXPIRED' then 'expired' else 'cancelled' end;
  v_invoice_status := case v_status when 'SUCCESS' then 'paid' when 'FAILED' then 'unpaid' else 'cancelled' end;

  update public.finance_payment_intents
     set status = v_intent_status, provider_reference = nullif(trim(p_provider_reference), ''), updated_at = now()
   where id = v_order.finance_intent_id;
  update public.reseller_membership_orders
     set status = v_order_status,
         payment_status = lower(v_status),
         provider_payment_reference = nullif(trim(p_provider_reference), ''),
         approval_status = case when v_status = 'SUCCESS' then 'approved' else approval_status end,
         updated_at = now()
   where id = v_order.id returning * into v_order;
  update public.finance_invoices
     set status = v_invoice_status,
         paid_at = case when v_status = 'SUCCESS' then now() else paid_at end
   where id = v_order.finance_invoice_id;

  if v_status = 'SUCCESS' then
    v_membership_id := public.activate_reseller_membership(v_order.id, v_actor);
    insert into public.reseller_membership_events (reseller_id, membership_id, order_id, event_key, event_type, payload)
    values (v_order.reseller_id, v_membership_id, v_order.id, 'payment-success:' || v_order.id::text, 'payment.verified',
            jsonb_build_object('actor', v_actor, 'reference', p_provider_reference))
    on conflict (event_key) do nothing;
  else
    insert into public.reseller_membership_events (reseller_id, order_id, event_key, event_type, payload)
    values (v_order.reseller_id, v_order.id, 'payment-' || lower(v_status) || ':' || v_order.id::text, 'payment.' || lower(v_status),
            jsonb_build_object('actor', v_actor))
    on conflict (event_key) do nothing;
  end if;
  return jsonb_build_object('order', to_jsonb(v_order), 'membership_id', v_membership_id, 'duplicate', false);
end;
$function$;

revoke all on function public.create_reseller_membership_order(text, text) from public, anon;
grant execute on function public.create_reseller_membership_order(text, text) to authenticated;
revoke all on function public.submit_reseller_membership_payment(uuid, text, text, text) from public, anon;
grant execute on function public.submit_reseller_membership_payment(uuid, text, text, text) to authenticated;
revoke all on function public.verify_reseller_membership_payment(uuid, text, text) from public, anon;
grant execute on function public.verify_reseller_membership_payment(uuid, text, text) to authenticated;
