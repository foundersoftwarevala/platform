-- The cart total said the wrong currency, on the screen the buyer reads before paying.
--
-- marketplace_cart_quote adds up `pp.amount * quantity` from the pricing rows
-- and then reports `min(c.currency)` - the cart's own column, which defaults to
-- INR. It is the same mistake marketplace_create_checkout made, one step
-- earlier and in front of the customer: a basket of dollar-priced software
-- showing a rupee total.
--
-- Three changes, all matching what checkout now does, so the quote and the
-- order can never disagree:
--
--   1. the currency comes from the items being priced, not from the cart;
--   2. a basket holding more than one currency says so, in `mixed` and
--      `currencies`, instead of quietly adding dollars to rupees - checkout
--      already refuses such a basket with a message, so nobody can buy at the
--      nonsense total, but the cart should not print it either;
--   3. the same publish window checkout applies, so the quote never includes a
--      line checkout will drop.
--
-- The returned shape keeps every field it had, so the cart page renders exactly
-- as before; `mixed` and `currencies` are additions beside them.

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
  v_currencies text[];
  v_discount numeric;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'cart_item_id', ci.id, 'product_id', ci.product_id, 'name', p.name,
           'quantity', ci.quantity, 'unit_amount', pp.amount, 'currency', pp.currency,
           'line_total', pp.amount * ci.quantity) order by ci.created_at), '[]'::jsonb),
         coalesce(sum(pp.amount * ci.quantity), 0),
         -- From the items, not the cart.
         coalesce(array_agg(distinct upper(pp.currency)) filter (where pp.currency is not null), '{}')
    into v_lines, v_subtotal, v_currencies
    from public.marketplace_carts c
    join public.marketplace_cart_items ci on ci.cart_id = c.id
    join public.marketplace_products p on p.id = ci.product_id
    join public.marketplace_product_pricing pp on pp.product_id = ci.product_id
         and (pp.variant_id is not distinct from ci.variant_id) and pp.active
   where c.buyer_id = auth.uid() and c.status = 'active'
     and p.visible and p.moderation_status = 'approved'
     and coalesce(p.content_status, 'published') = 'published'
     and (p.publish_at is null or p.publish_at <= now())
     and (p.unpublish_at is null or p.unpublish_at > now());

  -- One currency is the normal case and the only one that can be checked out.
  v_currency := case when array_length(v_currencies, 1) = 1 then v_currencies[1] else null end;
  if v_currency is null then
    select coalesce(min(c.currency), 'INR') into v_currency
      from public.marketplace_carts c
     where c.buyer_id = auth.uid() and c.status = 'active';
  end if;

  v_pricing := public.reseller_pricing_for(auth.uid());
  v_discount := public.reseller_discount_amount(v_subtotal, (v_pricing->>'percent')::numeric);

  return jsonb_build_object(
    'lines', v_lines,
    'currency', v_currency,
    'currencies', to_jsonb(v_currencies),
    -- True when the total below cannot mean anything, because it adds amounts
    -- in different currencies. Checkout refuses such a basket outright.
    'mixed', coalesce(array_length(v_currencies, 1), 0) > 1,
    'subtotal', v_subtotal,
    'discount_percent', (v_pricing->>'percent')::numeric,
    'discount_total', v_discount,
    'total', v_subtotal - v_discount,
    'pricing', v_pricing - 'reseller_id');
end;
$function$;
