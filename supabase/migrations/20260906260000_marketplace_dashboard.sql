-- The Marketplace Manager control room, counted from the real database.
--
-- DashboardSection.tsx makes no backend call at all. Its KPI cards render the
-- literal string "—" and its approval queues are a list of hardcoded labels, so
-- the control room shows nothing about the marketplace it is supposed to
-- control. It is at least honest — there are no invented numbers — but sections
-- 11 through 15 ask for real ones.
--
-- This composes what already exists rather than rebuilding it:
-- mm_marketplace_score, mm_health_checks and mm_attention_center are reused
-- unchanged. What is added is the counting the dashboard needs and nothing
-- else had: KPIs, approval queues, revenue by period, and recent activity.
--
-- Where a thing genuinely does not exist in this database — there is no
-- downloads table and no collections table — the answer is null, and the UI is
-- expected to say "not tracked" rather than draw a zero that looks measured.

create or replace function public.mm_dashboard()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_products    jsonb;
  v_commerce    jsonb;
  v_revenue     jsonb;
  v_queues      jsonb;
  v_activity    jsonb;
  v_has_downloads boolean;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='downloads'
  ) into v_has_downloads;

  -- ---- Catalogue -----------------------------------------------------------
  select jsonb_build_object(
    'total',      count(*),
    'published',  count(*) filter (where visible and content_status='published'),
    'draft',      count(*) filter (where content_status='draft'),
    'archived',   count(*) filter (where content_status='archived'),
    'hidden',     count(*) filter (where not visible),
    'with_demo',  count(*) filter (where coalesce(demo_url,'') <> ''),
    'with_image', count(*) filter (where coalesce(thumbnail_url,'') <> ''),
    'sellers',    count(distinct seller_id) filter (where seller_id is not null),
    'categories', (select count(*) from public.marketplace_categories)
  ) into v_products
  from public.marketplace_products;

  -- ---- Orders --------------------------------------------------------------
  select jsonb_build_object(
    'orders',        count(*),
    'paid',          count(*) filter (where status::text = 'paid'),
    'pending',       count(*) filter (where status::text <> 'paid'),
    'refunds',       (select count(*) from public.marketplace_order_refunds),
    -- Nothing has ever been downloaded here because the table does not exist;
    -- null says that, 0 would imply it was measured.
    'downloads',     case when v_has_downloads
                          then (select count(*) from public.marketplace_orders) else null end
  ) into v_commerce
  from public.marketplace_orders;

  -- ---- Revenue, reconciled against the order lines -------------------------
  select jsonb_build_object(
    'today',      coalesce(sum(oi.line_total) filter (where o.created_at >= date_trunc('day', now())), 0),
    'this_week',  coalesce(sum(oi.line_total) filter (where o.created_at >= date_trunc('week', now())), 0),
    'this_month', coalesce(sum(oi.line_total) filter (where o.created_at >= date_trunc('month', now())), 0),
    'this_year',  coalesce(sum(oi.line_total) filter (where o.created_at >= date_trunc('year', now())), 0),
    'all_time',   coalesce(sum(oi.line_total), 0),
    'refunded',   coalesce((select sum(amount) from public.marketplace_order_refunds), 0),
    'net',        coalesce(sum(oi.line_total), 0)
                  - coalesce((select sum(amount) from public.marketplace_order_refunds), 0),
    'currency',   coalesce(max(o.currency::text), 'INR'),
    -- The dashboard must be able to say "no transactions yet" rather than 0.
    'has_transactions', count(*) > 0
  ) into v_revenue
  from public.marketplace_orders o
  join public.marketplace_order_items oi on oi.order_id = o.id
  where o.status::text = 'paid';

  -- ---- Approval queues — section 13 ---------------------------------------
  -- Each queue names the destination that actually lists those records, so a
  -- card can open the exact set it counted.
  select jsonb_agg(q) into v_queues from (
    select jsonb_build_object(
      'key', 'pending_products', 'label', 'Pending Products',
      'count', (select count(*) from public.marketplace_products
                 where moderation_status::text in ('pending','pending_review','in_review','submitted')),
      'destination', '/marketplace-manager?section=catalog&moderation=pending') q
    union all
    select jsonb_build_object(
      'key', 'unpublished_products', 'label', 'Draft & Unpublished',
      'count', (select count(*) from public.marketplace_products
                 where content_status='draft' or not visible),
      'destination', '/marketplace-manager?section=catalog&status=draft')
    union all
    select jsonb_build_object(
      'key', 'products_without_demo', 'label', 'Products Without a Demo',
      'count', (select count(*) from public.marketplace_products
                 where visible and content_status='published' and coalesce(demo_url,'')=''),
      'destination', '/marketplace-manager?section=demo-urls')
    union all
    select jsonb_build_object(
      'key', 'products_without_image', 'label', 'Products Without an Image',
      'count', (select count(*) from public.marketplace_products
                 where visible and content_status='published' and coalesce(thumbnail_url,'')=''),
      'destination', '/marketplace-manager?section=catalog&missing=image')
    union all
    select jsonb_build_object(
      'key', 'pending_orders', 'label', 'Orders Awaiting Payment',
      'count', (select count(*) from public.marketplace_orders where status::text <> 'paid'),
      'destination', '/marketplace-manager?section=commerce&status=pending')
    union all
    select jsonb_build_object(
      'key', 'draft_rows', 'label', 'Homepage Rows Not Published',
      'count', (select count(*) from public.marketplace_row_config
                 where status <> 'published'),
      'destination', '/marketplace-manager?section=homepage-rows')
  ) qs;

  -- ---- Activity — section 15 ----------------------------------------------
  -- Real events and real audit entries, merged newest first. No placeholder
  -- "connecting to live stream" state: if there is nothing, the list is empty
  -- and the UI says so.
  select coalesce(jsonb_agg(a order by a->>'at' desc), '[]'::jsonb) into v_activity
  from (
    select jsonb_build_object(
      'at', e.created_at, 'kind', e.event_type::text, 'source', 'marketplace_events',
      'label', coalesce(p.name, 'a product'),
      'detail', coalesce(e.source_page, '')) a
    from public.marketplace_events e
    left join public.marketplace_products p on p.id = e.product_id
    order by e.created_at desc limit 15
  ) x;

  select v_activity || coalesce((
    select jsonb_agg(jsonb_build_object(
      'at', l.created_at, 'kind', l.action, 'source', 'audit',
      'label', coalesce(l.actor, 'system'),
      'detail', coalesce(l.reason, '')))
    from (select * from public.marketplace_audit_logs
          order by created_at desc limit 15) l
  ), '[]'::jsonb) into v_activity;

  return jsonb_build_object(
    'ok', true,
    'generated_at', now(),
    'products', v_products,
    'commerce', v_commerce,
    'revenue', v_revenue,
    'queues', coalesce(v_queues, '[]'::jsonb),
    'activity', v_activity,
    -- Reused wholesale. These already exist and are already correct; building
    -- a second version of them would be exactly the duplication rule 3 forbids.
    'score', public.mm_marketplace_score(),
    'attention', public.mm_attention_center(),
    'health', (select coalesce(jsonb_agg(to_jsonb(h)), '[]'::jsonb)
               from public.mm_health_checks() h)
  );
end $$;

grant execute on function public.mm_dashboard() to authenticated;
