BEGIN;

DO $$
DECLARE
  claim_definition text;
BEGIN
  claim_definition := pg_get_functiondef(
    'public.claim_marketplace_product_country_seo_batch(jsonb,integer)'::regprocedure
  );
  IF position(
    'ORDER BY (queue.last_error IS NOT NULL) DESC, queue.created_at, queue.id'
    IN claim_definition
  ) > 0 THEN
    claim_definition := replace(
      claim_definition,
      'ORDER BY (queue.last_error IS NOT NULL) DESC, queue.created_at, queue.id',
      'ORDER BY queue.created_at, queue.id'
    );
    EXECUTE claim_definition;
  END IF;
END;
$$;

UPDATE public.api_services
SET endpoint_url = 'https://openrouter.ai/api/v1',
    provider_id = NULL
WHERE slug = 'openrouter-api'
  AND endpoint_url = 'https://openrouter.ai/api/v1/chat/completions'
  AND provider_id = (
    SELECT id FROM public.ai_providers WHERE slug = 'openrouter'
  );

ALTER TABLE public.marketplace_product_country_seo_worker_state
  DROP CONSTRAINT IF EXISTS marketplace_product_country_seo_free_failures_check,
  DROP COLUMN IF EXISTS consecutive_free_failures,
  DROP COLUMN IF EXISTS retry_after;

COMMIT;
