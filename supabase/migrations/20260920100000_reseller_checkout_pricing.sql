-- Reseller discount at checkout, decided by the database.
--
-- Before this, marketplace_create_checkout charged list price to everyone, and
-- the only reseller quote (/api/partner/quote) mapped the reseller row's tier
-- to a plan - so an approved reseller whose tier defaulted to 'bronze' was
-- quoted the Starter discount without ever buying a membership.
--
-- The rule now lives in one function, reseller_pricing_for(user):
--   * the user owns a reseller row that is active and approved, and
--   * that reseller holds an active, unexpired membership,
--   * the discount is that membership plan's profit_percent.
-- Anything else is list price. The product's stored price is never changed:
-- the discount is recorded on the order (discount_total, metadata.pricing).
--
-- The cart quote, the product quote and checkout all call the same function,
-- so what the reseller is shown and what they are charged cannot disagree.
-- Nothing is taken from the caller except which product or cart is meant.

create or replace function public.reseller_pricing_for(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_reseller public.resellers%rowtype;
  v_membership record;
begin
  if p_user is null then
    return jsonb_build_object('eligible', false, 'percent', 0, 'reason', 'not_signed_in');
  end if;
  select * into v_reseller from public.resellers where user_id = p_user limit 1;
  if not found then
    return jsonb_build_object('eligible', false, 'percent', 0, 'reason', 'not_a_reseller');
  end if;
  if v_reseller.status <> 'active' or v_reseller.approved_at is null then
    return jsonb_build_object('eligible', false, 'percent', 0, 'reseller_id', v_reseller.id,
                              'reason', 'reseller_not_active');
  end if;
  select m.id, m.expires_at, p.code, p.name, p.profit_percent
    into v_membership
    from public.reseller_memberships m
    join public.reseller_membership_plans p on p.id = m.plan_id
   where m.reseller_id = v_reseller.id
     and m.status = 'active'
     and (m.expires_at is null or m.expires_at > now())
   order by p.profit_percent desc, m.activated_at desc nulls last
   limit 1;
  if not found or coalesce(v_membership.profit_percent, 0) <= 0 then
    return jsonb_build_object('eligible', false, 'percent', 0, 'reseller_id', v_reseller.id,
                              'reason', 'no_active_membership');
  end if;
  return jsonb_build_object('eligible', true, 'percent', v_membership.profit_percent,
    'reseller_id', v_reseller.id, 'membership_id', v_membership.id,
    'plan_code', v_membership.code, 'plan_name', v_membership.name,
    'expires_at', v_membership.expires_at, 'reason', 'active_membership');
end;
$function$;

-- Internal: callable only by other definer functions, never with a chosen user.
revoke all on function public.reseller_pricing_for(uuid) from public, anon, authenticated;

-- The discount on an amount, in whole cents.
create or replace function public.reseller_discount_amount(p_amount numeric, p_percent numeric)
returns numeric
language sql
immutable
as $$ select round(coalesce(p_amount, 0) * greatest(coalesce(p_percent, 0), 0) / 100, 2) $$;

-- What the signed-in user pays for one product.
create or replace function public.marketplace_quote_product(p_product uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_pricing jsonb;
  v_product record;
  v_discount numeric;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select p.id, p.slug, p.name, pp.amount, pp.currency into v_product
    from public.marketplace_products p
    join public.marketplace_product_pricing pp on pp.product_id = p.id and pp.variant_id is null and pp.active
   where p.id = p_product and p.visible and p.moderation_status = 'approved'
   limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_published_price');
  end if;
  v_pricing := public.reseller_pricing_for(auth.uid());
  v_discount := public.reseller_discount_amount(v_product.amount, (v_pricing->>'percent')::numeric);
  return jsonb_build_object('ok', true,
    'product', jsonb_build_object('id', v_product.id, 'slug', v_product.slug, 'name', v_product.name),
    'currency', v_product.currency,
    'list_price', v_product.amount,
    'discount_percent', (v_pricing->>'percent')::numeric,
    'discount', v_discount,
    'final_price', v_product.amount - v_discount,
    'pricing', v_pricing - 'reseller_id');
end;
$function$;

revoke all on function public.marketplace_quote_product(uuid) from public, anon;
grant execute on function public.marketplace_quote_product(uuid) to authenticated;

-- What the signed-in user's active cart costs, line by line.
create or replace function public.marketplace_cart_quote()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_pricing jsonb;
  v_lines jsonb;
  v_subtotal numeric;
  v_currency text;
  v_discount numeric;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'cart_item_id', ci.id, 'product_id', ci.product_id, 'name', p.name,
           'quantity', ci.quantity, 'unit_amount', pp.amount, 'currency', pp.currency,
           'line_total', pp.amount * ci.quantity) order by ci.created_at), '[]'::jsonb),
         coalesce(sum(pp.amount * ci.quantity), 0),
         min(c.currency)
    into v_lines, v_subtotal, v_currency
    from public.marketplace_carts c
    join public.marketplace_cart_items ci on ci.cart_id = c.id
    join public.marketplace_products p on p.id = ci.product_id
    join public.marketplace_product_pricing pp on pp.product_id = ci.product_id
         and (pp.variant_id is not distinct from ci.variant_id) and pp.active
   where c.buyer_id = auth.uid() and c.status = 'active'
     and p.visible and p.moderation_status = 'approved';
  v_pricing := public.reseller_pricing_for(auth.uid());
  v_discount := public.reseller_discount_amount(v_subtotal, (v_pricing->>'percent')::numeric);
  return jsonb_build_object(
    'lines', v_lines,
    'currency', v_currency,
    'subtotal', v_subtotal,
    'discount_percent', (v_pricing->>'percent')::numeric,
    'discount_total', v_discount,
    'total', v_subtotal - v_discount,
    'pricing', v_pricing - 'reseller_id');
