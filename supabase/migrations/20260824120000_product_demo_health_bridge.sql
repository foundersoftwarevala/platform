-- Recovered from the Supabase migration history (supabase_migrations.schema_migrations).
-- Already applied in production; committed so the repository carries the full history.

-- Bridge health history to the product_demo_urls model used by Marketplace Manager.
ALTER TABLE public.demo_health
  ALTER COLUMN demo_id DROP NOT NULL;
ALTER TABLE public.demo_health
  ADD COLUMN IF NOT EXISTS demo_url_id uuid REFERENCES public.product_demo_urls(id) ON DELETE CASCADE;
ALTER TABLE public.demo_health
  DROP CONSTRAINT IF EXISTS demo_health_demo_reference_check;
ALTER TABLE public.demo_health
  ADD CONSTRAINT demo_health_demo_reference_check
  CHECK (demo_id IS NOT NULL OR demo_url_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS demo_health_demo_url_idx
  ON public.demo_health(demo_url_id, checked_at DESC);
