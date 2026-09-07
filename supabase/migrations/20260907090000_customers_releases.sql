-- Customer Management, over the customers this project already has.
--
-- No marketplace_customers table is created. auth.users and public.profiles
-- already are the customer record - 84 accounts, 84 profiles - and inventing a
-- third would be the duplication this must not become.
--
-- What genuinely links, checked rather than assumed:
--
--   orders        marketplace_orders.buyer_id -> auth.users   20 of 20 match
--   licences      marketplace_licenses.buyer_id               10
--   entitlements  marketplace_entitlements.buyer_id           10
--   spend         order totals on paid orders
--
-- What does not link, and is reported as such rather than joined on a guess:
--
--   tickets       support_tickets.customer_id is a uuid, 11 rows carry one,
--                 and NONE of them matches an auth.users id. Those tickets
--                 belong to another customer system.
--   subscriptions finance_subscriptions has no user column at all - only
--                 customer_name - so it cannot be attributed to an account.
--   activity      activity_logs is empty, so there is no timeline to show.
--   wishlist      no wishlist table exists anywhere in this database.
--   reviews       marketplace_reviews holds no rows.
--
-- The screen shows those as unavailable with the reason. None of them is
-- filled with a plausible-looking number.

/* --------------------------------------------------------------- the list */

create or replace function public.mm_customers(p_query jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_search text := nullif(btrim(coalesce(p_query->>'search','')), '');
  v_filter text := coalesce(p_query->>'filter', 'all');
  v_limit  integer := least(greatest(coalesce((p_query->>'limit')::int, 25), 1), 100);
  v_offset integer := greatest(coalesce((p_query->>'offset')::int, 0), 0);
  v_rows   jsonb;
  v_total  integer;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  with base as (
    select u.id,
           u.email,
           p.full_name,
           p.phone,
           u.created_at as registered_at,
           u.last_sign_in_at,
           (select count(*) from public.marketplace_orders o where o.buyer_id = u.id) as orders,
           (select count(*) from public.marketplace_orders o
             where o.buyer_id = u.id and o.status::text = 'paid') as paid_orders,
           coalesce((select sum(o.total) from public.marketplace_orders o
                      where o.buyer_id = u.id and o.status::text = 'paid'), 0) as lifetime_value,
           (select count(*) from public.marketplace_licenses l where l.buyer_id = u.id) as licences,
           (select count(*) from public.marketplace_entitlements e where e.buyer_id = u.id) as entitlements,
           (select max(o.created_at) from public.marketplace_orders o where o.buyer_id = u.id) as last_order_at
      from auth.users u
      left join public.profiles p on p.id = u.id
  ),
  -- A customer is someone who has bought. Everyone else is a registered
  -- account, and the two are counted separately rather than blended.
  typed as (
    select b.*,
           case when b.paid_orders > 0 then 'customer' else 'registered' end as customer_type,
           -- VIP is earned, not stored: more than one paid order, or lifetime
           -- value above the standard single-product price. There is no VIP
           -- column in this database and inventing one would be a second
           -- source of truth.
           (b.paid_orders > 1 or b.lifetime_value > 249) as vip
      from base b
  ),
  filtered as (
    select * from typed t
     where (v_search is null
            or t.email ilike '%' || v_search || '%'
            or coalesce(t.full_name,'') ilike '%' || v_search || '%'
            or coalesce(t.phone,'') ilike '%' || v_search || '%'
            or t.id::text = v_search)
       and (v_filter = 'all'
            or (v_filter = 'customers'  and t.customer_type = 'customer')
            or (v_filter = 'registered' and t.customer_type = 'registered')
            or (v_filter = 'vip'        and t.vip))
  )
  select count(*) into v_total from filtered;

  with base as (
    select u.id, u.email, p.full_name, p.phone, u.created_at as registered_at,
           u.last_sign_in_at,
           (select count(*) from public.marketplace_orders o where o.buyer_id = u.id) as orders,
           (select count(*) from public.marketplace_orders o
             where o.buyer_id = u.id and o.status::text = 'paid') as paid_orders,
           coalesce((select sum(o.total) from public.marketplace_orders o
                      where o.buyer_id = u.id and o.status::text = 'paid'), 0) as lifetime_value,
           (select count(*) from public.marketplace_licenses l where l.buyer_id = u.id) as licences,
           (select count(*) from public.marketplace_entitlements e where e.buyer_id = u.id) as entitlements,
           (select max(o.created_at) from public.marketplace_orders o where o.buyer_id = u.id) as last_order_at
      from auth.users u
      left join public.profiles p on p.id = u.id
  ),
  typed as (
    select b.*, case when b.paid_orders > 0 then 'customer' else 'registered' end as customer_type,
           (b.paid_orders > 1 or b.lifetime_value > 249) as vip
      from base b
  ),
  filtered as (
    select * from typed t
     where (v_search is null
            or t.email ilike '%' || v_search || '%'
            or coalesce(t.full_name,'') ilike '%' || v_search || '%'
            or coalesce(t.phone,'') ilike '%' || v_search || '%'
            or t.id::text = v_search)
       and (v_filter = 'all'
            or (v_filter = 'customers'  and t.customer_type = 'customer')
            or (v_filter = 'registered' and t.customer_type = 'registered')
            or (v_filter = 'vip'        and t.vip))
  )
  select coalesce(jsonb_agg(to_jsonb(f) order by f.lifetime_value desc, f.registered_at desc), '[]'::jsonb)
    into v_rows
    from (select * from filtered order by lifetime_value desc, registered_at desc
           limit v_limit offset v_offset) f;

  return jsonb_build_object(
    'ok', true, 'total', v_total, 'limit', v_limit, 'offset', v_offset,
    'customers', v_rows);
end;
$$;

/* ------------------------------------------------------------ the overview */

create or replace function public.mm_customers_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  return jsonb_build_object(
    'ok', true,
    'accounts',        (select count(*) from auth.users),
    'customers',       (select count(distinct buyer_id) from public.marketplace_orders
                         where buyer_id is not null and status::text = 'paid'),
    'with_any_order',  (select count(distinct buyer_id) from public.marketplace_orders
                         where buyer_id is not null),
    'vip',             (select count(*) from (
                          select o.buyer_id,
                                 count(*) filter (where o.status::text='paid') pd,
                                 coalesce(sum(o.total) filter (where o.status::text='paid'),0) lv
                            from public.marketplace_orders o
                           where o.buyer_id is not null group by o.buyer_id) t
                         where t.pd > 1 or t.lv > 249),
    'orders',          (select count(*) from public.marketplace_orders),
    'paid_orders',     (select count(*) from public.marketplace_orders where status::text='paid'),
    'licences',        (select count(*) from public.marketplace_licenses),
    'entitlements',    (select count(*) from public.marketplace_entitlements),
    'lifetime_value',  (select coalesce(sum(total),0) from public.marketplace_orders
                         where status::text='paid'),
    'signed_in_30d',   (select count(*) from auth.users
                         where last_sign_in_at > now() - interval '30 days'),
    -- Everything below is unavailable, and says why instead of showing a zero
    -- that would read as "no tickets" rather than "not connected".
    'unavailable', jsonb_build_object(
      'support_tickets', 'support_tickets.customer_id matches no auth.users id — those 11 tickets belong to another customer system',
      'subscriptions',   'finance_subscriptions has no user column, only customer_name, so it cannot be attributed to an account',
      'activity',        'activity_logs is empty — there is no timeline data yet',
      'wishlist',        'no wishlist table exists in this database',
      'reviews',         'marketplace_reviews holds no rows',
      'downloads',       'marketplace_downloads holds no rows and no product files are stored'));
end;
$$;

/* ------------------------------------------------------------- one profile */

create or replace function public.mm_customer_profile(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_user record;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select u.id, u.email, u.created_at, u.last_sign_in_at, p.full_name, p.phone
    into v_user
    from auth.users u left join public.profiles p on p.id = u.id
   where u.id = p_user;

  if v_user.id is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_customer');
  end if;

  -- Reading a customer record is itself a sensitive act and is recorded.
  perform public.mm_audit('customer.viewed', 'marketplace_customer', p_user::text,
                          null, jsonb_build_object('email', v_user.email), null);

  return jsonb_build_object(
    'ok', true,
    'customer', jsonb_build_object(
      'id', v_user.id, 'email', v_user.email, 'full_name', v_user.full_name,
      'phone', v_user.phone, 'registered_at', v_user.created_at,
      'last_sign_in_at', v_user.last_sign_in_at),
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', o.id, 'order_number', o.order_number, 'status', o.status,
               'total', o.total, 'currency', o.currency, 'created_at', o.created_at)
             order by o.created_at desc)
        from public.marketplace_orders o where o.buyer_id = p_user), '[]'::jsonb),
    'licences', coalesce((
      select jsonb_agg(jsonb_build_object(
               'license_key', l.license_key, 'model', l.license_model,
               'status', l.status, 'product', pr.name, 'created_at', l.created_at)
             order by l.created_at desc)
        from public.marketplace_licenses l
        left join public.marketplace_products pr on pr.id = l.product_id
       where l.buyer_id = p_user), '[]'::jsonb),
    'entitlements', coalesce((
      select jsonb_agg(jsonb_build_object(
               'product', pr.name, 'status', e.status, 'starts_at', e.starts_at)
             order by e.created_at desc)
        from public.marketplace_entitlements e
        left join public.marketplace_products pr on pr.id = e.product_id
       where e.buyer_id = p_user), '[]'::jsonb),
    'lifetime_value', (select coalesce(sum(total),0) from public.marketplace_orders
                        where buyer_id = p_user and status::text='paid'));
