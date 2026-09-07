-- The public read policy on ai_content_items was true on paper and false in
-- practice.
--
-- It allowed an anonymous reader a PUBLISHED row when the product it belongs to
-- is visible, and it established that by selecting from marketplace_products —
-- a table anonymous callers cannot read at all under its own row-level
-- security. The existence test was therefore always false, so anon saw nothing,
-- and a policy that says "published content is public" while delivering none of
-- it is worse than no policy: it hides the fact that the storefront depends
-- entirely on mm_product_content instead.
--
-- The visibility test now goes through a definer function, so the policy means
-- what it says. The rule itself has not been loosened by a hair: published
-- rows, visible product, not deleted, and nothing else.

create or replace function public.mm_product_is_public(p_product uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.marketplace_products p
     where p.id = p_product
       and p.visible
       and p.deleted_at is null);
$$;

revoke all on function public.mm_product_is_public(uuid) from public;
grant execute on function public.mm_product_is_public(uuid) to anon, authenticated, service_role;

drop policy if exists ai_content_items_public on public.ai_content_items;
create policy ai_content_items_public on public.ai_content_items
  for select to anon, authenticated
  using (status = 'PUBLISHED' and public.mm_product_is_public(product_id));
