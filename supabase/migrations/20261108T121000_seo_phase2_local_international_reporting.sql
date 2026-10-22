-- Phase 2 SEO foundation storage; no external API integrations are configured.

BEGIN;

CREATE TABLE IF NOT EXISTS public.seo_local_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  domain text,
  country_code text NOT NULL,
  url text,
  listing_source text,
  external_listing_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'needs_review', 'error')),
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.seo_local_listings(id) ON DELETE SET NULL,
  business_name text NOT NULL,
  reviewer_name text,
  rating numeric(2, 1) CHECK (rating IS NULL OR rating BETWEEN 0 AND 5),
  country_code text NOT NULL,
  url text,
  review_text text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'published', 'flagged', 'removed', 'error')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_local_citations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.seo_local_listings(id) ON DELETE SET NULL,
  business_name text NOT NULL,
  source_name text NOT NULL,
  country_code text NOT NULL,
  url text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'inconsistent', 'missing', 'error')),
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_hreflang_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  alternate_url text NOT NULL,
  locale_code text NOT NULL,
  country_code text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'valid', 'invalid', 'error')),
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (url, locale_code)
);

CREATE TABLE IF NOT EXISTS public.seo_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  translated_url text,
  source_locale text NOT NULL,
  target_locale text NOT NULL,
  country_code text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'draft', 'published', 'needs_review', 'error')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (url, target_locale)
);

CREATE TABLE IF NOT EXISTS public.seo_country_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL UNIQUE,
  domain text,
  url text,
  language_code text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'paused', 'error')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- seo_reports already exists and is used by the existing SEO Manager.
ALTER TABLE public.seo_reports
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS url text;

CREATE TABLE IF NOT EXISTS public.seo_revenue_attribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  country_code text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  attributed_revenue numeric(16, 2) NOT NULL DEFAULT 0 CHECK (attributed_revenue >= 0),
  currency_code text NOT NULL DEFAULT 'USD',
  conversion_count bigint NOT NULL DEFAULT 0 CHECK (conversion_count >= 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'available', 'error')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);

CREATE TABLE IF NOT EXISTS public.seo_custom_dashboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS seo_local_listings_country_code_idx
  ON public.seo_local_listings USING btree (country_code);
CREATE INDEX IF NOT EXISTS seo_local_listings_url_idx
  ON public.seo_local_listings USING btree (url);
CREATE INDEX IF NOT EXISTS seo_local_listings_status_idx
  ON public.seo_local_listings USING btree (status);
CREATE INDEX IF NOT EXISTS seo_reviews_country_code_idx
  ON public.seo_reviews USING btree (country_code);
CREATE INDEX IF NOT EXISTS seo_reviews_url_idx
  ON public.seo_reviews USING btree (url);
CREATE INDEX IF NOT EXISTS seo_reviews_status_idx
  ON public.seo_reviews USING btree (status);
CREATE INDEX IF NOT EXISTS seo_reviews_listing_created_idx
  ON public.seo_reviews USING btree (listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS seo_local_citations_country_code_idx
  ON public.seo_local_citations USING btree (country_code);
CREATE INDEX IF NOT EXISTS seo_local_citations_url_idx
  ON public.seo_local_citations USING btree (url);
CREATE INDEX IF NOT EXISTS seo_local_citations_status_idx
  ON public.seo_local_citations USING btree (status);
CREATE INDEX IF NOT EXISTS seo_hreflang_maps_country_code_idx
  ON public.seo_hreflang_maps USING btree (country_code);
CREATE INDEX IF NOT EXISTS seo_hreflang_maps_url_idx
  ON public.seo_hreflang_maps USING btree (url);
CREATE INDEX IF NOT EXISTS seo_hreflang_maps_alternate_url_idx
  ON public.seo_hreflang_maps USING btree (alternate_url);
CREATE INDEX IF NOT EXISTS seo_hreflang_maps_status_idx
  ON public.seo_hreflang_maps USING btree (status);
CREATE INDEX IF NOT EXISTS seo_translations_country_code_idx
  ON public.seo_translations USING btree (country_code);
CREATE INDEX IF NOT EXISTS seo_translations_url_idx
  ON public.seo_translations USING btree (url);
CREATE INDEX IF NOT EXISTS seo_translations_translated_url_idx
  ON public.seo_translations USING btree (translated_url);
CREATE INDEX IF NOT EXISTS seo_translations_status_idx
  ON public.seo_translations USING btree (status);
CREATE INDEX IF NOT EXISTS seo_country_targets_country_code_idx
  ON public.seo_country_targets USING btree (country_code);
CREATE INDEX IF NOT EXISTS seo_country_targets_url_idx
  ON public.seo_country_targets USING btree (url);
CREATE INDEX IF NOT EXISTS seo_country_targets_status_idx
  ON public.seo_country_targets USING btree (status);
CREATE INDEX IF NOT EXISTS seo_reports_country_code_idx
  ON public.seo_reports USING btree (country_code);
CREATE INDEX IF NOT EXISTS seo_reports_url_idx
  ON public.seo_reports USING btree (url);
CREATE INDEX IF NOT EXISTS seo_reports_status_idx
  ON public.seo_reports USING btree (status);
CREATE INDEX IF NOT EXISTS seo_revenue_attribution_country_code_idx
  ON public.seo_revenue_attribution USING btree (country_code);
CREATE INDEX IF NOT EXISTS seo_revenue_attribution_url_idx
  ON public.seo_revenue_attribution USING btree (url);
CREATE INDEX IF NOT EXISTS seo_revenue_attribution_status_idx
  ON public.seo_revenue_attribution USING btree (status);
CREATE INDEX IF NOT EXISTS seo_revenue_attribution_period_idx
  ON public.seo_revenue_attribution USING btree (period_start, period_end);
CREATE INDEX IF NOT EXISTS seo_custom_dashboards_url_idx
  ON public.seo_custom_dashboards USING btree (url);
CREATE INDEX IF NOT EXISTS seo_custom_dashboards_status_idx
  ON public.seo_custom_dashboards USING btree (status);

ALTER TABLE public.seo_local_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_local_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_hreflang_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_country_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_revenue_attribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_custom_dashboards ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.seo_local_listings,
  public.seo_reviews,
  public.seo_local_citations,
  public.seo_hreflang_maps,
  public.seo_translations,
  public.seo_country_targets,
  public.seo_revenue_attribution,
  public.seo_custom_dashboards
FROM PUBLIC;

DO $$
DECLARE
  relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY[
    'seo_local_listings',
    'seo_reviews',
    'seo_local_citations',
    'seo_hreflang_maps',
    'seo_translations',
    'seo_country_targets',
    'seo_revenue_attribution',
    'seo_custom_dashboards'
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', relation_name);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', relation_name);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', relation_name);
    END IF;
  END LOOP;
END;
$$;

COMMIT;
