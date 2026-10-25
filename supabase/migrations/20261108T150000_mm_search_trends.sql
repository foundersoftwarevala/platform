-- Aggregate recent marketplace search events for the operator console.
CREATE INDEX IF NOT EXISTS marketplace_events_search_created_idx
  ON public.marketplace_events (created_at DESC)
  WHERE event_type = 'search';

CREATE OR REPLACE FUNCTION public.mm_search_trends(
  p_days integer DEFAULT 30,
  p_limit integer DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_searches jsonb;
BEGIN
  IF NOT public.mm_is_operator() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_permitted');
  END IF;

  IF p_days IS NULL OR p_days < 1 OR p_days > 90
     OR p_limit IS NULL OR p_limit < 1 OR p_limit > 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_query');
  END IF;

  WITH normalized AS (
    SELECT lower(regexp_replace(btrim(e.metadata ->> 'query'), '\s+', ' ', 'g')) AS query
      FROM public.marketplace_events e
     WHERE e.event_type = 'search'
       AND e.created_at >= now() - make_interval(days => p_days)
       AND nullif(btrim(e.metadata ->> 'query'), '') IS NOT NULL
  ),
  ranked AS (
    SELECT n.query, count(*)::bigint AS searches
      FROM normalized n
     GROUP BY n.query
     ORDER BY searches DESC, n.query
     LIMIT p_limit
  )
  SELECT coalesce(
           jsonb_agg(jsonb_build_object('query', r.query, 'searches', r.searches)
                     ORDER BY r.searches DESC, r.query),
           '[]'::jsonb
         )
    INTO v_searches
    FROM ranked r;

  RETURN jsonb_build_object(
    'ok', true,
    'window_days', p_days,
    'searches', v_searches
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mm_search_trends(integer, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mm_search_trends(integer, integer) TO authenticated;

COMMENT ON FUNCTION public.mm_search_trends(integer, integer) IS
  'Returns the five most frequent normalized marketplace search terms in a bounded recent window to authorized marketplace operators.';
