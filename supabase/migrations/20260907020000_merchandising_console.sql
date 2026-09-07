-- Let a product be placed into a curated row at all.
--
-- marketplace_row_slots.category_id was NOT NULL. A curated row - Featured,
-- Trending, Top Selling - has no category of its own, so mm_slot_assign built
-- its insert with a null category_id and the constraint rejected it every time.
-- Placing a product into any curated placement was therefore impossible, which
-- is the single reason the Merchandising Console could never have worked no
-- matter how its buttons were wired.
--
-- Everything else for curated slots was already in place and correct:
--
--   mm_row_slots_rowpos_uq    unique (row_id, position) where row_id is not null
--   mm_row_slots_rowdupe_uq   unique (row_id, product_id) where row_id is not null
--   marketplace_row_slots_row_id_fkey  -> marketplace_row_config(id) on delete cascade
--
-- So one slot per position and one position per product are still enforced for
-- curated rows, by their own partial indexes, exactly as the category rows are
-- by theirs. Dropping the NOT NULL removes nothing: it lets the row_id half of
-- a design that was already finished actually be used.
--
-- A check constraint takes its place so a slot can never belong to nothing.
-- Category rows keep category_id, curated rows keep row_id, and a row with
-- neither is now rejected rather than orphaned.

alter table public.marketplace_row_slots
  alter column category_id drop not null;

alter table public.marketplace_row_slots
  drop constraint if exists marketplace_row_slots_owner_check;

alter table public.marketplace_row_slots
  add constraint marketplace_row_slots_owner_check
  check (category_id is not null or row_id is not null);

select column_name, is_nullable
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'marketplace_row_slots'
   and column_name in ('category_id', 'row_id')
 order by column_name;
-- Top Selling must mean "actually sold".
--
-- The rule engine narrowed the best_selling rule to products carrying the
-- is_best_seller flag. No product in the catalogue carries it - the count is
-- zero out of 5,469 published products - so a Top Selling row could never fill,
-- while six products have genuine paid orders behind them. The row would have
-- rendered empty and the console would have shown a ranking that was working
-- correctly and returning nothing.
--
-- The flag stays honoured, because an editor marking a product as a best seller
-- is a real editorial signal and removing it would drop behaviour somebody may
-- rely on. It is now one of two ways in rather than the only one: a product
-- qualifies if it has been paid for, or if an editor has flagged it. Ranking is
-- unchanged - still coalesce(sold, 0) descending - so the order is real sales
-- either way.
--
-- Everything else in this function is byte-for-byte what was there. Only the
-- best_selling predicate changes, in both places it appears: the candidate
-- query and the eligible_total count that the manager sees.

create or replace function public.mm_row_products(p_key text)
returns jsonb
language plpgsql
stable
as $$
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
               -- Sold for real, or flagged by an editor. The flag alone
               -- matched nothing.
               when 'best_selling' then (coalesce(s.sold, 0) > 0 or p.is_best_seller)
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
      left join (
        select oi.product_id, count(*) sold
        from public.marketplace_order_items oi
        join public.marketplace_orders o on o.id = oi.order_id and o.status::text='paid'
        group by oi.product_id) s on s.product_id = p.id
      where p.visible and p.content_status='published'
        and (rw.category_id is null or p.category_id = rw.category_id)
        and (rw.kind = 'category' or case rw.auto_rule
               when 'featured'     then p.is_featured
               when 'trending'     then p.is_trending
               when 'best_selling' then (coalesce(s.sold, 0) > 0 or p.is_best_seller)
               when 'new_release'  then p.is_new_release
               else true end)),
    'products', v_out);
end
$$;
