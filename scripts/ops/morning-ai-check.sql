-- Do Morning AI's rules hold?
--
-- A line reading ERROR is a constraint doing its job. Everything written
-- carries the maicheck marker and is removed at the end.
--
--   node scripts/ops/db.mjs --file scripts/ops/morning-ai-check.sql
\set ON_ERROR_STOP 0

\echo '=== a cycle that claims a brief must point at one ==='
INSERT INTO public.founder_daily_cycles (cycle_date, state)
VALUES (DATE '1990-01-02', 'BRIEF_READY');

\echo '=== a cycle that failed must say why ==='
INSERT INTO public.founder_daily_cycles (cycle_date, state)
VALUES (DATE '1990-01-03', 'FAILED');

\echo '=== an analysing cycle with no brief yet is fine ==='
INSERT INTO public.founder_daily_cycles (cycle_date, state)
VALUES (DATE '1990-01-01', 'ANALYSING');

\echo '=== only one cycle per day ==='
INSERT INTO public.founder_daily_cycles (cycle_date, state)
VALUES (DATE '1990-01-01', 'ANALYSING');

\echo '=== a plan item must point at exactly one piece of work ==='
INSERT INTO public.founder_work_plan_items
  (cycle_id, title, domain, position, priority_score, priority_reason)
SELECT id, 'maicheck orphan', 'ops', 1, 10, 'no source'
  FROM public.founder_daily_cycles WHERE cycle_date = DATE '1990-01-01';

\echo '=== a plan item must explain its position ==='
INSERT INTO public.founder_work_plan_items
  (cycle_id, attention_id, title, domain, position, priority_score, priority_reason)
SELECT c.id, gen_random_uuid(), 'maicheck', 'ops', 1, 10, '   '
  FROM public.founder_daily_cycles c WHERE c.cycle_date = DATE '1990-01-01';

\echo '=== a real attention item, so the plan has something to point at ==='
INSERT INTO public.founder_attention
  (kind, domain, title, reason, severity, priority, source_system, status, evidence)
VALUES ('maicheck', 'ops', 'maicheck item', 'raised by the morning check', 'HIGH', 2, 'maicheck', 'NEW', '{"raisedBy":"maicheck"}'::jsonb);

\echo '=== a well-formed plan item is accepted ==='
INSERT INTO public.founder_work_plan_items
  (cycle_id, attention_id, title, domain, severity, position, priority_score, priority_reason)
SELECT c.id, a.id, 'maicheck', 'ops', 'HIGH', 1, 55, 'high severity; a person set priority 2'
  FROM public.founder_daily_cycles c, public.founder_attention a
 WHERE c.cycle_date = DATE '1990-01-01' AND a.source_system = 'maicheck';

\echo '=== the same work cannot appear twice in one day''s plan ==='
INSERT INTO public.founder_work_plan_items
  (cycle_id, attention_id, title, domain, severity, position, priority_score, priority_reason)
SELECT c.id, a.id, 'maicheck again', 'ops', 'HIGH', 2, 50, 'duplicate'
  FROM public.founder_daily_cycles c, public.founder_attention a
 WHERE c.cycle_date = DATE '1990-01-01' AND a.source_system = 'maicheck';

\echo '=== an agent suggestion must say why that agent ==='
UPDATE public.founder_work_plan_items
   SET suggested_agent_id = (SELECT id FROM public.ai_agents WHERE agent_key = 'mon-finance'),
       allocation_reason = NULL
 WHERE title = 'maicheck';

\echo '=== work cannot jump from PLANNED straight to COMPLETED ==='
UPDATE public.founder_work_plan_items SET state = 'COMPLETED' WHERE title = 'maicheck';

\echo '=== the lawful path is allowed, step by step ==='
UPDATE public.founder_work_plan_items SET state = 'PRIORITIZED' WHERE title = 'maicheck';
UPDATE public.founder_work_plan_items SET state = 'PLANNED'   WHERE title = 'maicheck';
UPDATE public.founder_work_plan_items SET state = 'ASSIGNED'  WHERE title = 'maicheck';
UPDATE public.founder_work_plan_items SET state = 'EXECUTING' WHERE title = 'maicheck';
UPDATE public.founder_work_plan_items SET state = 'VERIFYING' WHERE title = 'maicheck';
UPDATE public.founder_work_plan_items SET state = 'COMPLETED' WHERE title = 'maicheck';
SELECT state, verification FROM public.founder_work_plan_items WHERE title = 'maicheck';

\echo '=== completing is not verifying: it still reads UNVERIFIED ==='
SELECT count(*) AS completed_but_unverified FROM public.founder_work_plan_items
 WHERE title = 'maicheck' AND state = 'COMPLETED' AND verification = 'UNVERIFIED';

\echo '=== nothing can be marked VERIFIED unless it is complete ==='
UPDATE public.founder_work_plan_items SET verification = 'VERIFIED', state = 'EXECUTING'
 WHERE title = 'maicheck';

\echo '=== the day, counted in SQL ==='
SELECT planned, completed, verified, failed FROM public.founder_cycle_totals
 WHERE cycle_date = DATE '1990-01-01';

\echo '=== cleanup ==='
DELETE FROM public.founder_work_plan_items WHERE title LIKE 'maicheck%';
DELETE FROM public.founder_daily_cycles WHERE cycle_date BETWEEN DATE '1990-01-01' AND DATE '1990-01-03';
DELETE FROM public.founder_attention WHERE source_system = 'maicheck';

SELECT
 (SELECT count(*) FROM public.founder_daily_cycles)    AS cycles_left,
 (SELECT count(*) FROM public.founder_work_plan_items) AS items_left,
 (SELECT count(*) FROM public.founder_attention WHERE source_system = 'maicheck') AS attention_left;
