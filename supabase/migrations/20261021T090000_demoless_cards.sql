-- Which cards are waiting for a demo.
--
-- This is the one step of the Demo Manager's workflow that was genuinely
-- absent. Everything around it exists and is built well:
--
--   investigateDemo  fetches the address through an SSRF-guarded client,
--                    extracts the evidence, asks the AI API Manager through the
--                    gateway, and keeps only the findings whose value is
--                    actually present in the page — the rest are recorded as
--                    dropped, with a reason;
--   activateDemo     fetches again, applies the Software Vala presentation and
--                    refuses to go live unless the favicon is in place and none
--                    of the developer's contact details survive;
--   demo-gateway     serves /demo/$slug from product_demo_urls, which is what
--                    the marketplace card's demo button opens.
--
-- What no part of it could answer was "which card needs one?". An operator had
-- to know the product before submitting an address, because investigateDemo
-- takes a product id. So the pipeline could verify a demo beautifully and never
-- tell anyone where a demo was missing.
--
-- marketplace_card_slots holds 7,280 slots, every one of them occupied by a
-- product, and product_demo_urls holds one active demo. The gap is the whole
-- catalogue, which is exactly why this has to be a count in SQL and paged:
-- fetching the slots to compare them in the browser would be wrong on the first
-- page and hopeless by the seventieth.
--
-- A card counts as waiting when its product has no demo row with status
-- 'active', because status alone is what demo-gateway asks for when it serves
-- /demo/$slug. Matching the gateway rather than the pipeline matters: it means
-- a demo can reach the storefront without ever having passed the brand
-- verification, and the count says how many have. Today that is the single
-- demo on the platform: active, served, and never investigated.

CREATE OR REPLACE FUNCTION public.mm_demoless_cards(p_query jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_limit    int  := least(greatest(coalesce((p_query->>'limit')::int, 50), 1), 200);
  v_offset   int  := greatest(coalesce((p_query->>'offset')::int, 0), 0);
  v_category uuid := nullif(p_query->>'category_id', '')::uuid;
  v_search   text := nullif(btrim(coalesce(p_query->>'search', '')), '');
  v_total    bigint;
  v_rows     jsonb;
BEGIN
  IF NOT public.mm_is_operator() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_permitted');
  END IF;

  WITH waiting AS (
    SELECT s.id, s.category_id, s.slot_no, s.country_code, s.slot_title, s.slot_url,
           s.current_product_id, p.name AS product_name, p.slug AS product_slug,
           c.name AS category_name
      FROM public.marketplace_card_slots s
      JOIN public.marketplace_products p ON p.id = s.current_product_id
      LEFT JOIN public.marketplace_categories c ON c.id = s.category_id
     WHERE s.current_product_id IS NOT NULL
       AND (v_category IS NULL OR s.category_id = v_category)
       AND (v_search IS NULL OR p.name ILIKE '%' || v_search || '%'
                             OR s.slot_title ILIKE '%' || v_search || '%')
       AND NOT EXISTS (
             SELECT 1 FROM public.product_demo_urls d
              WHERE d.product_id = s.current_product_id
                AND d.status = 'active')
  )
  SELECT count(*) INTO v_total FROM waiting;

  WITH waiting AS (
    SELECT s.id, s.category_id, s.slot_no, s.country_code, s.slot_title, s.slot_url,
           s.current_product_id, p.name AS product_name, p.slug AS product_slug,
           c.name AS category_name,
           -- An address that was submitted but never verified is worth showing:
           -- it is the difference between "nobody has tried" and "it failed".
           (SELECT d.processing_status FROM public.product_demo_urls d
             WHERE d.product_id = s.current_product_id
             ORDER BY d.sort_order, d.created_at LIMIT 1) AS pending_status,
           (SELECT d.url FROM public.product_demo_urls d
             WHERE d.product_id = s.current_product_id
             ORDER BY d.sort_order, d.created_at LIMIT 1) AS pending_url
      FROM public.marketplace_card_slots s
      JOIN public.marketplace_products p ON p.id = s.current_product_id
      LEFT JOIN public.marketplace_categories c ON c.id = s.category_id
     WHERE s.current_product_id IS NOT NULL
       AND (v_category IS NULL OR s.category_id = v_category)
       AND (v_search IS NULL OR p.name ILIKE '%' || v_search || '%'
                             OR s.slot_title ILIKE '%' || v_search || '%')
       AND NOT EXISTS (
             SELECT 1 FROM public.product_demo_urls d
              WHERE d.product_id = s.current_product_id
                AND d.status = 'active')
     ORDER BY c.name NULLS LAST, s.slot_no
     LIMIT v_limit OFFSET v_offset
  )
  SELECT coalesce(jsonb_agg(to_jsonb(w)), '[]'::jsonb) INTO v_rows FROM waiting w;

  RETURN jsonb_build_object(
    'ok', true,
    'total', v_total,
    'limit', v_limit,
    'offset', v_offset,
    'cards', v_rows,
    -- The denominator, so the number above is readable without a second query.
    'slots_total', (SELECT count(*) FROM public.marketplace_card_slots
                     WHERE current_product_id IS NOT NULL),
    'connected', (SELECT count(DISTINCT s.id)
                    FROM public.marketplace_card_slots s
                    JOIN public.product_demo_urls d
                      ON d.product_id = s.current_product_id
                     AND d.status = 'active'),
    -- Of the connected ones, how many actually went through investigate and
    -- activate. The gap between these two numbers is demos the storefront
    -- serves that no brand check has ever looked at.
    'verified', (SELECT count(DISTINCT s.id)
                   FROM public.marketplace_card_slots s
                   JOIN public.product_demo_urls d
                     ON d.product_id = s.current_product_id
                    AND d.status = 'active'
                    AND d.processing_status = 'live'));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.mm_demoless_cards(jsonb) TO PUBLIC;

COMMENT ON FUNCTION public.mm_demoless_cards(jsonb) IS
  'Card slots whose product has no live demo, paged and counted in SQL. Takes {limit, offset, category_id, search}. A demo counts as connected only when it is both status active and processing_status live, because that is what the marketplace will serve; a submitted-but-unverified address is reported as pending instead.';
