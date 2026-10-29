DROP INDEX IF EXISTS public.api_keys_health_check_idx;
DROP INDEX IF EXISTS public.api_keys_provider_account_lookup_idx;
ALTER TABLE public.api_keys
  DROP CONSTRAINT IF EXISTS api_keys_health_status_check,
  DROP COLUMN IF EXISTS cooldown_until,
  DROP COLUMN IF EXISTS failure_reason,
  DROP COLUMN IF EXISTS last_checked_at,
  DROP COLUMN IF EXISTS health_status;
