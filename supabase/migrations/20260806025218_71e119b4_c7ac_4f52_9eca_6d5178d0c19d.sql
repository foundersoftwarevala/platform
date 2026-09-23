-- Recovered from the Supabase migration history (supabase_migrations.schema_migrations).
-- Already applied in production; committed so the repository carries the full history.

CREATE TABLE public.error_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL CHECK (source IN ('server_fn','client','ssr')),
  severity text NOT NULL DEFAULT 'error',
  fingerprint text NOT NULL,
  message text NOT NULL,
  stack text,
  route text,
  fn_name text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX error_events_occurred_at_idx ON public.error_events (occurred_at DESC);
CREATE INDEX error_events_fingerprint_idx ON public.error_events (fingerprint);
GRANT ALL ON public.error_events TO service_role;
ALTER TABLE public.error_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages error events"
ON public.error_events FOR ALL TO service_role
USING (true) WITH CHECK (true);
