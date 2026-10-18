-- What Demo Sync has to be sure of before it calls a demo connected.
--
-- The relationship it synchronises is already canonical: demo-gateway serves
-- /demo/$slug by reading product_demo_urls directly, so there is nothing to
-- copy anywhere and nothing to keep in step. That is why this is a check and
-- not a copier, and why no table is added — a second store of "which demo
-- belongs to which product" is exactly the duplication the whole exercise is
-- avoiding.
--
-- What was missing is the answer to "is this demo actually reachable from the
-- marketplace, by the route a visitor takes". Several things can be true
-- separately and wrong together: a demo can be active while its product is
-- hidden, a product can hold a card slot while its demo points somewhere else,
-- and two active demos can exist for one product so that the one an operator
-- verified is not the one the gateway picks.
--
-- That last one is worth spelling out. demo-gateway takes status = 'active',
-- ordered by sort_order then created_at descending, and keeps the first. So
-- "this demo is active" does not mean "this demo is served". The check below
-- resolves the winner the same way the gateway does and says whether it is the
-- demo being asked about.
--
-- The HTTP half — that /demo/$slug answers, and answers with this address —
-- belongs to the worker, because it needs a request. This half is everything
-- the database can settle on its own.

CREATE OR REPLACE FUNCTION public.mm_demo_sync_check(p_demo uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_demo     record;
  v_product  record;
  v_served   uuid;
  v_actives  int;
  v_slots    int;
  v_checks   jsonb := '[]'::jsonb;
  v_failed   int;
BEGIN
  IF NOT public.mm_is_operator() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_permitted');
  END IF;

  SELECT * INTO v_demo FROM public.product_demo_urls WHERE id = p_demo;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_demo');
  END IF;

  SELECT p.id, p.slug, p.name, p.visible, p.content_status, p.category_id,
         c.slug AS category_slug, c.name AS category_name
    INTO v_product
    FROM public.marketplace_products p
    LEFT JOIN public.marketplace_categories c ON c.id = p.category_id
   WHERE p.id = v_demo.product_id;

  -- Resolved exactly the way demo-gateway resolves it.
  SELECT d.id INTO v_served
    FROM public.product_demo_urls d
   WHERE d.product_id = v_demo.product_id
     AND d.status = 'active'
   ORDER BY d.sort_order, d.created_at DESC
   LIMIT 1;

  SELECT count(*) INTO v_actives
    FROM public.product_demo_urls d
   WHERE d.product_id = v_demo.product_id AND d.status = 'active';

  SELECT count(*) INTO v_slots
    FROM public.marketplace_card_slots s
   WHERE s.current_product_id = v_demo.product_id;

  v_checks := jsonb_build_array(
    jsonb_build_object('key','demo_active','label','The demo is active',
      'passed', v_demo.status = 'active',
      'detail', format('status is %s', v_demo.status)),

    jsonb_build_object('key','demo_verified','label','The demo passed verification',
      'passed', v_demo.processing_status = 'live',
      'detail', format('processing status is %s', coalesce(v_demo.processing_status,'unset'))),

    jsonb_build_object('key','has_address','label','The demo has an address',
      'passed', coalesce(btrim(v_demo.url),'') <> '',
      'detail', coalesce(nullif(btrim(v_demo.url),''), 'no address')),

    jsonb_build_object('key','product_exists','label','The product exists',
      'passed', v_product.id IS NOT NULL,
      'detail', coalesce(v_product.name, 'the product this demo names is gone')),

    jsonb_build_object('key','product_public','label','The product is on the marketplace',
      'passed', coalesce(v_product.visible, false)
                AND lower(coalesce(v_product.content_status,'')) = 'published',
      'detail', format('visible %s, content %s',
                       coalesce(v_product.visible::text,'unknown'),
                       coalesce(v_product.content_status,'unknown'))),

    jsonb_build_object('key','category','label','The product has a category',
      'passed', v_product.category_id IS NOT NULL,
      'detail', coalesce(v_product.category_name, 'no category')),

    jsonb_build_object('key','card_slot','label','A card slot holds the product',
      'passed', v_slots > 0,
      'detail', format('%s slot(s)', v_slots)),

    -- The one that catches a demo which is active and still not the one served.
    jsonb_build_object('key','is_served','label','This is the demo the gateway serves',
      'passed', v_served = p_demo,
      'detail', CASE WHEN v_served = p_demo THEN 'yes'
                     WHEN v_served IS NULL THEN 'the product has no active demo'
                     ELSE format('another demo wins the ordering (%s of %s active)',
                                 v_served, v_actives) END)
  );

  SELECT count(*) INTO v_failed
    FROM jsonb_array_elements(v_checks) c
   WHERE NOT (c->>'passed')::boolean;

  RETURN jsonb_build_object(
    'ok', true,
    'demo_id', p_demo,
    'product_id', v_demo.product_id,
    'product_slug', v_product.slug,
    'category_slug', v_product.category_slug,
    'url', v_demo.url,
    -- The address a visitor would use, so the worker knows what to request
    -- without deciding the route for itself.
    'public_path', CASE WHEN v_product.slug IS NULL THEN NULL
                        ELSE '/demo/' || v_product.slug END,
    'active_demos_for_product', v_actives,
    'card_slots', v_slots,
    'checks', v_checks,
    'failed', v_failed,
    'ready', v_failed = 0);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.mm_demo_sync_check(uuid) TO PUBLIC;

COMMENT ON FUNCTION public.mm_demo_sync_check(uuid) IS
  'Everything the database can settle about whether a demo is reachable from the marketplace: the demo is active and verified, the product exists and is published, it has a category and a card slot, and this demo is the one demo-gateway would actually serve for it. Returns the public path so the worker can check the HTTP half without deciding the route itself.';
