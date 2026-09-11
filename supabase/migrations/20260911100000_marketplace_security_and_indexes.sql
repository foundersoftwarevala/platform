-- Marketplace audit, 2026-09-11: the database half of the fixes.
--
-- Everything here is additive: new RESTRICTIVE policies narrow who can read,
-- one REVOKE removes direct execution of an internal trigger function, and the
-- indexes are CREATE ... IF NOT EXISTS. No table, column, row, policy or
-- function is dropped.
--
-- Apply after 20260909035000, 20260909040000 and 20260909050000 (the order
-- does not matter for this file itself; it depends on none of them).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Demo URLs are not public (P0)
-- ---------------------------------------------------------------------------
--
-- The policy "product demos public active read" lets anon and authenticated
-- SELECT every active row. The anon key ships in the public JavaScript bundle,
-- so on 2026-09-11 an anonymous request to
--   /rest/v1/product_demo_urls?select=url
-- returned all 9 live demo addresses — with no sign-in, no demo pass and no
-- lead recorded, which is exactly what the demo gate exists to prevent.
--
-- Every storefront read of this table is server side on the service role
-- (catalogue, product page, demo ticket, demo proxy), which bypasses RLS, so
-- nothing public changes. The two operator screens that read it from the
-- browser (/product-demo-manager) keep working for operators.
--
-- RESTRICTIVE policies are AND-ed with the permissive ones, so the existing
-- policy is left in place and simply no longer admits anon or non-operators.

DROP POLICY IF EXISTS demo_urls_no_anon_select ON public.product_demo_urls;
CREATE POLICY demo_urls_no_anon_select
  ON public.product_demo_urls
  AS RESTRICTIVE FOR SELECT TO anon
  USING (false);

DROP POLICY IF EXISTS demo_urls_operator_select ON public.product_demo_urls;
CREATE POLICY demo_urls_operator_select
  ON public.product_demo_urls
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    public.mm_is_operator()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'boss'::public.app_role)
  );

-- ---------------------------------------------------------------------------
-- 2. An internal trigger function is not a public endpoint
-- ---------------------------------------------------------------------------
--
-- mm_issue_for_order is SECURITY DEFINER and is called only by the paid-order
-- trigger. Anyone could call it through /rest/v1/rpc and learn whether an
-- order id exists and what state it is in. The trigger keeps working: it runs
-- as the function's owner.

REVOKE EXECUTE ON FUNCTION public.mm_issue_for_order(uuid) FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Indexes for the public catalogue at 12,000+ products
-- ---------------------------------------------------------------------------
--
-- The public reads filter on visible + content_status and order by
-- sort_order, name; the category page adds category_id; country pages match
-- search_keywords; search matches industry_label and search_text with ilike.
-- Only the unique slug and the name/description trigram indexes existed.

CREATE INDEX IF NOT EXISTS marketplace_products_public_cat_sort_idx
  ON public.marketplace_products (category_id, sort_order, name, id)
  WHERE visible AND content_status = 'published';

CREATE INDEX IF NOT EXISTS marketplace_products_public_sort_idx
  ON public.marketplace_products (sort_order, name, id)
  WHERE visible AND content_status = 'published';

CREATE INDEX IF NOT EXISTS marketplace_products_search_keywords_gin
  ON public.marketplace_products USING gin (search_keywords);

CREATE INDEX IF NOT EXISTS marketplace_products_industry_label_trgm
  ON public.marketplace_products USING gin (industry_label gin_trgm_ops);

CREATE INDEX IF NOT EXISTS marketplace_products_search_text_trgm
  ON public.marketplace_products USING gin (search_text gin_trgm_ops);

CREATE INDEX IF NOT EXISTS product_demo_urls_active_product_idx
  ON public.product_demo_urls (product_id, sort_order)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS seo_pages_product_id_idx
  ON public.seo_pages (product_id);

CREATE INDEX IF NOT EXISTS marketplace_events_created_idx
  ON public.marketplace_events (created_at DESC);

CREATE INDEX IF NOT EXISTS marketplace_orders_buyer_status_idx
  ON public.marketplace_orders (buyer_id, status);

COMMIT;
