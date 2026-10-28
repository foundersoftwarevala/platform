-- VPS-only short-lived credentials for the AYRA Chrome Auto-Fill extension.
-- Apply to sv_platform on the VPS only; never apply this migration to Supabase cloud.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ayra_extension_tokens (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS ayra_extension_tokens_user_expiry_idx
  ON public.ayra_extension_tokens (user_id, expires_at DESC);

ALTER TABLE public.ayra_extension_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ayra_extension_tokens FROM PUBLIC;
DO $secure_extension_tokens$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.ayra_extension_tokens FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.ayra_extension_tokens FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ayra_extension_tokens TO service_role;
  END IF;
END
$secure_extension_tokens$;

COMMENT ON TABLE public.ayra_extension_tokens IS
  'Hashed, short-lived, executive-issued bearer tokens scoped to AYRA company-profile autofill through the VPS API.';

COMMIT;
