-- Recovered from the Supabase migration history (supabase_migrations.schema_migrations).
-- Already applied in production; committed so the repository carries the full history.

-- Compatibility bridge for live catalog databases created before commerce moderation.
ALTER TABLE public.marketplace_products
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
UPDATE public.marketplace_products
SET moderation_status = 'approved'
WHERE moderation_status IS NULL;
