-- Retire only the known stale recommendation notes after the live readiness
-- check confirms that each corresponding signal is now present. Other manual
-- blocks and the not-yet-wired saved-products engine remain untouched.
UPDATE public.marketplace_recommendation_configs AS config
SET blocked_reason = NULL,
    updated_at = now()
WHERE config.blocked_reason IS NOT NULL
  AND (
    (
      config.key = 'recommended-for-you'
      AND config.blocked_reason ILIKE '%no user_id%'
    )
    OR (
      config.key = 'recently-viewed'
      AND (
        config.blocked_reason ILIKE '%no user_id%'
        OR config.blocked_reason ILIKE '%no session_id%'
      )
    )
    OR (
      config.key = 'continue-browsing'
      AND config.blocked_reason ILIKE '%session continuity%'
    )
  )
  AND coalesce(
    (public.mm_recommendation_readiness(config.key)->>'ready')::boolean,
    false
  );

-- Best-selling is a ranking, not a requirement that every product have a
-- previous paid order. Keep genuine sales and editorial best-seller flags at
-- the top, then fill remaining positions from the published catalogue.
CREATE OR REPLACE FUNCTION public.mm_row_products(p_key text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  rw record;
  v_out jsonb := '[]'::jsonb;
  v_taken uuid[];
  r record;
  i int;
BEGIN
  SELECT * INTO rw FROM public.mm_row_resolve(p_key);
  IF rw.row_id IS NULL AND rw.category_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_row');
  END IF;

  IF rw.source_mode IN ('manual', 'hybrid') THEN
    FOR r IN
      SELECT s.position, s.product_id, s.pinned, p.name, p.slug, p.thumbnail_url,
             p.visible, p.content_status
      FROM public.marketplace_row_slots s
      JOIN public.marketplace_products p ON p.id = s.product_id
      WHERE (s.row_id = rw.row_id
             OR (rw.category_id IS NOT NULL AND s.category_id = rw.category_id))
        AND s.position <= rw.max_products
      ORDER BY s.position
    LOOP
      v_out := v_out || jsonb_build_object(
        'position', r.position, 'product_id', r.product_id, 'name', r.name,
        'slug', r.slug, 'thumbnail_url', r.thumbnail_url, 'pinned', r.pinned,
        'source', 'manual',
        'live', (r.visible AND r.content_status = 'published'));
      v_taken := array_append(v_taken, r.product_id);
    END LOOP;
  END IF;

  IF rw.source_mode IN ('auto', 'hybrid') THEN
    i := 1;
    FOR r IN
      SELECT p.id, p.name, p.slug, p.thumbnail_url
      FROM public.marketplace_products p
      LEFT JOIN (
        SELECT oi.product_id, count(*) sold
        FROM public.marketplace_order_items oi
        JOIN public.marketplace_orders o
          ON o.id = oi.order_id AND o.status::text = 'paid'
        GROUP BY oi.product_id
      ) s ON s.product_id = p.id
      LEFT JOIN (
        SELECT e.product_id, count(*) views
        FROM public.marketplace_events e
        WHERE e.created_at > now() - interval '30 days'
        GROUP BY e.product_id
      ) v ON v.product_id = p.id
      WHERE p.visible AND p.content_status = 'published'
        AND (rw.category_id IS NULL OR p.category_id = rw.category_id)
        AND (rw.kind = 'category' OR CASE rw.auto_rule
               WHEN 'featured' THEN p.is_featured
               WHEN 'trending' THEN p.is_trending
               WHEN 'new_release' THEN p.is_new_release
               ELSE true
             END)
        AND (v_taken IS NULL OR NOT (p.id = ANY(v_taken)))
      ORDER BY
        CASE rw.auto_rule
          WHEN 'newest' THEN extract(epoch FROM p.created_at)
          WHEN 'new_release' THEN extract(epoch FROM p.created_at)
        END DESC NULLS LAST,
        CASE rw.auto_rule WHEN 'best_selling' THEN coalesce(s.sold, 0) END DESC NULLS LAST,
        CASE rw.auto_rule WHEN 'best_selling' THEN p.is_best_seller END DESC NULLS LAST,
        CASE rw.auto_rule WHEN 'trending' THEN coalesce(v.views, 0) END DESC NULLS LAST,
        CASE rw.auto_rule WHEN 'rating' THEN p.rating END DESC NULLS LAST,
        p.sort_order ASC NULLS LAST,
        p.name ASC
      LIMIT rw.max_products
    LOOP
      WHILE EXISTS (
        SELECT 1
        FROM public.marketplace_row_slots s2
        WHERE (s2.row_id = rw.row_id
               OR (rw.category_id IS NOT NULL AND s2.category_id = rw.category_id))
          AND s2.position = i
      ) AND rw.source_mode = 'hybrid' LOOP
        i := i + 1;
      END LOOP;
      EXIT WHEN i > rw.max_products;
      v_out := v_out || jsonb_build_object(
        'position', i, 'product_id', r.id, 'name', r.name, 'slug', r.slug,
        'thumbnail_url', r.thumbnail_url, 'pinned', false,
        'source', 'auto', 'live', true);
      i := i + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'row', p_key,
    'row_kind', rw.kind,
    'source_mode', rw.source_mode,
    'auto_rule', rw.auto_rule,
    'max_products', rw.max_products,
    'live_now', public.mm_row_is_live(p_key),
    'filled', jsonb_array_length(v_out),
    'empty', greatest(rw.max_products - jsonb_array_length(v_out), 0),
    'eligible_total', (
      SELECT count(*)
      FROM public.marketplace_products p
      WHERE p.visible AND p.content_status = 'published'
        AND (rw.category_id IS NULL OR p.category_id = rw.category_id)
        AND (rw.kind = 'category' OR CASE rw.auto_rule
               WHEN 'featured' THEN p.is_featured
               WHEN 'trending' THEN p.is_trending
               WHEN 'new_release' THEN p.is_new_release
               ELSE true
             END)
    ),
    'products', v_out);
