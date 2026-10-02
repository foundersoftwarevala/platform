-- Product Manager search without reading the whole catalogue.
--
-- The studio searches name, slug and industry_label with ilike '%term%'
-- (resource.ts products.searchable) and counts the matches for its range text.
-- Only name had a trigram index, so the OR across three columns could not use
-- any index: every search read all 7,365 rows twice, once for the page and
-- once for the count (about 18 ms and 15 ms median on 2026-10-03, growing with
-- the catalogue).
--
-- Measured in a rolled-back trial with these two indexes: the planner combines
-- them with the existing marketplace_products_name_trgm in a BitmapOr - page
-- 0.30 ms and count 0.27 ms median for "school". Sizes 752 kB and 368 kB.
-- Search results are unchanged; only the plan is.
--
-- CONCURRENTLY, so the table stays readable and writable while they build.
-- Run outside a transaction block.

create index concurrently if not exists marketplace_products_slug_trgm
  on public.marketplace_products using gin (slug gin_trgm_ops);

create index concurrently if not exists marketplace_products_industry_label_trgm
  on public.marketplace_products using gin (industry_label gin_trgm_ops);
