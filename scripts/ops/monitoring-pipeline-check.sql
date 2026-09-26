-- Does the monitoring ladder hold?
--
-- Each block tries something the pipeline must refuse, or asserts something
-- the ladder must say. A line reading ERROR is a constraint doing its job.
--
--   node scripts/ops/db.mjs --file scripts/ops/monitoring-pipeline-check.sql
--
-- Everything written carries the mpcheck marker and is removed at the end.
\set ON_ERROR_STOP 0

\echo '=== the ladder, as configured ==='
SELECT severity, label, raises_attention, attention_priority, notifies, escalates, opens_decision
  FROM public.founder_signal_routes ORDER BY attention_priority DESC;

\echo '=== INFO raises nothing; CRITICAL does everything ==='
SELECT
  (SELECT raises_attention FROM public.founder_signal_routes WHERE severity='INFO')    AS info_raises,
  (SELECT notifies         FROM public.founder_signal_routes WHERE severity='LOW')     AS low_notifies,
  (SELECT raises_attention FROM public.founder_signal_routes WHERE severity='MEDIUM')  AS medium_raises,
  (SELECT notifies         FROM public.founder_signal_routes WHERE severity='HIGH')    AS high_notifies,
  (SELECT escalates        FROM public.founder_signal_routes WHERE severity='CRITICAL') AS critical_escalates,
  (SELECT opens_decision   FROM public.founder_signal_routes WHERE severity='CRITICAL') AS critical_decides;

\echo '=== a band cannot escalate without notifying anyone ==='
UPDATE public.founder_signal_routes SET escalates = true, notifies = false WHERE severity = 'LOW';

\echo '=== a band cannot notify without raising something to work ==='
UPDATE public.founder_signal_routes SET notifies = true, raises_attention = false WHERE severity = 'INFO';

\echo '=== a correlation window cannot be zero ==='
UPDATE public.founder_signal_routes SET correlation_window = interval '0' WHERE severity = 'HIGH';

\echo '=== a dispatch that claims correlation must point at the item ==='
INSERT INTO public.founder_signal_dispatch (event_id, severity, route_label, correlated)
SELECT gen_random_uuid(), 'HIGH', 'mpcheck', true;

\echo '=== a dispatch must name the route it took ==='
INSERT INTO public.founder_events
  (event_type, domain, source_system, source_event_id, occurred_at, severity, actor_type)
VALUES ('monitor.mpcheck', 'ops', 'mpcheck', 'mpcheck-1', now(), 'HIGH', 'AI');

INSERT INTO public.founder_signal_dispatch (event_id, severity, route_label)
SELECT id, 'HIGH', '   ' FROM public.founder_events WHERE source_event_id = 'mpcheck-1';

\echo '=== a well-formed dispatch is accepted ==='
INSERT INTO public.founder_signal_dispatch (event_id, severity, route_label)
SELECT id, 'HIGH', 'alerts the Founder' FROM public.founder_events WHERE source_event_id = 'mpcheck-1';

\echo '=== the same event cannot be dispatched twice ==='
INSERT INTO public.founder_signal_dispatch (event_id, severity, route_label)
SELECT id, 'HIGH', 'alerts the Founder' FROM public.founder_events WHERE source_event_id = 'mpcheck-1';

\echo '=== per-agent totals answer ==='
SELECT count(*) AS agents_in_view, sum(signals) AS signals_recorded
  FROM public.founder_signal_agent_totals;

\echo '=== cleanup ==='
DELETE FROM public.founder_signal_dispatch WHERE route_label IN ('mpcheck', 'alerts the Founder')
   AND event_id IN (SELECT id FROM public.founder_events WHERE source_event_id LIKE 'mpcheck%');
DELETE FROM public.founder_events WHERE source_event_id LIKE 'mpcheck%';

SELECT
 (SELECT count(*) FROM public.founder_events WHERE source_event_id LIKE 'mpcheck%') AS events_left,
 (SELECT count(*) FROM public.founder_signal_dispatch) AS dispatch_rows,
 (SELECT count(*) FROM public.founder_attention) AS attention_rows,
 (SELECT escalates FROM public.founder_signal_routes WHERE severity='LOW') AS low_still_quiet,
 (SELECT raises_attention FROM public.founder_signal_routes WHERE severity='INFO') AS info_still_silent;
