-- How big the catalogue actually is, for the homepage's own title.
--
-- The live homepage says "147 Software Solutions" in its title, its description
-- and its Open Graph tags. The catalogue holds 7,357 visible products. The
-- number was written by hand when it was true and has been wrong ever since -
-- understating the storefront by a factor of fifty in the one piece of text
-- Google reads first.
--
-- Counted here rather than in the page, so it cannot drift again, and counted in
-- SQL rather than by fetching a list, because a list is always capped and a
-- capped list undercounts silently.
--
-- Cheap on purpose: two counts over indexed columns, and the homepage's HTML is
-- micro-cached for sixty seconds at nginx, so this runs at most once a minute
-- however much traffic arrives.

create or replace function public.sf_catalogue_headline()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'products', (select count(*) from public.marketplace_products where visible),
    'categories', (select count(*) from public.marketplace_categories),
    -- Categories are flat in this schema - there is no parent_id - so the
    -- figure the homepage copy calls "master categories" is the categories a
    -- visitor can actually see.
    'visible_categories', (
      select count(*) from public.marketplace_categories where not coalesce(is_hidden, false)),
    'generated_at', now()
  );
$$;

revoke all on function public.sf_catalogue_headline() from public;
grant execute on function public.sf_catalogue_headline() to anon, authenticated, service_role;

comment on function public.sf_catalogue_headline() is
  'Visible product and category counts for the storefront''s own metadata. Counted in SQL so the homepage title can never drift from the catalogue again.';
