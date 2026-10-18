-- The SEO audit and the monthly report, counted by the database.
--
-- Both were worked out in JavaScript from fetched lists:
--
--   coverage  = pageRows.filter(p => Boolean(p[field])).length / pageRows.length
--   onPage    = pageRows.reduce((s, p) => s + p.seo_score, 0) / pageRows.length
--   clicks    = rows.reduce((s, r) => s + r.clicks, 0)
--
-- Every one of those is a percentage or a total of whatever happened to
-- arrive. PostgREST on this server caps a result at 10,000 rows and reports no
-- truncation, so past that the audit would measure the coverage of the first
-- ten thousand pages and present it as the coverage of the site, and the
-- monthly report would total the first ten thousand days of metrics and call
-- it the month. Both would be wrong, and neither would look wrong.
--
-- seo_pages holds 1,908 rows today, which is why this has been right so far.
-- That is not a reason to leave it: the number only goes up, and the failure
-- when it crosses is silent.
--
-- Nothing about what is measured changes. Each expression below is the same
-- arithmetic the TypeScript did, moved to where the whole table is in scope.

-- ------------------------------------------------------------------ audit
CREATE OR REPLACE FUNCTION public.mm_seo_audit_snapshot()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH pages AS (
    SELECT
      count(*)                                                            AS total,
      -- round(100 * present / total), with the same guard the JavaScript
      -- had: no pages means zero rather than a division by zero.
      coalesce(round(100.0 * count(*) FILTER (WHERE meta_title IS NOT NULL
                     AND btrim(meta_title) <> '') / nullif(count(*), 0)), 0) AS meta_title,
      coalesce(round(100.0 * count(*) FILTER (WHERE meta_description IS NOT NULL
                     AND btrim(meta_description) <> '') / nullif(count(*), 0)), 0) AS meta_description,
      coalesce(round(100.0 * count(*) FILTER (WHERE h1 IS NOT NULL
                     AND btrim(h1) <> '') / nullif(count(*), 0)), 0)      AS h1,
      coalesce(round(100.0 * count(*) FILTER (WHERE canonical_url IS NOT NULL
                     AND btrim(canonical_url) <> '') / nullif(count(*), 0)), 0) AS canonical_url,
      coalesce(round(100.0 * count(*) FILTER (WHERE index_status = 'indexed')
                     / nullif(count(*), 0)), 0)                           AS indexability,
      coalesce(round(avg(seo_score)), 0)                                  AS on_page
    FROM public.seo_pages
  ),
  issues AS (
    SELECT
      count(*) AS open_count,
      -- The same weights: critical 12, high 7, anything else 3.
      coalesce(sum(CASE severity WHEN 'critical' THEN 12
                                 WHEN 'high'     THEN 7
                                 ELSE 3 END), 0) AS weight
    FROM public.seo_issues
    WHERE status <> 'resolved'
  )
  SELECT jsonb_build_object(
    'pages',            pages.total,
    'issues',           issues.open_count,
    'on_page',          pages.on_page,
    'meta_title',       pages.meta_title,
    'meta_description', pages.meta_description,
    'h1',               pages.h1,
    'canonical_url',    pages.canonical_url,
    'indexability',     pages.indexability,
    'technical',        greatest(0, 100 - issues.weight)
  )
  FROM pages, issues;
$function$;

GRANT EXECUTE ON FUNCTION public.mm_seo_audit_snapshot() TO service_role;

COMMENT ON FUNCTION public.mm_seo_audit_snapshot() IS
  'The SEO audit''s page coverage, average on-page score, indexability and technical weight, counted across every row rather than across the first ten thousand that a REST read returns.';

-- ----------------------------------------------------------------- report
CREATE OR REPLACE FUNCTION public.mm_seo_report_summary(
  p_start date,
  p_end   date
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH metrics AS (
    SELECT
      coalesce(sum(clicks), 0)      AS clicks,
      coalesce(sum(impressions), 0) AS impressions,
      coalesce(sum(conversions), 0) AS conversions,
      -- Null rather than zero when there is nothing in the window: an average
      -- position of zero would read as the best possible rank.
      round(avg(avg_position)::numeric, 2) AS average_position
    FROM public.seo_performance_metrics
    WHERE recorded_on >= p_start AND recorded_on <= p_end
  ),
  keywords AS (
    SELECT
      count(*) FILTER (WHERE status = 'tracking') AS tracked,
      count(*) FILTER (
        WHERE position IS NOT NULL
          AND previous_position IS NOT NULL
          AND position < previous_position
      ) AS improved
    FROM public.seo_keywords
  ),
  issues AS (
    SELECT
      count(*) FILTER (WHERE status <> 'resolved') AS open_count,
      count(*) FILTER (
        WHERE status <> 'resolved' AND severity IN ('critical', 'high')
      ) AS critical
    FROM public.seo_issues
  )
  SELECT jsonb_build_object(
    'clicks',            metrics.clicks,
    'impressions',       metrics.impressions,
    'conversions',       metrics.conversions,
    'average_position',  metrics.average_position,
    'tracked_keywords',  keywords.tracked,
    'improved_keywords', keywords.improved,
    'open_issues',       issues.open_count,
    'critical_issues',   issues.critical
  )
  FROM metrics, keywords, issues;
$function$;

GRANT EXECUTE ON FUNCTION public.mm_seo_report_summary(date, date) TO service_role;

COMMENT ON FUNCTION public.mm_seo_report_summary(date, date) IS
  'The monthly SEO report''s totals for a date range - clicks, impressions, conversions, average position, tracked and improved keywords, open and critical issues - summed in SQL rather than over a fetched page of rows.';
