-- Public read of the catalogue covers published products only.
--
-- Both public SELECT policies on marketplace_products checked visibility and
-- the publish window but not content_status. /rest/v1 on softwarevala.net
-- answers without a key, so any visitor could list visible drafts - on
-- 2026-10-02, ten of them ("School Management Software" among them) - and
-- every product Product Manager's Add Product creates starts as a visible
-- draft.
--
-- The storefront itself reads with the service role and applies
-- visible = true AND content_status = 'published' in its own queries
-- (catalog.server.ts PUBLISHED), so nothing a visitor sees on the site changes.
-- Operators, sellers and admins keep their own policies.
--
-- Additive in effect: the same two policies, each with one more condition.
-- Nothing is dropped and no row is touched.

alter policy "products public read" on public.marketplace_products
  using (
    visible = true
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
