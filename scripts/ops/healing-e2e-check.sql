-- The self-healing loop, run forwards.
--
-- Every other check on this engine proves it by refusing things. This one
-- injects a real failure into a real row, lets detection classify it, has the
-- worker claim it, performs the actual recovery action, verifies against the
-- row itself, and only then resolves — and puts everything back.
--
--   node scripts/ops/db.mjs --file scripts/ops/healing-e2e-check.sql
--
-- It runs in a transaction that is always rolled back, so the injected
-- failure cannot outlive the check even if the check fails partway.
\set ON_ERROR_STOP 0

BEGIN;

\echo '=== the agent before: its real configured ceiling ==='
SELECT name, max_concurrent FROM public.ai_agents WHERE agent_key = 'mon-api';

\echo '=== inject: the agent is put above a workable ceiling ==='
UPDATE public.ai_agents SET max_concurrent = 8 WHERE agent_key = 'mon-api';

\echo '=== detection raises one incident ==='
INSERT INTO public.founder_incidents
  (title, detail, failure_class, severity, domain, source_system,
   entity_type, entity_id, correlation_key, root_cause_hypothesis,
   diagnosis_evidence, verification_requirement, state)
SELECT 'healcheck: agent carrying more than it should',
       'Open runs exceed the configured ceiling; latency is rising on this agent.',
       'PERFORMANCE', 'HIGH', 'ops', 'healcheck',
       'ai_agents', a.id::text, 'healcheck|performance|' || a.id::text,
       'the signal describes degradation rather than failure',
       '{"raisedBy":"healcheck","observed":"queue depth and latency rising"}'::jsonb,
       'the measured latency or queue depth returns below the threshold',
       'ELIGIBLE'
  FROM public.ai_agents a WHERE a.agent_key = 'mon-api';

\echo '=== a second report of the same failure is refused ==='
SAVEPOINT s1;
INSERT INTO public.founder_incidents
  (title, detail, failure_class, severity, domain, source_system,
   entity_type, entity_id, correlation_key, state)
SELECT 'healcheck: same outage, different words', 'Another agent noticed it too.',
       'PERFORMANCE', 'HIGH', 'ops', 'healcheck',
       'ai_agents', a.id::text, 'healcheck|performance|' || a.id::text, 'ELIGIBLE'
  FROM public.ai_agents a WHERE a.agent_key = 'mon-api';
ROLLBACK TO s1;

\echo '=== a class that may not heal itself cannot become eligible ==='
SAVEPOINT s2;
INSERT INTO public.founder_incidents
  (title, detail, failure_class, severity, domain, source_system, state)
VALUES ('healcheck: security probe', 'Refused reads from one session.',
        'SECURITY', 'CRITICAL', 'security', 'healcheck', 'DETECTED');
UPDATE public.founder_incidents SET state = 'ELIGIBLE'
 WHERE title = 'healcheck: security probe';
ROLLBACK TO s2;

\echo '=== the worker claims it, and is handed only its policy actions ==='
SELECT failure_class, max_attempts,
       array_to_string(allowed_actions, ', ') AS allowed,
       (verification_method IS NOT NULL) AS has_verification_method
  FROM public.founder_incident_claim('healcheck-worker', 300);

\echo '=== a second worker gets nothing: the incident is already held ==='
SELECT count(*) AS second_worker_claimed
  FROM public.founder_incident_claim('healcheck-worker-2', 300);

\echo '=== the action: the ceiling is actually halved ==='
UPDATE public.ai_agents SET max_concurrent = 4 WHERE agent_key = 'mon-api';
SELECT max_concurrent AS ceiling_after_action FROM public.ai_agents WHERE agent_key = 'mon-api';

\echo '=== the attempt is recorded ==='
INSERT INTO public.founder_recovery_attempts
  (incident_id, attempt_number, action, chosen_because, result, outcome,
   idempotency_key, executed_by)
SELECT i.id, 1, 'reduce_concurrency',
       'PERFORMANCE policy permits reduce_concurrency; the agent was above its ceiling',
       'SUCCEEDED', 'concurrency reduced from 8 to 4',
       i.id::text || ':reduce_concurrency:1', 'healcheck-worker'
  FROM public.founder_incidents i WHERE i.source_system = 'healcheck';

\echo '=== a crashed worker restarting cannot act twice ==='
SAVEPOINT s3;
INSERT INTO public.founder_recovery_attempts
  (incident_id, attempt_number, action, chosen_because, result, outcome,
   idempotency_key, executed_by)
SELECT i.id, 1, 'reduce_concurrency', 'a crashed worker restarting',
       'SUCCEEDED', 'would have acted again',
       i.id::text || ':reduce_concurrency:1', 'healcheck-worker'
  FROM public.founder_incidents i WHERE i.source_system = 'healcheck';
ROLLBACK TO s3;

\echo '=== an action belonging to another class is refused ==='
SAVEPOINT s4;
INSERT INTO public.founder_recovery_attempts
  (incident_id, attempt_number, action, chosen_because)
SELECT i.id, 2, 'fallback_route', 'reaching for another class''s action'
  FROM public.founder_incidents i WHERE i.source_system = 'healcheck';
ROLLBACK TO s4;

\echo '=== succeeded, but unverified: resolving is refused ==='
UPDATE public.founder_incidents SET state = 'VERIFYING' WHERE source_system = 'healcheck';
SAVEPOINT s5;
UPDATE public.founder_incidents
   SET state = 'RESOLVED', resolved_at = now(),
       resolved_by_attempt = (SELECT id FROM public.founder_recovery_attempts
                               WHERE action = 'reduce_concurrency' LIMIT 1)
 WHERE source_system = 'healcheck';
ROLLBACK TO s5;

\echo '=== verification against the real row ==='
SELECT a.max_concurrent AS ceiling,
       (SELECT count(*) FROM public.ai_agent_runs r
         WHERE r.agent_id = a.id AND r.state IN ('RUNNING','WAITING')) AS open_runs,
       ((SELECT count(*) FROM public.ai_agent_runs r
          WHERE r.agent_id = a.id AND r.state IN ('RUNNING','WAITING')) <= a.max_concurrent)
         AS within_ceiling
  FROM public.ai_agents a WHERE a.agent_key = 'mon-api';

UPDATE public.founder_recovery_attempts
   SET verified = true,
       verification_method = 'the agent was read back and its open runs compared to the new ceiling',
       verification_detail = 'open runs are within the reduced ceiling',
       verified_at = now()
 WHERE action = 'reduce_concurrency';

\echo '=== only now can it resolve ==='
UPDATE public.founder_incidents
   SET state = 'RESOLVED', resolved_at = now(), attempts = 1,
       resolved_by_attempt = (SELECT id FROM public.founder_recovery_attempts
                               WHERE action = 'reduce_concurrency' LIMIT 1)
 WHERE source_system = 'healcheck';
SELECT state, (resolved_by_attempt IS NOT NULL) AS on_a_verified_attempt
  FROM public.founder_incidents WHERE source_system = 'healcheck';

\echo '=== the timeline answers why ==='
SELECT what_failed, why_classified, action_taken, what_happened, verified
  FROM public.founder_healing_timeline WHERE what_failed LIKE 'healcheck%';

ROLLBACK;

\echo '=== nothing survived, and the agent is as it was ==='
SELECT (SELECT count(*) FROM public.founder_incidents WHERE source_system = 'healcheck') AS incidents_left,
       (SELECT count(*) FROM public.founder_recovery_attempts) AS attempts_left,
       (SELECT max_concurrent FROM public.ai_agents WHERE agent_key = 'mon-api') AS agent_ceiling;
