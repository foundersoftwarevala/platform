-- Add account-level health metadata to the existing encrypted api_keys registry.
-- Multiple rows per provider/service are already supported; do not duplicate secrets.
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS health_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS cooldown_until timestamptz;

CREATE INDEX IF NOT EXISTS api_keys_provider_account_lookup_idx
  ON public.api_keys (provider_id, service_id, environment, status, created_at DESC);

CREATE INDEX IF NOT EXISTS api_keys_health_check_idx
  ON public.api_keys (last_checked_at, id)
  WHERE status = 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'api_keys_health_status_check'
       AND conrelid = 'public.api_keys'::regclass
  ) THEN
    ALTER TABLE public.api_keys
      ADD CONSTRAINT api_keys_health_status_check
      CHECK (health_status IN ('unknown', 'healthy', 'invalid', 'throttled', 'unreachable'));
  END IF;
END;
$$;
