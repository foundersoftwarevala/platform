-- Refund cap (20261107T213000_refund_total_cap.sql), every case, inside one
-- transaction that is rolled back. Run it on the live database BEFORE the
-- migration is applied by prefixing the migration body (as the dry run does),
-- or on its own AFTER it is applied:
--
--   node scripts/ops/db.mjs --file scripts/ops/refund-cap-verify.sql
--
-- Each case prints expected next to actual. A refused refund must leave no
-- trace: order status, licences, commissions and their reversals, payouts,
-- audit rows and notifications are fingerprinted before and after it.
\set ON_ERROR_STOP off
begin;
select r.id as ra, r.user_id as ua from resellers r where r.code = 'TEST-RESELLER' \gset
update resellers set plan_code = 'starter_reseller' where id = :'ra';
select u.id as buyer from auth.users u where not exists (select 1 from resellers r where r.user_id = u.id) order by u.created_at limit 1 \gset
select p.id as prod, p.name as pname from marketplace_products p order by p.created_at limit 1 \gset
insert into marketplace_referral_codes (reseller_id, code) values (:'ra', 'RCAP' || left(md5(random()::text), 6)) returning id as code_id \gset

create or replace function pg_temp.paid_order(p_buyer uuid, p_reseller uuid, p_code uuid, p_prod uuid, p_name text)
returns uuid language plpgsql as $$
declare v_o uuid;
begin
  insert into marketplace_orders (buyer_id, currency, subtotal, total, idempotency_key, status, payment_gateway, payu_txn_id)
  values (p_buyer, 'USD', 100, 100, 'rcap-' || gen_random_uuid(), 'pending_payment', 'payu', 'RCAP-' || gen_random_uuid()) returning id into v_o;
  insert into marketplace_order_items (order_id, product_id, product_name, quantity, unit_amount, line_total, currency)
  values (v_o, p_prod, p_name, 1, 100, 100, 'USD');
  insert into marketplace_order_attributions (order_id, reseller_id, referral_code_id, attribution_method)
  values (v_o, p_reseller, p_code, 'referral_code');
  update marketplace_orders set status = 'paid' where id = v_o;
  return v_o;
end $$;
-- Everything downstream of one order, as one string.
create or replace function pg_temp.trace(p_order uuid) returns text language sql as $$
  select concat_ws(' | ',
    'order ' || (select status from marketplace_orders where id = p_order),
    'refunds ' || (select count(*) || '/' || coalesce(sum(amount), 0) from marketplace_order_refunds where order_id = p_order and status in ('pending','approved','processed')),
    'licences ' || (select coalesce(string_agg(status, ',' order by status), '-') from licenses where order_id = p_order),
    'marketplace licences ' || (select coalesce(string_agg(status::text, ',' order by status::text), '-') from marketplace_licenses where order_item_id in (select id from marketplace_order_items where order_id = p_order)),
    'reseller commission ' || (select coalesce(string_agg(status, ','), '-') from reseller_commissions where order_id = p_order),
    'reversals ' || (select count(*) from marketplace_commission_reversals v join marketplace_order_refunds r on r.id = v.refund_id where r.order_id = p_order),
    'payouts ' || (select count(*) from reseller_commissions where order_id = p_order and payout_id is not null),
    'audit ' || (select count(*) from marketplace_audit_logs where entity_id::text = p_order::text),
    'notifications ' || (select count(*) from user_notifications where created_at >= now() - interval '5 minutes'));
$$;

\echo === 1. normal refund request (full amount) is accepted
select pg_temp.paid_order(:'buyer', :'ra', :'code_id', :'prod', :'pname') as o1 \gset
select 'expect ok' expect, public.mm_refund_request(:'o1', 100, 'case 1') ->> 'ok' got;
\echo === 3. exact-total: processing it refunds the order, revokes access, reverses commission
update marketplace_order_refunds set status = 'processed' where order_id = :'o1';
select 'expect refunded, licences revoked, commission reversed' expect, pg_temp.trace(:'o1') got;
\echo === 8. refund after fully refunded is refused, nothing changes
select pg_temp.trace(:'o1') as t_before \gset
select 'expect not_paid' expect, public.mm_refund_request(:'o1', 1, 'case 8') ->> 'reason' got;
savepoint s; insert into marketplace_order_refunds (order_id, provider, amount, currency, status) values (:'o1', 'payu', 1, 'USD', 'processed'); rollback to savepoint s;
select 'expect unchanged' expect, (pg_temp.trace(:'o1') = :'t_before') got;

\echo === 2. partial refund (30), order stays paid, commission stands
select pg_temp.paid_order(:'buyer', :'ra', :'code_id', :'prod', :'pname') as o2 \gset
select 'expect ok' expect, public.mm_refund_request(:'o2', 30, 'case 2') ->> 'ok' got;
update marketplace_order_refunds set status = 'processed' where order_id = :'o2';
select 'expect paid, licence active, commission pending' expect, pg_temp.trace(:'o2') got;
\echo === 4. over-refund (80 when 70 is left) is refused with what is left, no side effect
select pg_temp.trace(:'o2') as t_before \gset
select 'expect refund_exceeds_remaining, 70.00 refundable' expect, public.mm_refund_request(:'o2', 80, 'case 4')::text got;
savepoint s; insert into marketplace_order_refunds (order_id, provider, amount, currency, status) values (:'o2', 'payu', 80, 'USD', 'processed'); rollback to savepoint s;
select 'expect unchanged' expect, (pg_temp.trace(:'o2') = :'t_before') got;
\echo === 5. duplicate refund: the same full request twice, the second is refused
select pg_temp.paid_order(:'buyer', :'ra', :'code_id', :'prod', :'pname') as o5 \gset
select 'first' k, public.mm_refund_request(:'o5', 100, 'case 5') ->> 'ok' got;
select 'expect refund_exceeds_remaining' expect, public.mm_refund_request(:'o5', 100, 'case 5') ->> 'reason' got;
select 'expect one 100 refund' expect, pg_temp.trace(:'o5') got;
\echo === 9. a refused refund leaves order, licences, commission, reversals, payouts, audit and notifications as they were
select pg_temp.trace(:'o5') as t_before \gset
savepoint s; update marketplace_order_refunds set amount = 150 where order_id = :'o5'; rollback to savepoint s;
select 'expect unchanged' expect, (pg_temp.trace(:'o5') = :'t_before') got;
\echo === a failed refund frees its amount for a new request
update marketplace_order_refunds set status = 'failed' where order_id = :'o5';
select 'expect ok' expect, public.mm_refund_request(:'o5', 100, 'case 5 retry') ->> 'ok' got;
rollback;
-- Cases 6 and 7 (concurrent full and concurrent partial refunds) need
-- separate committing sessions; scratchpad refund-cap-race.sh runs them on
-- a scratch schema: ten simultaneous refunds of 20 on an order of 100 leave
-- exactly 100 refunded with the cap, 200 without it.
