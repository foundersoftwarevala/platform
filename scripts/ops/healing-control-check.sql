-- Does the off switch actually switch it off?
--
-- An autonomous worker without an authoritative stop is the part of this
-- design that could do harm, so this is the check that matters most. It
-- verifies that "off" cannot be overridden by the thing being switched off,
-- and that a Founder's block on one incident is obeyed.
--
--   node scripts/ops/db.mjs --file scripts/ops/healing-control-check.sql
--
-- Runs inside a transaction that is always rolled back, so the switch is
-- never left off by a failed check.
\set ON_ERROR_STOP 0

BEGIN;

\echo '=== an incident the worker would otherwise take ==='
INSERT INTO public.founder_incidents
  (title, detail, failure_class, severity, domain, source_system, state)
VALUES ('ctlcheck: transient provider failure', 'The gateway timed out.',
        'TRANSIENT', 'HIGH', 'ai', 'ctlcheck', 'ELIGIBLE');

\echo '=== with the engine on, it is claimable ==='
SELECT count(*) AS claimed_while_enabled
  FROM public.founder_incident_claim('ctlcheck-worker', 300);

-- Put it back so the next claim has something to find.
UPDATE public.founder_incidents
   SET state = 'RETRY_PENDING', locked_by = NULL, locked_at = NULL
 WHERE source_system = 'ctlcheck';

\echo '=== the switch cannot be turned off without a reason ==='
SAVEPOINT s1;
UPDATE public.founder_healing_control SET enabled = false WHERE id = true;
ROLLBACK TO s1;

\echo '=== turned off properly ==='
UPDATE public.founder_healing_control
   SET enabled = false, disabled_reason = 'ctlcheck: verifying the kill switch',
       disabled_at = now()
 WHERE id = true;
SELECT enabled, (disabled_reason IS NOT NULL) AS has_reason
  FROM public.founder_healing_control WHERE id = true;

\echo '=== now nothing is claimable, however eligible it looks ==='
SELECT count(*) AS claimed_while_disabled
  FROM public.founder_incident_claim('ctlcheck-worker', 300);

\echo '=== and an attempt cannot be written even if something tried ==='
SAVEPOINT s2;
INSERT INTO public.founder_recovery_attempts
  (incident_id, attempt_number, action, chosen_because)
SELECT id, 1, 'retry', 'ignoring the switch'
  FROM public.founder_incidents WHERE source_system = 'ctlcheck';
ROLLBACK TO s2;

\echo '=== detection keeps working while healing is off ==='
INSERT INTO public.founder_incidents
  (title, detail, failure_class, severity, domain, source_system, state)
VALUES ('ctlcheck: raised while disabled', 'Detection does not stop.',
        'TRANSIENT', 'MEDIUM', 'ai', 'ctlcheck', 'DETECTED');
SELECT count(*) AS incidents_visible FROM public.founder_incidents
 WHERE source_system = 'ctlcheck';

\echo '=== escalation keeps working while healing is off ==='
UPDATE public.founder_incidents
   SET state = 'ESCALATED', escalated_at = now(),
       escalation_reason = 'healing is disabled, so this needs a person'
 WHERE title = 'ctlcheck: raised while disabled';
SELECT state FROM public.founder_incidents WHERE title = 'ctlcheck: raised while disabled';

\echo '=== the engine reports itself degraded while off ==='
SELECT enabled, degraded FROM public.founder_healing_self_check;

\echo '=== switched back on ==='
UPDATE public.founder_healing_control
   SET enabled = true, disabled_reason = NULL, disabled_at = NULL WHERE id = true;

\echo '=== the Founder blocks one incident without stopping the engine ==='
UPDATE public.founder_incidents
   SET recovery_blocked = true, block_reason = 'I am looking at this one myself',
       blocked_at = now()
 WHERE title = 'ctlcheck: transient provider failure';

\echo '=== a block with no reason is refused ==='
SAVEPOINT s3;
UPDATE public.founder_incidents
   SET recovery_blocked = true, block_reason = NULL, blocked_at = now()
 WHERE title = 'ctlcheck: raised while disabled';
ROLLBACK TO s3;

\echo '=== the blocked incident is not handed out ==='
SELECT count(*) AS claimed_while_blocked
  FROM public.founder_incident_claim('ctlcheck-worker', 300);

\echo '=== nor may an attempt be written against it ==='
SAVEPOINT s4;
INSERT INTO public.founder_recovery_attempts
  (incident_id, attempt_number, action, chosen_because)
SELECT id, 1, 'retry', 'ignoring the block'
  FROM public.founder_incidents WHERE title = 'ctlcheck: transient provider failure';
ROLLBACK TO s4;

\echo '=== unblocked, it is workable again ==='
UPDATE public.founder_incidents
   SET recovery_blocked = false, block_reason = NULL, blocked_at = NULL
 WHERE title = 'ctlcheck: transient provider failure';
SELECT count(*) AS claimed_after_unblock
  FROM public.founder_incident_claim('ctlcheck-worker', 300);

ROLLBACK;

\echo '=== the switch is on and nothing survived ==='
SELECT (SELECT enabled FROM public.founder_healing_control WHERE id = true) AS enabled,
       (SELECT count(*) FROM public.founder_incidents WHERE source_system = 'ctlcheck') AS left_over;
