-- The investigation, where the operator reviews.
--
-- mm_demo_ops listed the rows waiting for a product but not what reading their
-- pages found, so an operator had the queue and none of the evidence. This adds
-- it, and the counts the operations centre needs to show progress through
-- twelve thousand addresses.
create or replace function public.mm_demo_ops(p_days integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with window_start as (
    select now() - make_interval(days => greatest(least(coalesce(p_days, 30), 365), 1)) as since
  ),
  checks as (
    select h.demo_url_id, count(*) as checks,
           count(*) filter (where h.status = 'active') as up,
           avg(h.response_time) as avg_ms
      from public.demo_health h, window_start w
     where h.checked_at >= w.since group by h.demo_url_id
  ),
  visits as (
    select c.demo_url_id, count(*) as clicks
      from public.demo_clicks c, window_start w
     where c.clicked_at >= w.since group by c.demo_url_id
  ),
  rows_out as (
    select d.id, coalesce(d.demo_name, 'Demo') as title, d.url, d.status,
           d.processing_status, d.product_id, p.name as product_name, p.slug as product_slug,
           d.last_http_status as http_status, d.last_response_ms as response_time_ms,
           d.last_checked_at, d.detected_category_id, p.category_id as product_category_id,
           case when coalesce(c.checks, 0) > 0
                then round((c.up::numeric * 100) / c.checks, 2) else null end as uptime_percentage,
           coalesce(c.checks, 0) as checks,
           case when c.avg_ms is null then null else round(c.avg_ms::numeric) end as avg_response_ms,
           coalesce(v.clicks, 0) as clicks,
           d.processing->'assignment'->>'state' as assignment_state,
           d.processing->'assignment'->>'reason' as assignment_reason,
           d.processing->'assignment'->'candidates' as assignment_candidates,
           d.processing->'assignment'->>'batch_id' as batch_id,
           d.processing->'investigation' as investigation,
           d.created_at, d.updated_at
      from public.product_demo_urls d
      left join public.marketplace_products p on p.id = d.product_id
      left join checks c on c.demo_url_id = d.id
      left join visits v on v.demo_url_id = d.id
  )
  select jsonb_build_object(
    'demos', coalesce((select jsonb_agg(to_jsonb(r) order by r.updated_at desc) from rows_out r), '[]'::jsonb),
    'buckets', jsonb_build_object(
      'total', (select count(*) from rows_out),
      'assigned', (select count(*) from rows_out where product_id is not null),
      'unassigned', (select count(*) from rows_out where product_id is null),
      'ambiguous', (select count(*) from rows_out where assignment_state = 'AMBIGUOUS'),
      'unmatched', (select count(*) from rows_out where assignment_state = 'UNMATCHED'),
      'live', (select count(*) from rows_out where status = 'active' and processing_status = 'live'),
      'inactive', (select count(*) from rows_out where status <> 'active'),
      'failed', (select count(*) from rows_out where processing_status = 'failed'),
      'awaiting_processing', (select count(*) from rows_out where processing_status = 'unprocessed'),
      'never_checked', (select count(*) from rows_out where checks = 0),
      -- Progress through the investigation, so twelve thousand can be watched.
      'investigated', (select count(*) from rows_out where investigation is not null),
      'investigation_pending', (
        select count(*) from rows_out where product_id is null and investigation is null),
      'fetch_failed', (
        select count(*) from rows_out where investigation->>'state' = 'FETCH_FAILED'),
      'investigation_errors', (
        select count(*) from rows_out where investigation->>'state' = 'ERROR'),
      'ai_suggestions', (
        select count(*) from rows_out where investigation->'ai_suggestion'->>'name' is not null),
      'ai_errors', (
        select count(*) from rows_out where investigation->>'ai_error' is not null)),
    'review', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', id, 'title', title, 'url', url,
               'state', coalesce(assignment_state, 'UNASSIGNED'),
               'reason', assignment_reason,
               'candidates', assignment_candidates,
               'batch_id', batch_id,
               -- What reading the page found, for the operator to judge.
               'investigation', investigation,
               'created_at', created_at)
             order by created_at desc)
        from rows_out where product_id is null), '[]'::jsonb),
    'category_mismatches', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'title', r.title, 'url', r.url,
               'product_name', r.product_name, 'product_slug', r.product_slug,
               'detected_category', dc.name, 'product_category', pc.name, 'status', r.status)
             order by r.title)
        from rows_out r
        left join public.marketplace_categories dc on dc.id = r.detected_category_id
        left join public.marketplace_categories pc on pc.id = r.product_category_id
       where r.detected_category_id is not null and r.product_category_id is not null
         and r.detected_category_id <> r.product_category_id), '[]'::jsonb),
    'window_days', greatest(least(coalesce(p_days, 30), 365), 1),
    'generated_at', now()
  );
$$;
