-- Revenue over time, from the same rows the dashboard already totals.
--
-- The control room showed "Revenue graph renders when transactions stream in"
-- in a dashed box. Transactions had streamed in — 2,490.00 gross across the
-- order lines, 249.00 refunded — and the box still said that, because nothing
-- behind it had ever been written.
--
-- This is the missing half. It is deliberately not a new financial view: the
-- arithmetic is character for character what mm_dashboard does, so a bar in
-- the graph and the number in the panel above it can never disagree.
--
--     gross   sum(marketplace_order_items.line_total)
--     refunds sum(marketplace_order_refunds.amount)
--     net     gross - refunds
--
-- Refunds are attributed to the day the refund was recorded rather than the
-- day of the order it reverses. That is the honest choice for a graph read as
-- "what happened this week": money left on the day it left. It also means the
-- series and the panel agree on totals, because both count every refund once.
--
-- Buckets follow the range, so a day is read in hours and a year in months:
--
--     today   24 hourly buckets
--     week     7 daily buckets
--     month   daily, from the 1st
--     year    12 monthly buckets
--
-- Every bucket in the range is returned, including the empty ones. A graph
-- that silently drops quiet days draws a busier marketplace than exists.

CREATE OR REPLACE FUNCTION public.mm_revenue_series(p_range text DEFAULT 'month')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_from      timestamptz;
  v_step      interval;
  v_unit      text;
  v_currency  text;
  v_points    jsonb;
  v_any       boolean;
BEGIN
  -- The same gate as every other control-room figure.
  IF NOT public.mm_is_operator() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_permitted');
  END IF;

  CASE lower(coalesce(p_range, 'month'))
    WHEN 'today' THEN v_from := date_trunc('day',   now()); v_step := interval '1 hour';  v_unit := 'hour';
    WHEN 'week'  THEN v_from := date_trunc('week',  now()); v_step := interval '1 day';   v_unit := 'day';
    WHEN 'month' THEN v_from := date_trunc('month', now()); v_step := interval '1 day';   v_unit := 'day';
    WHEN 'year'  THEN v_from := date_trunc('year',  now()); v_step := interval '1 month'; v_unit := 'month';
    ELSE RETURN jsonb_build_object(
      'ok', false, 'reason', 'unknown_range',
      'message', 'Range must be today, week, month or year.');
  END CASE;

  SELECT coalesce(max(o.currency::text), 'INR'), count(*) > 0
    INTO v_currency, v_any
    FROM public.marketplace_orders o;

  WITH buckets AS (
    SELECT generate_series(v_from, now(), v_step) AS bucket
  ),
  gross AS (
    SELECT date_trunc(v_unit, o.created_at) AS bucket,
           sum(oi.line_total)               AS amount,
           count(DISTINCT o.id)             AS orders
      FROM public.marketplace_orders o
      JOIN public.marketplace_order_items oi ON oi.order_id = o.id
     -- Paid only, exactly as mm_dashboard counts it. Leaving this out was
     -- caught by reconciling the two: the series read 5,976.00 against the
     -- panel's 2,490.00, because every unpaid basket was being counted as
     -- money taken.
     WHERE o.status::text = 'paid'
       AND o.created_at >= v_from
     GROUP BY 1
  ),
  refunds AS (
    SELECT date_trunc(v_unit, r.created_at) AS bucket,
           sum(r.amount)                    AS amount,
           count(*)                         AS refunds
      FROM public.marketplace_order_refunds r
     WHERE r.created_at >= v_from
     GROUP BY 1
  )
  SELECT jsonb_agg(
           jsonb_build_object(
             'at',      b.bucket,
             'gross',   coalesce(g.amount, 0),
             'refunds', coalesce(f.amount, 0),
             'net',     coalesce(g.amount, 0) - coalesce(f.amount, 0),
             'orders',  coalesce(g.orders, 0)
           ) ORDER BY b.bucket
         )
    INTO v_points
    FROM buckets b
    LEFT JOIN gross   g ON g.bucket = b.bucket
    LEFT JOIN refunds f ON f.bucket = b.bucket;

  RETURN jsonb_build_object(
    'ok',       true,
    'range',    lower(coalesce(p_range, 'month')),
    'unit',     v_unit,
    'from',     v_from,
    'currency', v_currency,
    -- Distinct from "every bucket is zero": one means the marketplace has
    -- never sold anything, the other that this particular window was quiet.
    'has_transactions', coalesce(v_any, false),
    'points',   coalesce(v_points, '[]'::jsonb)
  );
END
$$;

REVOKE ALL ON FUNCTION public.mm_revenue_series(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mm_revenue_series(text) TO service_role;

COMMENT ON FUNCTION public.mm_revenue_series(text) IS
  'Revenue per bucket over a range, from the same order lines and refunds mm_dashboard totals. Empty buckets are returned, not dropped.';
