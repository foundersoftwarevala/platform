-- The countries the catalogue is targeted at, and what each one holds.
--
-- The target country is stored as a marker on the product itself, so working
-- out which countries exist meant reading every product and picking the markers
-- apart in the application. These answer it in the database instead, which is
-- what the country pages and the country sitemap read.
--
-- Both are stable and run as the caller, so the row-level rules still decide
-- what is counted: an unpublished or hidden product is never included.

create or replace function public.marketplace_countries()
returns table (country text, product_count bigint)
language sql
stable
security invoker
set search_path to 'public'
as $$
  select replace(k, 'country:', '') as country, count(*)::bigint as product_count
  from public.marketplace_products p, unnest(p.search_keywords) k
  where k like 'country:%'
    and p.visible
    and p.content_status = 'published'
  group by 1
  order by 1
$$;

create or replace function public.marketplace_country_categories(target text)
returns table (category_id uuid, category_name text, category_slug text, product_count bigint)
language sql
stable
security invoker
set search_path to 'public'
as $$
  select c.id, c.name, c.slug, count(*)::bigint
  from public.marketplace_products p
  join public.marketplace_categories c on c.id = p.category_id
  where p.visible
    and p.content_status = 'published'
    and p.search_keywords @> array['country:' || target]
    and not c.is_hidden
  group by c.id, c.name, c.slug
  order by count(*) desc, c.name
$$;

grant execute on function public.marketplace_countries() to anon, authenticated, service_role;
grant execute on function public.marketplace_country_categories(text) to anon, authenticated, service_role;
