CREATE TABLE IF NOT EXISTS public.seo_bulk_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_type text NOT NULL DEFAULT 'reseller',
  country text NOT NULL,
  keyword text NOT NULL,
  hashtag text NOT NULL,
  meta_title text NOT NULL,
  meta_description text NOT NULL,
  backlink_url text NOT NULL DEFAULT 'https://softwarevala.net/apply/reseller',
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seo_bulk_assets_reseller_role_check
    CHECK (role_type = 'reseller'),
  CONSTRAINT seo_bulk_assets_application_url_check
    CHECK (backlink_url = 'https://softwarevala.net/apply/reseller'),
  CONSTRAINT seo_bulk_assets_brand_hashtag_check
    CHECK (hashtag LIKE '%#SoftwareVala%'),
  CONSTRAINT seo_bulk_assets_status_check
    CHECK (status IN ('draft', 'review', 'approved', 'archived'))
);

CREATE INDEX IF NOT EXISTS seo_bulk_assets_role_country_created_idx
  ON public.seo_bulk_assets (role_type, country, created_at DESC);

REVOKE ALL ON public.seo_bulk_assets FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.seo_bulk_assets TO service_role;
