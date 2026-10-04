-- Franchise audit history is append-only server output. Authenticated staff
-- may read it, but must not be able to invent or rewrite audit events directly.
DROP POLICY IF EXISTS franchise_audit_authenticated_write
  ON public.franchise_audit_logs;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON TABLE public.franchise_audit_logs
  FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public.franchise_audit_logs', 'INSERT')
     OR has_table_privilege('authenticated', 'public.franchise_audit_logs', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.franchise_audit_logs', 'DELETE')
     OR has_table_privilege('anon', 'public.franchise_audit_logs', 'INSERT')
     OR has_table_privilege('anon', 'public.franchise_audit_logs', 'UPDATE')
     OR has_table_privilege('anon', 'public.franchise_audit_logs', 'DELETE') THEN
    RAISE EXCEPTION 'Client write privileges remain on franchise_audit_logs';
  END IF;

  IF NOT has_table_privilege('service_role', 'public.franchise_audit_logs', 'INSERT') THEN
    RAISE EXCEPTION 'service_role must retain franchise audit insertion';
  END IF;
END;
$$;
