-- Foundation storage for the Backlinks, Technical SEO, and Keywords phases.
-- Existing seo_backlinks, seo_competitors, and seo_keywords tables are retained.

BEGIN;

CREATE TABLE IF NOT EXISTS public.seo_referring_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL UNIQUE,
  backlinks_count integer NOT NULL DEFAULT 0 CHECK (backlinks_count >= 0),
  first_seen_at timestamptz,
  last_checked_at timestamptz,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'lost', 'error')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_crawl_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  url text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  pages_scanned integer NOT NULL DEFAULT 0 CHECK (pages_scanned >= 0),
  pages_total integer CHECK (pages_total IS NULL OR pages_total >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_broken_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  url text NOT NULL,
  source_url text,
  http_status smallint CHECK (http_status IS NULL OR http_status BETWEEN 100 AND 599),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'fixed', 'ignored', 'error')),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_redirects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  source_url text NOT NULL,
  target_url text NOT NULL,
  redirect_type smallint NOT NULL DEFAULT 301 CHECK (redirect_type IN (301, 302, 307, 308)),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_core_web_vitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  url text NOT NULL,
  device text NOT NULL DEFAULT 'mobile' CHECK (device IN ('mobile', 'desktop')),
  lcp_ms integer CHECK (lcp_ms IS NULL OR lcp_ms >= 0),
  inp_ms integer CHECK (inp_ms IS NULL OR inp_ms >= 0),
  cls numeric(8, 5) CHECK (cls IS NULL OR cls >= 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'good', 'needs_improvement', 'poor', 'error')),
  measured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL,
  domain text NOT NULL,
  url text,
  country text NOT NULL DEFAULT 'global',
  position integer CHECK (position IS NULL OR position > 0),
  previous_position integer CHECK (previous_position IS NULL OR previous_position > 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'tracking', 'available', 'error')),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_search_volume (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL,
  domain text,
  country text NOT NULL DEFAULT 'global',
  search_volume bigint CHECK (search_volume IS NULL OR search_volume >= 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'available', 'error')),
  measured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Existing backlink and keyword tables need dedicated lookup/status indexes.
CREATE INDEX IF NOT EXISTS seo_backlinks_source_domain_idx
  ON public.seo_backlinks USING btree (source_domain);
CREATE INDEX IF NOT EXISTS seo_backlinks_source_url_idx
  ON public.seo_backlinks USING btree (source_url);
CREATE INDEX IF NOT EXISTS seo_backlinks_target_url_idx
  ON public.seo_backlinks USING btree (target_url);
CREATE INDEX IF NOT EXISTS seo_backlinks_status_idx
  ON public.seo_backlinks USING btree (status);
CREATE INDEX IF NOT EXISTS seo_keywords_keyword_idx
  ON public.seo_keywords USING btree (keyword);
CREATE INDEX IF NOT EXISTS seo_keywords_status_idx
  ON public.seo_keywords USING btree (status);

CREATE INDEX IF NOT EXISTS seo_referring_domains_status_idx
  ON public.seo_referring_domains USING btree (status);
CREATE INDEX IF NOT EXISTS seo_crawl_jobs_domain_idx
  ON public.seo_crawl_jobs USING btree (domain);
CREATE INDEX IF NOT EXISTS seo_crawl_jobs_url_idx
  ON public.seo_crawl_jobs USING btree (url);
CREATE INDEX IF NOT EXISTS seo_crawl_jobs_status_idx
  ON public.seo_crawl_jobs USING btree (status);
CREATE INDEX IF NOT EXISTS seo_broken_links_domain_idx
  ON public.seo_broken_links USING btree (domain);
CREATE INDEX IF NOT EXISTS seo_broken_links_url_idx
  ON public.seo_broken_links USING btree (url);
CREATE INDEX IF NOT EXISTS seo_broken_links_source_url_idx
  ON public.seo_broken_links USING btree (source_url);
CREATE INDEX IF NOT EXISTS seo_broken_links_status_idx
  ON public.seo_broken_links USING btree (status);
CREATE INDEX IF NOT EXISTS seo_redirects_domain_idx
  ON public.seo_redirects USING btree (domain);
CREATE INDEX IF NOT EXISTS seo_redirects_source_url_idx
  ON public.seo_redirects USING btree (source_url);
CREATE INDEX IF NOT EXISTS seo_redirects_target_url_idx
  ON public.seo_redirects USING btree (target_url);
CREATE INDEX IF NOT EXISTS seo_redirects_status_idx
  ON public.seo_redirects USING btree (status);
CREATE UNIQUE INDEX IF NOT EXISTS seo_redirects_active_source_uidx
  ON public.seo_redirects USING btree (domain, source_url)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS seo_core_web_vitals_domain_idx
  ON public.seo_core_web_vitals USING btree (domain);
CREATE INDEX IF NOT EXISTS seo_core_web_vitals_url_idx
  ON public.seo_core_web_vitals USING btree (url);
CREATE INDEX IF NOT EXISTS seo_core_web_vitals_status_idx
  ON public.seo_core_web_vitals USING btree (status);
CREATE INDEX IF NOT EXISTS seo_core_web_vitals_measured_at_idx
  ON public.seo_core_web_vitals USING btree (measured_at DESC);
CREATE INDEX IF NOT EXISTS seo_rankings_keyword_idx
  ON public.seo_rankings USING btree (keyword);
CREATE INDEX IF NOT EXISTS seo_rankings_domain_idx
  ON public.seo_rankings USING btree (domain);
CREATE INDEX IF NOT EXISTS seo_rankings_url_idx
  ON public.seo_rankings USING btree (url);
CREATE INDEX IF NOT EXISTS seo_rankings_status_idx
  ON public.seo_rankings USING btree (status);
CREATE INDEX IF NOT EXISTS seo_rankings_keyword_country_recorded_idx
  ON public.seo_rankings USING btree (keyword, country, recorded_at DESC);
CREATE INDEX IF NOT EXISTS seo_search_volume_keyword_idx
  ON public.seo_search_volume USING btree (keyword);
CREATE INDEX IF NOT EXISTS seo_search_volume_domain_idx
  ON public.seo_search_volume USING btree (domain);
CREATE INDEX IF NOT EXISTS seo_search_volume_status_idx
  ON public.seo_search_volume USING btree (status);
CREATE INDEX IF NOT EXISTS seo_search_volume_keyword_country_measured_idx
  ON public.seo_search_volume USING btree (keyword, country, measured_at DESC);

ALTER TABLE public.seo_referring_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_crawl_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_broken_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_redirects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_core_web_vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_search_volume ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.seo_referring_domains,
  public.seo_crawl_jobs,
  public.seo_broken_links,
  public.seo_redirects,
  public.seo_core_web_vitals,
  public.seo_rankings,
  public.seo_search_volume
FROM PUBLIC;

DO $$
DECLARE
  relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY[
    'seo_referring_domains',
    'seo_crawl_jobs',
    'seo_broken_links',
    'seo_redirects',
    'seo_core_web_vitals',
    'seo_rankings',
    'seo_search_volume'
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
