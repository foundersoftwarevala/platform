-- Product Manager's list and "recent" panels, without sorting the catalogue.
--
-- The list pages through marketplace_products ordered by (sort_order, id) and
-- the dashboard reads the newest products by created_at. Neither order had an
-- index (the existing mp_row_idx is partial - published rows only - and leads
-- with category_id), so every request sorted all 7,365 rows.
--
-- Measured in a rolled-back trial on 2026-10-02: first page 0.58 ms with the
-- index (index scan), newest four 0.19 ms (backward index scan) against 5.3 ms.
-- Deeper pages still choose a sequential scan at this table size, which is the
-- planner's correct call; the index keeps the common first pages flat as the
-- catalogue grows.
--
-- CONCURRENTLY, so the table stays readable and writable while they build.
-- Run outside a transaction block.

create index concurrently if not exists marketplace_products_sort_order_id_idx
  on public.marketplace_products (sort_order, id);

create index concurrently if not exists marketplace_products_created_at_idx
  on public.marketplace_products (created_at);
