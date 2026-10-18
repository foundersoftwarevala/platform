-- The numbers the homepage tells visitors, counted rather than typed.
--
-- The storefront badge, the footer and the AI Zone blurb all read SITE_STATS,
-- a frozen object in src/lib/site-content/constants.ts:
--
--     solutions:  "12,000+"
--     categories: "80+"
--
-- The catalogue actually holds 7,347 published products in 91 categories. So
-- the site overstates its range by nearly five thousand products and
-- understates its categories, and neither figure can ever correct itself
-- because both are compiled into the bundle.
--
-- This is the case the engineering standard names outright: no hardcoded
-- business numbers, and no aggregate worked out anywhere but the database. A
-- count taken from a fetched list would be wrong the moment the list is capped,
-- and every list here is capped at 10,000 rows by PostgREST.
--
-- What "published" means is taken from the storefront's own rule rather than
-- invented here: visible = true and content_status = 'published', which is what
-- marketplace_products is filtered by everywhere a visitor sees it.
--
-- The function returns the raw counts. How they are phrased - whether 7,347 is
-- shown exactly, rounded down to "7,000+", or overridden with a figure the
-- owner wants to advertise - is a presentation decision, and it belongs to
-- Marketplace Manager, not to a constant in a bundle.

CREATE OR REPLACE FUNCTION public.mm_marketplace_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT jsonb_build_object(
    'products', (
      SELECT count(*) FROM public.marketplace_products
       WHERE visible IS TRUE
         AND lower(coalesce(content_status, '')) = 'published'
    ),
    'categories', (
      SELECT count(*) FROM public.marketplace_categories
    ),
    -- A demo a visitor can actually open: active, and past its second
    -- verification. The same pair the demo gateway resolves on.
    'live_demos', (
      SELECT count(*) FROM public.product_demo_urls
       WHERE status = 'active' AND processing_status = 'live'
    ),
    'counted_at', now()
  );
$function$;

-- Readable by anyone, because these are the numbers on the public homepage.
-- Nothing here exposes a row, only how many there are.
GRANT EXECUTE ON FUNCTION public.mm_marketplace_stats() TO PUBLIC;

COMMENT ON FUNCTION public.mm_marketplace_stats() IS
  'The real catalogue counts for the storefront: published products, categories and demos a visitor can open. Counted by the database so the figures cannot be capped by a row ceiling or drift out of date in a bundle.';
