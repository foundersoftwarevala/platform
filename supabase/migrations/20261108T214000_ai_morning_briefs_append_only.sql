-- VPS-only: remove inherited default write privileges beyond append-only access.
-- The initial table migration grants SELECT/INSERT, but VPS default ACLs may
-- already grant every table privilege to service_role. Explicitly revoke those
-- mutation privileges so brief history remains append-only.
DO $grant_append_only$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.ai_morning_briefs FROM service_role';
    EXECUTE 'GRANT SELECT, INSERT ON TABLE public.ai_morning_briefs TO service_role';
  END IF;
END
$grant_append_only$;
