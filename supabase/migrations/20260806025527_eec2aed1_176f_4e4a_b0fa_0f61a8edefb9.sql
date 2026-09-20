-- Recovered from the Supabase migration history (supabase_migrations.schema_migrations).
-- Already applied in production; committed so the repository carries the full history.

DELETE FROM public.error_events WHERE message = 'monitor smoke test';
