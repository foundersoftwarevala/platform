-- Adding the same product twice made a second line instead of counting it.
--
-- marketplace_add_to_cart relies on
--
--   ON CONFLICT (cart_id, product_id, variant_id) DO UPDATE SET quantity = ...
--
-- and the unique constraint behind it includes variant_id. Almost no product
-- here has a variant, so variant_id is null, and in SQL null is never equal to
-- null - so the conflict never fires and every click inserts another row. It is
-- not theoretical: one live cart holds the same product seven times as seven
-- separate lines, another holds one three times.
--
-- The fix is to look for the line rather than rely on a conflict that cannot
-- happen. Deliberately not done by adding a unique index over
-- coalesce(variant_id, ...): existing carts already hold duplicates, so such an
-- index could not be created without first merging and deleting rows out of
-- people's carts. Nothing is deleted here. Existing duplicate lines stay as
-- they are and are reported to the owner; from now on the quantity goes up
-- instead of the line count.
--
-- Everything else about the function is unchanged, including the publish-window
-- and moderation checks on the product.

create or replace function public.marketplace_add_to_cart(
  p_product_id uuid,
  p_quantity integer default 1,
  p_variant_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_cart uuid;
  v_product public.marketplace_products%rowtype;
  v_item uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > 1000 then raise exception 'invalid quantity'; end if;

  select * into v_product from public.marketplace_products
   where id = p_product_id
     and visible = true
     and moderation_status = 'approved'
     and (publish_at is null or publish_at <= now())
     and (unpublish_at is null or unpublish_at > now());
  if v_product.id is null then raise exception 'product unavailable'; end if;

  v_cart := public.marketplace_get_or_create_cart();

  -- `is not distinct from` is the comparison that treats two nulls as equal,
  -- which is exactly what ON CONFLICT could not do. Locked, so two clicks
  -- arriving together cannot both decide the line is missing.
  select id into v_item
    from public.marketplace_cart_items
   where cart_id = v_cart
     and product_id = p_product_id
     and variant_id is not distinct from p_variant_id
   order by created_at
   limit 1
   for update;

  if v_item is null then
    insert into public.marketplace_cart_items (cart_id, product_id, variant_id, quantity)
    values (v_cart, p_product_id, p_variant_id, p_quantity);
  else
    update public.marketplace_cart_items
       set quantity = least(quantity + p_quantity, 1000),
           updated_at = now()
     where id = v_item;
  end if;

  update public.marketplace_carts set updated_at = now() where id = v_cart;
  return jsonb_build_object('cart_id', v_cart);
end;
$function$;

-- ------------------------------------------------------- one demo per address
--
-- product_demo_urls has no unique constraint on (product_id, url), so the same
-- demo can be attached to the same product twice, and the import function's
-- `onConflict: "product_id,url"` upsert could never have worked. There are no
-- duplicates today, so the index can go on now, before there are.
create unique index if not exists product_demo_urls_product_url_once
  on public.product_demo_urls(product_id, url);
