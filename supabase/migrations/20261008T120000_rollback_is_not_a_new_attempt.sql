-- A reversal must always be recordable.
--
-- The first rollback the engine ever performed exposed this. The action ran,
-- its verification said no, the worker put the agent's ceiling back to 4 —
-- and then the audit row was refused, because (incident_id, attempt_number)
-- is unique and the reversal had been numbered as part of the attempt it
-- undid. The log line read:
--
--   rolled back — ai_agents:dddd… put back to {"max_concurrent":4}
--   (and the rollback could not be recorded: 23505 … already exists)
--
-- A production change that happened with no record of it happening is the
-- exact failure this audit exists to prevent, and it was introduced by the
-- rollback feature itself. So the reversal gets its own attempt number, and
-- the guards learn the difference between a reversal and a further try.
--
-- What changes: a row carrying rollback_of is exempt from the *limits* —
-- the attempt ceiling, the open circuit, the elapsed-time budget and the
-- concurrency cap. Those limits exist to stop the engine doing more to
-- production. A reversal does less: it restores a state the system already
-- held minutes earlier, and refusing it leaves production in the state
-- nobody wanted.
--
-- What does not change: a rollback is still checked against the policy's
-- allowed actions, still bounded by the class's scope ceiling, and still
-- cannot mark itself verified for a class that may not self-verify. Those
-- are safety, not budget, and a reversal has no claim on them.

CREATE OR REPLACE FUNCTION public.founder_recovery_attempt_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  inc public.founder_incidents%ROWTYPE;
  pol public.founder_recovery_policies%ROWTYPE;
  undoing boolean := NEW.rollback_of IS NOT NULL;
BEGIN
  SELECT * INTO inc FROM public.founder_incidents WHERE id = NEW.incident_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no such incident' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO pol FROM public.founder_recovery_policies
   WHERE failure_class = inc.failure_class;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no recovery policy exists for a % failure', inc.failure_class
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- A reversal is allowed through an open circuit. The circuit stops new
    -- attempts on production; putting back what the last one changed is the
    -- opposite of a new attempt.
    IF inc.circuit_open AND NOT undoing THEN
      RAISE EXCEPTION 'the circuit is open for this incident: %', inc.circuit_reason
        USING ERRCODE = 'check_violation';
    END IF;

    -- Unchanged, and it applies to reversals too: a rollback can only undo
    -- an action the class permitted in the first place.
    IF NOT (NEW.action = ANY (pol.allowed_actions)) THEN
      RAISE EXCEPTION '% is not an allowed action for a % failure (allowed: %)',
        NEW.action, inc.failure_class, array_to_string(pol.allowed_actions, ', ')
        USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.attempt_number > pol.max_attempts AND NOT undoing THEN
      RAISE EXCEPTION 'a % failure allows %  attempt(s); this is attempt %',
        inc.failure_class, pol.max_attempts, NEW.attempt_number
        USING ERRCODE = 'check_violation';
    END IF;

    -- What it says it is undoing has to exist, and has to belong to this
    -- same incident. Otherwise "rollback" is just a word that skips limits.
    IF undoing AND NOT EXISTS (
      SELECT 1 FROM public.founder_recovery_attempts prior
       WHERE prior.id = NEW.rollback_of
         AND prior.incident_id = NEW.incident_id
    ) THEN
      RAISE EXCEPTION 'a rollback must name an earlier attempt on the same incident'
        USING ERRCODE = 'check_violation';
    END IF;

    -- And it may only undo something that was captured as reversible, so a
    -- reversal cannot be claimed over an action that recorded no prior state.
    IF undoing AND NOT EXISTS (
      SELECT 1 FROM public.founder_recovery_attempts prior
       WHERE prior.id = NEW.rollback_of AND prior.reversible
    ) THEN
      RAISE EXCEPTION 'the attempt being rolled back was not recorded as reversible'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.verified AND NOT pol.autonomous THEN
    RAISE EXCEPTION 'a % failure is not autonomously recoverable, so it cannot self-verify',
      inc.failure_class USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION public.founder_recovery_budget_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  inc public.founder_incidents%ROWTYPE;
  pol public.founder_recovery_policies%ROWTYPE;
  running int;
  elapsed_minutes numeric;
  undoing boolean := NEW.rollback_of IS NOT NULL;
BEGIN
  SELECT * INTO inc FROM public.founder_incidents WHERE id = NEW.incident_id;
  SELECT * INTO pol FROM public.founder_recovery_policies WHERE failure_class = inc.failure_class;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Time. Measured from detection, so a recovery cannot creep across days by
  -- staying inside its attempt count. A reversal is exempt: the budget has
  -- run out precisely when a half-finished change most needs undoing.
  elapsed_minutes := EXTRACT(EPOCH FROM (now() - inc.detected_at)) / 60.0;
  IF elapsed_minutes > pol.max_recovery_minutes AND NOT undoing THEN
    RAISE EXCEPTION
      'the recovery budget for a % failure is % minute(s); this incident was detected % minute(s) ago',
      inc.failure_class, pol.max_recovery_minutes, round(elapsed_minutes)
      USING ERRCODE = 'check_violation';
  END IF;

  -- Breadth. Not exempt, and deliberately so: a reversal touches exactly the
  -- rows the action touched, so if it cannot fit inside the class's ceiling
  -- then something is wrong with what it claims to be undoing.
  IF NEW.scope_rows > pol.max_scope_rows THEN
    RAISE EXCEPTION
      'a % recovery may touch at most % row(s); this attempt declares %',
      inc.failure_class, pol.max_scope_rows, NEW.scope_rows
      USING ERRCODE = 'check_violation';
  END IF;

  -- Concurrency, across the engine. A reversal is exempt for the same reason
  -- as time: it is finishing work already in flight, not starting more.
  IF TG_OP = 'INSERT' AND NOT undoing THEN
    SELECT count(*) INTO running
      FROM public.founder_incidents i
     WHERE i.failure_class = inc.failure_class
       AND i.state = 'RECOVERING'
       AND i.id <> inc.id;

    IF running >= pol.max_concurrent THEN
      RAISE EXCEPTION
        'a % failure allows % concurrent recovery/recoveries; % already running',
        inc.failure_class, pol.max_concurrent, running
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END
$$;
