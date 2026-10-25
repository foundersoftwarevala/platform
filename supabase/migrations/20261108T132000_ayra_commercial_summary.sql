-- Read-only, aggregate-only retrieval scoped to auth.uid() wherever verified
-- ownership exists. Unmapped Sales and Lead sources are intentionally omitted.
CREATE OR REPLACE FUNCTION public.ayra_commercial_summary()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT jsonb_build_object(
    'measured_at', statement_timestamp(),
    'sales_deals', '[]'::jsonb,
    'sales_leads', '[]'::jsonb,
    'lead_manager_leads', '[]'::jsonb,
    'unavailable_sources', jsonb_build_array(
      'Sales deals and sales leads have no verified auth.users ownership mapping.',
      'Lead Manager leads are assigned to lead_agents, which have no verified auth.users mapping.'
    ),
    'marketplace_orders', (
      SELECT COALESCE(
        jsonb_agg(jsonb_build_object(
          'status', grouped.status,
          'currency', grouped.currency,
          'count', grouped.record_count,
          'total', grouped.recorded_total::text
        ) ORDER BY grouped.currency, grouped.status),
        '[]'::jsonb
      )
      FROM (
        SELECT status, currency, count(*) AS record_count, sum(total) AS recorded_total
        FROM public.marketplace_orders
        WHERE buyer_id = auth.uid()
          AND soft_delete_flag = false
        GROUP BY status, currency
      ) AS grouped
    ),
    'tasks', (
      SELECT COALESCE(
        jsonb_agg(jsonb_build_object(
          'status', grouped.status,
          'count', grouped.record_count,
          'overdue', grouped.overdue_count
        ) ORDER BY grouped.status),
        '[]'::jsonb
      )
      FROM (
        SELECT
          status,
          count(*) AS record_count,
          count(*) FILTER (
            WHERE deadline < statement_timestamp()
              AND status NOT IN ('completed', 'cancelled', 'closed')
          ) AS overdue_count
        FROM public.tm_tasks
        WHERE created_by = auth.uid()
          OR assigned_to = public.tm_my_member_id()
        GROUP BY status
      ) AS grouped
    )
  );
$function$;

REVOKE ALL ON FUNCTION public.ayra_commercial_summary() FROM PUBLIC;

DO $grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ayra_commercial_summary() FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ayra_commercial_summary() TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ayra_commercial_summary() FROM service_role';
  END IF;
END
$grant$;

COMMENT ON FUNCTION public.ayra_commercial_summary() IS
  'Returns aggregates only for marketplace orders bought by auth.uid() and tasks created by or assigned to auth.uid(); sales and lead aggregates remain unavailable until verified auth.users ownership mappings exist.';
