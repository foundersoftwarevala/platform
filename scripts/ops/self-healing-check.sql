-- Can the system ever say "healed" without having healed anything?
--
-- Controlled failures are injected here and the recovery path is walked, so
-- this is not a check that the tables exist — it is a check that an incident
-- cannot reach RESOLVED without a recovery attempt that actually verified.
--
--   node scripts/ops/db.mjs --file scripts/ops/self-healing-check.sql
--
-- Runs inside a transaction that is always rolled back.
\set ON_ERROR_STOP 0

\echo '=== the policies, and which classes may heal themselves ==='
SELECT failure_class, max_attempts, autonomous FROM public.founder_recovery_policies
 ORDER BY autonomous DESC, failure_class;

\echo '=== a class that heals itself must say how success is confirmed ==='
SELECT count(*) AS autonomous_without_verification
  FROM public.founder_recovery_policies
 WHERE autonomous AND (verification_method IS NULL OR btrim(verification_method) = '');

BEGIN;

-- ---------------------------------------------- injected failure 1: transient
\echo '=== a transient failure is detected ==='
INSERT INTO public.founder_incidents
  (title, detail, failure_class, severity, domain, source_system, state)
VALUES ('healcheck: provider timed out', 'The AI gateway timed out twice in one minute.',
        'TRANSIENT', 'MEDIUM', 'ai', 'healcheck', 'RECOVERING');

\echo '=== an action the policy does not allow is refused ==='
SAVEPOINT s1;
INSERT INTO public.founder_recovery_attempts
  (incident_id, attempt_number, action, chosen_because)
SELECT id, 1, 'rebuild_derived', 'seemed reasonable'
  FROM public.founder_incidents WHERE title LIKE 'healcheck: provider%';
ROLLBACK TO s1;

\echo '=== an allowed action is accepted ==='
INSERT INTO public.founder_recovery_attempts
  (incident_id, attempt_number, action, chosen_because, result, error)
SELECT id, 1, 'retry', 'the gateway reported a timeout, which is transient by classification',
       'FAILED', 'timed out again'
  FROM public.founder_incidents WHERE title LIKE 'healcheck: provider%';

\echo '=== a failed attempt cannot be marked verified ==='
SAVEPOINT s2;
UPDATE public.founder_recovery_attempts
   SET verified = true, verification_method = 'it looked fine', verified_at = now(),
       verification_detail = 'no further errors seen'
 WHERE action = 'retry' AND result = 'FAILED';
ROLLBACK TO s2;

\echo '=== the incident cannot be resolved on a failed attempt ==='
SAVEPOINT s3;
UPDATE public.founder_incidents
   SET state = 'RESOLVED', resolved_at = now(),
       resolved_by_attempt = (SELECT id FROM public.founder_recovery_attempts
                               WHERE action = 'retry' AND result = 'FAILED')
 WHERE title LIKE 'healcheck: provider%';
ROLLBACK TO s3;

\echo '=== a second attempt succeeds ==='
INSERT INTO public.founder_recovery_attempts
  (incident_id, attempt_number, action, chosen_because, result, outcome)
SELECT id, 2, 'reroute', 'the retry failed, so the request was sent by another route',
       'SUCCEEDED', 'the request completed on the alternate route'
  FROM public.founder_incidents WHERE title LIKE 'healcheck: provider%';

\echo '=== succeeding is not enough: resolving still needs verification ==='
SAVEPOINT s4;
UPDATE public.founder_incidents
   SET state = 'RESOLVED', resolved_at = now(),
       resolved_by_attempt = (SELECT id FROM public.founder_recovery_attempts
                               WHERE action = 'reroute')
 WHERE title LIKE 'healcheck: provider%';
ROLLBACK TO s4;

\echo '=== verification without a method is refused ==='
SAVEPOINT s5;
UPDATE public.founder_recovery_attempts SET verified = true, verified_at = now()
 WHERE action = 'reroute';
ROLLBACK TO s5;

\echo '=== verified properly, with a method and what it showed ==='
UPDATE public.founder_recovery_attempts
   SET verified = true,
       verification_method = 'the same request was replayed and its result passed the primary validation',
       verification_detail = 'replayed twice; both returned a structurally valid answer',
       verified_at = now()
 WHERE action = 'reroute';

