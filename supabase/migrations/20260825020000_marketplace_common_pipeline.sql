-- Recovered from the Supabase migration history (supabase_migrations.schema_migrations).
-- Already applied in production; committed so the repository carries the full history.

-- Common marketplace contracts for every category and future product.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.marketplace_products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cta_action text,
  ADD COLUMN IF NOT EXISTS source_page text;
ALTER TABLE public.marketplace_products
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS technology text,
  ADD COLUMN IF NOT EXISTS search_keywords text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS search_text text;
UPDATE public.marketplace_products
SET search_text = lower(concat_ws(' ', name, industry_label, subcategory, description, technology,
  array_to_string(tags, ' '), array_to_string(search_keywords, ' ')));
CREATE OR REPLACE FUNCTION public.update_marketplace_product_search_text()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.search_text := lower(concat_ws(' ', NEW.name, NEW.industry_label, NEW.subcategory,
    NEW.description, NEW.technology, array_to_string(NEW.tags, ' '),
    array_to_string(NEW.search_keywords, ' ')));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_marketplace_product_search_text ON public.marketplace_products;
CREATE TRIGGER trg_marketplace_product_search_text
  BEFORE INSERT OR UPDATE OF name, industry_label, subcategory, description, technology, tags, search_keywords
  ON public.marketplace_products
  FOR EACH ROW EXECUTE FUNCTION public.update_marketplace_product_search_text();
CREATE INDEX IF NOT EXISTS marketplace_products_search_text_idx
  ON public.marketplace_products USING gin (to_tsvector('simple', search_text));
CREATE TABLE IF NOT EXISTS public.marketplace_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN ('product_view','category_view','search','filter','demo_click','cta_click','lead_created','product_interaction')),
  product_id uuid REFERENCES public.marketplace_products(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.marketplace_categories(id) ON DELETE SET NULL,
  source_page text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.marketplace_events TO anon, authenticated;
GRANT SELECT ON public.marketplace_events TO authenticated;
ALTER TABLE public.marketplace_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marketplace_events_public_insert" ON public.marketplace_events
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "marketplace_events_staff_read" ON public.marketplace_events
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'boss')
    OR public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'sales')
    OR public.has_role(auth.uid(), 'support')
  );
CREATE INDEX IF NOT EXISTS marketplace_events_created_idx ON public.marketplace_events(created_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_events_product_idx ON public.marketplace_events(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS leads_marketplace_product_idx
  ON public.leads(product_id, created_at DESC)
  WHERE source = 'marketplace';
-- Public marketplace forms may create leads, but must never read, update, or delete them.
DROP POLICY IF EXISTS "open_leads" ON public.leads;
CREATE POLICY "marketplace_lead_intake" ON public.leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (source = 'marketplace');
CREATE POLICY "staff_manage_leads" ON public.leads
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'boss')
    OR public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'sales')
    OR public.has_role(auth.uid(), 'support')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'boss')
    OR public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'sales')
    OR public.has_role(auth.uid(), 'support')
  );
