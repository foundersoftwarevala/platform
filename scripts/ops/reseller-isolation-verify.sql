-- Reseller isolation, enforced by the database (RLS + grants), read as real
-- reseller sessions. Everything happens in one transaction that is rolled back.
--
--   node scripts/ops/db.mjs --file scripts/ops/reseller-isolation-verify.sql
--
-- Reseller A is the reseller test account (TEST-RESELLER). Reseller B is the
-- reseller record RLSTEST-9e40fc-B, which has no login of its own: inside the
-- transaction it is linked to an existing account that is not a reseller, so
-- the session can become B exactly as PostgREST would. Rows for both are
-- created inside the transaction; then each side tries to read and change the
-- other's data. Expected: every "of other" count is 0, every write is refused.
\set ON_ERROR_STOP off
begin;
select r.id as ra, r.user_id as ua from resellers r where r.code = 'TEST-RESELLER' \gset
select id as rb from resellers where code = 'RLSTEST-9e40fc-B' \gset
select u.id as ub from auth.users u
 where not exists (select 1 from resellers r where r.user_id = u.id)
   and not exists (select 1 from user_roles ur where ur.user_id = u.id and ur.role::text in ('admin', 'boss', 'finance', 'support'))
 order by u.created_at limit 1 \gset
update resellers set user_id = :'ub' where id = :'rb';
select i.id as ia, i.order_id as oa from marketplace_order_items i join marketplace_orders o on o.id = i.order_id where o.status = 'paid' order by i.id limit 1 offset 0 \gset
select i.id as ib, i.order_id as ob from marketplace_order_items i join marketplace_orders o on o.id = i.order_id where o.status = 'paid' order by i.id limit 1 offset 1 \gset
insert into reseller_commissions (reseller_id, order_id, order_item_id, gross_amount, commission_amount, currency, status, rule_snapshot, idempotency_key)
values (:'ra', :'oa', :'ia', 100, 10, 'USD', 'available', '{}', 'iso-a-' || gen_random_uuid()),
       (:'rb', :'ob', :'ib', 100, 20, 'USD', 'available', '{}', 'iso-b-' || gen_random_uuid());
insert into reseller_payouts (reseller_id, amount, currency, status, idempotency_key)
values (:'ra', 10, 'USD', 'pending', 'iso-pa-' || gen_random_uuid()), (:'rb', 20, 'USD', 'pending', 'iso-pb-' || gen_random_uuid());
select id as pa from reseller_payouts where reseller_id = :'ra' and idempotency_key like 'iso-pa-%' \gset
select id as pb from reseller_payouts where reseller_id = :'rb' and idempotency_key like 'iso-pb-%' \gset
insert into marketplace_referral_codes (reseller_id, code) values (:'ra', 'ISOA' || left(md5(random()::text), 6)), (:'rb', 'ISOB' || left(md5(random()::text), 6));
insert into reseller_notifications (reseller_id, title, type, body) values (:'ra', 'iso a', 'info', 'iso'), (:'rb', 'iso b', 'info', 'iso');
insert into user_notifications (user_id, type, message) values (:'ua', 'info', 'iso a'), (:'ub', 'info', 'iso b');

