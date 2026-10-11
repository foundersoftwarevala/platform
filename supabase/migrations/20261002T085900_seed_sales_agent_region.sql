-- Give the seeded sales-intelligence agent a region before the sales workforce
-- constraint arrives.
--
-- 20260929T090000_worker_agents.sql seeds 'sales-intelligence' with
-- specialization 'SALES' and no region. 20261002T090000_sales_workforce.sql
-- then adds ai_agents_sales_has_region, which requires a region on every SALES
-- agent, so on a database built from these migrations that constraint fails on
-- the seeded row. On the VPS and the cloud project the region was set to
-- 'GLOBAL' by hand; this records that value so a fresh build gets the same row.
--
-- It is timestamped to run between those two migrations, which is the only
-- place it can help. The region column is added here if missing because it is
-- otherwise created by sales_workforce itself; that migration's
-- ADD COLUMN IF NOT EXISTS then leaves it as it is.
--
-- Idempotent and a no-op where the region is already set (VPS, cloud): it
-- touches at most one row and only when that row has no region.

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS region text;

UPDATE public.ai_agents
   SET region = 'GLOBAL'
 WHERE agent_key = 'sales-intelligence'
   AND region IS NULL;
