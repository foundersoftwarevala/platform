BEGIN;

DROP POLICY IF EXISTS marketplace_events_public_insert ON public.marketplace_events;
REVOKE INSERT ON TABLE public.marketplace_events FROM anon, authenticated;

DO $$
BEGIN
  IF has_table_privilege('anon', 'public.marketplace_events', 'INSERT') THEN
    RAISE EXCEPTION 'anonymous role can still insert marketplace events';
  END IF;
  IF has_table_privilege('authenticated', 'public.marketplace_events', 'INSERT') THEN
    RAISE EXCEPTION 'authenticated role can still insert marketplace events';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.marketplace_events', 'INSERT') THEN
    RAISE EXCEPTION 'service role cannot insert marketplace events';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'marketplace_events'
      AND policyname = 'marketplace_events_public_insert'
  ) THEN
    RAISE EXCEPTION 'public marketplace event insert policy still exists';
  END IF;
END
$$;

COMMIT;
