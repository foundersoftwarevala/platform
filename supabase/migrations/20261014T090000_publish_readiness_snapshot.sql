-- What the Quality Gate screen shows, measured instead of written down.
--
-- The screen has been reporting 146 ready, 24 missing items, 6 blocked and an
-- 82% auto-fix rate, against a nine-item checklist for a product called
-- "Vala ERP Pro" which is not in the catalogue. None of those numbers came
-- from anywhere. The real catalogue holds 7,365 products, and running the
-- gate across them says something quite different.
--
-- The gate itself is mm_product_checks — the same function the Approval
-- Workflow uses, so the screen and the gate cannot disagree about what ready
-- means. Running it over the whole catalogue takes about six seconds, which is
-- fine for a scheduled job and far too slow for a page load. So it is measured
-- into a snapshot and the screen reads the snapshot.
--
-- That is also why this is a table and not a view: at 7,365 products it is
-- already six seconds, and the platform is built for a catalogue many times
-- that. A view would put that cost on every operator who opens the screen.
--
--   mm_publish_readiness_refresh()   run the gate, store a snapshot
--   mm_publish_readiness()           the latest snapshot, no recompute

CREATE TABLE IF NOT EXISTS public.mm_publish_readiness (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  computed_at       timestamptz NOT NULL DEFAULT now(),
  duration_ms       integer     NOT NULL,
  considered        integer     NOT NULL,
  ready             integer     NOT NULL,
  advisory_only     integer     NOT NULL,
  blocked           integer     NOT NULL,
  -- Products that are live on the site while failing a mandatory check. This
  -- is the number worth acting on: the gate cannot stop what is already out.
  published_blocked integer     NOT NULL,
  by_check          jsonb       NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS mm_publish_readiness_computed_idx
  ON public.mm_publish_readiness (computed_at DESC);

CREATE OR REPLACE FUNCTION public.mm_publish_readiness_refresh()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_started timestamptz := clock_timestamp();
  v_id uuid;
BEGIN
  IF NOT public.mm_is_operator() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_permitted');
  END IF;

  -- MATERIALIZED matters here: without it the planner is free to inline the
  -- gate call into both aggregates below and run all 7,365 checks twice.
  WITH gate AS MATERIALIZED (
    SELECT p.id, p.content_status, p.visible, public.mm_product_checks(p.id) AS r
      FROM public.marketplace_products p
  ),
  totals AS (
    SELECT
      count(*)::int AS considered,
      count(*) FILTER (
        WHERE NOT (r->>'blocking')::boolean
          AND (r->>'advisory_failed')::int = 0)::int AS ready,
      count(*) FILTER (
        WHERE NOT (r->>'blocking')::boolean
          AND (r->>'advisory_failed')::int > 0)::int AS advisory_only,
      count(*) FILTER (WHERE (r->>'blocking')::boolean)::int AS blocked,
      count(*) FILTER (
        WHERE (r->>'blocking')::boolean
          AND content_status = 'published'
          AND visible)::int AS published_blocked
    FROM gate
  ),
  per_check AS (
    SELECT
      c->>'key'   AS key,
      c->>'label' AS label,
      count(*)::int AS checked,
      count(*) FILTER (WHERE NOT (c->>'passed')::boolean)::int AS failed,
      -- `author_approved` is mandatory only for a product that has a seller,
      -- so mandatory is counted per row rather than treated as a property of
      -- the check.
      count(*) FILTER (
        WHERE NOT (c->>'passed')::boolean
          AND (c->>'mandatory')::boolean)::int AS blocking_failures
    FROM gate g, jsonb_array_elements(g.r->'checks') c
    GROUP BY 1, 2
  )
  INSERT INTO public.mm_publish_readiness
    (duration_ms, considered, ready, advisory_only, blocked, published_blocked, by_check)
  SELECT
    (extract(epoch FROM clock_timestamp() - v_started) * 1000)::int,
    t.considered, t.ready, t.advisory_only, t.blocked, t.published_blocked,
    coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.failed DESC, p.key)
                FROM per_check p), '[]'::jsonb)
  FROM totals t
  RETURNING id INTO v_id;

  -- Thirty snapshots is enough to see a trend and small enough that nobody has
  -- to think about this table.
  DELETE FROM public.mm_publish_readiness
   WHERE id IN (
     SELECT id FROM public.mm_publish_readiness
      ORDER BY computed_at DESC OFFSET 30);

  RETURN public.mm_publish_readiness();
END;
$function$;

CREATE OR REPLACE FUNCTION public.mm_publish_readiness()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public.mm_is_operator() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_permitted');
  END IF;

  RETURN coalesce(
    (SELECT to_jsonb(r) || jsonb_build_object('ok', true)
       FROM public.mm_publish_readiness r
      ORDER BY r.computed_at DESC
      LIMIT 1),
    -- Never measured is a different state from measured and empty, and the
    -- screen has to be able to say which one it is looking at.
    jsonb_build_object('ok', false, 'reason', 'never_measured'));
END;
$function$;

-- Granted the way every other mm_ function is, PUBLIC included. That is not
-- carelessness: PostgREST introspects the catalogue once, as the authenticator
-- role, and a function the authenticator cannot see is not in its schema cache
-- at all — it answers PGRST202 "no matches were found", which reads like a
-- missing function rather than a refused one. So the grant is wide and the
-- guard is mm_is_operator() inside the function, which is why a non-operator
-- gets a stated refusal instead of a 404 nobody can act on.
GRANT EXECUTE ON FUNCTION public.mm_publish_readiness_refresh() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.mm_publish_readiness()         TO PUBLIC;

REVOKE ALL ON TABLE public.mm_publish_readiness FROM public, anon, authenticated;
GRANT SELECT ON TABLE public.mm_publish_readiness TO service_role;

COMMENT ON TABLE public.mm_publish_readiness IS
  'Snapshots of the publish gate run across the whole catalogue: how many products are ready, advisory-only or blocked, and which check fails most. Written by mm_publish_readiness_refresh.';

COMMENT ON FUNCTION public.mm_publish_readiness_refresh() IS
  'Runs mm_product_checks over every product and stores a snapshot. Takes seconds, not milliseconds — call it from a job or an explicit operator action, never from a page load.';

COMMENT ON FUNCTION public.mm_publish_readiness() IS
  'The latest publish-readiness snapshot. Returns ok:false with reason never_measured when none has been taken.';
