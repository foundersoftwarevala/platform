-- Whether an engine can run is a question about the data, not a note in a column.
--
-- marketplace_recommendation_configs carries a blocked_reason string, and
-- mm_recommendation_engines reported can_run as simply "blocked_reason is
-- null". That judgement was written once, when the platform could not answer
-- who did what, and never looked again. It has been wrong for a while:
--
--   "marketplace_events carries no user_id, so there is no profile"
--       marketplace_events has user_id, session_id, surface and dedupe_key.
--       25 of 71 events carry a user, 36 carry a session, across 2 users and
--       15 sessions.
--
--   "No session continuity is recorded on marketplace_events"
--       2 sessions and 1 user have viewed two or more distinct products.
--
--   "Favourites are localStorage only"
--       Half true, and the half that is wrong matters: marketplace_saved_products
--       exists with the right shape and 2 rows. What is missing is that nothing
--       in src/ writes to it — the storefront still keeps favourites in the
--       browser. So this engine stays blocked, but for the accurate reason.
--
-- A stale "cannot run" is worse than no flag at all: it turns a fixable gap
-- into a permanent-looking one, and nobody re-checks a thing the system has
-- already declared impossible.
--
-- So readiness is now measured. The stored blocked_reason is kept and still
-- honoured — an operator may still block an engine by hand — but it no longer
-- decides on its own, and the measurement says how far off a blocked engine is
-- rather than only that it is blocked.

CREATE OR REPLACE FUNCTION public.mm_recommendation_readiness(p_key text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_attributable   bigint;   -- views that can be tied to somebody
  v_sessions       bigint;   -- sessions that viewed 2+ distinct products
  v_users          bigint;   -- users that viewed 2+ distinct products
  v_saved          bigint;   -- rows in the real saved-products store
  v_saved_written  boolean;  -- whether anything actually writes to it
  v_products       bigint;   -- eligible catalogue
  v_events         bigint;
BEGIN
  SELECT count(*) FILTER (WHERE event_type = 'product_view'
                            AND (user_id IS NOT NULL OR session_id IS NOT NULL)),
         count(*)
    INTO v_attributable, v_events
    FROM public.marketplace_events;

  SELECT count(*) INTO v_sessions FROM (
    SELECT session_id FROM public.marketplace_events
     WHERE session_id IS NOT NULL AND product_id IS NOT NULL
     GROUP BY session_id HAVING count(DISTINCT product_id) >= 2) s;

  SELECT count(*) INTO v_users FROM (
    SELECT user_id FROM public.marketplace_events
     WHERE user_id IS NOT NULL AND product_id IS NOT NULL
     GROUP BY user_id HAVING count(DISTINCT product_id) >= 2) u;

  SELECT count(*) INTO v_saved FROM public.marketplace_saved_products;

  -- The storefront keeps favourites in localStorage; nothing in the app writes
  -- to marketplace_saved_products. Rows reaching it by other means do not make
  -- the signal available to a visitor's session, so this stays false until the
  -- storefront writes there. It is stated as a fact about the code, not
  -- inferred from the row count.
  v_saved_written := false;

  SELECT count(*) INTO v_products
    FROM public.marketplace_products
   WHERE visible AND content_status = 'published';

  RETURN CASE p_key
    WHEN 'popular-now' THEN jsonb_build_object(
      'ready', v_events > 0 AND v_products > 0,
      'needs', 'events and a published catalogue',
      'have', format('%s event(s), %s published product(s)', v_events, v_products))

    WHEN 'similar-products' THEN jsonb_build_object(
      'ready', v_products > 1,
      'needs', 'two or more published products to compare',
      'have', format('%s published product(s)', v_products))

    WHEN 'recently-viewed' THEN jsonb_build_object(
      'ready', v_attributable > 0,
      'needs', 'product views carrying a user or a session',
      'have', format('%s attributable view(s)', v_attributable))

    WHEN 'recommended-for-you' THEN jsonb_build_object(
      'ready', v_users > 0,
      'needs', 'a user who has viewed more than one product',
      'have', format('%s user(s) with two or more products viewed', v_users))

    WHEN 'continue-browsing' THEN jsonb_build_object(
      'ready', v_sessions > 0,
      'needs', 'a session that viewed more than one product',
      'have', format('%s session(s) with two or more products viewed', v_sessions))

    WHEN 'save-for-later' THEN jsonb_build_object(
      'ready', v_saved_written,
      'needs', 'the storefront to save favourites to marketplace_saved_products',
      'have', format('the table exists with %s row(s), but nothing in the app writes to it — favourites are still localStorage', v_saved))

    ELSE jsonb_build_object('ready', false, 'needs', 'an engine this function knows', 'have', 'nothing')
  END;
END
$$;

REVOKE ALL ON FUNCTION public.mm_recommendation_readiness(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mm_recommendation_readiness(text) TO service_role;

-- The registry, now reporting a measurement beside the stored note.
--
-- can_run needs both: the data has to support the engine, and no operator may
-- have blocked it by hand. Keeping the stored reason honoured means a manual
-- block still works; measuring beside it means a stale note can no longer
-- claim something is impossible when it is not.
CREATE OR REPLACE FUNCTION public.mm_recommendation_engines()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'key', c.key, 'title', c.title, 'description', c.description,
    'enabled', c.enabled, 'strategy', c.strategy, 'max_results', c.max_results,
    'weights', c.weights, 'recency_days', c.recency_days,
    'min_confidence', c.min_confidence, 'exclude_purchased', c.exclude_purchased,
    'diversity_per_category', c.diversity_per_category,
    -- What was written down, kept.
    'blocked_reason', c.blocked_reason,
    -- What is true now, measured.
    'readiness', public.mm_recommendation_readiness(c.key),
    'data_ready', (public.mm_recommendation_readiness(c.key)->>'ready')::boolean,
    'needs', public.mm_recommendation_readiness(c.key)->>'needs',
    'have', public.mm_recommendation_readiness(c.key)->>'have',
    -- An engine runs when the data supports it and nobody has blocked it.
    'can_run', (public.mm_recommendation_readiness(c.key)->>'ready')::boolean
               AND c.blocked_reason IS NULL,
    -- Worth surfacing loudly: the note says one thing, the data another.
    'note_is_stale', (c.blocked_reason IS NOT NULL
                      AND (public.mm_recommendation_readiness(c.key)->>'ready')::boolean),
    'updated_at', c.updated_at) ORDER BY c.key), '[]'::jsonb)
  FROM public.marketplace_recommendation_configs c;
$$;

COMMENT ON FUNCTION public.mm_recommendation_readiness(text) IS
  'Whether an engine has the data it needs, counted now. Says what is required and what exists, so a blocked engine shows how far off it is.';
