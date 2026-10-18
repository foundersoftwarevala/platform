-- Do AYRA's rules hold?
--
-- A line reading ERROR is a guard doing its job. The whole check runs inside
-- a transaction that is always rolled back, so it leaves nothing behind, and
-- each statement expected to fail sits behind a savepoint so the rest can
-- continue.
--
--   node scripts/ops/db.mjs --file scripts/ops/ayra-check.sql
\set ON_ERROR_STOP 0

\echo '=== what AYRA can honestly offer ==='
SELECT * FROM public.ayra_capability_summary;

\echo '=== every unconnected capability explains itself ==='
SELECT count(*) AS unexplained FROM public.ayra_capabilities
 WHERE NOT connected AND (not_connected_reason IS NULL OR btrim(not_connected_reason) = '');

\echo '=== nothing claims to confirm delivery without being connected ==='
SELECT count(*) AS false_confirmers FROM public.ayra_capabilities
 WHERE confirms_delivery AND NOT connected;

BEGIN;

\echo '=== a capability cannot be added as connected with nothing behind it ==='
SAVEPOINT c1;
INSERT INTO public.ayra_capabilities (capability, label, connected)
VALUES ('ayracheck.fake', 'pretend channel', true);
ROLLBACK TO c1;

\echo '=== nor as unconnected without saying why ==='
SAVEPOINT c2;
INSERT INTO public.ayra_capabilities (capability, label, connected)
VALUES ('ayracheck.fake', 'pretend channel', false);
ROLLBACK TO c2;

\echo '=== an order from the Founder ==='
INSERT INTO public.ayra_orders (instruction, understood_as, state)
VALUES ('ayracheck: is customer ko reply prepare karo', 'Draft a reply to the named customer', 'PLANNED');

\echo '=== a step needing a capability that does not exist is refused ==='
SAVEPOINT s1;
INSERT INTO public.ayra_order_steps (order_id, position, description, capability)
SELECT id, 1, 'ayracheck', 'ayracheck.nonexistent' FROM public.ayra_orders
 WHERE instruction LIKE 'ayracheck:%';
ROLLBACK TO s1;

\echo '=== a step may be planned against an unconnected capability ==='
INSERT INTO public.ayra_order_steps (order_id, position, description, capability, state)
SELECT id, 1, 'ayracheck: send it on WhatsApp', 'whatsapp.send', 'PLANNED'
  FROM public.ayra_orders WHERE instruction LIKE 'ayracheck:%';

\echo '=== but it cannot be run, and the refusal names the reason ==='
SAVEPOINT s2;
UPDATE public.ayra_order_steps SET state = 'RUNNING'
 WHERE description = 'ayracheck: send it on WhatsApp';
ROLLBACK TO s2;

\echo '=== nor be claimed done ==='
SAVEPOINT s3;
UPDATE public.ayra_order_steps SET state = 'DONE', result = 'sent'
 WHERE description = 'ayracheck: send it on WhatsApp';
ROLLBACK TO s3;

\echo '=== a connected capability runs normally ==='
INSERT INTO public.ayra_order_steps (order_id, position, description, capability, state)
SELECT id, 2, 'ayracheck: draft the reply', 'email.draft', 'RUNNING'
  FROM public.ayra_orders WHERE instruction LIKE 'ayracheck:%';

\echo '=== a step cannot be verified without a result ==='
SAVEPOINT s4;
UPDATE public.ayra_order_steps SET state = 'VERIFIED'
 WHERE description = 'ayracheck: draft the reply';
ROLLBACK TO s4;

\echo '=== with a result it can ==='
UPDATE public.ayra_order_steps SET state = 'VERIFIED', result = 'draft written to email_outbox'
 WHERE description = 'ayracheck: draft the reply';

\echo '=== the order cannot be reported while a step is outstanding ==='
SAVEPOINT s5;
UPDATE public.ayra_orders SET state = 'REPORTED', report = 'done', reported_at = now()
 WHERE instruction LIKE 'ayracheck:%';
ROLLBACK TO s5;

\echo '=== settle the outstanding step, and it can ==='
UPDATE public.ayra_order_steps SET state = 'BLOCKED',
       blocked_reason = 'WhatsApp is not connected on this platform'
 WHERE description = 'ayracheck: send it on WhatsApp';
UPDATE public.ayra_orders SET state = 'REPORTED', report = 'Reply drafted. WhatsApp is not available.', reported_at = now()
 WHERE instruction LIKE 'ayracheck:%';
SELECT state, (report IS NOT NULL) AS has_report FROM public.ayra_orders
 WHERE instruction LIKE 'ayracheck:%';

\echo '=== "done" cannot be claimed without saying what was done ==='
SAVEPOINT s6;
UPDATE public.ayra_orders SET report = NULL WHERE instruction LIKE 'ayracheck:%';
ROLLBACK TO s6;

\echo '=== a high-impact order cannot execute unauthorized ==='
SAVEPOINT s7;
INSERT INTO public.ayra_orders (instruction, impact, state)
VALUES ('ayracheck: pay the invoice', 'FINANCIAL', 'EXECUTING');
ROLLBACK TO s7;

\echo '=== it can once the Founder has authorized it ==='
INSERT INTO public.ayra_orders (instruction, impact, state, authorized_by, authorized_at)
VALUES ('ayracheck: pay the invoice', 'FINANCIAL', 'EXECUTING', gen_random_uuid(), now());

ROLLBACK;

\echo '=== nothing survived the check ==='
SELECT (SELECT count(*) FROM public.ayra_orders)      AS orders_left,
       (SELECT count(*) FROM public.ayra_order_steps) AS steps_left,
       (SELECT count(*) FROM public.ayra_capabilities) AS capabilities;
