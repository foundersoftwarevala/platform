-- Who brought this order in.
--
-- marketplace_order_attributions has carried the whole partner chain all along
-- — reseller_id, affiliate_partner_id, influencer_profile_id, the attribution
-- method and the click that started it — and nothing in Marketplace Manager
-- has ever shown any of it. Four orders are attributed today; an operator
-- looking at one of them sees the customer and the products and no sign that
-- somebody was owed credit for it.
--
-- This is deliberately a separate, additive function rather than a change to
-- mm_orders_list or mm_order_detail. Both of those work, both are read on
-- every Orders Center page load, and neither needed rewriting to answer a
-- question about one open order. A new small function costs one query in the
-- detail drawer and risks nothing that is already serving.
--
-- Names are resolved here rather than in the browser, so the drawer shows
-- "Acme Resellers" instead of a uuid, and so an operator without rights to
-- the reseller tables still cannot read them through this.

CREATE OR REPLACE FUNCTION public.mm_order_partners(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v jsonb;
BEGIN
  IF NOT public.mm_is_operator() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_permitted');
  END IF;

  SELECT coalesce(jsonb_agg(row ORDER BY row->>'attributed_at' DESC), '[]'::jsonb)
    INTO v
    FROM (
      SELECT jsonb_build_object(
        'id',            a.id,
        'method',        a.attribution_method,
        'attributed_at', a.attributed_at,
        'click_id',      a.click_id,
        -- Each partner resolved to the name an operator would recognise, with
        -- its own id kept so the row can be followed to the owning module.
        'reseller',      CASE WHEN a.reseller_id IS NULL THEN NULL ELSE
                           jsonb_build_object(
                             'id', a.reseller_id,
                             'name', coalesce(r.company_name, r.name, r.legal_name, 'unnamed reseller'),
                             'code', r.code,
                             'status', r.status) END,
        'affiliate',     CASE WHEN a.affiliate_partner_id IS NULL THEN NULL ELSE
                           jsonb_build_object(
                             'id', a.affiliate_partner_id,
                             'name', coalesce(ap.display_name, 'unnamed partner'),
                             'status', ap.status) END,
        'influencer',    CASE WHEN a.influencer_profile_id IS NULL THEN NULL ELSE
                           jsonb_build_object(
                             'id', a.influencer_profile_id,
                             'name', coalesce(ip.full_name, 'unnamed influencer'),
                             'status', ip.status) END
      ) AS row
      FROM public.marketplace_order_attributions a
      LEFT JOIN public.resellers r                      ON r.id  = a.reseller_id
      LEFT JOIN public.marketplace_affiliate_partners ap ON ap.id = a.affiliate_partner_id
      LEFT JOIN public.influencer_profiles ip            ON ip.id = a.influencer_profile_id
     WHERE a.order_id = p_order_id
    ) s;

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', p_order_id,
    'attributions', v,
    -- Zero is the normal case and is worth saying out loud: most orders arrive
    -- without a partner, and a drawer that renders nothing leaves the reader
    -- unsure whether it looked.
    'count', jsonb_array_length(v));
END
$$;

REVOKE ALL ON FUNCTION public.mm_order_partners(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mm_order_partners(uuid) TO service_role;

COMMENT ON FUNCTION public.mm_order_partners(uuid) IS
  'The reseller, affiliate or influencer credited with an order, resolved to names. Returns an empty list for a direct order rather than nothing.';
