-- Recovered from the Supabase migration history (supabase_migrations.schema_migrations).
-- Already applied in production; committed so the repository carries the full history.

REVOKE ALL ON FUNCTION public.log_seo_activity() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_seo_activity() FROM anon;
REVOKE ALL ON FUNCTION public.log_seo_activity() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.log_seo_activity() TO service_role;
