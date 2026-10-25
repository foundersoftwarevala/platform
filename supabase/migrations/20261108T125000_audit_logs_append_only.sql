-- Keep audit history immutable for application roles, including service_role.
CREATE OR REPLACE FUNCTION public.reject_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only'
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_reject_update_delete ON public.audit_logs;
CREATE TRIGGER audit_logs_reject_update_delete
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_audit_log_mutation();

DROP TRIGGER IF EXISTS audit_logs_reject_truncate ON public.audit_logs;
CREATE TRIGGER audit_logs_reject_truncate
  BEFORE TRUNCATE ON public.audit_logs
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.reject_audit_log_mutation();
