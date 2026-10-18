BEGIN;

DROP POLICY IF EXISTS "a click may be recorded" ON public.affiliate_clicks;
REVOKE INSERT ON TABLE public.affiliate_clicks FROM anon, authenticated;

DROP POLICY IF EXISTS "demo_clicks anyone insert" ON public.demo_clicks;
REVOKE INSERT ON TABLE public.demo_clicks FROM anon, authenticated;

DROP POLICY IF EXISTS "demo_requests anyone insert" ON public.demo_requests;
REVOKE INSERT ON TABLE public.demo_requests FROM anon;

DROP POLICY IF EXISTS marketplace_lead_intake ON public.leads;
REVOKE INSERT ON TABLE public.leads FROM anon;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'affiliate_clicks',
    'demo_clicks',
    'demo_requests',
    'leads'
  ] LOOP
    IF has_table_privilege('anon', format('public.%I', table_name), 'INSERT') THEN
      RAISE EXCEPTION 'anonymous role can still insert into public.%', table_name;
    END IF;
    IF NOT has_table_privilege('service_role', format('public.%I', table_name), 'INSERT') THEN
      RAISE EXCEPTION 'service role cannot insert into public.%', table_name;
    END IF;
  END LOOP;

  IF has_table_privilege('authenticated', 'public.affiliate_clicks', 'INSERT')
     OR has_table_privilege('authenticated', 'public.demo_clicks', 'INSERT') THEN
    RAISE EXCEPTION 'non-operator insert remains on click analytics tables';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (tablename = 'affiliate_clicks' AND policyname = 'a click may be recorded')
        OR (tablename = 'demo_clicks' AND policyname = 'demo_clicks anyone insert')
        OR (tablename = 'demo_requests' AND policyname = 'demo_requests anyone insert')
        OR (tablename = 'leads' AND policyname = 'marketplace_lead_intake')
      )
  ) THEN
    RAISE EXCEPTION 'a public insert policy remains on a server-handled table';
  END IF;
END
$$;

COMMIT;
