-- Recovered from the Supabase migration history (supabase_migrations.schema_migrations).
-- Already applied in production; committed so the repository carries the full history.

REVOKE ALL ON FUNCTION public.generate_lead_alerts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_lead_alerts() FROM anon;
REVOKE ALL ON FUNCTION public.generate_lead_alerts() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.generate_lead_alerts() TO service_role;
