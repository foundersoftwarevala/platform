-- mm_row_analytics: operators only.
--
-- The function is SECURITY DEFINER, executable by anon and authenticated, and
-- had no caller check, so anyone holding the publishable key could POST
-- /rest/v1/rpc/mm_row_analytics with a category slug and read that category's
-- paid order count and revenue. Every other Marketplace Manager read refuses a
-- caller public.mm_is_operator() does not accept; this one now does the same,
-- with the same refusal shape the others use. The body is otherwise unchanged
-- from the live definition.
--
-- The server function in front of it (getRowAnalytics in
-- src/lib/marketplace-manager/rows.functions.ts) already checks the caller, so
-- the Marketplace Manager screen behaves the same before and after this runs.

CREATE OR REPLACE FUNCTION public.mm_row_analytics(p_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_cat uuid; v_views bigint; v_demo bigint; v_cta bigint; v_orders bigint; v_rev numeric;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select id into v_cat from public.marketplace_categories where slug = p_key;
  if v_cat is null then return jsonb_build_object('ok', false, 'reason', 'unknown_row'); end if;

  select count(*) filter (where event_type::text = 'product_view'),
         count(*) filter (where event_type::text = 'demo_click'),
         count(*) filter (where event_type::text = 'cta_click')
    into v_views, v_demo, v_cta
  from public.marketplace_events where category_id = v_cat;

  select count(distinct o.id), coalesce(sum(oi.line_total),0)
    into v_orders, v_rev
  from public.marketplace_order_items oi
  join public.marketplace_orders o on o.id = oi.order_id and o.status::text = 'paid'
  join public.marketplace_products p on p.id = oi.product_id
  where p.category_id = v_cat;

  return jsonb_build_object(
    'ok', true, 'row', p_key,
    'product_views', v_views, 'demo_opens', v_demo, 'cta_clicks', v_cta,
    'orders', v_orders, 'revenue', v_rev,
    -- Returned as null rather than 0 when there is nothing to divide by, so
    -- the UI shows "not measured yet" instead of a confident 0.0%.
    'ctr', case when coalesce(v_views,0) > 0
                then round((coalesce(v_demo,0) + coalesce(v_cta,0))::numeric * 100 / v_views, 2)
                else null end,
    'conversion', case when coalesce(v_views,0) > 0
                       then round(coalesce(v_orders,0)::numeric * 100 / v_views, 2)
                       else null end,
    'measured_from', (select min(created_at) from public.marketplace_events where category_id = v_cat));
end $function$;

-- Nothing anonymous has a reason to call it.
REVOKE EXECUTE ON FUNCTION public.mm_row_analytics(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mm_row_analytics(text) TO authenticated, service_role;
