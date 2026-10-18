-- Merge duplicate lines in ACTIVE carts only. Quantities are added into the
-- earliest line; the redundant rows go. Checked-out carts are left untouched:
-- their lines record what was actually bought and an order already exists
-- against them.
begin;

create temporary table cart_merge on commit drop as
select ci.id,
       first_value(ci.id) over w as keep_id,
       sum(ci.quantity) over w as merged_quantity
  from marketplace_cart_items ci
  join marketplace_carts c on c.id = ci.cart_id
 where c.status = 'active'
   and (ci.cart_id, ci.product_id, coalesce(ci.variant_id, '00000000-0000-0000-0000-000000000000'::uuid)) in (
     select ci2.cart_id, ci2.product_id, coalesce(ci2.variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
       from marketplace_cart_items ci2
       join marketplace_carts c2 on c2.id = ci2.cart_id
      where c2.status = 'active'
      group by 1,2,3 having count(*) > 1)
window w as (partition by ci.cart_id, ci.product_id, coalesce(ci.variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
             order by ci.created_at, ci.id
             rows between unbounded preceding and unbounded following);

select 'before' as step, count(*) rows_in_groups, count(distinct keep_id) groups from cart_merge;

update marketplace_cart_items ci
   set quantity = least(m.merged_quantity, 1000), updated_at = now()
  from (select distinct keep_id, merged_quantity from cart_merge) m
 where ci.id = m.keep_id;

delete from marketplace_cart_items ci
 using cart_merge m
 where ci.id = m.id and m.id <> m.keep_id;

select 'after' as step,
       (select count(*) from (
          select ci.cart_id, ci.product_id, coalesce(ci.variant_id,'00000000-0000-0000-0000-000000000000'::uuid)
            from marketplace_cart_items ci join marketplace_carts c on c.id=ci.cart_id
           where c.status='active' group by 1,2,3 having count(*)>1) x) as duplicate_groups_left_in_active_carts;

commit;
