-- Marketplace homepage rows: manage the real ones.
--
-- The correction is right, and the evidence is in home-catalog.functions.ts.
-- The public homepage builds its product rows straight from
-- marketplace_categories — `is_hidden=eq.false`, `order=sort_order.asc`, one
-- row per category, keyed by slug — and then fills each row with
-- `productsFor(category_id)` ordered by sort_order. There is no other row
-- source. The categories ARE the homepage rows.
--
-- Which means marketplace_homepage_sections, which I added earlier, is a
-- second dataset the homepage has never read. Nothing here deletes it, but
-- nothing here uses it either: it is superseded, and the manager is being
-- repointed at the rows the public site actually renders.
--
-- So the model is:
--
--   the row      = a category (existing, real, stable key = slug)
--   its settings = marketplace_row_config, one row per category
--   its products = marketplace_row_slots, up to 60 positions per category
--
-- Config and slots are new because placement genuinely does not exist yet
-- anywhere — that is the missing capability, not a duplicate of an existing
-- one. Ordering and visibility are NOT duplicated: they stay on
-- marketplace_categories.sort_order and .is_hidden, which is what the homepage
-- reads, and the manager writes those columns directly.
--
-- The default is deliberately "behave exactly as today". A category with no
-- config row and no slots renders precisely as it does now, so adding control
-- cannot change the front page until somebody decides to.

comment on table public.marketplace_homepage_sections is
  'SUPERSEDED. The public homepage renders rows from marketplace_categories '
  '(see src/lib/marketplace/home-catalog.functions.ts). Row control lives in '
  'marketplace_row_config and marketplace_row_slots. Retained, not read.';

