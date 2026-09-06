-- One registry for every homepage row, including the ones that are not
-- categories.
--
-- The homepage's product rows are categories, and that stays true. But the
-- brief also names featured-software, trending-now, top-selling and
-- new-releases, and those are not categories and do not exist on the page at
-- all. "If a row does not exist: CREATE IT" means the registry has to be able
-- to hold a row that no category backs.
--
-- The danger is obvious, because I already made this mistake once: a second
-- table the homepage never reads. What makes this different is that the
-- homepage renders from it in the same pass as the categories, so a curated row
-- created here appears on the public page. If it did not, it would be the same
-- error with a new name.
--
-- marketplace_row_config was empty, so it is restructured rather than
-- duplicated:
--
--   row_kind = 'category'  -> category_id set; the row IS that category
--   row_kind = 'curated'   -> category_id null; the row is a rule over the
--                             whole catalogue (featured, trending, ...)
--
-- Ordering still belongs to marketplace_categories.sort_order for category
-- rows. A curated row carries its own sort_order, and the homepage merges the
-- two into one ordered list, so there is a single order and not two.

alter table public.marketplace_row_config
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists key text,
  add column if not exists title text,
  add column if not exists row_kind text not null default 'category',
  add column if not exists sort_order int,
  add column if not exists subcategory text,
  add column if not exists created_by uuid;

-- category_id was the primary key. A curated row has no category, so the key
-- moves to the surrogate id and category_id becomes optional-but-unique.
-- Only when the primary key is still the original category_id one. On a
-- replay the key is already `id`, and dropping it would fail anyway because
-- marketplace_row_slots.row_id now references it.
do $$
declare v_con text;
begin
  select con.conname into v_con
  from pg_constraint con
  where con.conrelid = 'public.marketplace_row_config'::regclass
    and con.contype = 'p'
    and (select array_agg(att.attname::text order by att.attname)
         from unnest(con.conkey) k
         join pg_attribute att
           on att.attrelid = con.conrelid and att.attnum = k) = array['category_id'];
  if v_con is not null then
    execute 'alter table public.marketplace_row_config drop constraint ' || quote_ident(v_con);
  end if;
end $$;

update public.marketplace_row_config set id = gen_random_uuid() where id is null;

alter table public.marketplace_row_config
  alter column id set not null,
  alter column category_id drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.marketplace_row_config'::regclass and contype = 'p'
  ) then
    alter table public.marketplace_row_config add primary key (id);
  end if;
end $$;

create unique index if not exists mm_row_config_key_uq
  on public.marketplace_row_config (key) where key is not null;
create unique index if not exists mm_row_config_category_uq
  on public.marketplace_row_config (category_id) where category_id is not null;

alter table public.marketplace_row_config
  drop constraint if exists marketplace_row_config_row_kind_check;
alter table public.marketplace_row_config
  add constraint marketplace_row_config_row_kind_check
  check (row_kind in ('category','curated'));

-- A curated row needs a rule that means something across the catalogue.
alter table public.marketplace_row_config
  drop constraint if exists marketplace_row_config_auto_rule_check;
alter table public.marketplace_row_config
  add constraint marketplace_row_config_auto_rule_check
  check (auto_rule in ('sort_order','newest','best_selling','trending','rating',
                       'featured','new_release'));

-- A category row must name its category; a curated row must not.
alter table public.marketplace_row_config
  drop constraint if exists marketplace_row_config_kind_shape;
alter table public.marketplace_row_config
  add constraint marketplace_row_config_kind_shape check (
    (row_kind = 'category' and category_id is not null)
    or (row_kind = 'curated' and category_id is null and key is not null)
  );

-- Slots hang off a row, not off a category, so a curated row can be curated by
-- hand exactly like a category row. category_id is kept for the rows that have
-- one, so nothing that already worked changes shape.
alter table public.marketplace_row_slots
  add column if not exists row_id uuid references public.marketplace_row_config(id) on delete cascade;

create index if not exists mm_row_slots_rowid_idx
  on public.marketplace_row_slots (row_id, position);