end;
$function$;

revoke all on function public.marketplace_cart_quote() from public, anon;
grant execute on function public.marketplace_cart_quote() to authenticated;

-- Checkout: the same lines, the same rule, recorded on the order.
create or replace function public.marketplace_create_checkout(p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_cart public.marketplace_carts%rowtype;
  v_order public.marketplace_orders%rowtype;
  v_item record;
  v_subtotal numeric(20,2) := 0;
  v_count integer := 0;
  v_pricing jsonb;
  v_discount numeric(20,2) := 0;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 16 then raise exception 'valid idempotency key required'; end if;
  select * into v_order from public.marketplace_orders where idempotency_key = p_idempotency_key and buyer_id = auth.uid();
  if v_order.id is not null then
    return jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number, 'status', v_order.status,
      'subtotal', v_order.subtotal, 'discount_total', v_order.discount_total, 'total', v_order.total, 'duplicate', true);
  end if;
  select * into v_cart from public.marketplace_carts where buyer_id = auth.uid() and status = 'active' for update;
  if v_cart.id is null then raise exception 'cart is empty'; end if;
  for v_item in
    select ci.product_id, ci.variant_id, ci.quantity, p.name, p.seller_id, pp.amount, pp.currency
      from public.marketplace_cart_items ci
      join public.marketplace_products p on p.id = ci.product_id
      join public.marketplace_product_pricing pp on pp.product_id = ci.product_id and (pp.variant_id is not distinct from ci.variant_id) and pp.active = true
     where ci.cart_id = v_cart.id and p.visible = true and p.moderation_status = 'approved'
     for update of ci
  loop
    v_count := v_count + 1;
    v_subtotal := v_subtotal + (v_item.amount * v_item.quantity);
  end loop;
  if v_count = 0 then raise exception 'cart has no priced products'; end if;

  -- The partner rule, read from the database for the signed-in user only.
  v_pricing := public.reseller_pricing_for(auth.uid());
  v_discount := public.reseller_discount_amount(v_subtotal, (v_pricing->>'percent')::numeric);

  insert into public.marketplace_orders (buyer_id, currency, subtotal, discount_total, total, idempotency_key, metadata)
    values (auth.uid(), v_cart.currency, v_subtotal, v_discount, v_subtotal - v_discount, p_idempotency_key,
            jsonb_build_object('pricing', v_pricing || jsonb_build_object('list_subtotal', v_subtotal, 'discount_total', v_discount)))
    returning * into v_order;
  for v_item in
    select ci.product_id, ci.variant_id, ci.quantity, p.name, p.seller_id, pp.amount, pp.currency
      from public.marketplace_cart_items ci
      join public.marketplace_products p on p.id = ci.product_id
      join public.marketplace_product_pricing pp on pp.product_id = ci.product_id and (pp.variant_id is not distinct from ci.variant_id) and pp.active = true
     where ci.cart_id = v_cart.id and p.visible = true and p.moderation_status = 'approved'
  loop
    insert into public.marketplace_order_items (order_id, product_id, variant_id, seller_id, product_name, quantity, unit_amount, line_total, currency)
      values (v_order.id, v_item.product_id, v_item.variant_id, v_item.seller_id, v_item.name, v_item.quantity, v_item.amount, v_item.amount * v_item.quantity, v_item.currency);
  end loop;
  insert into public.marketplace_payment_intents (order_id, provider, status, amount, currency, idempotency_key)
    values (v_order.id, 'unconfigured', 'pending', v_order.total, v_order.currency, 'pi-' || p_idempotency_key);
  insert into public.marketplace_order_status_history (order_id, to_status, actor_id, metadata)
    values (v_order.id, v_order.status, auth.uid(), jsonb_build_object('source', 'checkout'));
  update public.marketplace_carts set status = 'checked_out', updated_at = now() where id = v_cart.id;
  insert into public.marketplace_audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'checkout.created', 'marketplace_order', v_order.id,
            jsonb_build_object('subtotal', v_order.subtotal, 'discount_total', v_order.discount_total,
                               'total', v_order.total, 'currency', v_order.currency, 'pricing', v_pricing));
  return jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number, 'status', v_order.status,
    'subtotal', v_order.subtotal, 'discount_total', v_order.discount_total, 'total', v_order.total,
    'payment_status', 'pending', 'duplicate', false);
