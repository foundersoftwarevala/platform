-- Persist local Ollama forecasts and risk assessments against the VPS platform DB.
CREATE TABLE IF NOT EXISTS public.founder_ai_insight_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_type text NOT NULL CHECK (insight_type IN ('operational_forecast', 'security_risk_assessment', 'promise_risk')),
  snapshot_hash text NOT NULL,
  reference_id text,
  data jsonb NOT NULL,
  model text NOT NULL,
  source_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT founder_ai_insight_runs_snapshot_unique UNIQUE (insight_type, snapshot_hash),
  CONSTRAINT founder_ai_insight_runs_reference_unique UNIQUE (insight_type, reference_id)
);

CREATE INDEX IF NOT EXISTS founder_ai_insight_runs_recent
  ON public.founder_ai_insight_runs (insight_type, created_at DESC);

REVOKE ALL ON TABLE public.founder_ai_insight_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.founder_ai_insight_runs TO service_role;