-- The old (category_id, position) unique index cannot express a curated row, so
-- a parallel pair of partial indexes covers both shapes without dropping the
-- protection either provides.
create unique index if not exists mm_row_slots_rowpos_uq
  on public.marketplace_row_slots (row_id, position) where row_id is not null;
create unique index if not exists mm_row_slots_rowdupe_uq
  on public.marketplace_row_slots (row_id, product_id) where row_id is not null;

comment on table public.marketplace_row_config is
  'Every homepage row. row_kind=category rows are backed by marketplace_categories '
  '(which the homepage still orders and filters by); row_kind=curated rows are '
  'catalogue-wide rules such as featured-software or trending-now.';
-- Row operations, now covering curated rows as well as category rows.

-- ---------------------------------------------------------------------------
-- Resolving a row, whatever kind it is.
-- ---------------------------------------------------------------------------
-- One helper so every other function agrees on what a key means. A key is
-- either a category slug or a curated row's key, and nothing else needs to
-- care which.

create or replace function public.mm_row_resolve(p_key text)
returns table (
  row_id uuid, kind text, category_id uuid, title text, max_products int,
  source_mode text, auto_rule text, allow_cross boolean, allow_dupes boolean,
  status text, starts_at timestamptz, ends_at timestamptz, hidden boolean
) language sql stable security definer set search_path = public as $$
  -- A curated row: keyed directly.
  select cfg.id, cfg.row_kind, cfg.category_id, cfg.title, cfg.max_products,
         cfg.source_mode, cfg.auto_rule, cfg.allow_cross_category,
         cfg.allow_duplicates, cfg.status, cfg.starts_at, cfg.ends_at, false
  from public.marketplace_row_config cfg
  where cfg.key = p_key and cfg.row_kind = 'curated'
  union all
  -- A category row: keyed by the category slug, config optional.
  select cfg.id, 'category', c.id, c.name, coalesce(cfg.max_products, 60),
         coalesce(cfg.source_mode, 'auto'), coalesce(cfg.auto_rule, 'sort_order'),
         coalesce(cfg.allow_cross_category, false), coalesce(cfg.allow_duplicates, false),
         coalesce(cfg.status, 'published'), cfg.starts_at, cfg.ends_at, c.is_hidden
  from public.marketplace_categories c
  left join public.marketplace_row_config cfg
    on cfg.category_id = c.id and cfg.row_kind = 'category'
  where c.slug = p_key
  limit 1;
$$;

grant execute on function public.mm_row_resolve(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Is a row live right now? Section 11's schedule, answered in one place.
-- ---------------------------------------------------------------------------
create or replace function public.mm_row_is_live(p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select r.status = 'published'
       and not coalesce(r.hidden, false)
       and (r.starts_at is null or r.starts_at <= now())
       and (r.ends_at   is null or r.ends_at   >  now())
    from public.mm_row_resolve(p_key) r
  ), false);
$$;