\echo '=== now the incident may be resolved ==='
UPDATE public.founder_incidents
   SET state = 'RESOLVED', resolved_at = now(),
       resolved_by_attempt = (SELECT id FROM public.founder_recovery_attempts
                               WHERE action = 'reroute')
 WHERE title LIKE 'healcheck: provider%';
SELECT state, (resolved_by_attempt IS NOT NULL) AS points_at_verified_attempt
  FROM public.founder_incidents WHERE title LIKE 'healcheck: provider%';

-- ---------------------------------------------- injected failure 2: security
\echo '=== a security failure is detected ==='
INSERT INTO public.founder_incidents
  (title, detail, failure_class, severity, domain, source_system, state)
VALUES ('healcheck: repeated unauthorized access', 'Forty refused reads from one session.',
        'SECURITY', 'CRITICAL', 'security', 'healcheck', 'RECOVERING');

\echo '=== it may be contained ==='
INSERT INTO public.founder_recovery_attempts
  (incident_id, attempt_number, action, chosen_because, result, outcome)
SELECT id, 1, 'isolate', 'containment is the only autonomous action a security failure permits',
       'SUCCEEDED', 'the session was isolated'
  FROM public.founder_incidents WHERE title LIKE 'healcheck: repeated%';

\echo '=== but it cannot verify itself, so it cannot self-resolve ==='
SAVEPOINT s6;
UPDATE public.founder_recovery_attempts
   SET verified = true, verification_method = 'checked', verification_detail = 'fine', verified_at = now()
 WHERE action = 'isolate';
ROLLBACK TO s6;

\echo '=== it escalates instead, with a reason ==='
UPDATE public.founder_incidents
   SET state = 'ESCALATED', escalated_at = now(),
       escalation_reason = 'a security failure is never resolved without a person'
 WHERE title LIKE 'healcheck: repeated%';

-- ---------------------------------------------- injected failure 3: runaway
\echo '=== a failure that keeps failing ==='
INSERT INTO public.founder_incidents
  (title, detail, failure_class, severity, domain, source_system, state)
VALUES ('healcheck: workflow stuck', 'The same workflow refuses to advance.',
        'WORKFLOW', 'HIGH', 'ops', 'healcheck', 'RECOVERING');

INSERT INTO public.founder_recovery_attempts (incident_id, attempt_number, action, chosen_because, result, error)
SELECT id, 1, 'resume', 'the workflow had a lawful next state', 'FAILED', 'refused the transition'
  FROM public.founder_incidents WHERE title LIKE 'healcheck: workflow%';
INSERT INTO public.founder_recovery_attempts (incident_id, attempt_number, action, chosen_because, result, error)
SELECT id, 2, 'reassign', 'the first attempt failed, so the owner was changed', 'FAILED', 'refused again'
  FROM public.founder_incidents WHERE title LIKE 'healcheck: workflow%';

\echo '=== a third attempt exceeds the policy and is refused ==='
SAVEPOINT s7;
INSERT INTO public.founder_recovery_attempts (incident_id, attempt_number, action, chosen_because)
SELECT id, 3, 'retry', 'one more time' FROM public.founder_incidents
 WHERE title LIKE 'healcheck: workflow%';
ROLLBACK TO s7;

\echo '=== the circuit opens, and further attempts are refused ==='
UPDATE public.founder_incidents
   SET circuit_open = true, circuit_reason = 'two recovery attempts failed; stopping to avoid a loop'
 WHERE title LIKE 'healcheck: workflow%';
SAVEPOINT s8;
INSERT INTO public.founder_recovery_attempts (incident_id, attempt_number, action, chosen_because)
SELECT id, 2, 'retry', 'trying anyway' FROM public.founder_incidents
 WHERE title LIKE 'healcheck: workflow%';
ROLLBACK TO s8;

\echo '=== the healing totals ==='
SELECT incidents, auto_recovered, escalated, circuits_open, attempts, verified_attempts
  FROM public.founder_healing_totals;

ROLLBACK;

\echo '=== nothing survived the check ==='
SELECT (SELECT count(*) FROM public.founder_incidents) AS incidents_left,
       (SELECT count(*) FROM public.founder_recovery_attempts) AS attempts_left,
       (SELECT count(*) FROM public.founder_recovery_policies) AS policies;
