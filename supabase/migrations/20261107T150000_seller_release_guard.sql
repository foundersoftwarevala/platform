-- Author/vendor earnings are released only for a real sale.
--
-- mm_seller_earnings_release moved every pending commission past its holding
-- period to 'available' (payable) without looking at the order. Commission
-- writing now requires a paid order and refuses a seller buying their own
-- product (src/lib/commerce/commission.ts), but rows written before that are
-- still pending - three of today's four are self-purchases on seeded orders.
-- Rather than rewrite those rows, release now applies the same two rules, so
-- such a line stays pending and is never paid out:
--   * the order is paid, or further along a paid order's life
--     (processing, fulfilled, completed) - not pending, refunded, cancelled
--     or disputed;
--   * the buyer is not the account that owns the seller.
-- Everything else is unchanged.

begin;

create or replace function public.mm_seller_earnings_release(p_seller uuid default null::uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_released integer;
begin
  if not public.mm_seller_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  with due as (
    select c.id
      from public.marketplace_commissions c
      left join public.marketplace_payout_schedules s on s.seller_id = c.seller_id
      join public.marketplace_order_items i on i.id = c.order_item_id
      join public.marketplace_orders o on o.id = i.order_id
      left join public.marketplace_sellers seller on seller.id = c.seller_id
     where c.status = 'pending'
       and c.seller_id is not null
       and (p_seller is null or c.seller_id = p_seller)
       and c.created_at <= now() - (coalesce(s.holding_days, 14) || ' days')::interval
       -- A line whose order was later refunded is not eligible, even if the
       -- reversal has not yet flipped this row.
       and not exists (select 1 from public.marketplace_commission_reversals r
                        where r.commission_id = c.id)
       -- Only a sale that happened and still stands.
       and o.status in ('paid', 'processing', 'fulfilled', 'completed')
       -- Nobody earns from buying their own product.
       and seller.owner_user_id is distinct from coalesce(o.user_id, o.buyer_id)
  )
  update public.marketplace_commissions c
     set status = 'available'
    from due where c.id = due.id;
  get diagnostics v_released = row_count;

  if v_released > 0 then
    perform public.mm_audit('seller.earnings_released', 'marketplace_seller',
                            coalesce(p_seller::text, 'all'), null,
                            jsonb_build_object('released', v_released), null);
  end if;

  return jsonb_build_object('ok', true, 'released', v_released);
end;
$function$;

commit;
