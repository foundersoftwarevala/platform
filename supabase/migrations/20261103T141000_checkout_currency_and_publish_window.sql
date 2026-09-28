-- Checkout was about to sell a $249 product for ₹249.
--
-- marketplace_create_checkout adds up `pp.amount` from the pricing rows, and
-- then writes the order with `v_cart.currency` - the cart's own column, which
-- defaults to 'INR'. The two are unrelated. Of the active pricing rows, 3,699
-- are in USD and 15 in INR, so in practice almost every order would have been
-- recorded in rupees at the dollar figure, and /api/payment/initiate skips
-- conversion when it sees INR (`rate: 1`). Nobody has been charged wrongly
-- because online payment is not configured yet, so this is being fixed while it
-- is still theory.
--
-- Two changes, and nothing else about the function moves:
--
--   1. The order's currency comes from the items being bought, not from the
--      cart. A cart holding more than one currency is refused with a message
--      that says so, rather than adding dollars to rupees and calling the
--      result a total.
--
--   2. The publish window is honoured, the way add-to-cart already honours it:
--      a draft or a product outside its publish window cannot be checked out.
--      No product currently sets publish_at or unpublish_at, so that part is a
--      no-op today and starts working the day scheduling is used; ten visible
--      products are `content_status = 'draft'` and those stop being buyable,
--      which is the point.
--
-- No price is changed and no rate is introduced. This only makes the order say
-- which currency its own figure is in.

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
  v_currency text := null;
  v_currencies text[] := '{}';
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
       -- The same publish window add-to-cart already applies.
       and coalesce(p.content_status, 'published') = 'published'
       and (p.publish_at is null or p.publish_at <= now())
       and (p.unpublish_at is null or p.unpublish_at > now())
     for update of ci
  loop
    v_count := v_count + 1;
    v_subtotal := v_subtotal + (v_item.amount * v_item.quantity);
    if not (upper(coalesce(v_item.currency, '')) = any (v_currencies)) then
      v_currencies := v_currencies || upper(coalesce(v_item.currency, ''));
    end if;
  end loop;
  if v_count = 0 then raise exception 'cart has no priced products'; end if;

  -- Dollars and rupees do not add up, and pretending they do is how a $249
  -- product becomes a ₹249 one. Said plainly so the buyer can split the order.
  if array_length(v_currencies, 1) > 1 then
    raise exception 'This basket mixes % currencies (%). Please check out one currency at a time.',
      array_length(v_currencies, 1), array_to_string(v_currencies, ', ');
  end if;
  v_currency := coalesce(nullif(v_currencies[1], ''), v_cart.currency, 'INR');

  -- The partner rule, read from the database for the signed-in user only.
  v_pricing := public.reseller_pricing_for(auth.uid());
  v_discount := public.reseller_discount_amount(v_subtotal, (v_pricing->>'percent')::numeric);

  insert into public.marketplace_orders (buyer_id, currency, subtotal, discount_total, total, idempotency_key, metadata)
    values (auth.uid(), v_currency, v_subtotal, v_discount, v_subtotal - v_discount, p_idempotency_key,
            jsonb_build_object('pricing', v_pricing || jsonb_build_object('list_subtotal', v_subtotal, 'discount_total', v_discount),
                               'currency_source', 'product_pricing'))
    returning * into v_order;

  for v_item in
    select ci.product_id, ci.variant_id, ci.quantity, p.name, p.seller_id, pp.amount, pp.currency
      from public.marketplace_cart_items ci
      join public.marketplace_products p on p.id = ci.product_id
      join public.marketplace_product_pricing pp on pp.product_id = ci.product_id and (pp.variant_id is not distinct from ci.variant_id) and pp.active = true
     where ci.cart_id = v_cart.id and p.visible = true and p.moderation_status = 'approved'
       and coalesce(p.content_status, 'published') = 'published'
       and (p.publish_at is null or p.publish_at <= now())
       and (p.unpublish_at is null or p.unpublish_at > now())
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
    'currency', v_order.currency,
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