exception when unique_violation then
  select * into v_order from public.marketplace_orders where idempotency_key = p_idempotency_key and buyer_id = auth.uid();
  if v_order.id is not null then
    return jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number, 'status', v_order.status,
      'subtotal', v_order.subtotal, 'discount_total', v_order.discount_total, 'total', v_order.total, 'duplicate', true);
  end if;
  raise;
end;
$function$;

revoke all on function public.marketplace_create_checkout(text) from public, anon;
grant execute on function public.marketplace_create_checkout(text) to authenticated;

-- The ledger: one payment entry when an order becomes paid, carrying the price
-- as charged and the rule that set it. Written once per order.
create or replace function public.marketplace_order_paid_ledger()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.status = 'paid' and coalesce(old.status, '') <> 'paid' and coalesce(new.total, 0) > 0
     and not exists (select 1 from public.marketplace_ledger_entries
                      where order_id = new.id and entry_type = 'payment') then
    begin
      insert into public.marketplace_ledger_entries (order_id, entry_type, amount, currency, reseller_id, immutable_metadata)
      values (new.id, 'payment', new.total, new.currency,
              case when (new.metadata->'pricing'->>'eligible')::boolean
                   then nullif(new.metadata->'pricing'->>'reseller_id', '')::uuid end,
              jsonb_build_object('order_number', new.order_number, 'subtotal', new.subtotal,
                                 'discount_total', new.discount_total, 'total', new.total,
                                 'pricing', new.metadata->'pricing',
                                 'provider', new.payment_gateway, 'provider_txn', new.payu_txn_id,
                                 'recorded_at', now()));
    exception when others then
      -- Never block a payment being recorded; leave a trace to settle by hand.
      perform public.mm_audit('ledger.payment_failed', 'marketplace_order', new.id::text, null,
                              jsonb_build_object('error', sqlerrm), null);
    end;
  end if;
  return new;
end;
$function$;

drop trigger if exists marketplace_order_paid_ledger on public.marketplace_orders;
create trigger marketplace_order_paid_ledger
  after update on public.marketplace_orders
  for each row execute function public.marketplace_order_paid_ledger();
