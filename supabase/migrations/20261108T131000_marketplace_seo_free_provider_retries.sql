ALTER TABLE public.marketplace_product_country_seo_worker_state
  ADD COLUMN IF NOT EXISTS consecutive_free_failures integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retry_after timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.marketplace_product_country_seo_worker_state'::regclass
      AND conname = 'marketplace_product_country_seo_free_failures_check'
  ) THEN
    ALTER TABLE public.marketplace_product_country_seo_worker_state
      ADD CONSTRAINT marketplace_product_country_seo_free_failures_check
      CHECK (consecutive_free_failures BETWEEN 0 AND 10);
  END IF;
END;
$$;

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
    NULL;
  ELSIF position('ORDER BY queue.created_at, queue.id' IN claim_definition) > 0 THEN
    claim_definition := replace(
      claim_definition,
      'ORDER BY queue.created_at, queue.id',
      'ORDER BY (queue.last_error IS NOT NULL) DESC, queue.created_at, queue.id'
    );
    EXECUTE claim_definition;
  ELSE
    RAISE EXCEPTION
      'Marketplace SEO claim function differs from the reviewed version; refusing to change claim priority.';
  END IF;
END;
$$;

INSERT INTO public.ai_providers (
  name,
  slug,
  category,
  status,
  base_url,
  region,
  monthly_cost_usd,
  api_kind,
  content_generation_enabled,
  auth_type,
  pricing_tier,
  approval_status
)
VALUES (
  'OpenRouter',
  'openrouter',
  'ai',
  'active',
  'https://openrouter.ai/api/v1',
  'global',
  0,
  'openai-compatible',
  true,
  'api_key',
  'free-tier',
  'approved'
)
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
  v_provider_id uuid;
  v_service_id uuid;
BEGIN
  SELECT provider.id
  INTO v_provider_id
  FROM public.ai_providers AS provider
  WHERE provider.slug = 'openrouter';

  IF NOT EXISTS (
    SELECT 1
    FROM public.ai_providers AS provider
    WHERE provider.id = v_provider_id
      AND provider.name = 'OpenRouter'
      AND provider.status = 'active'
      AND provider.base_url = 'https://openrouter.ai/api/v1'
      AND provider.api_kind = 'openai-compatible'
      AND provider.content_generation_enabled
      AND provider.auth_type = 'api_key'
      AND provider.pricing_tier = 'free-tier'
      AND provider.approval_status = 'approved'
  ) THEN
    RAISE EXCEPTION
      'The existing OpenRouter provider metadata differs from the reviewed free-provider configuration.';
  END IF;

  SELECT service.id
  INTO v_service_id
  FROM public.api_services AS service
  WHERE service.slug = 'openrouter-api'
    AND EXISTS (
      SELECT 1
      FROM public.api_keys AS api_key
      WHERE api_key.service_id = service.id
        AND api_key.status = 'active'
        AND api_key.environment = 'production'
        AND nullif(api_key.secret_encrypted, '') IS NOT NULL
    );

  IF v_service_id IS NULL THEN
    RAISE EXCEPTION
      'An active production OpenRouter credential for api_services.slug=openrouter-api is required.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.api_services AS service
    WHERE service.id = v_service_id
      AND (
        service.endpoint_url IS NULL
        OR service.endpoint_url NOT IN (
          'https://openrouter.ai/api/v1',
          'https://openrouter.ai/api/v1/chat/completions'
        )
        OR service.status <> 'active'
        OR service.approval_status <> 'approved'
        OR service.pricing_tier <> 'free-tier'
        OR (
          service.provider_id IS NOT NULL
          AND service.provider_id <> v_provider_id
        )
      )
  ) THEN
    RAISE EXCEPTION
      'The existing OpenRouter endpoint or provider association differs from the reviewed configuration.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ai_models AS model
    WHERE model.model_id = 'xingchen-agi/xing4.0-29b-a4b:free'
      AND (
        model.provider_id IS DISTINCT FROM v_provider_id
        OR model.status <> 'active'
        OR NOT model.is_default
        OR model.input_cost_per_1k <> 0
        OR model.output_cost_per_1k <> 0
      )
  ) THEN
    RAISE EXCEPTION
      'The OpenRouter free model ID already exists with conflicting metadata.';
  END IF;

  UPDATE public.api_services
  SET provider_id = v_provider_id,
      endpoint_url = 'https://openrouter.ai/api/v1/chat/completions'
  WHERE id = v_service_id;

  IF EXISTS (
    SELECT 1
    FROM public.ai_models AS model
    WHERE model.provider_id = v_provider_id
      AND model.is_default
      AND model.model_id <> 'xingchen-agi/xing4.0-29b-a4b:free'
  ) THEN
    RAISE EXCEPTION
      'OpenRouter already has a different default model; refusing to replace its routing metadata.';
  END IF;

  INSERT INTO public.ai_models (
    provider_id,
    name,
    model_id,
    modality,
    context_window,
    input_cost_per_1k,
    output_cost_per_1k,
    status,
    is_default
  )
  VALUES (
    v_provider_id,
    'Xing4.0 29B A4B Free',
    'xingchen-agi/xing4.0-29b-a4b:free',
    'text',
    131072,
    0,
    0,
    'active',
    true
  )
  ON CONFLICT (model_id) DO NOTHING;
END;
$$;
