-- Indexes the live database is missing (fresh scan of sv_platform, 2026-10-03).
--
-- * i18n_translation_jobs (≈440,000 rows): the worker claims queued jobs by
--   priority, run_after and created_at. The partial index for that, defined in
--   20260919010000, is not present live, so every claim scans the table. The
--   three foreign-key columns are unindexed as well.
-- * marketplace_translations (≈261,000 rows) reviewed_by / source_language and
--   marketplace_products approved_by: foreign keys without an index.
-- * seo_pages.url and marketplace_homepage_sections.key: the unique indexes
--   their migrations define are missing live; both have 0 duplicates today.
--   (resellers.user_id is already unique under another index;
--   mkt_ent_order_item_uq was retired in favour of a key constraint.)
--
-- CONCURRENTLY: tables stay readable and writable while these build. Run
-- outside a transaction block.

create index concurrently if not exists i18n_translation_jobs_claim_idx
  on public.i18n_translation_jobs (priority, run_after, created_at)
  where status = 'queued';
create index concurrently if not exists i18n_translation_jobs_requested_by_idx
  on public.i18n_translation_jobs (requested_by);
create index concurrently if not exists i18n_translation_jobs_source_language_idx
  on public.i18n_translation_jobs (source_language);
create index concurrently if not exists i18n_translation_jobs_target_language_idx
  on public.i18n_translation_jobs (target_language);

create index concurrently if not exists marketplace_translations_reviewed_by_idx
  on public.marketplace_translations (reviewed_by);
create index concurrently if not exists marketplace_translations_source_language_idx
  on public.marketplace_translations (source_language);
create index concurrently if not exists marketplace_products_approved_by_idx
  on public.marketplace_products (approved_by);

create unique index concurrently if not exists seo_pages_url_uq
  on public.seo_pages (url);
create unique index concurrently if not exists mhs_key_unique
  on public.marketplace_homepage_sections (key);
