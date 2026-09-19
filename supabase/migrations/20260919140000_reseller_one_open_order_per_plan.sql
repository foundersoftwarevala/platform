-- One open membership order per reseller and plan.
--
-- The idempotency key protects a retried request, but each visit to Membership
-- & Plans makes a new key, so a reseller who came back and pressed "Purchase"
-- again got a second pending order and a second invoice for the same plan.
-- An order that is still open (pending, or payment submitted) for the same
-- plan is now returned instead of a new one.

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
  -- Still open for this plan: the same order, not a second one.
  select * into v_order from public.reseller_membership_orders
   where reseller_id = v_reseller.id and plan_id = v_plan.id and status in ('pending','processing')
   order by created_at desc limit 1;
  if found then
    return jsonb_build_object('order', to_jsonb(v_order),
      'invoice', (select to_jsonb(i) from public.finance_invoices i where i.id = v_order.finance_invoice_id),
      'payment_intent', (select to_jsonb(pi) from public.finance_payment_intents pi where pi.id = v_order.finance_intent_id),
      'duplicate', true);
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

revoke all on function public.create_reseller_membership_order(text, text) from public, anon;
grant execute on function public.create_reseller_membership_order(text, text) to authenticated;
