-- The payment lifecycle, end to end, from the database that owns it.
--
--   node scripts/ops/db.mjs --file scripts/ops/payment-lifecycle-audit.sql
--
-- It reads and reports. It writes nothing, because payment records are not
-- something to experiment on, and because the questions worth asking here are
-- all answerable by looking.
--
-- The stages the brief names - payment, order, transaction, settlement,
-- reconciliation, invoice, licence, notification, accounting - are each given
-- a section below, in that order.

\echo '======== 1. ORDERS ========'
select status, currency, count(*) as orders, sum(total) as value,
       min(created_at)::date as oldest, max(created_at)::date as newest
from marketplace_orders
group by status, currency
order by count(*) desc;

\echo ''
\echo '======== 2. THE CHAIN: order -> intent -> item -> licence -> refund ========'
-- A paid order should carry a licence for each item. A pending one should
-- carry none: a licence before payment is the failure worth catching.
select o.status                          as order_status,
       coalesce(pi.status, '(no intent)') as intent_status,
       coalesce(pi.provider, '-')         as provider,
       count(distinct o.id)               as orders,
       count(distinct oi.id)              as items,
       count(distinct l.id)               as licences,
       count(distinct r.id)               as refunds
from marketplace_orders o
left join marketplace_payment_intents pi on pi.order_id = o.id
left join marketplace_order_items oi     on oi.order_id = o.id
left join marketplace_licenses l         on l.order_item_id = oi.id
left join marketplace_order_refunds r    on r.order_id = o.id
group by o.status, pi.status, pi.provider
order by o.status;

\echo ''
\echo '======== 3. A LICENCE ON AN UNPAID ORDER (must be zero) ========'
select count(*) as licences_without_payment
from marketplace_licenses l
join marketplace_order_items oi on oi.id = l.order_item_id
join marketplace_orders o       on o.id = oi.order_id
where o.status <> 'paid';

\echo ''
\echo '======== 4. IDEMPOTENCY, AS THE DATABASE ENFORCES IT ========'
-- Not "is there a column called idempotency_key" but "is it unique".
select c.relname as table_name, pg_get_indexdef(i.oid) as unique_index
from pg_index x
join pg_class c on c.oid = x.indrelid
join pg_class i on i.oid = x.indexrelid
where x.indisunique
  and c.relname in ('marketplace_orders','marketplace_payment_intents',
                    'marketplace_payment_events','marketplace_order_refunds')
order by c.relname, i.relname;

\echo ''
\echo '======== 5. SETTLEMENT QUEUE ========'
select status, count(*) as events, min(created_at)::date as oldest,
       max(attempts) as worst_attempts
from payment_event_outbox
group by status
order by count(*) desc;

\echo ''
\echo '======== 6. RECONCILIATION: WHICH TABLE DOES IT ACTUALLY REACH? ========'
-- reconcile_payment_intents() expires rows in payment_intents. The intents a
-- marketplace checkout creates live in marketplace_payment_intents, which has
-- no expires_at at all, so nothing expires them and the five-minutely run
-- reports success while they sit. Both counts are printed together because the
-- gap is only visible when they are side by side.
select 'payment_intents (what reconcile touches)' as table_name,
       count(*) as rows,
       count(*) filter (where status in ('initiated','pending','partial')) as still_open,
       max((now()::date - created_at::date)) as oldest_days
from payment_intents
union all
select 'marketplace_payment_intents (what checkout writes)',
       count(*),
       count(*) filter (where status = 'pending'),
       max((now()::date - created_at::date))
from marketplace_payment_intents;

\echo ''
\echo '======== 7. WEBHOOK SECURITY ========'
-- marketplace_record_payment_event raises rather than inserting when the
-- signature is not verified, and the (provider, provider_event_id) unique
-- index makes a replay a no-op. Anything here with signature_verified false
-- would mean that rule was bypassed.
select count(*) as events,
       count(*) filter (where signature_verified) as verified,
       count(*) filter (where not signature_verified) as unverified
from marketplace_payment_events;

\echo ''
\echo '======== 8. ACCOUNTING: IS FINANCE FED BY THE MARKETPLACE? ========'
-- finance_invoices carries no order, marketplace or source column, so a
-- marketplace sale cannot become a finance record. These two counts belong to
-- systems that do not meet.
select 'marketplace_orders paid' as source, count(*) as rows from marketplace_orders where status = 'paid'
union all select 'finance_invoices',     count(*) from finance_invoices
union all select 'finance_transactions', count(*) from finance_transactions
union all select 'finance_ledger_entries', count(*) from finance_ledger_entries;

\echo ''
\echo '======== 9. NOTIFICATION ========'
select status, count(*) as messages, max(attempts) as worst_attempts
from email_outbox
group by status
order by count(*) desc;
