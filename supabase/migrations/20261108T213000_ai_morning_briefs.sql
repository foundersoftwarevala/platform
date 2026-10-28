-- VPS-only persistent AI CEO morning briefs. Apply to sv_platform only.
-- Brief history is append-only; each run records its exact source window.
CREATE TABLE IF NOT EXISTS public.ai_morning_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  generated_by uuid,
  source_counts jsonb NOT NULL,
  sources text[] NOT NULL,
  summary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_morning_briefs_window_ck CHECK (window_start < window_end)
);

CREATE INDEX IF NOT EXISTS ai_morning_briefs_created_at_idx
  ON public.ai_morning_briefs (created_at DESC, id DESC);

ALTER TABLE public.ai_morning_briefs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_morning_briefs FROM PUBLIC;
DO $grant_roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE public.ai_morning_briefs FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE public.ai_morning_briefs FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT SELECT, INSERT ON TABLE public.ai_morning_briefs TO service_role';
  END IF;
END
$grant_roles$;

COMMENT ON TABLE public.ai_morning_briefs IS
  'Append-only AI CEO overnight activity briefs generated from VPS Postgres operational data.';
