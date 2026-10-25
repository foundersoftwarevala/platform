-- Keep AI registry and metering tables behind the authorized server
-- boundary. Browser access to these tables is mediated by authorized APIs.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'ai_providers',
    'ai_models',
    'ai_agents',
    'ai_decision_logs',
    'ai_agent_runs',
    'api_keys',
    'usage_events',
    'usage_daily'
  ]
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      RAISE EXCEPTION 'Required AI security table public.% is missing', table_name;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', table_name);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_service_role', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      table_name || '_service_role',
      table_name
    );
  END LOOP;
END
$$;

-- Attribute new team feedback to the verified operator who submitted it.
-- Historical rows remain unattributed and are excluded from user-scoped AI analysis.
ALTER TABLE public.rnd_team_feedback
  ADD COLUMN IF NOT EXISTS submitted_by uuid
  REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS rnd_team_feedback_submitter_created_idx
  ON public.rnd_team_feedback (submitted_by, created_at DESC);

ALTER TABLE public.rnd_feedback_insights
  ADD COLUMN IF NOT EXISTS submitted_by uuid
  REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS rnd_feedback_insights_submitter_created_idx
  ON public.rnd_feedback_insights (submitted_by, created_at DESC);

-- Keep the existing operator-read policies, but require rows to belong to the
-- authenticated user. Legacy rows without an attributable submitter stay hidden.
DROP POLICY IF EXISTS rnd_team_feedback_owner_scope ON public.rnd_team_feedback;
CREATE POLICY rnd_team_feedback_owner_scope ON public.rnd_team_feedback
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (submitted_by = auth.uid());

DROP POLICY IF EXISTS rnd_feedback_insights_owner_scope ON public.rnd_feedback_insights;
CREATE POLICY rnd_feedback_insights_owner_scope ON public.rnd_feedback_insights
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (submitted_by = auth.uid());