grant execute on function public.mm_row_is_live(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Create Row — section 9.
-- ---------------------------------------------------------------------------
-- Creating a category row means configuring the category that already exists;
-- creating a curated row means registering a new one. Both end up in the same
-- registry the homepage reads, which is what makes this a real creation rather
-- than another private table.

create or replace function public.mm_row_create(p_spec jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_key text; v_kind text; v_cat uuid; v_id uuid; v_order int;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  v_key  := nullif(trim(coalesce(p_spec->>'key','')), '');
  v_kind := coalesce(p_spec->>'row_kind', 'curated');

  if v_key is null then
    return jsonb_build_object('ok', false, 'reason', 'key_required',
      'message', 'A stable row key is required. Display names can change; keys cannot.');
  end if;
  if v_key !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    return jsonb_build_object('ok', false, 'reason', 'bad_key',
      'message', 'Use a lowercase slug such as featured-software.');
  end if;

  -- Section 1: never create a second row with a key the homepage already has.
  if exists (select 1 from public.marketplace_categories where slug = v_key)
     or exists (select 1 from public.marketplace_row_config where key = v_key) then
    return jsonb_build_object('ok', false, 'reason', 'row_exists',
      'message', 'A homepage row with that key already exists — manage it instead of creating another.',
      'key', v_key);
  end if;

  if v_kind = 'category' then
    v_cat := nullif(p_spec->>'category_id','')::uuid;
    if v_cat is null then
      return jsonb_build_object('ok', false, 'reason', 'category_required');
    end if;
  end if;

  select coalesce(max(sort_order), (select coalesce(max(sort_order),0)
                                    from public.marketplace_categories)) + 1
    into v_order from public.marketplace_row_config;

  insert into public.marketplace_row_config (
    key, title, row_kind, category_id, subcategory, sort_order,
    source_mode, auto_rule, max_products,
    visible_desktop, visible_tablet, visible_mobile,
    starts_at, ends_at, cta_label, cta_href, status, created_by, updated_by)
  values (
    v_key,
    coalesce(nullif(p_spec->>'title',''), initcap(replace(v_key,'-',' '))),
    v_kind, v_cat, nullif(p_spec->>'subcategory',''),
    coalesce((p_spec->>'sort_order')::int, v_order),
    coalesce(p_spec->>'source_mode','auto'),
    coalesce(p_spec->>'auto_rule','featured'),
    least(coalesce((p_spec->>'max_products')::int, 60), 60),
    coalesce((p_spec->>'visible_desktop')::boolean, true),
    coalesce((p_spec->>'visible_tablet')::boolean, true),
    coalesce((p_spec->>'visible_mobile')::boolean, true),
    nullif(p_spec->>'starts_at','')::timestamptz,
    nullif(p_spec->>'ends_at','')::timestamptz,
    nullif(p_spec->>'cta_label',''), nullif(p_spec->>'cta_href',''),
    -- New rows start as drafts. Creating a row must not put something on the
    -- front page before anyone has looked at it.
    coalesce(p_spec->>'status','draft'),
    auth.uid(), auth.uid())
  returning id into v_id;

  perform public.mm_audit('row_create', 'homepage_row', v_id::text,
    '{}'::jsonb, p_spec, 'row created as a draft');

  return jsonb_build_object('ok', true, 'row_id', v_id, 'key', v_key,
    'status', coalesce(p_spec->>'status','draft'),
    'message', 'Row created as a draft. Publish it when it is ready to appear.');
end $$;

grant execute on function public.mm_row_create(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- The row list — both kinds, one ordered list.
-- ---------------------------------------------------------------------------
create or replace function public.mm_rows_list()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(r order by (r->>'effective_order')::int,
                                       r->>'title'), '[]'::jsonb)
  from (
    -- Category rows.
    select jsonb_build_object(
      'key', c.slug, 'row_id', cfg.id, 'row_kind', 'category',
      'category_id', c.id, 'title', c.name, 'icon', c.icon,
      'effective_order', coalesce(cfg.sort_order, c.sort_order, 9999),
      'hidden', c.is_hidden, 'featured', c.is_featured,
      'source_mode', coalesce(cfg.source_mode,'auto'),
      'auto_rule', coalesce(cfg.auto_rule,'sort_order'),
      'max_products', coalesce(cfg.max_products,60),
      'status', coalesce(cfg.status,'published'),
      'visible_desktop', coalesce(cfg.visible_desktop,true),
      'visible_tablet', coalesce(cfg.visible_tablet,true),
      'visible_mobile', coalesce(cfg.visible_mobile,true),
      'starts_at', cfg.starts_at, 'ends_at', cfg.ends_at,
      'cta_label', cfg.cta_label, 'cta_href', cfg.cta_href,
      'allow_cross_category', coalesce(cfg.allow_cross_category,false),
      'allow_duplicates', coalesce(cfg.allow_duplicates,false),
      'configured', (cfg.id is not null),
      'live_now', public.mm_row_is_live(c.slug),
      'filled_slots', (select count(*) from public.marketplace_row_slots s
                        where s.category_id = c.id or s.row_id = cfg.id),
      'eligible_products', (select count(*) from public.marketplace_products p
                             where p.category_id = c.id and p.visible
                               and p.content_status='published'),
      'updated_at', cfg.updated_at
    ) r
    from public.marketplace_categories c
    left join public.marketplace_row_config cfg
      on cfg.category_id = c.id and cfg.row_kind = 'category'

    union all

    -- Curated rows.
    select jsonb_build_object(
      'key', cfg.key, 'row_id', cfg.id, 'row_kind', 'curated',
      'category_id', null, 'title', cfg.title, 'icon', null,
      'effective_order', coalesce(cfg.sort_order, 9999),
      'hidden', false, 'featured', false,
      'source_mode', cfg.source_mode, 'auto_rule', cfg.auto_rule,
      'max_products', cfg.max_products, 'status', cfg.status,
      'visible_desktop', cfg.visible_desktop,
      'visible_tablet', cfg.visible_tablet,
      'visible_mobile', cfg.visible_mobile,
      'starts_at', cfg.starts_at, 'ends_at', cfg.ends_at,
      'cta_label', cfg.cta_label, 'cta_href', cfg.cta_href,
      'allow_cross_category', cfg.allow_cross_category,
      'allow_duplicates', cfg.allow_duplicates,
      'configured', true,
      'live_now', public.mm_row_is_live(cfg.key),
      'filled_slots', (select count(*) from public.marketplace_row_slots s
                        where s.row_id = cfg.id),
      'eligible_products', (
        select count(*) from public.marketplace_products p
        where p.visible and p.content_status='published'
          and case cfg.auto_rule
                when 'featured'     then p.is_featured
                when 'trending'     then p.is_trending
                when 'best_selling' then p.is_best_seller
                when 'new_release'  then p.is_new_release
                else true end),
      'updated_at', cfg.updated_at
    ) r
    from public.marketplace_row_config cfg
    where cfg.row_kind = 'curated'
  ) x;
$$;

grant execute on function public.mm_rows_list() to authenticated;

-- ---------------------------------------------------------------------------
-- A row's positions — category or curated.
-- ---------------------------------------------------------------------------
create or replace function public.mm_row_products(p_key text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  rw record; v_out jsonb := '[]'::jsonb; v_taken uuid[]; r record; i int;
begin
  select * into rw from public.mm_row_resolve(p_key);
  if rw.row_id is null and rw.category_id is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_row');
  end if;

  -- Placed products, whichever way the slot is keyed.
  if rw.source_mode in ('manual','hybrid') then
    for r in
      select s.position, s.product_id, s.pinned, p.name, p.slug, p.thumbnail_url,
             p.visible, p.content_status
      from public.marketplace_row_slots s
      join public.marketplace_products p on p.id = s.product_id
      where (s.row_id = rw.row_id or (rw.category_id is not null and s.category_id = rw.category_id))
        and s.position <= rw.max_products
      order by s.position
    loop
      v_out := v_out || jsonb_build_object(
        'position', r.position, 'product_id', r.product_id, 'name', r.name,
        'slug', r.slug, 'thumbnail_url', r.thumbnail_url, 'pinned', r.pinned,
        'source', 'manual',
        'live', (r.visible and r.content_status = 'published'));
      v_taken := array_append(v_taken, r.product_id);
    end loop;
  end if;

  if rw.source_mode in ('auto','hybrid') then
    i := 1;
    for r in
      select p.id, p.name, p.slug, p.thumbnail_url
      from public.marketplace_products p
      left join (
        select oi.product_id, count(*) sold
        from public.marketplace_order_items oi
        join public.marketplace_orders o on o.id = oi.order_id and o.status::text='paid'
        group by oi.product_id) s on s.product_id = p.id
      left join (
        select e.product_id, count(*) views
        from public.marketplace_events e
        where e.created_at > now() - interval '30 days'
        group by e.product_id) v on v.product_id = p.id
      where p.visible and p.content_status = 'published'
        -- A category row draws from its category; a curated row draws from the
        -- whole catalogue, narrowed by its rule.
        and (rw.category_id is null or p.category_id = rw.category_id)
        and (rw.kind = 'category' or case rw.auto_rule
               when 'featured'     then p.is_featured
               when 'trending'     then p.is_trending
               when 'best_selling' then p.is_best_seller
               when 'new_release'  then p.is_new_release
               else true end)
        and (v_taken is null or not (p.id = any(v_taken)))
      order by
        case rw.auto_rule when 'newest' then extract(epoch from p.created_at) end desc nulls last,
        case rw.auto_rule when 'new_release' then extract(epoch from p.created_at) end desc nulls last,
        case rw.auto_rule when 'best_selling' then coalesce(s.sold,0) end desc nulls last,
        case rw.auto_rule when 'trending' then coalesce(v.views,0) end desc nulls last,
        case rw.auto_rule when 'rating' then p.rating end desc nulls last,
        p.sort_order asc nulls last, p.name asc
      limit rw.max_products
    loop
      while exists (
        select 1 from public.marketplace_row_slots s2
        where (s2.row_id = rw.row_id
               or (rw.category_id is not null and s2.category_id = rw.category_id))
          and s2.position = i)
        and rw.source_mode = 'hybrid' loop
        i := i + 1;
      end loop;
      exit when i > rw.max_products;
      v_out := v_out || jsonb_build_object(
        'position', i, 'product_id', r.id, 'name', r.name, 'slug', r.slug,
        'thumbnail_url', r.thumbnail_url, 'pinned', false,
        'source', 'auto', 'live', true);
      i := i + 1;
    end loop;
  end if;

  return jsonb_build_object(
    'ok', true, 'row', p_key, 'row_kind', rw.kind,
    'source_mode', rw.source_mode, 'auto_rule', rw.auto_rule,
    'max_products', rw.max_products,
    'live_now', public.mm_row_is_live(p_key),
    'filled', jsonb_array_length(v_out),
    'empty', greatest(rw.max_products - jsonb_array_length(v_out), 0),
    'eligible_total', (
      select count(*) from public.marketplace_products p
      where p.visible and p.content_status='published'
        and (rw.category_id is null or p.category_id = rw.category_id)
        and (rw.kind = 'category' or case rw.auto_rule
               when 'featured'     then p.is_featured
               when 'trending'     then p.is_trending
               when 'best_selling' then p.is_best_seller
               when 'new_release'  then p.is_new_release
               else true end)),
    'products', v_out);
end $$;

grant execute on function public.mm_row_products(text) to authenticated;
-- Repair the upserts after the registry restructure.
--
-- marketplace_row_config used to be keyed by category_id, so `on conflict
-- (category_id)` inferred the primary key. Once curated rows arrived the key
-- moved to a surrogate id and category_id became a *partial* unique index
-- (`where category_id is not null`), which Postgres will not infer unless the
-- statement repeats the predicate. Every slot assignment on a category row was
-- failing with 42P10 as a result.
--
-- Both upserts now name the predicate, and both also set row_kind, which the
-- restructure made meaningful and these statements predated.

create or replace function public.mm_slot_assign(
  p_key text, p_position int, p_product_id uuid, p_override boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  rw record; v_pcat uuid; v_pname text; v_pcatname text;
  v_live boolean; v_mod text; v_license text;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select * into rw from public.mm_row_resolve(p_key);
  if rw.category_id is null and rw.row_id is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_row');
  end if;

  if p_position < 1 or p_position > rw.max_products then
    return jsonb_build_object('ok', false, 'reason', 'position_out_of_range',
                              'max', rw.max_products);
  end if;

  select p.category_id, p.name, (p.visible and p.content_status='published'),
         p.moderation_status::text, p.license
    into v_pcat, v_pname, v_live, v_mod, v_license
  from public.marketplace_products p where p.id = p_product_id;
  if v_pname is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_product');
  end if;

  -- Section 6. A curated row has no category of its own, so the check applies
  -- only where the row actually belongs to one.
  if rw.category_id is not null
     and v_pcat is distinct from rw.category_id
     and not (p_override and rw.allow_cross) then
    select c.name into v_pcatname from public.marketplace_categories c where c.id = v_pcat;
    return jsonb_build_object(
      'ok', false, 'reason', 'category_mismatch',
      'message', 'Product category mismatch',
      'product', v_pname,
      'product_category', coalesce(v_pcatname, 'none'),
      'row_category', rw.title,
      'override_allowed', rw.allow_cross);
  end if;

  if not rw.allow_dupes and exists (
    select 1 from public.marketplace_row_slots s
    where (s.row_id = rw.row_id
           or (rw.category_id is not null and s.category_id = rw.category_id))
      and s.product_id = p_product_id and s.position <> p_position)
  then
    return jsonb_build_object('ok', false, 'reason', 'duplicate_product',
      'message', 'This product already occupies another slot in this row.');
  end if;

  -- Slots are keyed by row for curated rows and by category for category rows,
  -- so the delete-then-insert covers both without two code paths.
  delete from public.marketplace_row_slots
  where (row_id = rw.row_id or (rw.category_id is not null and category_id = rw.category_id))
    and position = p_position;

  insert into public.marketplace_row_slots
    (category_id, row_id, position, product_id, added_by)
  values (rw.category_id, rw.row_id, p_position, p_product_id, auth.uid());

  -- Placing anything makes a purely automatic row curated, or it would ignore
  -- the placement and the manager would see nothing happen.
  if rw.category_id is not null then
    insert into public.marketplace_row_config
      (category_id, row_kind, source_mode, updated_by, updated_at)
    values (rw.category_id, 'category', 'hybrid', auth.uid(), now())
    on conflict (category_id) where category_id is not null do update
      set source_mode = case when public.marketplace_row_config.source_mode = 'auto'
                             then 'hybrid' else public.marketplace_row_config.source_mode end,
          updated_by = auth.uid(), updated_at = now();
  else
    update public.marketplace_row_config
       set source_mode = case when source_mode = 'auto' then 'hybrid' else source_mode end,
           updated_by = auth.uid(), updated_at = now()
     where id = rw.row_id;
  end if;

  perform public.mm_audit('row_slot_assign', 'homepage_row',
    coalesce(rw.category_id, rw.row_id)::text,
    jsonb_build_object('row', p_key, 'position', p_position),
    jsonb_build_object('product', v_pname, 'live', v_live,
                       'moderation', v_mod, 'license', v_license),
    'assigned to slot ' || p_position);

  return jsonb_build_object('ok', true, 'row', p_key, 'position', p_position,
    'product', v_pname, 'live', v_live, 'license', v_license);
end $$;

grant execute on function public.mm_slot_assign(text,int,uuid,boolean) to authenticated;

-- Remove and move must follow the same two-shaped keying.
create or replace function public.mm_slot_remove(p_key text, p_position int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare rw record; n int;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  select * into rw from public.mm_row_resolve(p_key);
  if rw.category_id is null and rw.row_id is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_row');
  end if;

  delete from public.marketplace_row_slots
  where (row_id = rw.row_id or (rw.category_id is not null and category_id = rw.category_id))
    and position = p_position;
  get diagnostics n = row_count;

  perform public.mm_audit('row_slot_remove', 'homepage_row',
    coalesce(rw.category_id, rw.row_id)::text,
    jsonb_build_object('row', p_key, 'position', p_position), '{}'::jsonb,
    'cleared slot ' || p_position);
  return jsonb_build_object('ok', true, 'removed', n);
end $$;

grant execute on function public.mm_slot_remove(text,int) to authenticated;

create or replace function public.mm_slot_move(p_key text, p_from int, p_to int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare rw record; v_a uuid; v_b uuid; v_ap boolean; v_bp boolean;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  select * into rw from public.mm_row_resolve(p_key);
  if rw.category_id is null and rw.row_id is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_row');
  end if;

  select product_id, pinned into v_a, v_ap from public.marketplace_row_slots
   where (row_id = rw.row_id or (rw.category_id is not null and category_id = rw.category_id))
     and position = p_from;
  if v_a is null then return jsonb_build_object('ok', false, 'reason', 'empty_source'); end if;

  select product_id, pinned into v_b, v_bp from public.marketplace_row_slots
   where (row_id = rw.row_id or (rw.category_id is not null and category_id = rw.category_id))
     and position = p_to;

  delete from public.marketplace_row_slots
  where (row_id = rw.row_id or (rw.category_id is not null and category_id = rw.category_id))
    and position in (p_from, p_to);

  insert into public.marketplace_row_slots (category_id, row_id, position, product_id, pinned, added_by)
  values (rw.category_id, rw.row_id, p_to, v_a, coalesce(v_ap, true), auth.uid());
  if v_b is not null then
    insert into public.marketplace_row_slots (category_id, row_id, position, product_id, pinned, added_by)
    values (rw.category_id, rw.row_id, p_from, v_b, coalesce(v_bp, true), auth.uid());
  end if;

  perform public.mm_audit('row_slot_move', 'homepage_row',
    coalesce(rw.category_id, rw.row_id)::text,
    jsonb_build_object('row', p_key, 'from', p_from),
    jsonb_build_object('to', p_to), 'moved ' || p_from || ' to ' || p_to);
  return jsonb_build_object('ok', true, 'from', p_from, 'to', p_to, 'swapped', v_b is not null);
end $$;

grant execute on function public.mm_slot_move(text,int,int) to authenticated;

-- And the settings upsert, which had the same inference problem.
create or replace function public.mm_row_configure(p_key text, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare rw record; v_before jsonb; v_id uuid;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  select * into rw from public.mm_row_resolve(p_key);
  if rw.category_id is null and rw.row_id is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_row');
  end if;

  select to_jsonb(cfg) into v_before from public.marketplace_row_config cfg
   where cfg.id = rw.row_id;

  if rw.row_id is null then
    insert into public.marketplace_row_config
      (category_id, row_kind, updated_by, updated_at)
    values (rw.category_id, 'category', auth.uid(), now())
    on conflict (category_id) where category_id is not null do nothing;
  end if;

  select coalesce(rw.row_id, (select id from public.marketplace_row_config
                              where category_id = rw.category_id and row_kind='category'))
    into v_id;

  update public.marketplace_row_config set
    source_mode          = coalesce(p_patch->>'source_mode', source_mode),
    auto_rule            = coalesce(p_patch->>'auto_rule', auto_rule),
    max_products         = coalesce((p_patch->>'max_products')::int, max_products),
    allow_cross_category = coalesce((p_patch->>'allow_cross_category')::boolean, allow_cross_category),
    allow_duplicates     = coalesce((p_patch->>'allow_duplicates')::boolean, allow_duplicates),
    visible_desktop      = coalesce((p_patch->>'visible_desktop')::boolean, visible_desktop),
    visible_tablet       = coalesce((p_patch->>'visible_tablet')::boolean, visible_tablet),
    visible_mobile       = coalesce((p_patch->>'visible_mobile')::boolean, visible_mobile),
    starts_at            = case when p_patch ? 'starts_at'
                                then nullif(p_patch->>'starts_at','')::timestamptz else starts_at end,
    ends_at              = case when p_patch ? 'ends_at'
                                then nullif(p_patch->>'ends_at','')::timestamptz else ends_at end,
    cta_label            = coalesce(p_patch->>'cta_label', cta_label),
    cta_href             = coalesce(p_patch->>'cta_href', cta_href),
    title                = coalesce(p_patch->>'title', title),
    sort_order           = coalesce((p_patch->>'sort_order')::int, sort_order),
    status               = coalesce(p_patch->>'status', status),
    updated_by = auth.uid(), updated_at = now()
  where id = v_id;

  -- Visibility stays on the category, because that is the column the homepage
  -- filters on.
  if p_patch ? 'hidden' and rw.category_id is not null then
    update public.marketplace_categories
       set is_hidden = (p_patch->>'hidden')::boolean, updated_at = now()
     where id = rw.category_id;
  end if;

  perform public.mm_audit('row_configure', 'homepage_row',
    coalesce(rw.category_id, v_id)::text,
    coalesce(v_before, '{}'::jsonb), p_patch, 'row settings changed');
  return jsonb_build_object('ok', true, 'row', p_key);
end $$;

grant execute on function public.mm_row_configure(text,jsonb) to authenticated;
