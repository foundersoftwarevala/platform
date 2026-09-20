-- Recovered from the Supabase migration history (supabase_migrations.schema_migrations).
-- Already applied in production; committed so the repository carries the full history.

CREATE TABLE public.seo_benchmark_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  target text NOT NULL,
  ttfb_ms numeric NOT NULL DEFAULT 0,
  query_ms numeric NOT NULL DEFAULT 0,
  pagination_ms numeric NOT NULL DEFAULT 0,
  report_ms numeric NOT NULL DEFAULT 0,
  rows_scanned integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pass',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.seo_benchmark_runs TO anon, authenticated;
GRANT ALL ON public.seo_benchmark_runs TO service_role;
ALTER TABLE public.seo_benchmark_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Benchmarks are viewable by everyone" ON public.seo_benchmark_runs FOR SELECT USING (true);
CREATE TABLE public.seo_error_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  name text NOT NULL,
  message text NOT NULL,
  stack text,
  route text,
  fn_name text,
  severity text NOT NULL DEFAULT 'error',
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurrences integer NOT NULL DEFAULT 1,
  resolved boolean NOT NULL DEFAULT false,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.seo_error_events TO anon, authenticated;
GRANT ALL ON public.seo_error_events TO service_role;
ALTER TABLE public.seo_error_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Error events are viewable by everyone" ON public.seo_error_events FOR SELECT USING (true);
CREATE INDEX seo_error_events_last_seen_idx ON public.seo_error_events (last_seen_at DESC);
CREATE INDEX seo_benchmark_runs_created_idx ON public.seo_benchmark_runs (created_at DESC);
