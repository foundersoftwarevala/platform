-- Reseller money path end to end on the live functions and triggers, inside one
-- transaction that is rolled back: nothing it creates survives.
--
--   node scripts/ops/db.mjs --file scripts/ops/reseller-money-flow-verify.sql
--
-- order -> payment -> commission -> refund -> reversal, and
-- commission -> payout -> paid -> ledger, with the repeats and the abuse cases.
-- Each step prints what it expects next to what happened.
\set ON_ERROR_STOP off
begin;
select r.id as ra, r.user_id as ua from resellers r where r.code = 'TEST-RESELLER' \gset
-- The reseller needs a margin to earn anything; the test account has no plan,
-- so it is given the real starter plan for the length of the transaction.
update resellers set plan_code = 'starter_reseller' where id = :'ra';
select u.id as buyer from auth.users u
 where not exists (select 1 from resellers r where r.user_id = u.id) order by u.created_at limit 1 \gset
select p.id as prod, p.name as pname from marketplace_products p order by p.created_at limit 1 \gset
insert into marketplace_referral_codes (reseller_id, code) values (:'ra', 'FLOW' || left(md5(random()::text), 6)) returning id as code_id \gset

-- An order (100.00 unless stated) with one line, attributed to reseller A.
create temp table flow_orders (label text, id uuid, item uuid) on commit drop;
create or replace function pg_temp.new_order(p_label text, p_buyer uuid, p_reseller uuid, p_code uuid, p_prod uuid, p_name text, p_amount numeric default 100)
returns uuid language plpgsql as $$
declare v_o uuid; v_i uuid;
begin
  insert into marketplace_orders (buyer_id, currency, subtotal, total, idempotency_key, status)
  values (p_buyer, 'USD', p_amount, p_amount, 'flow-' || gen_random_uuid(), 'pending_payment') returning id into v_o;
  insert into marketplace_order_items (order_id, product_id, product_name, quantity, unit_amount, line_total, currency)
  values (v_o, p_prod, p_name, 1, p_amount, p_amount, 'USD') returning id into v_i;
  insert into marketplace_order_attributions (order_id, reseller_id, referral_code_id, attribution_method)
  values (v_o, p_reseller, p_code, 'referral_code');
  insert into flow_orders values (p_label, v_o, v_i);
  return v_o;
end $$;
select pg_temp.new_order('main', :'buyer', :'ra', :'code_id', :'prod', :'pname') as o1 \gset

\echo === 1. unpaid order: no commission
select 'expect order_not_paid' expect, public.reseller_commissions_for_order(:'o1') ->> 'reason' got,
       (select count(*) from reseller_commissions where order_id = :'o1') commissions;

\echo === 2. failed payment: the intent fails, the order stays unpaid, still no commission
insert into marketplace_payment_intents (order_id, provider, provider_intent_id, amount, currency, idempotency_key, status)
values (:'o1', 'payu', 'FLOW-TXN-1', 100, 'USD', 'flow-pi-' || gen_random_uuid(), 'failed');
select 'expect pending_payment, 0' expect, (select status from marketplace_orders where id = :'o1') order_status,
       (select count(*) from reseller_commissions where order_id = :'o1') commissions;

\echo === 3. payment retry succeeds: the order is paid and the trigger records one commission at 20 percent
update marketplace_payment_intents set status = 'succeeded' where order_id = :'o1';
update marketplace_orders set status = 'paid' where id = :'o1';
select 'expect 1 line, 20.00, pending' expect, count(*) lines, sum(commission_amount) amount, string_agg(status, ',') status
  from reseller_commissions where order_id = :'o1';

\echo === 4. duplicate payment for the same provider transaction is refused by the database
savepoint s;
insert into marketplace_payment_intents (order_id, provider, provider_intent_id, amount, currency, idempotency_key, status)
values (pg_temp.new_order('dup', :'buyer', :'ra', :'code_id', :'prod', :'pname'), 'payu', 'FLOW-TXN-1', 100, 'USD', 'flow-pi-' || gen_random_uuid(), 'succeeded');
rollback to savepoint s;

\echo === 5. duplicate webhook: paid again, and the commission function called again directly
update marketplace_orders set status = 'paid' where id = :'o1';
select 'expect created 0' expect, public.reseller_commissions_for_order(:'o1') ->> 'created' got,
       (select count(*) from reseller_commissions where order_id = :'o1') commissions;

\echo === 6. a paid order cannot be cancelled (it is ended by a refund)
savepoint s; update marketplace_orders set status = 'cancelled' where id = :'o1'; rollback to savepoint s;

\echo === 7. partial refund (40 of 100): the order stays paid and the commission stands
insert into marketplace_order_refunds (order_id, provider, amount, currency, status, reason)
values (:'o1', 'payu', 40, 'USD', 'pending', 'flow partial') returning id as r1 \gset
update marketplace_order_refunds set status = 'processed' where id = :'r1';
select 'expect paid, pending' expect, (select status from marketplace_orders where id = :'o1') order_status,
       (select string_agg(status, ',') from reseller_commissions where order_id = :'o1') commission;