-- ---------------------------------------------------------------------------
-- Row settings — one per category.
-- ---------------------------------------------------------------------------
create table if not exists public.marketplace_row_config (
  category_id     uuid primary key references public.marketplace_categories(id) on delete cascade,
  source_mode     text not null default 'auto'
                    check (source_mode in ('manual','auto','hybrid')),
  max_products    int  not null default 60 check (max_products between 1 and 60),
  -- How auto and hybrid fill the remaining slots. 'sort_order' is what the
  -- homepage does today, so it is the default and nothing moves on its own.
  auto_rule       text not null default 'sort_order'
                    check (auto_rule in ('sort_order','newest','best_selling','trending','rating')),
  allow_cross_category boolean not null default false,
  allow_duplicates     boolean not null default false,
  visible_desktop boolean not null default true,
  visible_tablet  boolean not null default true,
  visible_mobile  boolean not null default true,
  starts_at       timestamptz,
  ends_at         timestamptz,
  cta_label       text,
  cta_href        text,
  status          text not null default 'published'
                    check (status in ('draft','review','scheduled','published','unpublished','archived')),
  updated_by      uuid,
  updated_at      timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Product placement — up to 60 positions per row.
-- ---------------------------------------------------------------------------
create table if not exists public.marketplace_row_slots (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.marketplace_categories(id) on delete cascade,
  position    int  not null check (position between 1 and 60),
  product_id  uuid not null references public.marketplace_products(id) on delete cascade,
  -- Pinned slots survive an auto-fill; unpinned manual slots do not.
  pinned      boolean not null default true,
  added_by    uuid,
  created_at  timestamptz not null default now(),
  unique (category_id, position)
);

-- Duplicate protection, section 18. A partial unique index rather than a plain
-- one, so a row that explicitly allows duplicates can still be configured —
-- the check lives in the assign function, which reads allow_duplicates.
create unique index if not exists mm_row_slots_no_dupe
  on public.marketplace_row_slots (category_id, product_id);

create index if not exists mm_row_slots_row_idx
  on public.marketplace_row_slots (category_id, position);

-- ---------------------------------------------------------------------------
-- Authorization and visibility.
-- ---------------------------------------------------------------------------
alter table public.marketplace_row_config enable row level security;
alter table public.marketplace_row_slots  enable row level security;

-- Everyone may read what the homepage shows; only operators change it. The
-- homepage itself reads through the service role, so this governs the manager.
drop policy if exists mm_row_config_read on public.marketplace_row_config;
create policy mm_row_config_read on public.marketplace_row_config
  for select to authenticated using (true);
drop policy if exists mm_row_config_write on public.marketplace_row_config;
create policy mm_row_config_write on public.marketplace_row_config
  for all to authenticated
  using (public.mm_is_operator()) with check (public.mm_is_operator());

drop policy if exists mm_row_slots_read on public.marketplace_row_slots;
create policy mm_row_slots_read on public.marketplace_row_slots
  for select to authenticated using (true);
drop policy if exists mm_row_slots_write on public.marketplace_row_slots;
create policy mm_row_slots_write on public.marketplace_row_slots
  for all to authenticated
  using (public.mm_is_operator()) with check (public.mm_is_operator());

do $$
declare t text;
begin
  foreach t in array array['marketplace_row_config','marketplace_row_slots'] loop
    execute format('drop policy if exists %I on public.%I', t || '_anon_denied', t);
    execute format(
      'create policy %I on public.%I as restrictive to anon using (false) with check (false)',
      t || '_anon_denied', t);
  end loop;
end $$;
-- Row operations. Every one writes the source of truth the homepage reads.

-- ---------------------------------------------------------------------------
-- The row list — the real homepage rows, with real counts.
-- ---------------------------------------------------------------------------
-- Replaces the static ROWS array in HomepageRowsSection.tsx. Every number here
-- is counted, including how many of the 60 positions are actually filled and
-- how many eligible products exist to fill them with.

create or replace function public.mm_rows_list()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(r order by r->>'sort_order'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'key',            c.slug,
      'category_id',    c.id,
      'title',          c.name,
      'icon',           c.icon,
      'sort_order',     lpad(coalesce(c.sort_order,9999)::text, 6, '0'),
      'sort_order_num', c.sort_order,
      'hidden',         c.is_hidden,
      'featured',       c.is_featured,
      'source_mode',    coalesce(cfg.source_mode, 'auto'),
      'auto_rule',      coalesce(cfg.auto_rule, 'sort_order'),
      'max_products',   coalesce(cfg.max_products, 60),
      'status',         coalesce(cfg.status, 'published'),
      'visible_desktop', coalesce(cfg.visible_desktop, true),
      'visible_tablet',  coalesce(cfg.visible_tablet, true),
      'visible_mobile',  coalesce(cfg.visible_mobile, true),
      'starts_at',      cfg.starts_at,
      'ends_at',        cfg.ends_at,
      'cta_label',      cfg.cta_label,
      'cta_href',       cfg.cta_href,
      'configured',     (cfg.category_id is not null),
      -- Real counts, not hardcoded.
      'filled_slots',   (select count(*) from public.marketplace_row_slots s
                          where s.category_id = c.id),
      'pinned_slots',   (select count(*) from public.marketplace_row_slots s
                          where s.category_id = c.id and s.pinned),
      'eligible_products', (select count(*) from public.marketplace_products p
                             where p.category_id = c.id and p.visible
                               and p.content_status = 'published'),
      'updated_at',     cfg.updated_at
    ) r
    from public.marketplace_categories c
    left join public.marketplace_row_config cfg on cfg.category_id = c.id
  ) x;
$$;

grant execute on function public.mm_rows_list() to authenticated;

-- ---------------------------------------------------------------------------
-- Resolving a row's 60 positions.
-- ---------------------------------------------------------------------------
-- The single place that decides what a row contains, used by both the manager
-- (to show the slot wall) and the homepage (to render). One resolver means the
-- two can never disagree, which is the whole point of section 8.
--
-- manual : only what has been placed. Empty positions stay empty.
-- auto   : ignore placement, fill by the configured rule.
-- hybrid : pinned placements hold their positions, everything else fills in
--          around them in the first free slots.

