-- Publish only tables with active client subscriptions and row-scoped SELECT
-- policies. Realtime uses these policies to decide which changes a user sees.
DO $$
DECLARE
  table_name text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    RAISE EXCEPTION 'The supabase_realtime publication does not exist';
  END IF;

  FOREACH table_name IN ARRAY ARRAY[
    'activity_logs',
    'marketplace_affiliate_partners',
    'partner_commissions',
    'partner_payouts',
    'safe_assist_notifications',
    'safe_assist_sessions'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_class c
      WHERE c.oid = format('public.%I', table_name)::regclass
        AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'RLS must be enabled on public.%', table_name;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = table_name
        AND cmd IN ('SELECT', 'ALL')
        AND roles && ARRAY['authenticated']::name[]
    ) THEN
      RAISE EXCEPTION 'An authenticated SELECT policy is required on public.%', table_name;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = table_name
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
    END IF;
  END LOOP;
END;
$$;
