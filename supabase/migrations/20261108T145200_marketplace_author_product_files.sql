-- Private author-owned product files. All object access is mediated by the
-- server after checking the author's seller and product ownership.
CREATE TABLE IF NOT EXISTS public.marketplace_product_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.marketplace_sellers(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.marketplace_products(id) ON DELETE RESTRICT,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 52428800),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  idempotency_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (seller_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS marketplace_product_files_product_created_idx
  ON public.marketplace_product_files (seller_id, product_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.marketplace_product_file_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  product_id uuid NOT NULL,
  file_id uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('uploaded', 'download_link_issued')),
  idempotency_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (seller_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS marketplace_product_file_events_file_created_idx
  ON public.marketplace_product_file_events (file_id, created_at DESC);

ALTER TABLE public.marketplace_product_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_product_file_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.marketplace_product_files FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.marketplace_product_file_events FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, DELETE ON public.marketplace_product_files TO service_role;
    GRANT SELECT, INSERT ON public.marketplace_product_file_events TO service_role;
  END IF;
END
$$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'marketplace-product-files',
  'marketplace-product-files',
  false,
  52428800,
  ARRAY[
    'application/zip',
    'application/x-zip-compressed',
    'application/pdf',
    'application/octet-stream',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
    'video/mp4',
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
