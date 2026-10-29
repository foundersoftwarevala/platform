BEGIN;

DROP INDEX IF EXISTS public.api_keys_fingerprint_unique_idx;
DROP INDEX IF EXISTS public.api_keys_expiry_check_idx;

ALTER TABLE public.api_keys
  DROP CONSTRAINT IF EXISTS api_keys_health_status_check;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.api_keys
     WHERE health_status = 'expired'
  ) THEN
    RAISE EXCEPTION
      'Cannot restore the previous api_keys health constraint while expired health rows exist.';
  END IF;
END;
$$;

ALTER TABLE public.api_keys
  ADD CONSTRAINT api_keys_health_status_check
  CHECK (health_status IN ('unknown', 'healthy', 'invalid', 'throttled', 'unreachable'));

COMMIT;
