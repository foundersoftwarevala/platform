CREATE TABLE IF NOT EXISTS public.marketplace_product_country_seo_worker_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT true,
  current_provider text NOT NULL DEFAULT 'Ollama Local',
  provider_service_id uuid,
  consecutive_ollama_failures integer NOT NULL DEFAULT 0
    CHECK (consecutive_ollama_failures BETWEEN 0 AND 3),
  pause_reason text,
  last_error text,
  heartbeat_at timestamptz,
  host_load_1m double precision,
  available_memory_bytes bigint CHECK (available_memory_bytes IS NULL OR available_memory_bytes >= 0),
  lease_token uuid,
  lease_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_product_country_seo_worker_lease_check CHECK (
    (lease_token IS NULL AND lease_until IS NULL)
    OR (lease_token IS NOT NULL AND lease_until IS NOT NULL)
  )
);

INSERT INTO public.marketplace_product_country_seo_worker_state (singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

ALTER TABLE public.marketplace_product_country_seo_worker_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_product_country_seo_worker_state FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.marketplace_product_country_seo_worker_state TO service_role;

CREATE OR REPLACE FUNCTION public.acquire_marketplace_product_country_seo_worker_lease()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acquired_token uuid;
BEGIN
  UPDATE public.marketplace_product_country_seo_worker_state
  SET lease_token = gen_random_uuid(),
      lease_until = now() + interval '5 minutes',
      heartbeat_at = now(),
      updated_at = now()
  WHERE singleton = true
    AND enabled = true
    AND (lease_until IS NULL OR lease_until < now())
  RETURNING lease_token INTO acquired_token;

  RETURN acquired_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_marketplace_product_country_seo_worker_lease(
  p_lease_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_rows integer;
BEGIN
  UPDATE public.marketplace_product_country_seo_worker_state
  SET lease_token = NULL,
      lease_until = NULL,
      updated_at = now()
  WHERE singleton = true
    AND lease_token = p_lease_token;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_marketplace_product_country_seo_worker_lease()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_marketplace_product_country_seo_worker_lease()
  TO service_role;
REVOKE ALL ON FUNCTION public.release_marketplace_product_country_seo_worker_lease(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_marketplace_product_country_seo_worker_lease(uuid)
  TO service_role;
