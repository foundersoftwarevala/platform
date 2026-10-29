DROP INDEX IF EXISTS public.api_keys_integrity_check_idx;
ALTER TABLE public.api_keys
  DROP COLUMN IF EXISTS integrity_checked_at;
