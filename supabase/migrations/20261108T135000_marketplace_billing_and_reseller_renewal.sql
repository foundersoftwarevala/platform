-- Persist the exact price selected for each cart line. A product can have
-- several active currencies and billing periods; summing those rows is not a
-- price selection.

alter table public.marketplace_cart_items
  add column if not exists selected_pricing_id uuid;

alter table public.marketplace_order_items
  add column if not exists billing_period text not null default 'lifetime';

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'marketplace_cart_items_selected_pricing_id_fkey'
       and conrelid = 'public.marketplace_cart_items'::regclass
  ) then
    alter table public.marketplace_cart_items
      add constraint marketplace_cart_items_selected_pricing_id_fkey
      foreign key (selected_pricing_id)
      references public.marketplace_product_pricing(id)
      on delete set null;
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conname = 'marketplace_order_items_billing_period_check'
       and conrelid = 'public.marketplace_order_items'::regclass
  ) then
    alter table public.marketplace_order_items
      add constraint marketplace_order_items_billing_period_check
      check (billing_period in ('lifetime', 'month', 'year', 'one_time'));
  end if;
end;
$$;

-- Preserve unambiguous existing cart prices; leave multiple-price lines for
-- the buyer to select at checkout.
with single_prices as (
  select product_id, variant_id, (array_agg(id))[1] as pricing_id
    from public.marketplace_product_pricing
   where active
   group by product_id, variant_id
  having count(*) = 1
)
update public.marketplace_cart_items ci
   set selected_pricing_id = sp.pricing_id,
       updated_at = now()
  from single_prices sp
 where ci.selected_pricing_id is null
   and ci.product_id = sp.product_id
   and ci.variant_id is not distinct from sp.variant_id;

