-- An order line's seller is the product's seller, and nobody else.
--
-- H11: 20 order lines had no seller_id. 19 are lines for products that have
-- no seller at all - Software Vala's own products - where NULL is the correct
-- value ("platform-owned"), so seller_id is not made NOT NULL. One line, on a
-- paid order inserted directly (not through checkout), is for a product whose
-- seller is a single approved seller with an owner: that is unambiguous and is
-- backfilled below. It is a seeded end-to-end order, and is reported as such.
--
-- Checkout already copies the product's seller onto each line. From now on the
-- database does it too, for every writer: a line takes the seller of its
-- product, so a line cannot be inserted with someone else's seller (which
-- would redirect the commission) and cannot be left without one when the
-- product has one. Existing lines are not touched beyond the one backfill.

begin;

create or replace function public.marketplace_order_item_seller()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.product_id is not null then
    select p.seller_id into new.seller_id
      from public.marketplace_products p
     where p.id = new.product_id;
  end if;
  return new;
end $$;

revoke all on function public.marketplace_order_item_seller() from public, anon, authenticated;

drop trigger if exists marketplace_order_item_seller on public.marketplace_order_items;
create trigger marketplace_order_item_seller
  before insert on public.marketplace_order_items
  for each row execute function public.marketplace_order_item_seller();

update public.marketplace_order_items i
   set seller_id = p.seller_id
  from public.marketplace_products p
 where p.id = i.product_id
   and i.seller_id is null
   and p.seller_id is not null;

commit;
