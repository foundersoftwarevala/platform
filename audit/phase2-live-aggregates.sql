BEGIN READ ONLY;

SELECT seller_kind, status, count(*) AS sellers
FROM marketplace_sellers
GROUP BY seller_kind, status
ORDER BY seller_kind, status;

SELECT moderation_status, content_status, visible, count(*) AS products
FROM marketplace_products
WHERE seller_id IS NOT NULL AND deleted_at IS NULL
GROUP BY moderation_status, content_status, visible
ORDER BY moderation_status, content_status, visible;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'marketplace_products'
  AND column_name = ANY(ARRAY[
    'name', 'slug', 'description', 'features', 'tech_stack', 'technology',
    'frontend', 'backend', 'database', 'mobile', 'cloud', 'integrations',
    'demo_url', 'public_repo_url', 'thumbnail_url', 'cover_image', 'logo',
    'icon', 'favicon', 'tags', 'search_keywords', 'languages', 'industry_label',
    'target_audience', 'subcategory', 'category_id', 'software_type', 'modules',
    'benefits', 'roles', 'version', 'license', 'price_label', 'price_period', 'currency'
  ])
ORDER BY column_name;

SELECT count(*) AS products,
       count(*) FILTER (WHERE nullif(btrim(thumbnail_url), '') IS NOT NULL
                          OR nullif(btrim(cover_image), '') IS NOT NULL
                          OR nullif(btrim(logo), '') IS NOT NULL
                          OR nullif(btrim(favicon), '') IS NOT NULL) AS products_with_image,
       count(*) FILTER (WHERE nullif(btrim(icon), '') IS NOT NULL
                          AND position('/' in icon) = 0
                          AND position('.' in icon) = 0) AS icon_name_only
FROM marketplace_products
WHERE deleted_at IS NULL;

SELECT count(*) AS public_products_without_image
FROM marketplace_products
WHERE deleted_at IS NULL AND visible = true AND moderation_status = 'approved'
  AND content_status IN ('published')
  AND (publish_at IS NULL OR publish_at <= now())
  AND (unpublish_at IS NULL OR unpublish_at > now())
  AND nullif(btrim(thumbnail_url), '') IS NULL
  AND nullif(btrim(cover_image), '') IS NULL
  AND nullif(btrim(logo), '') IS NULL;

SELECT to_regclass('public.marketplace_product_files') AS product_files_table,
       to_regclass('public.follows') AS generic_follows_table,
       to_regclass('public.marketplace_follows') AS marketplace_follows_table;

SELECT status, count(*) AS versions,
       count(*) FILTER (WHERE nullif(btrim(download_path), '') IS NOT NULL) AS versions_with_download_path
FROM marketplace_product_versions
GROUP BY status
ORDER BY status;

SELECT o.status, count(DISTINCT o.id) AS orders, count(i.id) AS line_items,
       coalesce(sum(i.line_total), 0)::numeric(14,2) AS line_total
FROM marketplace_orders o
JOIN marketplace_order_items i ON i.order_id = o.id
WHERE i.seller_id IS NOT NULL
GROUP BY o.status
ORDER BY o.status;

SELECT o.status, (i.seller_id IS NULL) AS missing_seller_attribution,
       count(*) AS line_items,
       count(c.id) AS commissioned_lines,
       count(*) FILTER (WHERE c.id IS NULL) AS lines_without_commission,
       coalesce(sum(i.line_total) FILTER (WHERE c.id IS NULL), 0)::numeric(14,2) AS uncommissioned_value
FROM marketplace_orders o
JOIN marketplace_order_items i ON i.order_id = o.id
LEFT JOIN marketplace_commissions c ON c.order_item_id = i.id
WHERE o.status = 'paid'
GROUP BY o.status, i.seller_id IS NULL
ORDER BY missing_seller_attribution;

SELECT md5(i.id::text) AS line_fingerprint,
       i.line_total::numeric(14,2) AS line_total,
       (i.seller_id IS NOT NULL) AS line_has_seller,
       (p.seller_id IS NOT NULL) AS product_has_seller,
       count(c.id) AS commission_rows,
       coalesce(string_agg(DISTINCT c.status, ',' ORDER BY c.status), 'none') AS commission_status,
       (coalesce(o.user_id, o.buyer_id) IS NOT NULL
        AND coalesce(o.user_id, o.buyer_id) = s.owner_user_id) AS buyer_owns_seller
FROM marketplace_orders o
JOIN marketplace_order_items i ON i.order_id = o.id
LEFT JOIN marketplace_products p ON p.id = i.product_id
LEFT JOIN marketplace_commissions c ON c.order_item_id = i.id
LEFT JOIN marketplace_sellers s ON s.id = coalesce(i.seller_id, p.seller_id)
WHERE o.status = 'paid'
GROUP BY i.id, i.line_total, i.seller_id, p.seller_id, o.user_id, o.buyer_id, s.owner_user_id
ORDER BY line_fingerprint;

SELECT status, count(*) AS commission_rows,
       coalesce(sum(gross_amount), 0)::numeric(14,2) AS gross,
       coalesce(sum(commission_amount), 0)::numeric(14,2) AS platform_fee,
       coalesce(sum(seller_amount), 0)::numeric(14,2) AS seller_amount,
       coalesce(sum(gross_amount - commission_amount - seller_amount), 0)::numeric(14,2) AS reconciliation_delta
FROM marketplace_commissions
GROUP BY status
ORDER BY status;

SELECT status, count(*) AS payouts,
       coalesce(sum(amount), 0)::numeric(14,2) AS amount
FROM marketplace_payouts
GROUP BY status
ORDER BY status;

SELECT count(*) AS download_events
FROM marketplace_downloads;

SELECT count(*) AS reviews,
       count(*) FILTER (WHERE seller_response IS NOT NULL AND btrim(seller_response) <> '') AS replied
FROM marketplace_reviews;

COMMIT;
