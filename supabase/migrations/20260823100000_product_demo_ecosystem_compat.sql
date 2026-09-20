-- Recovered from the Supabase migration history (supabase_migrations.schema_migrations).
-- Already applied in production; committed so the repository carries the full history.

-- Bridge the public marketplace demo URL model to the existing analytics tables.
ALTER TABLE public.demo_clicks
  ALTER COLUMN demo_id DROP NOT NULL;
ALTER TABLE public.demo_clicks
  ADD COLUMN IF NOT EXISTS demo_url_id uuid REFERENCES public.product_demo_urls(id) ON DELETE SET NULL;
ALTER TABLE public.demo_clicks
  ADD COLUMN IF NOT EXISTS source_page text;
ALTER TABLE public.demo_clicks
  ADD CONSTRAINT demo_clicks_source_check
  CHECK (demo_id IS NOT NULL OR demo_url_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS demo_clicks_demo_url_idx
  ON public.demo_clicks(demo_url_id, clicked_at DESC);
ALTER TABLE public.seo_pages
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.marketplace_products(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS seo_pages_product_id_idx
  ON public.seo_pages(product_id);
