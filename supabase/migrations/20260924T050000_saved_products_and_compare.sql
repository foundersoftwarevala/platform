-- Saved products and the compare list, kept for the person rather than the
-- browser.
--
-- The heart on a product card wrote to localStorage under
-- sv.home.favorites.v1, which is one browser on one machine: a buyer who
-- saved six products on their phone found none of them on their laptop, and a
-- cleared cache lost the lot. The compare list had nowhere to live at all.
--
-- Both are per-person lists of products, so both are one shape. A row is the
-- person, the product and which list it is on.

create table if not exists public.marketplace_saved_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- The product this is about. Kept as free text as well as a key, because
  -- the home page's own catalogue entries are addressed by slug and have no
  -- row in marketplace_products until an author uploads one.
  product_id uuid references public.marketplace_products(id) on delete cascade,
  product_slug text,
  -- 'saved' is the heart; 'compare' is the comparison tray.
  list text not null default 'saved',
  note text,
  created_at timestamptz not null default now(),
  constraint saved_products_identify_the_product check (product_id is not null or product_slug is not null),
  constraint saved_products_known_list check (list in ('saved', 'compare'))
);

-- One entry per person, per product, per list - so saving twice is saving once.
create unique index if not exists marketplace_saved_products_by_id
  on public.marketplace_saved_products(user_id, list, product_id)
  where product_id is not null;
create unique index if not exists marketplace_saved_products_by_slug
  on public.marketplace_saved_products(user_id, list, product_slug)
  where product_id is null;
create index if not exists marketplace_saved_products_person
  on public.marketplace_saved_products(user_id, list, created_at desc);

grant select, insert, update, delete on public.marketplace_saved_products to authenticated;
grant all on public.marketplace_saved_products to service_role;
alter table public.marketplace_saved_products enable row level security;

-- A person's saved list is their own, in every direction.
do $$ begin
  create policy "own saved products read" on public.marketplace_saved_products
    for select to authenticated using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "own saved products write" on public.marketplace_saved_products
    for insert to authenticated with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "own saved products change" on public.marketplace_saved_products
    for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "own saved products remove" on public.marketplace_saved_products
    for delete to authenticated using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

/**
 * Save or unsave in one call, so the card does not have to know which it is.
 *
 * Returns whether the product is on the list afterwards, which is exactly what
 * the heart needs to draw itself.
 */
create or replace function public.toggle_saved_product(
  _product_slug text,
  _list text default 'saved',
  _product_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  existing uuid;
begin
  if me is null then
    return json_build_object('saved', false, 'reason', 'not signed in');
  end if;
  if _list not in ('saved', 'compare') then
    return json_build_object('saved', false, 'reason', 'unknown list');
  end if;

  select id into existing
    from public.marketplace_saved_products
   where user_id = me
     and list = _list
     and (
       (_product_id is not null and product_id = _product_id)
       or (_product_id is null and product_slug = _product_slug)
     )
   limit 1;

  if existing is not null then
    delete from public.marketplace_saved_products where id = existing;
    return json_build_object('saved', false, 'list', _list);
  end if;

  insert into public.marketplace_saved_products (user_id, product_id, product_slug, list)
  values (me, _product_id, _product_slug, _list);
  return json_build_object('saved', true, 'list', _list);
end;
$$;
revoke all on function public.toggle_saved_product(text, text, uuid) from public, anon;
grant execute on function public.toggle_saved_product(text, text, uuid) to authenticated;

/** Everything this person has on one of their lists. */
create or replace function public.my_saved_products(_list text default 'saved')
returns table (
  id uuid,
  product_id uuid,
  product_slug text,
  name text,
  price_label text,
  industry_label text,
  icon text,
  visible boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.product_id,
    coalesce(s.product_slug, p.slug) as product_slug,
    p.name,
    p.price_label,
    p.industry_label,
    p.icon,
    p.visible,
    s.created_at
  from public.marketplace_saved_products s
  left join public.marketplace_products p
    on p.id = s.product_id or (s.product_id is null and p.slug = s.product_slug)
  where s.user_id = auth.uid()
    and s.list = coalesce(_list, 'saved')
  order by s.created_at desc
$$;
revoke all on function public.my_saved_products(text) from public, anon;
grant execute on function public.my_saved_products(text) to authenticated;

notify pgrst, 'reload schema';
