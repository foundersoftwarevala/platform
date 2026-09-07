-- Card Composition: the full set the screen actually shows.
--
-- The screen lists 18 visible fields, 11 actions, 12 badges and 6 platform
-- badges. The registry created earlier held a smaller set, taken from the other
-- card screen in this project. Rather than start a second registry - which is
-- exactly what "do not create a second product-card system" rules out - this
-- widens the one that exists: two new kinds, a badge priority, and the rows
-- that were missing. Nothing is removed and no existing key changes meaning.
--
-- Every row records what actually backs it. Measured across 5,469 published
-- products:
--
--   name, category, industry, updated_at, product status, price   100%
--   licence                                                        67%
--   thumbnail                                                       0
--   version                                                         1
--   rating                                                          8
--   downloads                                                       0
--   reviews (marketplace_reviews)                              0 rows
--   views (product_view events)                              27 events
--   gallery, hover preview, 3D, delivery time, support status   no column
--
-- Those are not gaps to paper over. A switch for a field no product can answer
-- renders nothing, so the manager is shown the number and the field is left
-- off until there is something behind it.

alter table public.marketplace_card_fields
  drop constraint if exists marketplace_card_fields_kind_check;
alter table public.marketplace_card_fields
  add constraint marketplace_card_fields_kind_check
  check (kind in ('visual','metadata','action','badge','platform'));

-- Badge ordering, so a card with several badges shows them in a decided order
-- rather than whatever the query returns.
alter table public.marketplace_card_fields
  add column if not exists priority integer not null default 50;

-- The composition screen's own names, where they differ from the ones the
-- other screen used. Same rows, same keys - only the label a person reads.
update public.marketplace_card_fields set label = 'Premium Thumbnail' where key = 'product-thumbnail';
update public.marketplace_card_fields set label = 'Thumbnail Gallery' where key = 'gallery';
update public.marketplace_card_fields set label = 'Hover Preview'     where key = 'hover-image';
update public.marketplace_card_fields set label = 'Software Name'     where key = 'product-name';
update public.marketplace_card_fields set label = 'Demo Video'        where key = 'watch-video';

insert into public.marketplace_card_fields
  (kind, key, label, data_column, enabled, position, hint, requires, priority)
