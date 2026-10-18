-- Reseller money path, read-only integrity scan of the live database:
-- order -> payment -> licence -> commission -> payout -> ledger.
--
--   node scripts/ops/db.mjs --file scripts/ops/reseller-money-scan.sql
--
-- Every "violations" row must be 0. The counts at the end describe what the
-- scan had to work with, so a 0 is never mistaken for "nothing was checked".
set default_transaction_read_only = on;

select 'commission on an order that is not paid or refunded' as rule, count(*) as violations
  from reseller_commissions c join marketplace_orders o on o.id = c.order_id
 where o.status not in ('paid', 'fulfilled', 'completed', 'refunded', 'partially_refunded')
union all
select 'commission on an order without a reseller attribution', count(*)
  from reseller_commissions c
 where not exists (select 1 from marketplace_order_attributions a where a.order_id = c.order_id and a.reseller_id = c.reseller_id)
union all
select 'more than one commission for one order line', count(*)
  from (select order_item_id from reseller_commissions group by order_item_id having count(*) > 1) d
union all
select 'commission larger than the line it was paid on', count(*)
  from reseller_commissions where commission_amount > gross_amount or commission_amount < 0
union all
select 'reseller paid commission on its own purchase', count(*)
  from reseller_commissions c join resellers r on r.id = c.reseller_id join marketplace_orders o on o.id = c.order_id
 where o.buyer_id = r.user_id
union all
select 'commission still payable after a full refund', count(*)
  from reseller_commissions c join marketplace_orders o on o.id = c.order_id
 where o.status = 'refunded' and c.status in ('pending', 'available', 'approved')
union all
select 'commission line attached to more than one payout or to a missing payout', count(*)
  from reseller_commissions c where c.payout_id is not null and not exists (select 1 from reseller_payouts p where p.id = c.payout_id)
union all
select 'payout amount differs from the lines attached to it', count(*)
  from reseller_payouts p
 where exists (select 1 from reseller_commissions c where c.payout_id = p.id)
   and p.amount <> (select sum(c.commission_amount) from reseller_commissions c where c.payout_id = p.id)
union all
select 'payout for another reseller''s commission', count(*)
  from reseller_commissions c join reseller_payouts p on p.id = c.payout_id where p.reseller_id <> c.reseller_id
union all
select 'negative or zero payout', count(*) from reseller_payouts where amount <= 0
union all
select 'paid payout without a completion time', count(*) from reseller_payouts where status = 'paid' and completed_at is null
union all
select 'more than one ledger entry of a kind for one payout', count(*)
  from (select immutable_metadata->>'payout_id', entry_type from marketplace_ledger_entries
         where immutable_metadata ? 'payout_id' group by 1, 2 having count(*) > 1) d
union all
select 'more than one attribution for one order', count(*)
  from (select order_id from marketplace_order_attributions where reseller_id is not null group by order_id having count(*) > 1) d
union all
select 'more than one licence for one order and product', count(*)
  from (select order_id, product_id from licenses where order_id is not null group by 1, 2 having count(*) > 1) d
union all
select 'paid order with two successful payment intents', count(*)
  from (select order_id from marketplace_payment_intents where status in ('succeeded', 'paid', 'captured') group by order_id having count(*) > 1) d
union all
select 'refunds adding up to more than the order total', count(*)
  from marketplace_orders o
 where (select coalesce(sum(r.amount), 0) from marketplace_order_refunds r where r.order_id = o.id and r.status in ('succeeded', 'processed', 'completed', 'success')) > o.total
union all
select 'reversals adding up to more than the seller share they undo', count(*)
  from marketplace_commissions pc
 where (select coalesce(sum(v.amount), 0) from marketplace_commission_reversals v where v.commission_id = pc.id) > pc.seller_amount;

select 'resellers' as what, count(*) as how_many from resellers
union all select 'reseller attributions', count(*) from marketplace_order_attributions where reseller_id is not null
union all select 'reseller commissions', count(*) from reseller_commissions
union all select 'reseller payouts', count(*) from reseller_payouts
union all select 'payout ledger entries', count(*) from marketplace_ledger_entries where immutable_metadata ? 'payout_id'
union all select 'refunds', count(*) from marketplace_order_refunds
union all select 'commission reversals', count(*) from marketplace_commission_reversals;
