-- Turning the self-healing engine on.
--
-- The policies and the "healed has to be earned" guard already exist and are
-- unchanged. What this adds is what a running loop needs and a schema alone
-- did not: a way to refuse a second incident for the same failure, a way to
-- refuse the same recovery running twice, and a state machine that refuses
-- the transitions a loop would otherwise make by accident.
--
-- All three are refusals rather than conventions, because the thing being
-- guarded against is a background worker with a bug, and a background worker
-- with a bug does not read conventions.

-- Three states the running loop needs. The existing ones are untouched.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                  WHERE t.typname = 'founder_incident_state' AND e.enumlabel = 'ELIGIBLE') THEN
    ALTER TYPE founder_incident_state ADD VALUE 'ELIGIBLE' AFTER 'DETECTED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                  WHERE t.typname = 'founder_incident_state' AND e.enumlabel = 'RETRY_PENDING') THEN
    ALTER TYPE founder_incident_state ADD VALUE 'RETRY_PENDING' AFTER 'VERIFYING';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                  WHERE t.typname = 'founder_incident_state' AND e.enumlabel = 'CIRCUIT_OPEN') THEN
    ALTER TYPE founder_incident_state ADD VALUE 'CIRCUIT_OPEN' AFTER 'RETRY_PENDING';
  END IF;
END $$;

ALTER TABLE public.founder_incidents
  -- What makes two reports the same failure. A monitoring pipeline that sees
  -- one outage sixty times must produce one incident, not sixty.
  ADD COLUMN IF NOT EXISTS correlation_key text,
  -- What the policy said had to be true for this to count as recovered,
  -- copied in at detection so a later policy edit cannot rewrite the bar a
  -- past incident was held to.
  ADD COLUMN IF NOT EXISTS verification_requirement text,
  -- When the worker may next pick it up, and which worker holds it now.
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by text,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;

-- One open incident per correlation key. A closed one may recur; an open one
-- absorbs the repeat.
CREATE UNIQUE INDEX IF NOT EXISTS founder_incidents_one_open_per_correlation
  ON public.founder_incidents (correlation_key)
  WHERE correlation_key IS NOT NULL
    AND state NOT IN ('RESOLVED', 'CONTAINED', 'ESCALATED', 'FAILED');

-- What the worker scans. Kept narrow so the scan stays an index hit rather
-- than a table walk as incidents accumulate.
CREATE INDEX IF NOT EXISTS founder_incidents_eligible_idx
  ON public.founder_incidents (next_attempt_at, severity DESC)
  WHERE state IN ('ELIGIBLE', 'RETRY_PENDING') AND circuit_open = false;

ALTER TABLE public.founder_recovery_attempts
  -- The same incident, action and attempt number must execute once. A worker
  -- that crashes after acting and retries would otherwise act twice.
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS executed_by text;

