-- Recovered from the Supabase migration history (supabase_migrations.schema_migrations).
-- Already applied in production; committed so the repository carries the full history.

-- Ensure the existing marketplace demo URL table exposes only active rows publicly.
DROP POLICY IF EXISTS "Boss or admin can view demo urls" ON public.product_demo_urls;
DROP POLICY IF EXISTS "product demos public active read" ON public.product_demo_urls;
CREATE POLICY "product demos public active read" ON public.product_demo_urls
  FOR SELECT TO anon, authenticated
  USING (status = 'active');