values
  -- Visible fields the registry did not have yet.
  ('visual','thumbnail-3d','3D Thumbnail', null, false, 12,
   'no 3D asset store exists in this database', 'model3d', 50),
  ('metadata','last-updated','Last Updated','updated_at', false, 14,
   'every product has one', 'updated_at', 50),
  ('metadata','product-status','Product Status','content_status', false, 15,
   'published / draft / archived', 'content_status', 50),
  ('metadata','rating','Rating','rating', true, 16,
   'shown only for a product that has one', 'rating', 50),
  ('metadata','reviews','Reviews', null, false, 17,
   'marketplace_reviews holds no rows', 'reviews', 50),
  ('metadata','downloads','Downloads','downloads', false, 18,
   'no product records a download count', 'downloads', 50),
  ('metadata','views','Views', null, false, 19,
   'from product_view events', 'views', 50),
  ('metadata','delivery-time','Delivery Time', null, false, 20,
   'no delivery column on the product', 'delivery', 50),
  ('metadata','support-status','Support Status', null, false, 21,
   'no support column on the product', 'support', 50),

  -- Actions the registry did not have yet.
  ('action','quick-view','Quick View', null, false, 11,
   'no quick-view modal exists yet', 'quickview', 50),
  ('action','add-to-cart','Add to Cart', null, false, 12,
   'marketplace_carts, through the same server function the product page uses',
   'cart', 50),
  ('action','add-to-collection','Add to Collection', null, false, 13,
   'no marketplace collection system exists', 'collection', 50),
  ('action','notify-me','Notify Me', null, false, 14,
   'the marketplace lead endpoint already accepts notify_me', 'notify', 50),

  -- The twelve badges.
  ('badge','badge-new',           'New',           'is_new_release', true,  1, null, 'is_new_release', 20),
  ('badge','badge-trending',      'Trending',      'is_trending',    true,  2, null, 'is_trending',    30),
  ('badge','badge-featured',      'Featured',      'is_featured',    true,  3, null, 'is_featured',    10),
  ('badge','badge-best-seller',   'Best Seller',   'is_best_seller', false, 4,
   'no product carries this flag', 'is_best_seller', 40),
  ('badge','badge-editor-choice', 'Editor Choice', null,             false, 5,
   'no editorial flag on the product', 'editor_choice', 50),
  ('badge','badge-staff-pick',    'Staff Pick',    null,             false, 6,
   'no staff-pick flag on the product', 'staff_pick', 60),
  ('badge','badge-ai-ready',      'AI Ready',      'is_ai',          false, 7,
   '1 product carries this flag', 'is_ai', 70),
  ('badge','badge-cloud',         'Cloud',         'cloud',          false, 8,
   '1 product records this', 'cloud', 80),
  ('badge','badge-offline',       'Offline',       'offline',        false, 9,
   '1 product records this', 'offline', 90),
  ('badge','badge-saas',          'SaaS',          null,             false,10,
   'no SaaS flag on the product', 'saas', 95),
  ('badge','badge-enterprise',    'Enterprise',    null,             false,11,
   'no enterprise flag on the product', 'enterprise', 96),
  ('badge','badge-verified',      'Verified',      'moderation_status', false,12,
   'every published product is approved, so this would mark all of them',
   'verified', 97),

  -- The six platform badges.
  ('platform','platform-windows','Windows', null, false, 1, 'no per-platform column on the product', 'platform_windows', 10),
  ('platform','platform-macos',  'macOS',   null, false, 2, 'no per-platform column on the product', 'platform_macos',   20),
  ('platform','platform-linux',  'Linux',   null, false, 3, 'no per-platform column on the product', 'platform_linux',   30),
  ('platform','platform-android','Android', 'mobile', false, 4, '1 product records a mobile value', 'mobile', 40),
  ('platform','platform-ios',    'iOS',     'mobile', false, 5, '1 product records a mobile value', 'mobile', 50),
  ('platform','platform-web',    'Web',     'deployment', false, 6, 'from the deployment field', 'deployment', 60)
on conflict (key) do nothing;

