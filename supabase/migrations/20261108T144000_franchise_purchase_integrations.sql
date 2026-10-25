-- Apply the configured franchise discounts at both quote and checkout,
-- persist purchase leads idempotently, and recognize the buyer in AMS.

create or replace function public.marketplace_franchise_pricing_for(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_ids uuid[];
  v_territory text;
  v_status text;
  v_plan text;
  v_plan_name text;
  v_percent numeric;
  v_assignment_active boolean;
begin
  if p_user_id is null then
    return jsonb_build_object('kind', 'none');
  end if;

  select array_agg(distinct linked.id order by linked.id), bool_or(linked.active)
    into v_ids, v_assignment_active
    from (
      select f.id, true as active
        from public.franchises f
       where f.owner_user_id = p_user_id
      union all
      select f.id, fu.active
        from public.franchise_users fu
         join public.franchises f on f.id = fu.franchise_id
        where fu.user_id = p_user_id
    ) linked;

  if coalesce(cardinality(v_ids), 0) = 0 then
    return jsonb_build_object('kind', 'none');
  end if;

  if cardinality(v_ids) <> 1 then
    return jsonb_build_object(
      'kind', 'franchise',
      'eligible', false,
      'reason', 'multiple_franchises'
    );
  end if;

  select lower(btrim(f.territory)), lower(btrim(f.status))
    into v_territory, v_status
    from public.franchises f
   where f.id = v_ids[1];

  if v_territory in ('city', 'local') then
    v_plan := 'city';
    v_plan_name := 'City / Local Partner';
    v_percent := 30;
  elsif v_territory in ('district', 'regional') then
    v_plan := 'district';
    v_plan_name := 'District / Regional Partner';
    v_percent := 40;
  elsif v_territory in ('division', 'master') then
    v_plan := 'division';
    v_plan_name := 'Division / Master Partner';
    v_percent := 60;
  else
    return jsonb_build_object(
      'kind', 'franchise',
      'eligible', false,
      'reason', 'unsupported_franchise_territory'
    );
  end if;

  if v_status is distinct from 'active' then
    return jsonb_build_object(
      'kind', 'franchise',
      'eligible', false,
      'reason', 'franchise_not_active',
      'plan_code', v_plan,
      'plan_name', v_plan_name
    );
  end if;

  if v_assignment_active is not true then
    return jsonb_build_object(
      'kind', 'franchise',
      'eligible', false,
      'reason', 'franchise_membership_inactive',
      'plan_code', v_plan,
      'plan_name', v_plan_name
    );
  end if;

  return jsonb_build_object(
    'kind', 'franchise',
    'eligible', true,
    'reason', 'active_franchise',
    'plan_code', v_plan,
    'plan_name', v_plan_name,
    'percent', v_percent
  );
end
$function$;

revoke all on function public.marketplace_franchise_pricing_for(uuid)
  from public, anon, authenticated;
grant execute on function public.marketplace_franchise_pricing_for(uuid)
  to service_role;

create or replace function public.marketplace_quote_product(p_product uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_pricing jsonb;
  v_franchise jsonb;
  v_is_franchise boolean := false;
  v_product record;
  v_percent numeric := 0;
  v_discount numeric;
  v_final_price numeric;
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

  v_franchise := public.marketplace_franchise_pricing_for(auth.uid());
  v_is_franchise := v_franchise->>'kind' = 'franchise';
  if v_is_franchise then
    if (v_franchise->>'eligible')::boolean is not true then
      raise exception 'franchise pricing is unavailable for this account';
    end if;
    v_pricing := v_franchise;
    v_percent := coalesce((v_pricing->>'percent')::numeric, 0);
  else
    v_pricing := public.reseller_pricing_for(auth.uid());
    v_percent := coalesce((v_pricing->>'percent')::numeric, 0);
  end if;

  v_discount := public.reseller_discount_amount(v_product.amount, v_percent);
  v_final_price := v_product.amount - v_discount;
  return jsonb_build_object(
    'ok', true,
    'product', jsonb_build_object('id', v_product.id, 'slug', v_product.slug, 'name', v_product.name),
    'currency', v_product.currency,
    'list_price', case when v_is_franchise then v_final_price else v_product.amount end,
    'discount_percent', case when v_is_franchise then 0 else v_percent end,
    'discount', case when v_is_franchise then 0 else v_discount end,
    'final_price', v_final_price,
    'pricing', v_pricing - 'reseller_id'
  );
end
$function$;

create or replace function public.marketplace_cart_quote()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_pricing jsonb;
  v_franchise jsonb;
  v_is_franchise boolean := false;
  v_percent numeric := 0;
  v_lines jsonb;
  v_subtotal numeric := 0;
  v_franchise_subtotal numeric := 0;
  v_display_subtotal numeric := 0;
  v_currency text;
  v_currencies text[];
  v_discount numeric;
  v_missing integer := 0;
  v_unavailable integer := 0;
  v_item_count integer := 0;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  v_franchise := public.marketplace_franchise_pricing_for(auth.uid());
  v_is_franchise := v_franchise->>'kind' = 'franchise';
  if v_is_franchise and (v_franchise->>'eligible')::boolean is not true then
    raise exception 'franchise pricing is unavailable for this account';
  end if;
  if v_is_franchise then
    v_pricing := v_franchise;
    v_percent := coalesce((v_pricing->>'percent')::numeric, 0);
  else
    v_pricing := public.reseller_pricing_for(auth.uid());
    v_percent := coalesce((v_pricing->>'percent')::numeric, 0);
  end if;

  select
         coalesce(
           jsonb_agg(jsonb_build_object(
             'cart_item_id', ci.id,
             'product_id', ci.product_id,
             'name', p.name,
             'quantity', ci.quantity,
             'pricing_id', pp.id,
             'billing_period', pp.billing_period,
             'unit_amount', case when v_is_franchise
               then round(pp.amount * (100 - v_percent) / 100, 2)
               else pp.amount end,
             'currency', pp.currency,
             'line_total', case when v_is_franchise
               then round(pp.amount * (100 - v_percent) / 100, 2) * ci.quantity
               else pp.amount * ci.quantity end
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

  if v_is_franchise then
    select coalesce(sum(round(pp.amount * (100 - v_percent) / 100, 2) * ci.quantity), 0)
      into v_franchise_subtotal
      from public.marketplace_carts c
      join public.marketplace_cart_items ci on ci.cart_id = c.id
      join public.marketplace_products p
        on p.id = ci.product_id
       and p.visible
       and p.moderation_status = 'approved'
       and coalesce(p.content_status, 'published') = 'published'
       and (p.publish_at is null or p.publish_at <= now())
       and (p.unpublish_at is null or p.unpublish_at > now())
      join public.marketplace_product_pricing pp
        on pp.id = ci.selected_pricing_id
       and pp.product_id = ci.product_id
       and pp.variant_id is not distinct from ci.variant_id
       and pp.active
     where c.buyer_id = auth.uid() and c.status = 'active';
    v_discount := v_subtotal - v_franchise_subtotal;
  else
    v_discount := public.reseller_discount_amount(v_subtotal, v_percent);
  end if;
  v_display_subtotal := case when v_is_franchise then v_subtotal - v_discount else v_subtotal end;

  return jsonb_build_object(
    'lines', v_lines,
    'currency', v_currency,
    'currencies', to_jsonb(v_currencies),
    'mixed', coalesce(array_length(v_currencies, 1), 0) > 1,
    'pricing_required_count', v_missing,
    'unavailable_count', v_unavailable,
    'ready', v_item_count > v_unavailable and v_missing = 0
             and coalesce(array_length(v_currencies, 1), 0) = 1,
    'subtotal', v_display_subtotal,
    'discount_percent', case when v_is_franchise then 0 else v_percent end,
    'discount_total', case when v_is_franchise then 0 else v_discount end,
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
  v_franchise_subtotal numeric(20,2) := 0;
  v_cart_count integer := 0;
  v_product_count integer := 0;
  v_priced_count integer := 0;
  v_pricing jsonb;
  v_franchise jsonb;
  v_is_franchise boolean := false;
  v_percent numeric := 0;
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

  v_franchise := public.marketplace_franchise_pricing_for(auth.uid());
  v_is_franchise := v_franchise->>'kind' = 'franchise';
  if v_is_franchise then
    if (v_franchise->>'eligible')::boolean is not true then
      raise exception 'franchise pricing is unavailable for this account';
    end if;
    v_pricing := v_franchise;
    v_percent := coalesce((v_pricing->>'percent')::numeric, 0);
    select coalesce(sum(round(pp.amount * (100 - v_percent) / 100, 2) * ci.quantity), 0)
      into v_franchise_subtotal
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
       and (p.unpublish_at is null or p.unpublish_at > now());
    v_discount := v_subtotal - v_franchise_subtotal;
  else
    v_pricing := public.reseller_pricing_for(auth.uid());
    v_percent := coalesce((v_pricing->>'percent')::numeric, 0);
    v_discount := public.reseller_discount_amount(v_subtotal, v_percent);
  end if;

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
       v_item.name, v_item.quantity,
       case when v_is_franchise then round(v_item.amount * (100 - v_percent) / 100, 2)
            else v_item.amount end,
       case when v_is_franchise then round(v_item.amount * (100 - v_percent) / 100, 2) * v_item.quantity
            else v_item.amount * v_item.quantity end,
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

create or replace function public.marketplace_capture_purchase_lead(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_order record;
  v_email text;
  v_name text;
  v_phone text;
  v_product_id uuid;
  v_product_name text;
  v_product_slug text;
  v_lead_id uuid;
begin
  select o.id, o.buyer_id, o.status
    into v_order
    from public.marketplace_orders o
   where o.id = p_order_id;
  if not found or v_order.status::text <> 'paid' or v_order.buyer_id is null then
    raise exception 'a paid marketplace order with a buyer is required';
  end if;

  select coalesce(nullif(lower(btrim(u.email)), ''), nullif(lower(btrim(p.email)), '')),
         coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(p.username), '')),
         coalesce(p.phone, '')
    into v_email, v_name, v_phone
    from auth.users u
    left join public.profiles p on p.id = u.id
   where u.id = v_order.buyer_id;

  if v_email is null then
    return jsonb_build_object('ok', true, 'created', false, 'reason', 'buyer_email_missing');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_email, 0));

  select l.id
    into v_lead_id
    from public.leads l
   where lower(btrim(l.email)) = v_email
   order by l.created_at
   limit 1;
  if v_lead_id is not null then
    return jsonb_build_object('ok', true, 'created', false, 'reason', 'lead_exists', 'lead_id', v_lead_id);
  end if;

  select oi.product_id, p.name, p.slug
    into v_product_id, v_product_name, v_product_slug
    from public.marketplace_order_items oi
    left join public.marketplace_products p on p.id = oi.product_id
   where oi.order_id = p_order_id
   order by oi.created_at, oi.id
   limit 1;

  v_name := coalesce(nullif(v_name, ''), split_part(v_email, '@', 1));
  insert into public.leads (
    name, email, phone, source, sub_source, category, status,
    product_id, cta_action, source_page, requirements
  )
  values (
    v_name, v_email, coalesce(v_phone, ''), 'marketplace', 'marketplace_purchase',
    'marketplace_buyer', 'new',
    v_product_id, 'purchase',
    case when v_product_slug is not null then '/marketplace/product/' || v_product_slug else '/marketplace' end,
    'Completed marketplace purchase' ||
      case when v_product_name is not null then ': ' || v_product_name else '' end
  )
  returning id into v_lead_id;

  return jsonb_build_object(
    'ok', true,
    'created', true,
    'lead_id', v_lead_id,
    'name', v_name,
    'email', v_email,
    'phone', coalesce(v_phone, ''),
    'product_id', v_product_id,
    'source_page', case when v_product_slug is not null then '/marketplace/product/' || v_product_slug else '/marketplace' end,
    'cta_action', 'purchase'
  );
end
$function$;

revoke all on function public.marketplace_capture_purchase_lead(uuid)
  from public, anon, authenticated;
grant execute on function public.marketplace_capture_purchase_lead(uuid)
  to service_role;

insert into public.xp_rules
  (name, description, source_id, xp_value, multiplier, conditions, cooldown_seconds, max_per_day, status)
select
  'Marketplace buyer order paid',
  'Buyer completed a marketplace purchase.',
  s.id,
  200,
  1.0,
  jsonb_build_object('role', 'user'),
  0,
  50,
  'active'::public.entity_status
from public.xp_sources s
where s.slug = 'order.paid'
  and not exists (
    select 1
      from public.xp_rules r
     where r.source_id = s.id
       and r.status = 'active'::public.entity_status
       and r.conditions->>'role' = 'user'
  );
