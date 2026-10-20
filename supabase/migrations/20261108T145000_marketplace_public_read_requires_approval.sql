-- Keep both permissive public product-read policies behind moderation approval.
-- PostgreSQL combines permissive policies with OR; the older "products public read"
-- policy must not admit an otherwise published product before approval.
alter policy "products public read" on public.marketplace_products
  using (
    visible = true
    and moderation_status = 'approved'
    and (content_status is null or content_status = 'published')
    and (publish_at is null or publish_at <= now())
    and (unpublish_at is null or unpublish_at > now())
  );

alter policy marketplace_products_public_read on public.marketplace_products
  using (
    visible = true
    and moderation_status = 'approved'
    and (content_status is null or content_status = 'published')
    and (publish_at is null or publish_at <= now())
    and (unpublish_at is null or unpublish_at > now())
  );
