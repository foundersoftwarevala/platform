-- Fifteen pairs of identical indexes, one of each dropped.
--
-- Two indexes with the same definition on the same table do not make reads
-- faster; the planner uses one and the other is paid for on every insert,
-- update and delete, and in every backup. On marketplace_products the pair is
-- 30 MB each - the same GIN index on search_keywords under two names - so the
-- catalogue was carrying 30 MB and half its write cost for nothing.
--
-- Nothing is lost. Each pair is identical by definition, so for every one of
-- these an index with exactly the same definition remains. Which one to keep
-- was decided, in order:
--
--   1. where one index backs a UNIQUE constraint, the constraint's index stays
--      and the loose duplicate goes - dropping the other way would either fail
--      or quietly remove the constraint's enforcement;
--   2. otherwise the name following this schema's own convention stays
--      (<table>_<columns>_idx, or the mp_ prefix used elsewhere on the
--      marketplace tables) and the ad-hoc idx_<table>_<column> twin goes.
--
-- Done as a migration rather than by hand so a replay from empty ends in the
-- same place, and so the reasoning sits with the change.
--
-- One naming problem is left alone deliberately: both marketplace_products
-- indexes are GIN on search_keywords, and neither name says so - one claims to
-- be about education search, the other about country. Renaming an index is a
-- separate decision from removing a duplicate, so the surviving name is
-- untouched.

-- Backed by a UNIQUE constraint: keep the constraint's index.
drop index if exists public.mkt_ent_order_item_uq;      -- = marketplace_entitlements_order_item_id_key
drop index if exists public.mhs_key_unique;             -- = marketplace_homepage_sections_key_key
drop index if exists public.mkt_licenses_key_uq;        -- = marketplace_licenses_license_key_key
drop index if exists public.seo_pages_url_uq;           -- = seo_pages_url_key

-- The 30 MB pair. Both are GIN on search_keywords; mp_country_idx survives.
drop index if exists public.marketplace_products_education_search_idx;

-- Plain duplicates, ad-hoc name dropped.
drop index if exists public.idx_developer_tasks_tm;     -- = developer_tasks_tm_task_id_unique
drop index if exists public.idx_mkt_audit_created;      -- = marketing_audit_created_idx
drop index if exists public.idx_mkt_campaigns_status;   -- = marketing_campaigns_status_idx
drop index if exists public.mp_events_product_idx;      -- = marketplace_events_product_idx

drop index if exists public.idx_tm_tasks_assigned;      -- = tm_tasks_assigned_to_idx
drop index if exists public.idx_tm_tasks_deadline;      -- = tm_tasks_deadline_idx
drop index if exists public.idx_tm_tasks_created;       -- = tm_tasks_created_at_idx
drop index if exists public.idx_tm_tasks_module;        -- = tm_tasks_module_idx
drop index if exists public.idx_tm_tasks_status;        -- = tm_tasks_status_idx
drop index if exists public.idx_tm_tasks_priority;      -- = tm_tasks_priority_idx
