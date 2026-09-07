-- Storefront filters.
--
-- The Filter Manager showed eight groups with their values typed into the
-- screen: ten categories, seven industries, four deployments, and so on. The
-- catalogue holds 91 categories. The list was not a configuration, it was a
-- sample, and nothing a manager did to it reached anything.
--
-- Only the group configuration is stored here - whether a group is on, what
-- order it sits in, how it behaves. The values are never stored, because the
-- categories, industries, deployments, licences and price bands already exist
-- in the product and category tables and copying them would create a second
-- taxonomy that drifts. mm_filter_values derives them, with a real product
-- count against each one, from the canonical data every time it is asked.
--
-- One honest limitation is recorded here rather than papered over: the public
-- storefront has no faceted filter surface at all. /marketplace renders the
-- homepage, which offers a search box and category rows; setActiveCategory
-- exists in the code and is never called from any control. So this
-- configuration is real and the values are real, but publishing it has nothing
-- to appear on yet. The manager reports that state instead of implying the
-- storefront is obeying it.

create table if not exists public.marketplace_filter_groups (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  label       text not null,
  -- Where the values come from. Never a stored copy of the taxonomy.
  source      text not null check (source in
                ('category','industry','deployment','platform','tag','price','rating','license')),
  enabled     boolean not null default true,
  position    integer not null,
  -- Section: single-select, multi-select, and how several selections combine.
  select_mode text not null default 'multi' check (select_mode in ('single','multi')),
  combine     text not null default 'or' check (combine in ('and','or')),
  visible_desktop boolean not null default true,
  visible_mobile  boolean not null default true,
  updated_by  uuid,
  updated_at  timestamptz not null default now()
);

alter table public.marketplace_filter_groups enable row level security;

drop policy if exists filter_groups_operator on public.marketplace_filter_groups;
create policy filter_groups_operator on public.marketplace_filter_groups
  for all to authenticated
  using (public.mm_is_operator()) with check (public.mm_is_operator());

-- The storefront will need to read which groups are on, so the read is public
-- and the writes are denied per command - never a single restrictive ALL
-- policy, which is what silently cancelled the read on four other tables.
drop policy if exists filter_groups_public_read on public.marketplace_filter_groups;
create policy filter_groups_public_read on public.marketplace_filter_groups
  for select to anon, authenticated using (true);

drop policy if exists filter_groups_anon_ins on public.marketplace_filter_groups;
drop policy if exists filter_groups_anon_upd on public.marketplace_filter_groups;
drop policy if exists filter_groups_anon_del on public.marketplace_filter_groups;
create policy filter_groups_anon_ins on public.marketplace_filter_groups
  as restrictive for insert to anon with check (false);
create policy filter_groups_anon_upd on public.marketplace_filter_groups
  as restrictive for update to anon using (false) with check (false);
create policy filter_groups_anon_del on public.marketplace_filter_groups
  as restrictive for delete to anon using (false);

insert into public.marketplace_filter_groups (key, label, source, position, select_mode, combine)
values
  ('category',   'Category',    'category',   1, 'multi',  'or'),
  ('industry',   'Industry',    'industry',   2, 'multi',  'or'),
  ('deployment', 'Deployment',  'deployment', 3, 'multi',  'or'),
  ('platform',   'Platform',    'platform',   4, 'multi',  'or'),
  ('tags',       'Tags',        'tag',        5, 'multi',  'and'),
  ('price',      'Price Range', 'price',      6, 'single', 'or'),
  ('rating',     'Rating',      'rating',     7, 'single', 'or'),
  ('license',    'License',     'license',    8, 'multi',  'or')
on conflict (key) do nothing;

/* ------------------------------------------------------------------ values */

