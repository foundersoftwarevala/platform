-- Make the lead audit trail genuinely append-only.
--
-- The Security screen tells the operator it keeps an "Immutable trail of lead
-- changes". It did not. The only policy on the table was `open_audit`, a
-- PERMISSIVE policy FOR ALL granted to `authenticated`, and UPDATE and DELETE
-- were granted to `authenticated`, `anon` and `service_role` alike - so anyone
-- who could read the trail could also edit or erase it, which is the one thing
-- an audit trail must not allow. A record that the person under investigation
-- can rewrite is not evidence.
--
-- This is enforced with a trigger rather than a RESTRICTIVE policy because
-- `service_role` carries BYPASSRLS: a policy would leave the service key able
-- to rewrite history, and the service key is exactly what a compromised server
-- process would be holding. A trigger has no such exemption.
--
-- Nothing is removed. INSERT and SELECT are untouched, the existing policy
-- stays exactly as it is, and all 125 existing rows are left alone. If the
-- owner ever genuinely needs to correct a row, a superuser can lift this for
-- the duration of that one statement with:
--     ALTER TABLE public.lead_audit_logs DISABLE TRIGGER lead_audit_logs_append_only;

CREATE OR REPLACE FUNCTION public.lead_audit_logs_reject_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'lead_audit_logs is append-only: % is not permitted on the audit trail',
    TG_OP
    USING ERRCODE = 'insufficient_privilege',
          HINT = 'Record a new audit entry instead of changing an existing one.';
END;
$$;

COMMENT ON FUNCTION public.lead_audit_logs_reject_rewrite() IS
  'Refuses UPDATE and DELETE on lead_audit_logs so the trail the Security screen calls immutable actually is.';

DROP TRIGGER IF EXISTS lead_audit_logs_append_only ON public.lead_audit_logs;

CREATE TRIGGER lead_audit_logs_append_only
  BEFORE UPDATE OR DELETE ON public.lead_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.lead_audit_logs_reject_rewrite();
