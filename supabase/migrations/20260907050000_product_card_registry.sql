-- One canonical product-card configuration.
--
-- The Product Card Manager claimed to govern eleven visual fields, thirteen
-- metadata fields and ten actions across every marketplace surface. It governed
-- nothing: the arrays were hardcoded in the screen and the card renderer had
-- never heard of them.
--
-- This is the registry the card actually reads. Each row names a field, what
-- product column backs it, and whether it renders. `data_column` is the point:
-- a field is only worth switching on if the catalogue carries the data, and the
-- manager can now show the real coverage instead of implying every product has
-- a banner and a brochure.
--
-- What the catalogue actually holds, measured across 5,469 published products:
--
--   name, description, price_label, industry_label   100%
--   features, tags, tech_stack, license, subcategory   67%
--   thumbnail_url, logo, cover_image, banner            0%
--   demo (product_demo_urls)                           12 products
--   rating                                              8 products
--   badge                                               9 products
--   downloads_label                                     2 products
--   version                                             1 product
--
-- So the eleven visual fields are seeded disabled - not to hide them, but
-- because there is not one product image in the database and a card cannot
-- render what does not exist. They stay in the registry, with their coverage
-- visible, ready the moment images are uploaded.

create table if not exists public.marketplace_card_fields (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('visual','metadata','action')),
  key         text not null unique,
  label       text not null,
  -- The product column (or related table) this field renders. Null means it is
  -- derived rather than stored - a computed badge, say.
  data_column text,
  -- A field the card cannot render without data is not switched on silently.
  enabled     boolean not null default false,
  position    integer not null,
  hint        text,
  -- Section 59: an action is only offered when the product can support it.
  requires    text,
  updated_by  uuid,
  updated_at  timestamptz not null default now()
);

create index if not exists marketplace_card_fields_kind_idx
  on public.marketplace_card_fields (kind, position);

alter table public.marketplace_card_fields enable row level security;

drop policy if exists card_fields_operator on public.marketplace_card_fields;
create policy card_fields_operator on public.marketplace_card_fields
  for all to authenticated
  using (public.mm_is_operator()) with check (public.mm_is_operator());

-- The public storefront reads this to know what to draw, so it may read - and
-- only read. Writes are denied per command rather than with a single ALL
-- policy, which would also cancel the SELECT.
drop policy if exists card_fields_public_read on public.marketplace_card_fields;
create policy card_fields_public_read on public.marketplace_card_fields
  for select to anon, authenticated using (true);

drop policy if exists card_fields_anon_ins on public.marketplace_card_fields;
drop policy if exists card_fields_anon_upd on public.marketplace_card_fields;
drop policy if exists card_fields_anon_del on public.marketplace_card_fields;
create policy card_fields_anon_ins on public.marketplace_card_fields
  as restrictive for insert to anon with check (false);
create policy card_fields_anon_upd on public.marketplace_card_fields
  as restrictive for update to anon using (false) with check (false);
create policy card_fields_anon_del on public.marketplace_card_fields
  as restrictive for delete to anon using (false);

/* ------------------------------------------------------------------ seed */

insert into public.marketplace_card_fields
  (kind, key, label, data_column, enabled, position, hint, requires)
values
  -- The eleven visual fields, exactly as the screen has always listed them.
  ('visual','product-thumbnail','Product Thumbnail','thumbnail_url', false, 1,'1:1 · 1024px · webp', 'thumbnail_url'),
  ('visual','demo-thumbnail',   'Demo Thumbnail',   null,            false, 2,'16:9 · poster',        'demo'),
  ('visual','video-thumbnail',  'Video Thumbnail',  null,            false, 3,'auto from frame',      'video'),
  ('visual','logo',             'Logo',             'logo',          false, 4,'SVG · light/dark',     'logo'),
  ('visual','banner',           'Banner',           'cover_image',   false, 5,'21:9 hero',            'cover_image'),
  ('visual','hover-image',      'Hover Image',      null,            false, 6,'alt frame',            'thumbnail_url'),
  ('visual','gallery',          'Gallery',          null,            false, 7,'up to 12',             'gallery'),
  ('visual','preview-image',    'Preview Image',    null,            false, 8,'card overlay',         'thumbnail_url'),
  ('visual','background',       'Background',       null,            true,  9,'colour gradient — the card renders this today', null),
  ('visual','overlay',          'Overlay',          null,            false,10,'scrim · noise',        null),
  ('visual','ribbon',           'Ribbon',           null,            false,11,'corner flag',          'badge'),

  -- The thirteen metadata fields.
  ('metadata','product-name',     'Product Name',     'name',           true,  1,'from the product record', null),
  ('metadata','short-description','Short Description','description',    true,  2,'clamped to two lines',    'description'),
  ('metadata','long-description', 'Long Description', 'description',    false, 3,'product page only',       'description'),
  ('metadata','highlights',       'Highlights',       'benefits',       false, 4,null,                      'benefits'),
  ('metadata','badges',           'Badges',           'badge',          true,  5,'featured, trending, best seller, new', null),
  ('metadata','tags',             'Tags',             'tags',           false, 6,null,                      'tags'),
  ('metadata','category',         'Category',         'industry_label', true,  7,'from the Category Manager', null),
  ('metadata','industry',         'Industry',         'industry_label', true,  8,null,                      null),
  ('metadata','version',          'Version',          'version',        false, 9,'1 product carries one',   'version'),
  ('metadata','license',          'License',          'license',        false,10,null,                      'license'),
  ('metadata','platform',         'Platform',         'deployment',     false,11,null,                      'deployment'),
  ('metadata','price',            'Price',            'price_label',    true, 12,'from the product record, not a constant', 'price_label'),
  ('metadata','discount',         'Discount',         null,            false,13,'needs a list price to compare against', null),

  -- The ten actions.
  ('action','buy-now',          'Buy Now',           null, false, 1,'no checkout is configured yet', 'checkout'),
  ('action','live-demo',        'Live Demo',         null, true,  2,'shown only for products that have a demo', 'demo'),
  ('action','view-details',     'View Details',      null, true,  3,'the canonical product page', null),
  ('action','compare',          'Compare',           null, false, 4,'/ai/compare',  null),
  ('action','wishlist',         'Wishlist',          null, true,  5,'favourites',   null),
  ('action','share',            'Share',             null, false, 6,'canonical product URL', null),
  ('action','watch-video',      'Watch Video',       null, false, 7,null,           'video'),
  ('action','screenshots',      'Screenshots',       null, false, 8,null,           'gallery'),
  ('action','download-brochure','Download Brochure', null, false, 9,null,           'brochure'),
  ('action','contact-sales',    'Contact Sales',     null, false,10,'the marketplace lead endpoint', null)