-- The values a group actually offers, derived from canonical data with a real
-- product count against each. A value that matches no published product is
-- still returned, with its zero, so the manager can see it rather than wonder
-- why it vanished.
create or replace function public.mm_filter_values(p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_source text; v_out jsonb;
begin
  select source into v_source from public.marketplace_filter_groups where key = p_key;
  if v_source is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_group');
  end if;

  if v_source = 'category' then
    select coalesce(jsonb_agg(jsonb_build_object('value', c.slug, 'label', c.name, 'count', n)
                    order by n desc, c.name), '[]'::jsonb)
      into v_out
      from public.marketplace_categories c
      join lateral (
        select count(*) as n from public.marketplace_products p
         where p.category_id = c.id and p.visible and p.content_status = 'published'
      ) k on true
     where not c.is_hidden;

  elsif v_source = 'industry' then
    select coalesce(jsonb_agg(jsonb_build_object('value', industry_label,
                                                 'label', industry_label, 'count', n)
                    order by n desc, industry_label), '[]'::jsonb)
      into v_out
      from (select industry_label, count(*) n from public.marketplace_products
             where visible and content_status = 'published'
               and coalesce(btrim(industry_label), '') <> ''
             group by industry_label) t;

  elsif v_source = 'deployment' then
    select coalesce(jsonb_agg(jsonb_build_object('value', deployment,
                                                 'label', deployment, 'count', n)
                    order by n desc, deployment), '[]'::jsonb)
      into v_out
      from (select deployment, count(*) n from public.marketplace_products
             where visible and content_status = 'published'
               and coalesce(btrim(deployment), '') <> ''
             group by deployment) t;

  elsif v_source = 'license' then
    select coalesce(jsonb_agg(jsonb_build_object('value', license,
                                                 'label', license, 'count', n)
                    order by n desc, license), '[]'::jsonb)
      into v_out
      from (select license, count(*) n from public.marketplace_products
             where visible and content_status = 'published'
               and coalesce(btrim(license), '') <> ''
             group by license) t;

  elsif v_source = 'platform' then
    -- The catalogue records deployment as free text and a mobile field; there
    -- is no per-platform flag, so the values are what the data can actually
    -- distinguish rather than the four the screen used to name.
    select coalesce(jsonb_agg(jsonb_build_object('value', v, 'label', v, 'count', n)
                    order by n desc), '[]'::jsonb)
      into v_out
      from (
        select 'Cloud' as v, count(*) n from public.marketplace_products
          where visible and content_status='published' and deployment ilike '%cloud%'
        union all
        select 'On-premise', count(*) from public.marketplace_products
          where visible and content_status='published' and deployment ilike '%premise%'
        union all
        select 'Mobile', count(*) from public.marketplace_products
          where visible and content_status='published' and coalesce(btrim(mobile),'') <> ''
      ) t where n > 0;

  elsif v_source = 'tag' then
    -- The same flags the Product Card Manager's badges read. One source, so
    -- badge and filter can never disagree.
    select jsonb_build_array(
      jsonb_build_object('value','new','label','New','count',
        (select count(*) from public.marketplace_products where visible and content_status='published' and is_new_release)),
      jsonb_build_object('value','trending','label','Trending','count',
        (select count(*) from public.marketplace_products where visible and content_status='published' and is_trending)),
      jsonb_build_object('value','featured','label','Featured','count',
        (select count(*) from public.marketplace_products where visible and content_status='published' and is_featured)),
      jsonb_build_object('value','best_seller','label','Best Seller','count',
        (select count(*) from public.marketplace_products where visible and content_status='published' and is_best_seller)),
      jsonb_build_object('value','ai_ready','label','AI Ready','count',
        (select count(*) from public.marketplace_products where visible and content_status='published' and is_ai))
    ) into v_out;

  elsif v_source = 'price' then
    -- Buckets over the real price label. The catalogue prices in four distinct
    -- ways today, so these are the bands that actually separate anything.
    select jsonb_build_array(
      jsonb_build_object('value','lifetime_249','label','$249 lifetime','count',
        (select count(*) from public.marketplace_products where visible and content_status='published' and price_label = '$249')),
      jsonb_build_object('value','custom','label','Custom','count',
        (select count(*) from public.marketplace_products where visible and content_status='published' and price_label = 'Custom')),
      jsonb_build_object('value','contact','label','Contact for pricing','count',
        (select count(*) from public.marketplace_products where visible and content_status='published' and price_label = 'Contact'))
    ) into v_out;

  elsif v_source = 'rating' then
    select jsonb_build_array(
      jsonb_build_object('value','5','label','5 stars','count',
        (select count(*) from public.marketplace_products where visible and content_status='published' and rating >= 5)),
      jsonb_build_object('value','4','label','4 and up','count',
        (select count(*) from public.marketplace_products where visible and content_status='published' and rating >= 4)),
      jsonb_build_object('value','3','label','3 and up','count',
        (select count(*) from public.marketplace_products where visible and content_status='published' and rating >= 3))
    ) into v_out;
  else
    v_out := '[]'::jsonb;
  end if;

  return jsonb_build_object('ok', true, 'group', p_key, 'source', v_source,
                            'values', coalesce(v_out, '[]'::jsonb));
end;
$$;

-- Every group with its values, for the manager.
create or replace function public.mm_filters()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_out jsonb := '[]'::jsonb; g record;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  for g in select * from public.marketplace_filter_groups order by position loop
    v_out := v_out || jsonb_build_object(
      'key', g.key, 'label', g.label, 'source', g.source,
      'enabled', g.enabled, 'position', g.position,
      'select_mode', g.select_mode, 'combine', g.combine,
      'visible_desktop', g.visible_desktop, 'visible_mobile', g.visible_mobile,
      'values', public.mm_filter_values(g.key)->'values');
  end loop;

  return jsonb_build_object('ok', true, 'groups', v_out);
end;
$$;

create or replace function public.mm_filter_set(p_key text, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_before jsonb; v_after jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select to_jsonb(g) into v_before from public.marketplace_filter_groups g where g.key = p_key;
  if v_before is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_group');
  end if;

  update public.marketplace_filter_groups g set
    enabled         = coalesce((p_patch->>'enabled')::boolean, g.enabled),
    label           = coalesce(nullif(btrim(p_patch->>'label'),''), g.label),
    position        = coalesce((p_patch->>'position')::int, g.position),
    select_mode     = coalesce(p_patch->>'select_mode', g.select_mode),
    combine         = coalesce(p_patch->>'combine', g.combine),
    visible_desktop = coalesce((p_patch->>'visible_desktop')::boolean, g.visible_desktop),
    visible_mobile  = coalesce((p_patch->>'visible_mobile')::boolean, g.visible_mobile),
    updated_by = auth.uid(), updated_at = now()
  where g.key = p_key
  returning to_jsonb(g) into v_after;

  perform public.mm_audit('filter.configure', 'storefront_filter', p_key,
                          v_before, v_after, null);
  return jsonb_build_object('ok', true, 'group', v_after);
end;
$$;
-- Let the public read the active demo URLs it is explicitly allowed to read.
--
-- product_demo_urls carries "product demos public active read", a permissive
-- SELECT policy for anon and authenticated, and anon_write_denied, a
-- RESTRICTIVE policy scoped to ALL. A restrictive policy applies to every
-- command it names, SELECT included, so the read evaluated as false AND (...)
-- and an anonymous visitor saw none of the nine active demos.
--
-- This is the fourth table in this project with the same shape - the hero
-- slides, the homepage sections and now this one all had a public read granted
-- by one policy and cancelled by another. Scoping the denial to the write
-- commands preserves the intent exactly: anonymous still cannot insert, update
-- or delete.

drop policy if exists anon_write_denied on public.product_demo_urls;

create policy anon_insert_denied on public.product_demo_urls
  as restrictive for insert to anon with check (false);
create policy anon_update_denied on public.product_demo_urls
  as restrictive for update to anon using (false) with check (false);
create policy anon_delete_denied on public.product_demo_urls
  as restrictive for delete to anon using (false);