create or replace function public.marketplace_add_to_cart(
  p_product_id uuid,
  p_quantity integer default 1,
  p_variant_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_cart uuid;
  v_product public.marketplace_products%rowtype;
  v_item uuid;
  v_selected_pricing_id uuid;
  v_price_count integer := 0;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > 1000 then raise exception 'invalid quantity'; end if;

  select * into v_product from public.marketplace_products
   where id = p_product_id
     and visible = true
     and moderation_status = 'approved'
     and (publish_at is null or publish_at <= now())
     and (unpublish_at is null or unpublish_at > now());
  if v_product.id is null then raise exception 'product unavailable'; end if;

  select count(*), (array_agg(id order by created_at, id))[1]
    into v_price_count, v_selected_pricing_id
    from public.marketplace_product_pricing
   where product_id = p_product_id
     and variant_id is not distinct from p_variant_id
     and active;
  if v_price_count <> 1 then v_selected_pricing_id := null; end if;

  v_cart := public.marketplace_get_or_create_cart();

  select id into v_item
    from public.marketplace_cart_items
   where cart_id = v_cart
     and product_id = p_product_id
     and variant_id is not distinct from p_variant_id
   order by created_at
   limit 1
   for update;

  if v_item is null then
    insert into public.marketplace_cart_items
      (cart_id, product_id, variant_id, quantity, selected_pricing_id)
    values (v_cart, p_product_id, p_variant_id, p_quantity, v_selected_pricing_id);
  else
    update public.marketplace_cart_items
       set quantity = least(quantity + p_quantity, 1000),
           selected_pricing_id = case
             when v_price_count = 1 then v_selected_pricing_id
             else selected_pricing_id
           end,
           updated_at = now()
     where id = v_item;
  end if;

  update public.marketplace_carts set updated_at = now() where id = v_cart;
  return jsonb_build_object('cart_id', v_cart);
end;
$function$;

create or replace function public.marketplace_set_cart_item_pricing(
  p_cart_item_id uuid,
  p_pricing_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_item record;
  v_pricing record;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  select ci.id, ci.product_id, ci.variant_id, ci.cart_id
    into v_item
    from public.marketplace_cart_items ci
    join public.marketplace_carts c on c.id = ci.cart_id
   where ci.id = p_cart_item_id
     and c.buyer_id = auth.uid()
     and c.status = 'active'
   for update of ci, c;
  if not found then raise exception 'active cart item not found'; end if;

  select id, billing_period, currency, amount
    into v_pricing
    from public.marketplace_product_pricing
   where id = p_pricing_id
     and product_id = v_item.product_id
     and variant_id is not distinct from v_item.variant_id
     and active;
  if not found then raise exception 'selected price is unavailable for this product'; end if;

  update public.marketplace_cart_items
     set selected_pricing_id = p_pricing_id, updated_at = now()
   where id = v_item.id;
  update public.marketplace_carts set updated_at = now() where id = v_item.cart_id;

  return jsonb_build_object(
    'cart_item_id', v_item.id,
    'pricing_id', v_pricing.id,
    'billing_period', v_pricing.billing_period,
    'currency', v_pricing.currency,
    'amount', v_pricing.amount
  );
end;
$function$;

revoke all on function public.marketplace_set_cart_item_pricing(uuid, uuid) from public, anon;
grant execute on function public.marketplace_set_cart_item_pricing(uuid, uuid) to authenticated, service_role;

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
  v_subtotal numeric := 0;
  v_currency text;
  v_currencies text[];
  v_discount numeric;
  v_missing integer := 0;
  v_unavailable integer := 0;
  v_item_count integer := 0;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  select
         coalesce(
           jsonb_agg(jsonb_build_object(
             'cart_item_id', ci.id,
             'product_id', ci.product_id,
             'name', p.name,
             'quantity', ci.quantity,
             'pricing_id', pp.id,
             'billing_period', pp.billing_period,
             'unit_amount', pp.amount,
             'currency', pp.currency,
             'line_total', pp.amount * ci.quantity
           ) order by ci.created_at) filter (where p.id is not null and pp.id is not null),
           '[]'::jsonb
         ),
         coalesce(sum(pp.amount * ci.quantity) filter (where p.id is not null and pp.id is not null), 0),
         coalesce(array_agg(distinct upper(pp.currency)) filter (where p.id is not null and pp.id is not null), '{}'),
         count(*) filter (where p.id is not null and pp.id is null),
         count(*) filter (where p.id is null),
         count(*)
    into v_lines, v_subtotal, v_currencies, v_missing, v_unavailable, v_item_count
    from public.marketplace_carts c
    join public.marketplace_cart_items ci on ci.cart_id = c.id
    left join public.marketplace_products p
      on p.id = ci.product_id
     and p.visible
     and p.moderation_status = 'approved'
     and coalesce(p.content_status, 'published') = 'published'
     and (p.publish_at is null or p.publish_at <= now())
     and (p.unpublish_at is null or p.unpublish_at > now())
    left join public.marketplace_product_pricing pp
      on pp.id = ci.selected_pricing_id
     and pp.product_id = ci.product_id
     and pp.variant_id is not distinct from ci.variant_id
     and pp.active
   where c.buyer_id = auth.uid() and c.status = 'active';

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
    'mixed', coalesce(array_length(v_currencies, 1), 0) > 1,
    'pricing_required_count', v_missing,
    'unavailable_count', v_unavailable,
    'ready', v_item_count > v_unavailable and v_missing = 0
             and coalesce(array_length(v_currencies, 1), 0) = 1,
    'subtotal', v_subtotal,
    'discount_percent', (v_pricing->>'percent')::numeric,
    'discount_total', v_discount,
    'total', v_subtotal - v_discount,
    'pricing', v_pricing - 'reseller_id'
  );
end;
$function$;

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
  v_cart_count integer := 0;
  v_product_count integer := 0;
  v_priced_count integer := 0;
  v_pricing jsonb;
  v_discount numeric(20,2) := 0;
  v_currency text;
  v_currencies text[] := '{}';
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 16 then raise exception 'valid idempotency key required'; end if;

  select * into v_order
    from public.marketplace_orders
   where idempotency_key = p_idempotency_key and buyer_id = auth.uid();
  if v_order.id is not null then
    return jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number, 'status', v_order.status,
      'subtotal', v_order.subtotal, 'discount_total', v_order.discount_total, 'total', v_order.total,
      'currency', v_order.currency, 'duplicate', true);
  end if;

  select * into v_cart
    from public.marketplace_carts
   where buyer_id = auth.uid() and status = 'active'
   for update;
  if v_cart.id is null then raise exception 'cart is empty'; end if;

  select count(*) into v_cart_count
    from public.marketplace_cart_items
   where cart_id = v_cart.id;
  if v_cart_count = 0 then raise exception 'cart is empty'; end if;

  select count(*) into v_product_count
    from public.marketplace_cart_items ci
    join public.marketplace_products p on p.id = ci.product_id
   where ci.cart_id = v_cart.id
     and p.visible = true
     and p.moderation_status = 'approved'
     and coalesce(p.content_status, 'published') = 'published'
     and (p.publish_at is null or p.publish_at <= now())
     and (p.unpublish_at is null or p.unpublish_at > now());
  if v_product_count = 0 then raise exception 'cart has no available products'; end if;

  select count(*) into v_priced_count
    from public.marketplace_cart_items ci
    join public.marketplace_products p on p.id = ci.product_id
    join public.marketplace_product_pricing pp
      on pp.id = ci.selected_pricing_id
     and pp.product_id = ci.product_id
     and pp.variant_id is not distinct from ci.variant_id
     and pp.active
   where ci.cart_id = v_cart.id
     and p.visible = true
     and p.moderation_status = 'approved'
     and coalesce(p.content_status, 'published') = 'published'
     and (p.publish_at is null or p.publish_at <= now())
     and (p.unpublish_at is null or p.unpublish_at > now());
  if v_priced_count <> v_product_count then
    raise exception 'Select a billing period and currency for every cart item.';
  end if;

  for v_item in
    select ci.id as cart_item_id, ci.product_id, ci.variant_id, ci.quantity,
           p.name, p.seller_id, pp.id as pricing_id, pp.amount, pp.currency,
           pp.billing_period
      from public.marketplace_cart_items ci
      join public.marketplace_products p on p.id = ci.product_id
      join public.marketplace_product_pricing pp
        on pp.id = ci.selected_pricing_id
       and pp.product_id = ci.product_id
       and pp.variant_id is not distinct from ci.variant_id
       and pp.active
     where ci.cart_id = v_cart.id
       and p.visible = true and p.moderation_status = 'approved'
       and coalesce(p.content_status, 'published') = 'published'
       and (p.publish_at is null or p.publish_at <= now())
       and (p.unpublish_at is null or p.unpublish_at > now())
     for update of ci, pp
  loop
    v_subtotal := v_subtotal + (v_item.amount * v_item.quantity);
    if not (upper(v_item.currency) = any (v_currencies)) then
      v_currencies := v_currencies || upper(v_item.currency);
    end if;
  end loop;

  if array_length(v_currencies, 1) > 1 then
    raise exception 'This basket mixes % currencies (%). Please check out one currency at a time.',
      array_length(v_currencies, 1), array_to_string(v_currencies, ', ');
  end if;
  v_currency := coalesce(nullif(v_currencies[1], ''), v_cart.currency, 'INR');

  v_pricing := public.reseller_pricing_for(auth.uid());
  v_discount := public.reseller_discount_amount(v_subtotal, (v_pricing->>'percent')::numeric);

  insert into public.marketplace_orders
    (buyer_id, currency, subtotal, discount_total, total, idempotency_key, metadata)
  values
    (auth.uid(), v_currency, v_subtotal, v_discount, v_subtotal - v_discount, p_idempotency_key,
     jsonb_build_object('pricing', v_pricing || jsonb_build_object('list_subtotal', v_subtotal, 'discount_total', v_discount),
                        'currency_source', 'selected_product_pricing'))
  returning * into v_order;

  for v_item in
    select ci.product_id, ci.variant_id, ci.quantity, p.name, p.seller_id,
           pp.amount, pp.currency, pp.billing_period
      from public.marketplace_cart_items ci
      join public.marketplace_products p on p.id = ci.product_id
      join public.marketplace_product_pricing pp
        on pp.id = ci.selected_pricing_id
       and pp.product_id = ci.product_id
       and pp.variant_id is not distinct from ci.variant_id
       and pp.active
     where ci.cart_id = v_cart.id
       and p.visible = true and p.moderation_status = 'approved'
       and coalesce(p.content_status, 'published') = 'published'
       and (p.publish_at is null or p.publish_at <= now())
       and (p.unpublish_at is null or p.unpublish_at > now())
  loop
    insert into public.marketplace_order_items
      (order_id, product_id, variant_id, seller_id, product_name, quantity,
       unit_amount, line_total, currency, billing_period)
    values
      (v_order.id, v_item.product_id, v_item.variant_id, v_item.seller_id,
       v_item.name, v_item.quantity, v_item.amount, v_item.amount * v_item.quantity,
       v_item.currency, v_item.billing_period);
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
    'currency', v_order.currency, 'payment_status', 'pending', 'duplicate', false);