END
$$;

-- Keep the manager's initial eligible count in agreement with the resolver.
CREATE OR REPLACE FUNCTION public.mm_rows_list()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT coalesce(jsonb_agg(r ORDER BY (r->>'effective_order')::int,
                                   r->>'title'), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'key', c.slug, 'row_id', cfg.id, 'row_kind', 'category',
      'category_id', c.id, 'title', c.name, 'icon', c.icon,
      'effective_order', coalesce(cfg.sort_order, c.sort_order, 9999),
      'hidden', c.is_hidden, 'featured', c.is_featured,
      'source_mode', coalesce(cfg.source_mode, 'auto'),
      'auto_rule', coalesce(cfg.auto_rule, 'sort_order'),
      'max_products', coalesce(cfg.max_products, 60),
      'status', coalesce(cfg.status, 'published'),
      'visible_desktop', coalesce(cfg.visible_desktop, true),
      'visible_tablet', coalesce(cfg.visible_tablet, true),
      'visible_mobile', coalesce(cfg.visible_mobile, true),
      'starts_at', cfg.starts_at, 'ends_at', cfg.ends_at,
      'cta_label', cfg.cta_label, 'cta_href', cfg.cta_href,
      'allow_cross_category', coalesce(cfg.allow_cross_category, false),
      'allow_duplicates', coalesce(cfg.allow_duplicates, false),
      'configured', (cfg.id IS NOT NULL),
      'live_now', public.mm_row_is_live(c.slug),
      'filled_slots', (
        SELECT count(*)
        FROM public.marketplace_row_slots s
        WHERE s.category_id = c.id OR s.row_id = cfg.id
      ),
      'eligible_products', (
        SELECT count(*)
        FROM public.marketplace_products p
        WHERE p.category_id = c.id AND p.visible
          AND p.content_status = 'published'
      ),
      'updated_at', cfg.updated_at
    ) r
    FROM public.marketplace_categories c
    LEFT JOIN public.marketplace_row_config cfg
      ON cfg.category_id = c.id AND cfg.row_kind = 'category'

    UNION ALL

    SELECT jsonb_build_object(
      'key', cfg.key, 'row_id', cfg.id, 'row_kind', 'curated',
      'category_id', null, 'title', cfg.title, 'icon', null,
      'effective_order', coalesce(cfg.sort_order, 9999),
      'hidden', false, 'featured', false,
      'source_mode', cfg.source_mode, 'auto_rule', cfg.auto_rule,
      'max_products', cfg.max_products, 'status', cfg.status,
      'visible_desktop', cfg.visible_desktop,
      'visible_tablet', cfg.visible_tablet,
      'visible_mobile', cfg.visible_mobile,
      'starts_at', cfg.starts_at, 'ends_at', cfg.ends_at,
      'cta_label', cfg.cta_label, 'cta_href', cfg.cta_href,
      'allow_cross_category', cfg.allow_cross_category,
      'allow_duplicates', cfg.allow_duplicates,
      'configured', true,
      'live_now', public.mm_row_is_live(cfg.key),
      'filled_slots', (
        SELECT count(*)
        FROM public.marketplace_row_slots s
        WHERE s.row_id = cfg.id
      ),
      'eligible_products', (
        SELECT count(*)
        FROM public.marketplace_products p
        WHERE p.visible AND p.content_status = 'published'
          AND CASE cfg.auto_rule
                WHEN 'featured' THEN p.is_featured
                WHEN 'trending' THEN p.is_trending
                WHEN 'new_release' THEN p.is_new_release
                ELSE true
              END
      ),
      'updated_at', cfg.updated_at
    ) r
    FROM public.marketplace_row_config cfg
    WHERE cfg.row_kind = 'curated'
  ) x;
$$;