/* ------------------------------------------------------- coverage, widened */

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

    elsif r.requires = 'reviews' then
      select count(distinct product_id) into v_have from public.marketplace_reviews;

    elsif r.requires = 'views' then
      select count(distinct product_id) into v_have
        from public.marketplace_events where event_type = 'product_view';

    elsif r.requires = 'cart' then
      -- The store exists; what matters is that it is reachable, not how many
      -- rows happen to be in it today.
      select count(*) into v_have from public.marketplace_carts;

    elsif r.requires in ('is_featured','is_trending','is_new_release','is_best_seller','is_ai') then
      execute format(
        'select count(*) from public.marketplace_products
          where visible and content_status = ''published'' and %I', r.requires)
      into v_have;

    elsif r.requires = 'verified' then
      select count(*) into v_have from public.marketplace_products
       where visible and content_status = 'published'
         and moderation_status::text = 'approved';

    elsif r.requires = 'rating' then
      select count(*) into v_have from public.marketplace_products
       where visible and content_status = 'published' and coalesce(rating, 0) > 0;

    elsif r.requires = 'downloads' then
      select count(*) into v_have from public.marketplace_products
       where visible and content_status = 'published' and coalesce(downloads, 0) > 0;

    elsif r.requires = 'updated_at' then
      select count(*) into v_have from public.marketplace_products
       where visible and content_status = 'published' and updated_at is not null;

    elsif r.requires = 'tags' then
      select count(*) into v_have from public.marketplace_products
       where visible and content_status = 'published'
         and tags is not null and array_length(tags, 1) > 0;

    elsif r.requires in ('thumbnail_url','logo','cover_image','description','price_label',
                         'license','version','deployment','content_status','benefits',
                         'badge','mobile','cloud','offline') then
      execute format(
        'select count(*) from public.marketplace_products
          where visible and content_status = ''published''
            and coalesce(btrim(%I::text), '''') <> ''''', r.requires)
      into v_have;
    end if;
    -- Anything else - gallery, video, 3D, brochure, checkout, quick view,
    -- collections, notify, per-platform flags - has no store in this database,
    -- so it stays null and is reported as "no store" rather than as zero.

    v_out := v_out || jsonb_build_object(
      'kind', r.kind, 'key', r.key, 'label', r.label,
      'enabled', r.enabled, 'position', r.position, 'priority', r.priority,
      'hint', r.hint, 'requires', r.requires, 'data_column', r.data_column,
      'have', v_have, 'total', v_total,
      'pct', case when v_have is null or v_total = 0 then null
                  else round(100.0 * v_have / v_total) end);
  end loop;

  return jsonb_build_object('ok', true, 'total_products', v_total, 'fields', v_out);
end;
$$;

-- Ordering, for fields, actions and badge priority alike.
create or replace function public.mm_card_reorder(p_kind text, p_keys text[])
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_before jsonb; v_after jsonb; v_n integer;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select count(*) into v_n from public.marketplace_card_fields
   where kind = p_kind and key = any(p_keys);
  if v_n <> coalesce(array_length(p_keys, 1), 0) then
    return jsonb_build_object('ok', false, 'reason', 'unknown_field');
  end if;

  select jsonb_agg(jsonb_build_object('key', key, 'position', position) order by position)
    into v_before from public.marketplace_card_fields where kind = p_kind;

  update public.marketplace_card_fields f
     set position = array_position(p_keys, f.key),
         -- Badges are ordered by priority on the card, so the two move together.
         priority = case when p_kind = 'badge'
                         then array_position(p_keys, f.key) * 10 else f.priority end,
         updated_by = auth.uid(), updated_at = now()
   where f.kind = p_kind and f.key = any(p_keys);

  select jsonb_agg(jsonb_build_object('key', key, 'position', position) order by position)
    into v_after from public.marketplace_card_fields where kind = p_kind;

  perform public.mm_audit('card.reorder', 'product_card', p_kind, v_before, v_after, null);
  return jsonb_build_object('ok', true, 'order', v_after);
end;
$$;
-- The screen's "Visible Fields" group spans two kinds - four visual fields and
-- fourteen metadata ones - because that is how the screen has always grouped
-- them. Filtering the reorder by kind would reject that list as containing
-- unknown fields, so the kind is used for the audit entry and the keys
-- themselves decide what moves.
create or replace function public.mm_card_reorder(p_kind text, p_keys text[])
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_before jsonb; v_after jsonb; v_n integer;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select count(*) into v_n from public.marketplace_card_fields where key = any(p_keys);
  if v_n <> coalesce(array_length(p_keys, 1), 0) then
    return jsonb_build_object('ok', false, 'reason', 'unknown_field');
  end if;

  select jsonb_agg(jsonb_build_object('key', key, 'position', position) order by position)
    into v_before from public.marketplace_card_fields where key = any(p_keys);

  update public.marketplace_card_fields f
     set position = array_position(p_keys, f.key),
         -- Badges are drawn in priority order, so the two move together.
         priority = case when f.kind = 'badge'
                         then array_position(p_keys, f.key) * 10 else f.priority end,
         updated_by = auth.uid(), updated_at = now()
   where f.key = any(p_keys);

  select jsonb_agg(jsonb_build_object('key', key, 'position', position) order by position)
    into v_after from public.marketplace_card_fields where key = any(p_keys);

  perform public.mm_audit('card.reorder', 'product_card', p_kind, v_before, v_after, null);
  return jsonb_build_object('ok', true, 'order', v_after);
end;
$$;
