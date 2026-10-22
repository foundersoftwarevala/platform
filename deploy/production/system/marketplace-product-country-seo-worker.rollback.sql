BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.marketplace_product_country_seo_worker_state
    WHERE enabled = true OR lease_token IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Pause the Marketplace SEO worker and wait for its lease to clear before rollback';
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.release_marketplace_product_country_seo_worker_lease(uuid);
DROP FUNCTION IF EXISTS public.acquire_marketplace_product_country_seo_worker_lease();
DROP TABLE IF EXISTS public.marketplace_product_country_seo_worker_state;

COMMIT;