end;
$$;

/* ------------------------------------------------------- release overview */

-- Counted from marketplace_product_versions, which is the table this schema
-- already has for versions. It holds no rows, so every figure is zero and the
-- screen says so instead of showing 482 releases.
create or replace function public.mm_release_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  return jsonb_build_object(
    'ok', true,
    'total',       (select count(*) from public.marketplace_product_versions),
    'published',   (select count(*) from public.marketplace_product_versions
                     where published_at is not null),
    'draft',       (select count(*) from public.marketplace_product_versions
                     where published_at is null),
    'by_status', coalesce((
      select jsonb_agg(jsonb_build_object('status', status, 'count', n) order by n desc)
        from (select coalesce(status,'(none)') status, count(*) n
                from public.marketplace_product_versions group by 1) t), '[]'::jsonb),
    'products_with_versions', (select count(distinct product_id)
                                from public.marketplace_product_versions),
    'downloads',   (select count(*) from public.marketplace_downloads),
    'unavailable', jsonb_build_object(
      'channels',     'no release channel table exists (stable/beta/deprecated)',
      'branches',     'no branch table exists',
      'changelogs',   'no changelog table — marketplace_product_versions.release_notes is the only field',
      'roadmap',      'no roadmap table exists',
      'deprecations', 'no deprecation table exists',
      'files',        'no product file storage: no bucket, and download_path holds no rows'));
end;
$$;