\echo === acting as reseller A
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'ua', 'role', 'authenticated')::text, true);
select 'A: resellers' k, count(*) visible, count(*) filter (where id <> :'ra') of_other from resellers
union all select 'A: commissions', count(*), count(*) filter (where reseller_id <> :'ra') from reseller_commissions
union all select 'A: payouts', count(*), count(*) filter (where reseller_id <> :'ra') from reseller_payouts
union all select 'A: referral codes', count(*), count(*) filter (where reseller_id is distinct from :'ra') from marketplace_referral_codes
union all select 'A: referral sessions', count(*), count(*) filter (where reseller_id is distinct from :'ra') from marketplace_referral_sessions
union all select 'A: attributions', count(*), count(*) filter (where reseller_id is distinct from :'ra') from marketplace_order_attributions
union all select 'A: memberships', count(*), count(*) filter (where reseller_id <> :'ra') from reseller_memberships
union all select 'A: membership orders', count(*), count(*) filter (where reseller_id <> :'ra') from reseller_membership_orders
union all select 'A: membership events', count(*), count(*) filter (where reseller_id <> :'ra') from reseller_membership_events
union all select 'A: reseller notifications', count(*), count(*) filter (where reseller_id <> :'ra') from reseller_notifications
union all select 'A: payout schedules', count(*), count(*) filter (where reseller_id <> :'ra') from reseller_payout_schedules
union all select 'A: user notifications', count(*), count(*) filter (where user_id <> :'ua') from user_notifications
union all select 'A: orders', count(*), count(*) filter (where buyer_id is distinct from :'ua') from marketplace_orders
union all select 'A: order items', count(*), count(*) filter (where order_id not in (select id from marketplace_orders where buyer_id = :'ua')) from marketplace_order_items
union all select 'A: refunds', count(*), count(*) filter (where order_id not in (select id from marketplace_orders where buyer_id = :'ua')) from marketplace_order_refunds
union all select 'A: commission reversals', count(*), count(*) from marketplace_commission_reversals
union all select 'A: partner commissions', count(*), count(*) from partner_commissions
union all select 'A: finance wallets', count(*), count(*) from finance_wallets
union all select 'A: finance wallet tx', count(*), count(*) from finance_wallet_transactions
union all select 'A: finance payouts', count(*), count(*) from finance_payouts
union all select 'A: crm customers', count(*), count(*) filter (where owner_id is distinct from :'ua') from crm_customers
union all select 'A: chat participants', count(*), count(*) filter (where conversation_id not in (select conversation_id from chat_participants p2 where p2.user_id = :'ua')) from chat_participants
union all select 'A: ams passports', count(*), count(*) filter (where user_id <> :'ua') from ams_passports;
\echo === reseller A tries to change B data and to pay itself
savepoint t; update resellers set status = 'terminated' where id = :'rb'; rollback to savepoint t;
savepoint t; update reseller_payouts set status = 'paid' where id = :'pb'; rollback to savepoint t;
savepoint t; update reseller_payouts set status = 'paid' where id = :'pa'; rollback to savepoint t;
savepoint t; update reseller_commissions set commission_amount = 9999 where reseller_id = :'ra'; rollback to savepoint t;
savepoint t; insert into reseller_commissions (reseller_id, order_id, order_item_id, gross_amount, commission_amount, currency, status, rule_snapshot, idempotency_key) values (:'ra', :'ob', gen_random_uuid(), 1, 1000, 'USD', 'available', '{}', 'iso-forge'); rollback to savepoint t;
savepoint t; insert into reseller_commissions (reseller_id, order_id, order_item_id, gross_amount, commission_amount, currency, status, rule_snapshot, idempotency_key) values (:'rb', :'ob', gen_random_uuid(), 1, 1000, 'USD', 'available', '{}', 'iso-forge-b'); rollback to savepoint t;
savepoint t; insert into reseller_payouts (reseller_id, amount, currency, status, idempotency_key) values (:'ra', 1000, 'USD', 'paid', 'iso-forge'); rollback to savepoint t;
savepoint t; insert into marketplace_order_attributions (order_id, reseller_id) values (:'ob', :'ra'); rollback to savepoint t;
savepoint t; update resellers set plan_code = 'master_reseller' where id = :'ra'; rollback to savepoint t;
savepoint t; update resellers set user_id = :'ua' where id = :'rb'; rollback to savepoint t;
savepoint t; select 'A: payout status rpc' k, public.mm_reseller_payout_status(:'pb', 'approved') ->> 'reason' as reason; rollback to savepoint t;
savepoint t; select 'A: payout create rpc' k, public.mm_reseller_payout_create(:'ra', 'iso') ->> 'reason' as reason; rollback to savepoint t;
savepoint t; select 'A: reseller status rpc' k, public.mm_reseller_status(:'rb', 'terminated', 'x') ->> 'reason' as reason; rollback to savepoint t;
savepoint t; select 'A: reseller_rate_for' k, public.reseller_rate_for(:'ra', null); rollback to savepoint t;
\echo === the data A tried to change is unchanged
reset role;
select 'B status' k, status from resellers where id = :'rb'
union all select 'B payout status', status from reseller_payouts where id = :'pb'
union all select 'A payout status', status from reseller_payouts where id = :'pa'
union all select 'A plan', plan_code from resellers where id = :'ra';

\echo === acting as reseller B
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'ub', 'role', 'authenticated')::text, true);
select 'B: resellers' k, count(*) visible, count(*) filter (where id <> :'rb') of_other from resellers
union all select 'B: commissions', count(*), count(*) filter (where reseller_id <> :'rb') from reseller_commissions
union all select 'B: payouts', count(*), count(*) filter (where reseller_id <> :'rb') from reseller_payouts
union all select 'B: referral codes', count(*), count(*) filter (where reseller_id is distinct from :'rb') from marketplace_referral_codes
union all select 'B: attributions', count(*), count(*) filter (where reseller_id is distinct from :'rb') from marketplace_order_attributions
union all select 'B: memberships', count(*), count(*) filter (where reseller_id <> :'rb') from reseller_memberships
union all select 'B: user notifications', count(*), count(*) filter (where user_id <> :'ub') from user_notifications;
savepoint t; update reseller_payouts set status = 'paid' where id = :'pa'; rollback to savepoint t;
savepoint t; update resellers set status = 'terminated' where id = :'ra'; rollback to savepoint t;
savepoint t; select 'B: payout status rpc' k, public.mm_reseller_payout_status(:'pa', 'approved') ->> 'reason' as reason; rollback to savepoint t;
reset role;
select 'A status after B' k, status from resellers where id = :'ra'
union all select 'A payout after B', status from reseller_payouts where id = :'pa';

\echo === anonymous
set local role anon;
select 'anon: resellers' k, count(*) from resellers
union all select 'anon: commissions', count(*) from reseller_commissions
union all select 'anon: payouts', count(*) from reseller_payouts
union all select 'anon: referral codes', count(*) from marketplace_referral_codes
union all select 'anon: attributions', count(*) from marketplace_order_attributions
union all select 'anon: memberships', count(*) from reseller_memberships
union all select 'anon: membership orders', count(*) from reseller_membership_orders
union all select 'anon: orders', count(*) from marketplace_orders
union all select 'anon: user notifications', count(*) from user_notifications;
savepoint t; select public.mm_reseller_payout_status(:'pa', 'approved'); rollback to savepoint t;
reset role;
rollback;
