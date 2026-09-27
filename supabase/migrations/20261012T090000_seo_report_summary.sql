-- The SEO report's numbers, counted in the database.
--
-- `generateSeoReport` wrote a row into `seo_reports` whose summary read
-- { clicks: 0, impressions: 0, conversions: 0, average_position: null,
--   tracked_keywords: 0, improved_keywords: 0, open_issues: 0,
--   critical_issues: 0 } — eight constants, hardcoded, under a message that
-- said "SEO report generated from live records". None of them was read from
-- anything. Meanwhile seo_keyword_rankings holds 2,160 rows carrying real
-- clicks, impressions and positions, and seo_issues holds 3,054 rows with a
-- real status and severity.
--
-- The counting is done here rather than in the application because a report is
-- an aggregate: computing it from a fetched page of rows would be wrong the
-- moment the table outgrew that page, and every fetch is capped.
--
-- What genuinely has no source is still reported as having none. Conversions
-- are not attributed to SEO anywhere in this platform, so the summary says
-- that rather than printing a zero that reads like a measurement.

CREATE OR REPLACE FUNCTION public.seo_report_summary(
  p_period_start date,
  p_period_end   date
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT r.keyword_id, r.recorded_on, r.position, r.clicks, r.impressions
      FROM public.seo_keyword_rankings r
     WHERE r.recorded_on >= p_period_start
       AND r.recorded_on <= p_period_end
  ),
  -- First and last recorded position per keyword inside the period. A keyword
  -- seen only once has moved neither way and counts as neither.
  bounds AS (
    SELECT keyword_id,
           (array_agg(position ORDER BY recorded_on ASC))[1]  AS first_position,
           (array_agg(position ORDER BY recorded_on DESC))[1] AS last_position,
           count(*) AS samples
      FROM ranked
     WHERE position IS NOT NULL
     GROUP BY keyword_id
  )
  SELECT jsonb_build_object(
    -- Zero clicks in a period where nothing was recorded is not the same fact
    -- as zero clicks in a period that was measured, and a report that cannot
    -- tell them apart is worse than one that admits the gap. This is how many
    -- ranking rows the period actually has.
    'ranking_rows',      (SELECT count(*) FROM ranked),
    'clicks',            coalesce((SELECT sum(clicks)      FROM ranked), 0),
    'impressions',       coalesce((SELECT sum(impressions) FROM ranked), 0),
    'average_position',  (SELECT round(avg(position)::numeric, 2)
                            FROM ranked WHERE position IS NOT NULL),
    'tracked_keywords',  (SELECT count(*) FROM public.seo_keywords),
    'ranked_keywords',   (SELECT count(*) FROM bounds WHERE samples > 1),
    'improved_keywords', (SELECT count(*) FROM bounds
                           WHERE samples > 1 AND last_position < first_position),
    'declined_keywords', (SELECT count(*) FROM bounds
                           WHERE samples > 1 AND last_position > first_position),
    'open_issues',       (SELECT count(*) FROM public.seo_issues WHERE status = 'open'),
    'critical_issues',   (SELECT count(*) FROM public.seo_issues
                           WHERE status = 'open' AND severity = 'critical'),
    'high_issues',       (SELECT count(*) FROM public.seo_issues
                           WHERE status = 'open' AND severity = 'high'),
    'audited_pages',     (SELECT pages_crawled FROM public.seo_audits
                           ORDER BY created_at DESC LIMIT 1),
    'period_start',      p_period_start,
    'period_end',        p_period_end,
    -- Stated, not guessed.
    'unavailable', jsonb_build_object(
      'conversions', 'no conversion source is attributed to SEO on this platform'
    )
  );
$$;

REVOKE ALL ON FUNCTION public.seo_report_summary(date, date) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seo_report_summary(date, date) TO service_role;

COMMENT ON FUNCTION public.seo_report_summary(date, date) IS
  'The SEO report summary for a period, counted in SQL: clicks, impressions and average position from seo_keyword_rankings, keyword movement from first to last recorded position, and open issue counts by severity. Reports conversions as unavailable rather than as zero.';
