BEGIN;

DROP POLICY IF EXISTS "demo_clicks anyone insert" ON public.demo_clicks;
REVOKE INSERT ON TABLE public.demo_clicks FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.mm_record_public_demo_click(
  p_product_id uuid,
  p_demo_url_id uuid,
  p_source_page text,
  p_referrer text,
  p_device_type text,
  p_browser text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF length(coalesce(p_source_page, '')) > 500
     OR length(coalesce(p_referrer, '')) > 2000
     OR length(coalesce(p_device_type, '')) > 80
     OR length(coalesce(p_browser, '')) > 120 THEN
    RAISE EXCEPTION 'Demo click metadata exceeds the allowed length.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.product_demo_urls d
    WHERE d.id = p_demo_url_id
      AND d.product_id = p_product_id
      AND d.status = 'active'
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO public.demo_clicks (
    product_id,
    demo_url_id,
    source_page,
    referrer,
    device_type,
    browser
  )
  VALUES (
    p_product_id,
    p_demo_url_id,
    p_source_page,
    p_referrer,
    p_device_type,
    p_browser
  );

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.mm_record_public_demo_click(uuid, uuid, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mm_record_public_demo_click(uuid, uuid, text, text, text, text)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.mm_recover_marketplace_catalogue(
  p_actor_id uuid,
  p_products jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_item jsonb;
  v_product public.marketplace_products%ROWTYPE;
  v_downloads integer;
  v_rating numeric;
  v_inserted integer := 0;
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'Recovery actor is required.';
  END IF;
  IF jsonb_typeof(p_products) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Recovery requires a bounded, non-empty product list.';
  END IF;
  IF jsonb_array_length(p_products) = 0
     OR jsonb_array_length(p_products) > 25 THEN
    RAISE EXCEPTION 'Recovery requires a bounded, non-empty product list.';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_products)
  LOOP
    IF jsonb_typeof(v_item) <> 'object'
       OR nullif(v_item ->> 'slug', '') IS NULL
       OR nullif(v_item ->> 'name', '') IS NULL THEN
      RAISE EXCEPTION 'Recovery product is missing its slug or name.';
    END IF;

    v_downloads := (v_item ->> 'downloads')::integer;
    v_rating := (v_item ->> 'rating')::numeric;
    IF v_downloads IS NULL
       OR v_rating IS NULL
       OR v_downloads < 0
       OR v_rating < 0
       OR v_rating > 5 THEN
      RAISE EXCEPTION 'Recovery product contains invalid metrics.';
    END IF;

    INSERT INTO public.marketplace_products (
      slug,
      name,
      industry_label,
      category_id,
      icon,
      price_label,
      price_period,
      rating,
      downloads,
      downloads_label,
      badge,
      is_featured,
      is_trending,
      is_best_seller,
      is_new_release,
      is_ai,
      visible,
      sort_order
    )
    VALUES (
      v_item ->> 'slug',
      v_item ->> 'name',
      v_item ->> 'name',
      nullif(v_item ->> 'category_id', '')::uuid,
      'Sparkles',
      v_item ->> 'price_label',
      'lifetime',
      v_rating,
      v_downloads,
      (floor(v_downloads / 1000.0)::integer)::text || 'k',
      nullif(v_item ->> 'badge', ''),
      coalesce((v_item ->> 'is_featured')::boolean, false),
      coalesce((v_item ->> 'is_trending')::boolean, false),
      false,
      (v_item ->> 'badge') = 'NEW',
      false,
      true,
      (v_item ->> 'sort_order')::integer
    )
    ON CONFLICT DO NOTHING
    RETURNING * INTO v_product;

    IF FOUND THEN
      INSERT INTO public.marketplace_audit_logs (
        actor_id,
        action,
        entity_type,
        entity_id,
        after_state,
        metadata
      )
      VALUES (
        p_actor_id,
        'marketplace.recovery.product_inserted',
        'marketplace_product',
        v_product.id,
        to_jsonb(v_product),
        jsonb_build_object('source', 'recoverMarketplaceData')
      );
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('productsInserted', v_inserted);
END;
$function$;

REVOKE ALL ON FUNCTION public.mm_recover_marketplace_catalogue(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mm_recover_marketplace_catalogue(uuid, jsonb)
  TO service_role;

COMMIT;
