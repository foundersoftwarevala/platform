-- Can an assignment ever be made without saying why?
--
-- The hard rule for this system is "no random agent assignment" and "every
-- assignment must be auditable". These check that the database enforces both
-- rather than trusting the code that writes to it.
--
--   node scripts/ops/db.mjs --file scripts/ops/lead-assignment-check.sql
--
-- Runs inside a transaction that is always rolled back.
\set ON_ERROR_STOP 0

\echo '=== agent load is counted, not stored ==='
SELECT name, status, open_leads, max_open_leads FROM public.lead_agent_load
 ORDER BY open_leads DESC LIMIT 3;

\echo '=== an offline agent has to say why ==='
SELECT count(*) AS offline_without_reason FROM public.lead_agents
 WHERE status = 'offline' AND (unavailable_reason IS NULL OR btrim(unavailable_reason) = '');

BEGIN;

\echo '=== an assignment without a reason is refused ==='
SAVEPOINT s1;
INSERT INTO public.lead_assignment_log (lead_id, agent_id, action, reason)
SELECT l.id, a.id, 'ASSIGNED', '   ' FROM public.leads l, public.lead_agents a LIMIT 1;
ROLLBACK TO s1;

\echo '=== an assignment that names no agent is refused ==='
SAVEPOINT s2;
INSERT INTO public.lead_assignment_log (lead_id, action, reason)
SELECT id, 'ASSIGNED', 'chosen somehow' FROM public.leads LIMIT 1;
ROLLBACK TO s2;

\echo '=== a reassignment must say who it took the lead from ==='
SAVEPOINT s3;
INSERT INTO public.lead_assignment_log (lead_id, agent_id, action, reason)
SELECT l.id, a.id, 'REASSIGNED', 'moved' FROM public.leads l, public.lead_agents a LIMIT 1;
ROLLBACK TO s3;

\echo '=== "nobody was available" without naming who was excluded is refused ==='
SAVEPOINT s4;
INSERT INTO public.lead_assignment_log (lead_id, action, reason)
SELECT id, 'NO_ELIGIBLE_AGENT', 'no one was free' FROM public.leads LIMIT 1;
ROLLBACK TO s4;

\echo '=== with the exclusions listed, it is accepted ==='
INSERT INTO public.lead_assignment_log (lead_id, action, reason, excluded)
SELECT id, 'NO_ELIGIBLE_AGENT',
       'No eligible agent: Raj Malhotra is offline; Anita Desai is at capacity',
       '[{"name":"Raj Malhotra","why":"offline"},{"name":"Anita Desai","why":"at capacity"}]'::jsonb
  FROM public.leads LIMIT 1;

\echo '=== a well-formed assignment is accepted, with its reasoning ==='
INSERT INTO public.lead_assignment_log (lead_id, agent_id, action, reason, score, factors, considered)
SELECT l.id, a.id, 'ASSIGNED',
       a.name || ': works in en; covers India; 20 of 25 places free',
       85,
       '{"language":40,"region":25,"headroom":16}'::jsonb,
       '[{"name":"other","score":41}]'::jsonb
  FROM public.leads l, public.lead_agents a WHERE a.status = 'online' LIMIT 1;

\echo '=== the log cannot be rewritten ==='
SAVEPOINT s5;
UPDATE public.lead_assignment_log SET reason = 'actually it was random'
 WHERE action = 'ASSIGNED' AND score = 85;
ROLLBACK TO s5;

\echo '=== nor deleted ==='
SAVEPOINT s6;
DELETE FROM public.lead_assignment_log WHERE action = 'ASSIGNED' AND score = 85;
ROLLBACK TO s6;

\echo '=== what was written ==='
SELECT action, (reason IS NOT NULL) AS has_reason,
       jsonb_array_length(excluded) AS excluded_listed
  FROM public.lead_assignment_log ORDER BY created_at DESC LIMIT 2;

ROLLBACK;

\echo '=== nothing survived the check ==='
SELECT count(*) AS log_rows FROM public.lead_assignment_log;
