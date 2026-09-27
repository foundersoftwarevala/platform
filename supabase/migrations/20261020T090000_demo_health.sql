-- The health of the demos that exist, measured from the checks that happened.
--
-- The Demo Manager's status grid renders twelve demos: "E-Commerce Pro" at
-- 99.99% uptime with 234 visitors and a 1.1s load, "Hospital Management",
-- "Banking Portal" at 523 visitors, and nine more. None of them is in the
-- catalogue. None of those uptimes, visitor counts, load times or "2 min ago"
-- checks was ever measured. The same array is filtered by the category and
-- status dropdowns above it, so the filters work perfectly on invented rows.
--
-- What the platform actually knows is better than that, and it is sitting in
-- two tables already:
--
--   demo_url_audit_log   5,723 monitor entries between 2026-09-07 and
--                        2026-09-25, each carrying the result, the HTTP
--                        status, the response time in milliseconds, whether
--                        SSL was valid and how many days were left on it.
--                        That is a real uptime history, one check at a time.
--
--   demo_clicks          real visits, tied to a demo and a source page.
--
-- So uptime is a count of working checks over total checks, the load time is
-- the mean of the response times actually recorded, and the visitor number is
-- a count of rows. Where a figure has no source it is returned as null rather
-- than filled in, and the screen says so.
--
-- The counting is in SQL because it is aggregation: 5,723 rows today over one
-- demo, and the monitor adds a row every half hour per demo. Working it out
-- from a fetched page of checks would be wrong the moment a second demo came
-- back.
--
-- One thing the numbers show that is worth stating: nine of the ten demons the
-- monitor knows about were deleted on 2026-09-12 and only "Lovable App"
-- survives. Their history stays in the log — it is an audit trail — but they
-- are not demos any more, so this only reports on rows that still exist.

CREATE OR REPLACE FUNCTION public.mm_demo_health(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH window_start AS (
    SELECT now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365))) AS since
  ),
  checks AS (
    SELECT
      l.demo_url_id,
      count(*)::int AS checks,
      count(*) FILTER (WHERE l.metadata->>'result' = 'working')::int AS working,
      round(avg(nullif((l.metadata->>'response_ms')::numeric, 0)))::int AS avg_response_ms,
      max(l.created_at) AS last_check,
      (array_agg(l.metadata->>'result' ORDER BY l.created_at DESC))[1] AS latest_result,
      (array_agg((l.metadata->>'ssl_days_left')::int ORDER BY l.created_at DESC))[1] AS ssl_days_left
    FROM public.demo_url_audit_log l, window_start w
    WHERE l.action = 'demo_url.monitor'
      AND l.created_at >= w.since
    GROUP BY l.demo_url_id
  ),
  visits AS (
    SELECT c.demo_url_id, count(*)::int AS clicks
      FROM public.demo_clicks c, window_start w
     WHERE c.clicked_at >= w.since
     GROUP BY c.demo_url_id
  )
  SELECT coalesce(jsonb_agg(row ORDER BY row->>'demo_name'), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'id', d.id,
      'demo_name', d.demo_name,
      'url', d.url,
      'status', d.status,
      'environment', d.environment,
      'product_id', d.product_id,
      'product_name', p.name,
      -- Measured, not assumed. Null when the monitor has not run in the
      -- window, which is a different fact from a hundred per cent.
      'checks', c.checks,
      'uptime_percent', CASE WHEN coalesce(c.checks, 0) > 0
                             THEN round((c.working::numeric / c.checks) * 100, 2)
                             ELSE NULL END,
      'avg_response_ms', c.avg_response_ms,
      'latest_result', coalesce(c.latest_result, d.last_result),
      'last_checked_at', coalesce(c.last_check, d.last_checked_at),
      'last_http_status', d.last_http_status,
      'ssl_valid', d.ssl_valid,
      'ssl_days_left', c.ssl_days_left,
      'clicks', coalesce(v.clicks, 0),
      -- Stated, not guessed: nothing records these against a demo.
      'unavailable', jsonb_build_object(
        'region', 'no region is recorded against a demo',
        'platforms', 'no device coverage is recorded against a demo',
        'stack', 'the technology behind a demo is not stored')
    ) AS row
    FROM public.product_demo_urls d
    LEFT JOIN checks c ON c.demo_url_id = d.id
    LEFT JOIN visits v ON v.demo_url_id = d.id
    LEFT JOIN public.marketplace_products p ON p.id = d.product_id
  ) s;
$function$;

-- Granted the way the rest of the mm_ family is: wide, because PostgREST only
-- caches what the authenticator can see, with the real check inside.
GRANT EXECUTE ON FUNCTION public.mm_demo_health(integer) TO PUBLIC;

COMMENT ON FUNCTION public.mm_demo_health(integer) IS
  'Health of every demo that still exists, over the last p_days: uptime counted from demo_url_audit_log monitor entries, mean response time from the same, visits counted from demo_clicks. Returns null rather than a number for a demo the monitor has not checked in the window, and names the figures nothing records.';
