-- Prevent concurrent crawler requests from multiplying load on the public site.
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS seo_crawl_jobs_one_running_per_domain_uidx
  ON public.seo_crawl_jobs USING btree (domain)
  WHERE status = 'running';

COMMIT;