exception when unique_violation then
  select * into v_order
    from public.marketplace_orders
   where idempotency_key = p_idempotency_key and buyer_id = auth.uid();
  if v_order.id is not null then
    return jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number, 'status', v_order.status,
      'subtotal', v_order.subtotal, 'discount_total', v_order.discount_total, 'total', v_order.total,
      'currency', v_order.currency, 'duplicate', true);
  end if;
  raise;
end;
$function$;

create or replace function public.mm_issue_for_order(p_order_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path to public, pg_temp
as $$
declare
  o record;
  item record;
  v_ent uuid;
  v_key text;
  v_created integer := 0;
  v_skipped integer := 0;
  v_model text;
  v_expires_at timestamptz;
begin
  select * into o from public.marketplace_orders where id = p_order_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_order');
  end if;
  if o.status::text <> 'paid' then
    return jsonb_build_object('ok', false, 'reason', 'order_not_paid', 'status', o.status::text);
  end if;
  if o.buyer_id is null then
    return jsonb_build_object('ok', false, 'reason', 'order_has_no_buyer');
  end if;

  for item in
    select oi.id, oi.product_id, oi.billing_period
      from public.marketplace_order_items oi
     where oi.order_id = p_order_id
  loop
    if exists (select 1 from public.marketplace_entitlements where order_item_id = item.id) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    select case
             when p.license ilike '%saas%' or p.license ilike '%subscription%' then 'subscription'
             when p.license ilike '%trial%' then 'trial'
             when p.license ilike '%team%' or p.license ilike '%multi%' then 'team'
             when p.license ilike '%single%' then 'single_user'
             else 'lifetime'
           end
      into v_model
      from public.marketplace_products p
     where p.id = item.product_id;

    v_expires_at := case
      when v_model in ('subscription', 'trial') and item.billing_period = 'year'
        then now() + interval '1 year'
      when v_model in ('subscription', 'trial')
        then now() + interval '1 month'
      else null
    end;

    insert into public.marketplace_entitlements
      (order_item_id, buyer_id, product_id, status, starts_at, ends_at)
    values (item.id, o.buyer_id, item.product_id, 'active', now(), v_expires_at)
    returning id into v_ent;

    v_key := public.mm_new_license_key();

    insert into public.marketplace_licenses
      (order_item_id, buyer_id, product_id, license_key, license_model, status, expires_at)
    values (item.id, o.buyer_id, item.product_id, v_key,
            coalesce(v_model, 'lifetime'), 'active', v_expires_at);

    v_created := v_created + 1;

    perform public.mm_audit(
      'license.issued', 'marketplace_license', item.id::text,
      null,
      jsonb_build_object('order_id', p_order_id, 'product_id', item.product_id,
                         'license_model', v_model, 'billing_period', item.billing_period,
                         'expires_at', v_expires_at, 'entitlement_id', v_ent),
      'issued on payment');
  end loop;

  return jsonb_build_object('ok', true, 'order', p_order_id, 'issued', v_created, 'already_had', v_skipped);
end;
$$;

create or replace function public.activate_reseller_membership(p_order_id uuid, p_actor uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order public.reseller_membership_orders%rowtype;
  v_plan public.reseller_membership_plans%rowtype;
  v_existing public.reseller_memberships%rowtype;
  v_membership_id uuid;
  v_start timestamptz := now();
  v_expiry timestamptz;
  v_feature text;
  v_renewal boolean := false;
begin
  select * into v_order from public.reseller_membership_orders where id = p_order_id for update;
  if not found then raise exception 'membership order not found'; end if;
  if v_order.payment_status <> 'success' or v_order.status <> 'paid' then raise exception 'payment is not verified'; end if;
  if v_order.approval_status <> 'approved' then raise exception 'membership approval is required'; end if;
  if v_order.membership_id is not null then return v_order.membership_id; end if;
  select * into v_plan from public.reseller_membership_plans where id = v_order.plan_id and enabled = true;
  if not found then raise exception 'membership plan not found'; end if;

  perform 1 from public.resellers where id = v_order.reseller_id for update;
  if not found then raise exception 'reseller not found'; end if;

  select * into v_existing
    from public.reseller_memberships
   where reseller_id = v_order.reseller_id
     and plan_id = v_plan.id
     and status in ('active', 'renewal_due')
   order by expires_at desc nulls last, created_at desc
   limit 1
   for update;

  if found then
    v_renewal := true;
    v_start := greatest(v_start, coalesce(v_existing.expires_at, v_start));
    v_expiry := v_start + make_interval(days => v_plan.validity_days);
    v_membership_id := v_existing.id;

    update public.reseller_memberships
       set status = 'active',
           membership_state = 'active',
           expires_at = v_expiry,
           renewal_at = v_expiry - interval '30 days',
           entitlements_snapshot = v_plan.features,
           provider_payment_reference = coalesce(v_order.provider_payment_reference, provider_payment_reference),
           updated_at = now()
     where id = v_membership_id;

    update public.reseller_membership_entitlements
       set expires_at = v_expiry
     where membership_id = v_membership_id;
  else
    -- A separately paid order for a different plan is the explicit plan
    -- change path; only same-plan purchases extend the existing membership.
    update public.reseller_memberships
       set status = 'expired', membership_state = 'expired',
           expires_at = least(coalesce(expires_at, v_start), v_start), updated_at = v_start
     where reseller_id = v_order.reseller_id and status in ('active', 'renewal_due');

    v_expiry := v_start + make_interval(days => v_plan.validity_days);
    insert into public.reseller_memberships
      (reseller_id, plan_id, plan_code, status, membership_state, starts_at, expires_at,
       activated_at, entitlements_snapshot, provider_payment_reference, order_id, finance_intent_id)
    values
      (v_order.reseller_id, v_plan.id, v_plan.code, 'active', 'active', v_start, v_expiry,
       v_start, v_plan.features, v_order.provider_payment_reference, v_order.id, v_order.finance_intent_id)
    returning id into v_membership_id;
  end if;

  insert into public.reseller_membership_entitlements
    (membership_id, feature_key, feature_value, starts_at, expires_at)
  values
    (v_membership_id, 'profit_percent', to_jsonb(v_plan.profit_percent), v_start, v_expiry)
  on conflict (membership_id, feature_key) do update
    set feature_value = excluded.feature_value, expires_at = excluded.expires_at;

  if jsonb_typeof(v_plan.features) = 'array' then
    for v_feature in select jsonb_array_elements_text(v_plan.features) loop
      insert into public.reseller_membership_entitlements
        (membership_id, feature_key, feature_value, starts_at, expires_at)
      values
        (v_membership_id, 'feature:' || v_feature, to_jsonb(v_feature), v_start, v_expiry)
      on conflict (membership_id, feature_key) do update
        set feature_value = excluded.feature_value, expires_at = excluded.expires_at;
    end loop;
  end if;

  update public.resellers set plan_code = v_plan.code, updated_at = now() where id = v_order.reseller_id;
  update public.reseller_membership_orders set membership_id = v_membership_id, updated_at = now() where id = p_order_id;
  insert into public.reseller_membership_events (reseller_id, membership_id, order_id, event_key, event_type, payload)
  values (
    v_order.reseller_id, v_membership_id, p_order_id,
    case when v_renewal then 'membership-renewed:' else 'membership-activated:' end || p_order_id::text,
    case when v_renewal then 'membership.renewed' else 'membership.activated' end,
    jsonb_build_object('actor', p_actor, 'plan_code', v_plan.code, 'expires_at', v_expiry)
  )
  on conflict (event_key) do nothing;

  insert into public.reseller_notifications (reseller_id, title, type, audience, status, body)
  values (
    v_order.reseller_id,
    case when v_renewal then 'Membership renewed' else 'Membership activated' end,
    case when v_renewal then 'membership.renewed' else 'membership.activated' end,
    'reseller', 'sent',
    case when v_renewal then 'Your ' || v_plan.name || ' membership has been renewed.'
         else 'Your ' || v_plan.name || ' membership is active.' end
  );
  return v_membership_id;
end;
$function$;

revoke all on function public.activate_reseller_membership(uuid, uuid) from public, anon, authenticated;