\echo === 8. the rest of the refund (60): the order is refunded and the commission reversed
insert into marketplace_order_refunds (order_id, provider, amount, currency, status, reason)
values (:'o1', 'payu', 60, 'USD', 'pending', 'flow rest') returning id as r2 \gset
update marketplace_order_refunds set status = 'processed' where id = :'r2';
select 'expect refunded, reversed' expect, (select status from marketplace_orders where id = :'o1') order_status,
       (select string_agg(status, ',') from reseller_commissions where order_id = :'o1') commission,
       (select count(*) from marketplace_audit_logs where entity_id::text = :'o1' and action = 'reseller.commission_reversed') reversal_audits;

\echo === 9. the refund processed again: nothing changes, no second reversal
update marketplace_order_refunds set status = 'processed' where id = :'r2';
select 'expect 1 reversal audit, reversed' expect,
       (select count(*) from marketplace_audit_logs where entity_id::text = :'o1' and action = 'reseller.commission_reversed') reversal_audits,
       (select string_agg(status, ',') from reseller_commissions where order_id = :'o1') commission;
\echo === 10. a refund past the order total: 200.00 below means unprotected; an error naming the cap means 20261107T213000 is applied
savepoint s;
insert into marketplace_order_refunds (order_id, provider, amount, currency, status, reason) values (:'o1', 'payu', 100, 'USD', 'processed', 'flow over-refund');
select 'refunded total now' k, sum(amount) from marketplace_order_refunds where order_id = :'o1' and status = 'processed';
rollback to savepoint s;

\echo === 11. self-purchase: the reseller buys through its own link, no commission
select pg_temp.new_order('self', :'ua', :'ra', :'code_id', :'prod', :'pname') as o2 \gset
update marketplace_orders set status = 'paid' where id = :'o2';
select 'expect 0 commissions, 1 refusal audit' expect, (select count(*) from reseller_commissions where order_id = :'o2') commissions,
       (select count(*) from marketplace_audit_logs where entity_id::text = :'o2' and action = 'reseller.self_referral_blocked') refusals;

\echo === 12. payout: a released commission is paid out once, with one ledger entry
select pg_temp.new_order('payout', :'buyer', :'ra', :'code_id', :'prod', :'pname', 300) as o3 \gset
update marketplace_orders set status = 'paid' where id = :'o3';
update reseller_commissions set status = 'available' where order_id = :'o3';
select public.mm_reseller_payout_create(:'ra', 'flow') as created \gset
select 'create returned' k, :'created'::text r;
select (:'created'::jsonb -> 'payout' ->> 'id') as pay \gset
select 'expect payout of 60.00 with 1 line' expect, (select amount from reseller_payouts where id = :'pay') amount,
       (select count(*) from reseller_commissions where payout_id = :'pay') lines;
select 'second create with nothing left' k, public.mm_reseller_payout_create(:'ra', 'flow') ->> 'reason' reason;
select 'skip straight to paid' k, public.mm_reseller_payout_status(:'pay', 'paid', 'FLOW-REF') ->> 'reason' reason;
select 'approved' k, public.mm_reseller_payout_status(:'pay', 'approved') ->> 'ok' ok;
select 'processing' k, public.mm_reseller_payout_status(:'pay', 'processing') ->> 'ok' ok;
select 'paid' k, public.mm_reseller_payout_status(:'pay', 'paid', 'FLOW-REF') ->> 'ok' ok;
select 'paid again' k, public.mm_reseller_payout_status(:'pay', 'paid', 'FLOW-REF') ->> 'reason' reason;
select 'expect paid, lines paid, 1 ledger entry' expect, (select status from reseller_payouts where id = :'pay') payout,
       (select string_agg(status, ',') from reseller_commissions where payout_id = :'pay') lines,
       (select count(*) from marketplace_ledger_entries where immutable_metadata->>'payout_id' = :'pay'::text) ledger_entries;

\echo === 13. refund after the commission was paid out: not clawed back silently, reported for a person
insert into marketplace_order_refunds (order_id, provider, amount, currency, status, reason)
values (:'o3', 'payu', 300, 'USD', 'processed', 'flow after payout');
select 'expect refunded, commission still paid, audit says already_paid 1' expect,
       (select status from marketplace_orders where id = :'o3') order_status,
       (select string_agg(status, ',') from reseller_commissions where order_id = :'o3') commission,
       (select after_state->>'already_paid' from marketplace_audit_logs where entity_id::text = :'o3' and action = 'reseller.commission_reversed' limit 1) audit_already_paid;

\echo === 14. a suspended reseller earns nothing
update resellers set status = 'suspended' where id = :'ra';
select pg_temp.new_order('suspended', :'buyer', :'ra', :'code_id', :'prod', :'pname') as o4 \gset
update marketplace_orders set status = 'paid' where id = :'o4';
select 'expect 0' expect, count(*) commissions from reseller_commissions where order_id = :'o4';

\echo === 15. notifications the flow raised for the reseller
select event_type, count(*) from user_notifications where user_id = :'ua' and created_at >= now() - interval '1 minute' group by 1 order by 1;
rollback;
