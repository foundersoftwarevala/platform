-- Recovered from the Supabase migration history (supabase_migrations.schema_migrations).
-- Already applied in production; committed so the repository carries the full history.

ALTER TABLE public.marketplace_products
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS public_repo_url text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tech_stack text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS content_status text NOT NULL DEFAULT 'draft';
ALTER TABLE public.marketplace_products
  DROP CONSTRAINT IF EXISTS marketplace_products_public_repo_url_check;
ALTER TABLE public.marketplace_products
  ADD CONSTRAINT marketplace_products_public_repo_url_check
  CHECK (public_repo_url IS NULL OR public_repo_url ~ '^https://(www\.)?(github\.com|gitlab\.com)/[^/]+/[^/]+/?$');
