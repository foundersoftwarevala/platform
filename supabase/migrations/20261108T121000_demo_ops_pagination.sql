-- Bound the Demo Operations API response while keeping estate-wide bucket
-- counts available to operators. The legacy unpaged RPC is no longer exposed
-- to browser-authenticated callers; the operator API uses the paginated RPC.

create or replace function public.mm_demo_ops_page(
  p_days integer default 30,
  p_page integer default 0,
  p_page_size integer default 50
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with args as (
    select greatest(least(coalesce(p_days, 30), 365), 1) as window_days,
           greatest(least(coalesce(p_page, 0), 1000000), 0) as page,
           greatest(least(coalesce(p_page_size, 50), 50), 1) as page_size
  ),
  window_start as (
    select now() - make_interval(days => a.window_days) as since
      from args a
  ),
  checks as (
    select h.demo_url_id,
           count(*) as checks,
           count(*) filter (where h.status = 'active') as up,
           avg(h.response_time) as avg_ms
      from public.demo_health h, window_start w
     where h.checked_at >= w.since
     group by h.demo_url_id
  ),
  visits as (
    select c.demo_url_id, count(*) as clicks
      from public.demo_clicks c, window_start w
     where c.clicked_at >= w.since
     group by c.demo_url_id
  ),
  rows_out as (
    select d.id,
           coalesce(d.demo_name, 'Demo') as title,
           d.url,
           d.status,
           d.processing_status,
           d.product_id,
           p.name as product_name,
           p.slug as product_slug,
           d.last_http_status as http_status,
           d.last_response_ms as response_time_ms,
           d.last_checked_at,
           d.detected_category_id,
           p.category_id as product_category_id,
           case when coalesce(c.checks, 0) > 0
                then round((c.up::numeric * 100) / c.checks, 2)
                else null end as uptime_percentage,
           coalesce(c.checks, 0) as checks,
           case when c.avg_ms is null then null else round(c.avg_ms::numeric) end as avg_response_ms,
           coalesce(v.clicks, 0) as clicks,
           d.processing->'assignment'->>'state' as assignment_state,
           d.processing->'assignment'->>'reason' as assignment_reason,
           d.processing->'assignment'->'candidates' as assignment_candidates,
           d.processing->'assignment'->>'batch_id' as batch_id,
           d.created_at,
           d.updated_at
      from public.product_demo_urls d
      left join public.marketplace_products p on p.id = d.product_id
      left join checks c on c.demo_url_id = d.id
      left join visits v on v.demo_url_id = d.id
  ),
  mismatches as (
    select r.id, r.title, r.url, r.product_name, r.product_slug,
           dc.name as detected_category, pc.name as product_category, r.status
      from rows_out r
      left join public.marketplace_categories dc on dc.id = r.detected_category_id
      left join public.marketplace_categories pc on pc.id = r.product_category_id
     where r.detected_category_id is not null
       and r.product_category_id is not null
       and r.detected_category_id <> r.product_category_id
  )
  select jsonb_build_object(
    'demos', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.updated_at desc, r.id desc)
        from (
          select row_out.*
            from rows_out row_out
           order by row_out.updated_at desc, row_out.id desc
           offset a.page * a.page_size
           limit a.page_size
        ) r
    ), '[]'::jsonb),
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
      'never_checked', (select count(*) from rows_out where checks = 0)
    ),
    'review', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'title', r.title, 'url', r.url,
               'state', coalesce(r.assignment_state, 'UNASSIGNED'),
               'reason', r.assignment_reason,
               'candidates', r.assignment_candidates,
               'batch_id', r.batch_id,
               'created_at', r.created_at)
             order by r.created_at desc, r.id desc)
        from (
          select row_out.*
            from rows_out row_out
           where row_out.product_id is null
           order by row_out.created_at desc, row_out.id desc
           offset a.page * a.page_size
           limit a.page_size
        ) r
    ), '[]'::jsonb),
    'category_mismatches', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.title, m.id)
        from (
          select mismatch.*
            from mismatches mismatch
           order by mismatch.title, mismatch.id
           offset a.page * a.page_size
           limit a.page_size
        ) m
    ), '[]'::jsonb),
    'page', a.page,
    'page_size', a.page_size,
    'review_total', (select count(*) from rows_out where product_id is null),
    'category_mismatches_total', (select count(*) from mismatches),
    'has_more', jsonb_build_object(
      'demos', (select count(*) from rows_out) > (a.page + 1) * a.page_size,
      'review', (select count(*) from rows_out where product_id is null) > (a.page + 1) * a.page_size,
      'category_mismatches', (select count(*) from mismatches) > (a.page + 1) * a.page_size
    ),
    'window_days', a.window_days,
    'generated_at', now()
  )
    from args a;
$$;

revoke all on function public.mm_demo_ops_page(integer, integer, integer) from public;
revoke all on function public.mm_demo_ops_page(integer, integer, integer) from anon, authenticated;
grant execute on function public.mm_demo_ops_page(integer, integer, integer) to service_role;

revoke all on function public.mm_demo_ops(integer) from public, anon, authenticated;
grant execute on function public.mm_demo_ops(integer) to service_role;

comment on function public.mm_demo_ops_page(integer, integer, integer) is
  'Paginated Demo Operations overview: each row collection is limited to at most 50 items, with full summary counts and per-collection has_more metadata. Only the authenticated operator API service role may execute it.';
