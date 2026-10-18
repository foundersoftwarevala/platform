-- Real series for the two Demo Manager screens that were drawing invented ones.
--
-- DemoUptimeMonitor plotted a hardcoded array - 99.99, 99.98, 99.99 at four-hour
-- intervals - and DemoAnalytics plotted "E-Commerce Pro" with 5,678 visitors and
-- a 24.5% conversion, none of which is a product this platform sells. Both are
-- operator screens, so somebody could have made a decision on a number that was
-- typed into a source file.
--
-- The data to draw them properly is already being collected:
--
--   demo_health           1,538 monitor checks, each with a status, a response
--                         time and a checked_at - written by the monitor cron
--                         against product_demo_urls
--   demo_clicks           a row per demo opened, with device, browser, country
--   product_demo_urls     the seventeen demos themselves
--
-- Both functions bucket and aggregate in SQL, which is the only way these can
-- stay right: the browser cannot count 1,538 rows it was never sent, and it
-- certainly cannot count them once there are a million.
--
-- Where a window holds no checks at all, the bucket returns null rather than
-- 100 - "we did not look" and "nothing was wrong" are different statements and a
-- monitor that cannot tell them apart is worse than none.

-- ------------------------------------------------------------ uptime over time
create or replace function public.mm_demo_uptime_series(p_hours integer default 24)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with bounds as (
    select now() - make_interval(hours => greatest(least(coalesce(p_hours, 24), 720), 1)) as since,
           -- Four-hourly for a day, wider as the window grows, so the chart
           -- never has to draw seven hundred points.
           case when coalesce(p_hours, 24) <= 24 then interval '4 hours'
                when coalesce(p_hours, 24) <= 168 then interval '12 hours'
                else interval '1 day' end as step
  ),
  buckets as (
    select generate_series(
             date_trunc('hour', b.since),
             date_trunc('hour', now()),
             b.step) as bucket_start,
           b.step
      from bounds b
  ),
  measured as (
    select bk.bucket_start,
           count(h.id) as checks,
           -- demo_status is an enum of active, inactive, maintenance and down. The
           -- monitor writes active when the demo answered and down when it did
           -- not, so active is what counts as up; maintenance is deliberately
           -- not counted as up, because it is not serving anyone.
           count(h.id) filter (where h.status = 'active') as up,
           avg(h.response_time) as avg_ms,
           percentile_cont(0.95) within group (order by h.response_time) as p95_ms
      from buckets bk
      left join public.demo_health h
             on h.checked_at >= bk.bucket_start
            and h.checked_at <  bk.bucket_start + bk.step
     group by bk.bucket_start
  )
  select jsonb_build_object(
    'uptime', coalesce((
      select jsonb_agg(jsonb_build_object(
               'time', to_char(bucket_start, 'HH24:MI'),
               -- Null, not 100, when nothing was checked in this window.
               'uptime', case when checks > 0
                              then round((up::numeric * 100) / checks, 2)
                              else null end,
               'checks', checks)
             order by bucket_start)
        from measured), '[]'::jsonb),
    'response', coalesce((
      select jsonb_agg(jsonb_build_object(
               'time', to_char(bucket_start, 'HH24:MI'),
               -- Seconds, which is what the chart's axis is labelled in.
               'avg', case when avg_ms is null then null else round(avg_ms::numeric / 1000, 2) end,
               'p95', case when p95_ms is null then null else round(p95_ms::numeric / 1000, 2) end)
             order by bucket_start)
        from measured), '[]'::jsonb),
    'totals', (
      select jsonb_build_object(
               'checks', coalesce(sum(checks), 0),
               'uptime_percent', case when coalesce(sum(checks), 0) > 0
                                      then round((sum(up)::numeric * 100) / sum(checks), 2)
                                      else null end,
               'avg_response_ms', case when count(avg_ms) = 0 then null
                                       else round(avg(avg_ms)::numeric) end)
        from measured),
    'window_hours', greatest(least(coalesce(p_hours, 24), 720), 1)
  );
$$;

revoke all on function public.mm_demo_uptime_series(integer) from public;
grant execute on function public.mm_demo_uptime_series(integer) to authenticated, service_role;

comment on function public.mm_demo_uptime_series(integer) is
  'Uptime and response time bucketed over a window, from demo_health. A bucket with no checks returns null rather than 100, because "not looked at" is not "nothing wrong".';

-- -------------------------------------------------------- who opened the demos
create or replace function public.mm_demo_click_analytics(p_days integer default 7)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with bounds as (
    select now() - make_interval(days => greatest(least(coalesce(p_days, 7), 365), 1)) as since
  ),
  clicks as (
    select c.* from public.demo_clicks c, bounds b where c.clicked_at >= b.since
  ),
  days as (
    select generate_series(
             date_trunc('day', (select since from bounds)),
             date_trunc('day', now()),
             interval '1 day') as day
  )
  select jsonb_build_object(
    -- The visitor chart. `conversions` is a real column on demo_clicks, so this
    -- is the count of opens that converted, not a guess at a rate.
    'visitors', coalesce((
      select jsonb_agg(jsonb_build_object(
               'date', to_char(d.day, 'Dy'),
               'visitors', (select count(*) from clicks c where date_trunc('day', c.clicked_at) = d.day),
               'conversions', (select count(*) from clicks c
                                where date_trunc('day', c.clicked_at) = d.day and c.converted))
             order by d.day)
        from days d), '[]'::jsonb),

    'regions', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'value', value) order by value desc)
        from (select coalesce(nullif(btrim(country), ''), 'Unknown') as name, count(*) as value
                from clicks group by 1 order by 2 desc limit 6) r), '[]'::jsonb),

    'devices', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'value', value) order by value desc)
        from (select initcap(coalesce(nullif(btrim(device_type), ''), 'unknown')) as name, count(*) as value
                from clicks group by 1 order by 2 desc) d), '[]'::jsonb),

    -- The demos people actually opened, named from product_demo_urls.
    'top_demos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'name', name, 'visitors', visitors,
               'conversion', conversion, 'bounce', null)
             order by visitors desc)
        from (
          select coalesce(d.demo_name, p.name, 'Demo') as name,
                 count(*) as visitors,
                 case when count(*) > 0
                      then round((count(*) filter (where c.converted)::numeric * 100) / count(*), 1)
                      else null end as conversion
            from clicks c
            left join public.product_demo_urls d on d.id = c.demo_url_id
            left join public.marketplace_products p on p.id = c.product_id
           group by 1 order by 2 desc limit 5) t), '[]'::jsonb),

    'totals', jsonb_build_object(
      'opens', (select count(*) from clicks),
      'converted', (select count(*) from clicks where converted),
      'avg_session_seconds', (select round(avg(session_duration)) from clicks where session_duration is not null)),
    -- Bounce rate has no source: nothing records a visitor leaving. Named so a
    -- screen can say so rather than draw a number for it.
    'unavailable', jsonb_build_object(
      'bounce', 'Nothing records a demo visit ending, so a bounce rate cannot be computed.'),
    'window_days', greatest(least(coalesce(p_days, 7), 365), 1)
  );
$$;

revoke all on function public.mm_demo_click_analytics(integer) from public;
grant execute on function public.mm_demo_click_analytics(integer) to authenticated, service_role;

comment on function public.mm_demo_click_analytics(integer) is
  'Demo opens by day, country, device and demo, from demo_clicks. Bounce rate is named as unavailable rather than invented.';
