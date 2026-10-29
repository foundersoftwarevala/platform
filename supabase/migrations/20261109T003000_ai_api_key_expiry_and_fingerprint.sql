-- Make existing API key fingerprints unique and expose expired health explicitly.
-- Credential rows remain in api_keys; no credential data is copied.
ALTER TABLE public.api_keys
  DROP CONSTRAINT IF EXISTS api_keys_health_status_check;

ALTER TABLE public.api_keys
  ADD CONSTRAINT api_keys_health_status_check
  CHECK (health_status IN ('unknown', 'healthy', 'invalid', 'throttled', 'unreachable', 'expired'));

CREATE UNIQUE INDEX IF NOT EXISTS api_keys_fingerprint_unique_idx
  ON public.api_keys (fingerprint);

CREATE INDEX IF NOT EXISTS api_keys_expiry_check_idx
  ON public.api_keys (expires_at, id)
  WHERE status = 'active' AND expires_at IS NOT NULL;