on conflict (key) do nothing;

/* -------------------------------------------------------------- functions */

-- What the storefront draws. Public, and only the enabled keys.
create or replace function public.mm_card_fields()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_object_agg(kind, keys), '{}'::jsonb)
    from (
      select kind, jsonb_agg(key order by position) as keys
        from public.marketplace_card_fields
       where enabled
       group by kind
    ) t;
$$;

revoke all on function public.mm_card_fields() from public;
grant execute on function public.mm_card_fields() to anon, authenticated, service_role;

-- Real coverage, counted rather than declared. This is what lets the manager
-- say "no product has a thumbnail" instead of offering a switch that would
-- render nothing.
create or replace function public.mm_card_coverage()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_total integer;
  v_out   jsonb := '[]'::jsonb;
  r       record;
  v_have  integer;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select count(*) into v_total from public.marketplace_products
   where visible and content_status = 'published';

  for r in select * from public.marketplace_card_fields order by kind, position
  loop
    v_have := null;

    if r.requires = 'demo' then
      select count(distinct d.product_id) into v_have
        from public.product_demo_urls d
        join public.marketplace_products p on p.id = d.product_id
       where p.visible and p.content_status = 'published'
         and coalesce(btrim(d.url), '') <> '';
    elsif r.requires in ('thumbnail_url','logo','cover_image','description',
                         'price_label','license','version','deployment') then
      execute format(
        'select count(*) from public.marketplace_products
          where visible and content_status = ''published''
            and coalesce(btrim(%I::text), '''') <> ''''', r.requires)
      into v_have;
    elsif r.requires = 'tags' then
      select count(*) into v_have from public.marketplace_products
       where visible and content_status = 'published'
         and tags is not null and array_length(tags, 1) > 0;
    elsif r.requires = 'benefits' then
      -- benefits is plain text on this table, not a jsonb array.
      select count(*) into v_have from public.marketplace_products
       where visible and content_status = 'published'
         and coalesce(btrim(benefits), '') <> '';
    elsif r.requires = 'badge' then
      select count(*) into v_have from public.marketplace_products
       where visible and content_status = 'published'
         and coalesce(btrim(badge), '') <> '';
    end if;
    -- Anything else - video, gallery, brochure, checkout - has no store in this
    -- database at all, so it stays null and is reported as "not available"
    -- rather than as zero, which would suggest the column merely happens to be
    -- empty.

    v_out := v_out || jsonb_build_object(
      'kind', r.kind, 'key', r.key, 'label', r.label,
      'enabled', r.enabled, 'position', r.position, 'hint', r.hint,
      'requires', r.requires, 'data_column', r.data_column,
      'have', v_have,
      'total', v_total,
      'pct', case when v_have is null or v_total = 0 then null
                  else round(100.0 * v_have / v_total) end);
  end loop;

  return jsonb_build_object('ok', true, 'total_products', v_total, 'fields', v_out);
end;
$$;

-- Switching a field on or off. Audited like every other manager action.
create or replace function public.mm_card_field_set(p_key text, p_enabled boolean)
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

  select to_jsonb(f) into v_before from public.marketplace_card_fields f where f.key = p_key;
  if v_before is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_field');
  end if;

  update public.marketplace_card_fields
     set enabled = p_enabled, updated_by = auth.uid(), updated_at = now()
   where key = p_key
  returning to_jsonb(marketplace_card_fields) into v_after;

  perform public.mm_audit(
    case when p_enabled then 'card.field.enable' else 'card.field.disable' end,
    'product_card', p_key, v_before, v_after, null);

  return jsonb_build_object('ok', true, 'field', v_after);
end;
$$;
