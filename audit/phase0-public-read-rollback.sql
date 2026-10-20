BEGIN;

ALTER POLICY "products public read" ON public.marketplace_products
  USING (
    visible = true
    AND (content_status IS NULL OR content_status = 'published')
    AND (publish_at IS NULL OR publish_at <= now())
    AND (unpublish_at IS NULL OR unpublish_at > now())
  );

ALTER POLICY marketplace_products_public_read ON public.marketplace_products
  USING (
    visible = true
    AND moderation_status = 'approved'
    AND (content_status IS NULL OR content_status = 'published')
    AND (publish_at IS NULL OR publish_at <= now())
    AND (unpublish_at IS NULL OR unpublish_at > now())
  );

COMMIT;
