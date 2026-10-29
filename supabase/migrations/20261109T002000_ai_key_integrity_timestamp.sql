-- Keep local encrypted-envelope checks distinct from provider-response health.
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS integrity_checked_at timestamptz;

CREATE INDEX IF NOT EXISTS api_keys_integrity_check_idx
  ON public.api_keys (integrity_checked_at, id)
  WHERE status = 'active';