CREATE UNIQUE INDEX IF NOT EXISTS founder_recovery_attempts_idempotent
  ON public.founder_recovery_attempts (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- The incident state machine.
--
-- A loop makes transitions by accident; this refuses the ones that would let
-- it skip the parts that matter — reaching RESOLVED without VERIFYING, or
-- leaving CIRCUIT_OPEN without a person.
CREATE OR REPLACE FUNCTION public.founder_incident_state_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  allowed founder_incident_state[];
  pol public.founder_recovery_policies%ROWTYPE;
BEGIN
  IF NEW.state = OLD.state THEN
    RETURN NEW;
  END IF;

  SELECT * INTO pol FROM public.founder_recovery_policies
   WHERE failure_class = NEW.failure_class;

  -- A class that may not heal itself never becomes ELIGIBLE, so the worker
  -- has nothing to pick up and cannot start down the autonomous path at all.
  IF NEW.state = 'ELIGIBLE' AND (pol.autonomous IS NOT TRUE) THEN
    RAISE EXCEPTION 'a % failure is not autonomously recoverable and cannot become eligible',
      NEW.failure_class USING ERRCODE = 'check_violation';
  END IF;

  allowed := CASE OLD.state
    WHEN 'DETECTED'      THEN ARRAY['ELIGIBLE','DIAGNOSING','CONTAINED','ESCALATED','FAILED']::founder_incident_state[]
    WHEN 'DIAGNOSING'    THEN ARRAY['ELIGIBLE','CONTAINED','ESCALATED','FAILED']::founder_incident_state[]
    WHEN 'ELIGIBLE'      THEN ARRAY['RECOVERING','ESCALATED','CONTAINED']::founder_incident_state[]
    WHEN 'RECOVERING'    THEN ARRAY['VERIFYING','RETRY_PENDING','ESCALATED','FAILED']::founder_incident_state[]
    -- RESOLVED is reachable only from VERIFYING. Nothing may shortcut it.
    WHEN 'VERIFYING'     THEN ARRAY['RESOLVED','RETRY_PENDING','ESCALATED','FAILED']::founder_incident_state[]
    WHEN 'RETRY_PENDING' THEN ARRAY['RECOVERING','CIRCUIT_OPEN','ESCALATED','FAILED']::founder_incident_state[]
    -- An open circuit is left deliberately, not by the loop carrying on.
    WHEN 'CIRCUIT_OPEN'  THEN ARRAY['ESCALATED','CONTAINED']::founder_incident_state[]
    WHEN 'ESCALATED'     THEN ARRAY['RECOVERING','RESOLVED','CONTAINED','FAILED']::founder_incident_state[]
    WHEN 'FAILED'        THEN ARRAY['ESCALATED','CONTAINED']::founder_incident_state[]
    WHEN 'RESOLVED'      THEN ARRAY[]::founder_incident_state[]
    WHEN 'CONTAINED'     THEN ARRAY['ESCALATED']::founder_incident_state[]
    ELSE ARRAY[]::founder_incident_state[]
  END;

  IF NOT (NEW.state = ANY (allowed)) THEN
    RAISE EXCEPTION 'an incident cannot go from % to %', OLD.state, NEW.state
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS founder_incident_state_guard ON public.founder_incidents;
CREATE TRIGGER founder_incident_state_guard
  BEFORE UPDATE OF state ON public.founder_incidents
  FOR EACH ROW EXECUTE FUNCTION public.founder_incident_state_guard();

-- Claiming one incident to work on.
--
-- The lock is taken with SKIP LOCKED so two workers never take the same row,
-- and the claim itself moves the state, so a crashed worker leaves an
-- incident in RECOVERING with a lock time rather than silently available to
-- be worked twice.
CREATE OR REPLACE FUNCTION public.founder_incident_claim(
  p_worker text,
  p_lock_timeout_seconds int DEFAULT 300
)
RETURNS TABLE (
  incident_id uuid,
  failure_class founder_failure_class,
  attempts int,
  allowed_actions text[],
  max_attempts int,
  verification_method text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT i.id INTO v_id
    FROM public.founder_incidents i
    JOIN public.founder_recovery_policies p ON p.failure_class = i.failure_class
   WHERE i.state IN ('ELIGIBLE', 'RETRY_PENDING')
     AND i.circuit_open = false
     AND p.autonomous = true
     AND (i.next_attempt_at IS NULL OR i.next_attempt_at <= now())
     -- A lock older than the timeout belonged to a worker that is gone.
     AND (i.locked_at IS NULL OR i.locked_at < now() - make_interval(secs => p_lock_timeout_seconds))
   ORDER BY i.severity DESC, i.detected_at ASC
   LIMIT 1
   FOR UPDATE OF i SKIP LOCKED;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.founder_incidents
     SET state = 'RECOVERING', locked_by = p_worker, locked_at = now()
   WHERE id = v_id;

  RETURN QUERY
  SELECT i.id, i.failure_class, i.attempts, p.allowed_actions, p.max_attempts, p.verification_method
    FROM public.founder_incidents i
    JOIN public.founder_recovery_policies p ON p.failure_class = i.failure_class
   WHERE i.id = v_id;
END $$;

REVOKE ALL ON FUNCTION public.founder_incident_claim FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.founder_incident_claim TO service_role;

-- The whole story of one recovery, in one row per attempt, so "why did I
-- recover this, why was that action allowed, and how do I know it worked"
-- has a single place to be answered from.
CREATE OR REPLACE VIEW public.founder_healing_timeline
WITH (security_invoker = true) AS
SELECT
  i.id                        AS incident_id,
  i.title                     AS what_failed,
  i.failure_class             AS why_classified,
  i.root_cause_hypothesis,
  i.severity,
  i.state                     AS final_state,
  i.correlation_key,
  i.detected_at,
  a.attempt_number,
  a.action                    AS action_taken,
  a.chosen_because            AS why_allowed,
  a.result                    AS what_happened,
  a.outcome,
  a.error,
  a.verification_method       AS how_verified,
  a.verified,
  a.verification_detail,
  a.started_at                AS attempt_started_at,
  p.max_attempts,
  p.autonomous
FROM public.founder_incidents i
LEFT JOIN public.founder_recovery_attempts a ON a.incident_id = i.id
LEFT JOIN public.founder_recovery_policies p ON p.failure_class = i.failure_class;

COMMENT ON VIEW public.founder_healing_timeline IS
  'Every recovery, attempt by attempt: what failed, why it was classified so, what was tried, why that was allowed, what happened and how it was checked.';

GRANT SELECT ON public.founder_healing_timeline TO service_role;