create or replace function public.mm_row_products(p_key text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_cat   uuid;
  v_mode  text;
  v_rule  text;
  v_max   int;
  v_out   jsonb := '[]'::jsonb;
  v_taken uuid[];
  r       record;
  i       int;
begin
  select c.id into v_cat from public.marketplace_categories c where c.slug = p_key;
  if v_cat is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_row');
  end if;

  select coalesce(cfg.source_mode,'auto'), coalesce(cfg.auto_rule,'sort_order'),
         coalesce(cfg.max_products,60)
    into v_mode, v_rule, v_max
  from public.marketplace_categories c
  left join public.marketplace_row_config cfg on cfg.category_id = c.id
  where c.id = v_cat;

  -- Placed products first, in their positions.
  if v_mode in ('manual','hybrid') then
    for r in
      select s.position, s.product_id, s.pinned, p.name, p.slug, p.thumbnail_url,
             p.visible, p.content_status
      from public.marketplace_row_slots s
      join public.marketplace_products p on p.id = s.product_id
      where s.category_id = v_cat and s.position <= v_max
      order by s.position
    loop
      v_out := v_out || jsonb_build_object(
        'position', r.position, 'product_id', r.product_id, 'name', r.name,
        'slug', r.slug, 'thumbnail_url', r.thumbnail_url, 'pinned', r.pinned,
        'source', 'manual',
        -- Surfaced so the manager can see a placed product that has since been
        -- unpublished, rather than silently dropping it.
        'live', (r.visible and r.content_status = 'published'));
      v_taken := array_append(v_taken, r.product_id);
    end loop;
  end if;

  -- Then auto-fill, for auto and hybrid, into the positions still free.
  if v_mode in ('auto','hybrid') then
    i := 1;
    for r in
      select p.id, p.name, p.slug, p.thumbnail_url
      from public.marketplace_products p
      left join (
        select oi.product_id, count(*) sold
        from public.marketplace_order_items oi
        join public.marketplace_orders o on o.id = oi.order_id and o.status::text = 'paid'
        group by oi.product_id
      ) s on s.product_id = p.id
      left join (
        select e.product_id, count(*) views
        from public.marketplace_events e
        where e.created_at > now() - interval '30 days'
        group by e.product_id
      ) v on v.product_id = p.id
      where p.category_id = v_cat
        and p.visible and p.content_status = 'published'
        and (v_taken is null or not (p.id = any(v_taken)))
      order by
        case v_rule when 'newest'       then extract(epoch from p.created_at) end desc nulls last,
        case v_rule when 'best_selling' then coalesce(s.sold,0)  end desc nulls last,
        case v_rule when 'trending'     then coalesce(v.views,0) end desc nulls last,
        p.sort_order asc nulls last, p.name asc
      limit v_max
    loop
      -- Walk to the next position no placed product already holds.
      while exists (select 1 from public.marketplace_row_slots s2
                    where s2.category_id = v_cat and s2.position = i)
            and v_mode = 'hybrid' loop
        i := i + 1;
      end loop;
      exit when i > v_max;
      v_out := v_out || jsonb_build_object(
        'position', i, 'product_id', r.id, 'name', r.name, 'slug', r.slug,
        'thumbnail_url', r.thumbnail_url, 'pinned', false,
        'source', 'auto', 'live', true);
      i := i + 1;
    end loop;
  end if;

  return jsonb_build_object(
    'ok', true, 'row', p_key, 'source_mode', v_mode, 'auto_rule', v_rule,
    'max_products', v_max,
    'filled', jsonb_array_length(v_out),
    -- Stated rather than padded: a row with 37 eligible products reports 37
    -- filled and 23 empty, and the UI draws the empty ones as available slots.
    'empty', greatest(v_max - jsonb_array_length(v_out), 0),
    'eligible_total', (select count(*) from public.marketplace_products p
                        where p.category_id = v_cat and p.visible
                          and p.content_status = 'published'),
    'products', v_out);
end $$;

grant execute on function public.mm_row_products(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Assigning a product to a slot — with the category check.
-- ---------------------------------------------------------------------------
create or replace function public.mm_slot_assign(
  p_key text, p_position int, p_product_id uuid, p_override boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cat uuid; v_pcat uuid; v_max int; v_dupes boolean; v_cross boolean;
  v_pname text; v_pcatname text; v_rowname text;
  v_live boolean; v_mod text;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select c.id, c.name into v_cat, v_rowname
  from public.marketplace_categories c where c.slug = p_key;
  if v_cat is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_row');
  end if;

  select coalesce(cfg.max_products,60), coalesce(cfg.allow_duplicates,false),
         coalesce(cfg.allow_cross_category,false)
    into v_max, v_dupes, v_cross
  from public.marketplace_categories c
  left join public.marketplace_row_config cfg on cfg.category_id = c.id
  where c.id = v_cat;

  if p_position < 1 or p_position > v_max then
    return jsonb_build_object('ok', false, 'reason', 'position_out_of_range',
                              'max', v_max);
  end if;

  select p.category_id, p.name, (p.visible and p.content_status='published'),
         p.moderation_status::text
    into v_pcat, v_pname, v_live, v_mod
  from public.marketplace_products p where p.id = p_product_id;
  if v_pname is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_product');
  end if;

  -- Section 6: never silently place a product from another category. Say what
  -- it actually belongs to so the manager can decide.
  if v_pcat is distinct from v_cat and not (p_override and v_cross) then
    select c.name into v_pcatname from public.marketplace_categories c where c.id = v_pcat;
    return jsonb_build_object(
      'ok', false, 'reason', 'category_mismatch',
      'message', 'Product category mismatch',
      'product', v_pname,
      'product_category', coalesce(v_pcatname, 'none'),
      'row_category', v_rowname,
      'override_allowed', v_cross);
  end if;

  if not v_dupes and exists (
    select 1 from public.marketplace_row_slots s
    where s.category_id = v_cat and s.product_id = p_product_id
      and s.position <> p_position)
  then
    return jsonb_build_object('ok', false, 'reason', 'duplicate_product',
                              'message', 'This product already occupies another slot in this row.');
  end if;

  insert into public.marketplace_row_slots (category_id, position, product_id, added_by)
  values (v_cat, p_position, p_product_id, auth.uid())
  on conflict (category_id, position) do update
    set product_id = excluded.product_id, added_by = excluded.added_by,
        created_at = now();

  -- Placing anything makes the row curated; a purely automatic row would
  -- ignore the placement and the manager would see nothing happen.
  insert into public.marketplace_row_config (category_id, source_mode, updated_by, updated_at)
  values (v_cat, 'hybrid', auth.uid(), now())
  on conflict (category_id) do update
    set source_mode = case when public.marketplace_row_config.source_mode = 'auto'
                           then 'hybrid' else public.marketplace_row_config.source_mode end,
        updated_by = auth.uid(), updated_at = now();

  perform public.mm_audit('row_slot_assign', 'homepage_row', v_cat::text,
    jsonb_build_object('row', p_key, 'position', p_position),
    jsonb_build_object('product', v_pname, 'live', v_live, 'moderation', v_mod),
    'assigned to slot ' || p_position);

  return jsonb_build_object('ok', true, 'row', p_key, 'position', p_position,
                            'product', v_pname, 'live', v_live);
end $$;

grant execute on function public.mm_slot_assign(text,int,uuid,boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Remove, move, pin.
-- ---------------------------------------------------------------------------
create or replace function public.mm_slot_remove(p_key text, p_position int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_cat uuid; n int;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  select id into v_cat from public.marketplace_categories where slug = p_key;
  if v_cat is null then return jsonb_build_object('ok', false, 'reason', 'unknown_row'); end if;

  delete from public.marketplace_row_slots
  where category_id = v_cat and position = p_position;
  get diagnostics n = row_count;

  perform public.mm_audit('row_slot_remove', 'homepage_row', v_cat::text,
    jsonb_build_object('row', p_key, 'position', p_position), '{}'::jsonb,
    'cleared slot ' || p_position);
  return jsonb_build_object('ok', true, 'removed', n);
end $$;

grant execute on function public.mm_slot_remove(text,int) to authenticated;

create or replace function public.mm_slot_move(p_key text, p_from int, p_to int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_cat uuid; v_a uuid; v_b uuid;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  select id into v_cat from public.marketplace_categories where slug = p_key;
  if v_cat is null then return jsonb_build_object('ok', false, 'reason', 'unknown_row'); end if;

  select product_id into v_a from public.marketplace_row_slots
   where category_id = v_cat and position = p_from;
  if v_a is null then return jsonb_build_object('ok', false, 'reason', 'empty_source'); end if;
  select product_id into v_b from public.marketplace_row_slots
   where category_id = v_cat and position = p_to;

  -- A swap, done through a position the unique index cannot be holding.
  delete from public.marketplace_row_slots where category_id = v_cat and position in (p_from, p_to);
  insert into public.marketplace_row_slots (category_id, position, product_id, added_by)
  values (v_cat, p_to, v_a, auth.uid());
  if v_b is not null then
    insert into public.marketplace_row_slots (category_id, position, product_id, added_by)
    values (v_cat, p_from, v_b, auth.uid());
  end if;

  perform public.mm_audit('row_slot_move', 'homepage_row', v_cat::text,
    jsonb_build_object('row', p_key, 'from', p_from),
    jsonb_build_object('to', p_to),
    'moved ' || p_from || ' to ' || p_to);
  return jsonb_build_object('ok', true, 'from', p_from, 'to', p_to, 'swapped', v_b is not null);
end $$;

grant execute on function public.mm_slot_move(text,int,int) to authenticated;

create or replace function public.mm_slot_pin(p_key text, p_position int, p_pinned boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_cat uuid;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  select id into v_cat from public.marketplace_categories where slug = p_key;
  if v_cat is null then return jsonb_build_object('ok', false, 'reason', 'unknown_row'); end if;
  update public.marketplace_row_slots set pinned = p_pinned
   where category_id = v_cat and position = p_position;
  return jsonb_build_object('ok', true, 'position', p_position, 'pinned', p_pinned);
end $$;

grant execute on function public.mm_slot_pin(text,int,boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Row settings, ordering and visibility — written where the homepage reads.
-- ---------------------------------------------------------------------------
create or replace function public.mm_row_configure(p_key text, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_cat uuid; v_before jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  select id into v_cat from public.marketplace_categories where slug = p_key;
  if v_cat is null then return jsonb_build_object('ok', false, 'reason', 'unknown_row'); end if;

  select to_jsonb(cfg) into v_before from public.marketplace_row_config cfg where category_id = v_cat;

  insert into public.marketplace_row_config (category_id, updated_by, updated_at)
  values (v_cat, auth.uid(), now())
  on conflict (category_id) do nothing;

  update public.marketplace_row_config set
    source_mode          = coalesce(p_patch->>'source_mode', source_mode),
    auto_rule            = coalesce(p_patch->>'auto_rule', auto_rule),
    max_products         = coalesce((p_patch->>'max_products')::int, max_products),
    allow_cross_category = coalesce((p_patch->>'allow_cross_category')::boolean, allow_cross_category),
    allow_duplicates     = coalesce((p_patch->>'allow_duplicates')::boolean, allow_duplicates),
    visible_desktop      = coalesce((p_patch->>'visible_desktop')::boolean, visible_desktop),
    visible_tablet       = coalesce((p_patch->>'visible_tablet')::boolean, visible_tablet),
    visible_mobile       = coalesce((p_patch->>'visible_mobile')::boolean, visible_mobile),
    starts_at            = coalesce((p_patch->>'starts_at')::timestamptz, starts_at),
    ends_at              = coalesce((p_patch->>'ends_at')::timestamptz, ends_at),
    cta_label            = coalesce(p_patch->>'cta_label', cta_label),
    cta_href             = coalesce(p_patch->>'cta_href', cta_href),
    status               = coalesce(p_patch->>'status', status),
    updated_by = auth.uid(), updated_at = now()
  where category_id = v_cat;

  -- Visibility belongs to the category, because that is the column the
  -- homepage filters on. Writing it anywhere else would be the duplicate
  -- source of truth this whole change exists to remove.
  if p_patch ? 'hidden' then
    update public.marketplace_categories
       set is_hidden = (p_patch->>'hidden')::boolean, updated_at = now()
     where id = v_cat;
  end if;

  perform public.mm_audit('row_configure', 'homepage_row', v_cat::text,
    coalesce(v_before, '{}'::jsonb), p_patch, 'row settings changed');
  return jsonb_build_object('ok', true, 'row', p_key);
end $$;

grant execute on function public.mm_row_configure(text,jsonb) to authenticated;

create or replace function public.mm_rows_reorder(p_keys text[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare i int := 0; k text; n int := 0;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  foreach k in array p_keys loop
    i := i + 1;
    update public.marketplace_categories
       set sort_order = i, updated_at = now()
     where slug = k;
    if found then n := n + 1; end if;
  end loop;
  perform public.mm_audit('rows_reorder', 'homepage_row',
    '00000000-0000-0000-0000-000000000000',
    '{}'::jsonb, jsonb_build_object('ordered', to_jsonb(p_keys)),
    'homepage row order changed');
  return jsonb_build_object('ok', true, 'rows', n);
end $$;

grant execute on function public.mm_rows_reorder(text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Real analytics — section 13.
-- ---------------------------------------------------------------------------
create or replace function public.mm_row_analytics(p_key text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_cat uuid; v_views bigint; v_demo bigint; v_cta bigint; v_orders bigint; v_rev numeric;
begin
  select id into v_cat from public.marketplace_categories where slug = p_key;
  if v_cat is null then return jsonb_build_object('ok', false, 'reason', 'unknown_row'); end if;

  select count(*) filter (where event_type::text = 'product_view'),
         count(*) filter (where event_type::text = 'demo_click'),
         count(*) filter (where event_type::text = 'cta_click')
    into v_views, v_demo, v_cta
  from public.marketplace_events where category_id = v_cat;

  select count(distinct o.id), coalesce(sum(oi.line_total),0)
    into v_orders, v_rev
  from public.marketplace_order_items oi
  join public.marketplace_orders o on o.id = oi.order_id and o.status::text = 'paid'
  join public.marketplace_products p on p.id = oi.product_id
  where p.category_id = v_cat;

  return jsonb_build_object(
    'ok', true, 'row', p_key,
    'product_views', v_views, 'demo_opens', v_demo, 'cta_clicks', v_cta,
    'orders', v_orders, 'revenue', v_rev,
    -- Returned as null rather than 0 when there is nothing to divide by, so
    -- the UI shows "not measured yet" instead of a confident 0.0%.
    'ctr', case when coalesce(v_views,0) > 0
                then round((coalesce(v_demo,0) + coalesce(v_cta,0))::numeric * 100 / v_views, 2)
                else null end,
    'conversion', case when coalesce(v_views,0) > 0
                       then round(coalesce(v_orders,0)::numeric * 100 / v_views, 2)
                       else null end,
    'measured_from', (select min(created_at) from public.marketplace_events where category_id = v_cat));
end $$;

grant execute on function public.mm_row_analytics(text) to authenticated;
