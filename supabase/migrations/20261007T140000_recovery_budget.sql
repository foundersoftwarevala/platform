-- The recovery budget: how much healing one incident is worth.
--
-- Attempt count was already bounded. What was not is time and breadth, and
-- those are the two that let a well-behaved worker still do damage — an
-- incident retried within its attempt limit but across three days, or a
-- recovery that touches far more than the thing that failed.
--
-- Three additions, all enforced where the attempt is written rather than
-- where it is decided:
--
--   A wall-clock deadline per incident. Past it, no further attempt.
--   A cap on how many recoveries may run at once across the whole engine,
--   so a burst of incidents cannot become a burst of concurrent changes.
--   A declared scope per attempt, so "reduce one agent's concurrency" cannot
--   quietly become "reduce everyone's".

ALTER TABLE public.founder_recovery_policies
  -- How long the whole recovery of one incident may take, from detection.
  ADD COLUMN IF NOT EXISTS max_recovery_minutes int NOT NULL DEFAULT 60,
  -- How many incidents of this class may be under recovery at once.
  ADD COLUMN IF NOT EXISTS max_concurrent int NOT NULL DEFAULT 2,
  -- How many rows one attempt of this class may touch.
  ADD COLUMN IF NOT EXISTS max_scope_rows int NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'founder_recovery_budget_bounded') THEN
    ALTER TABLE public.founder_recovery_policies ADD CONSTRAINT founder_recovery_budget_bounded CHECK (
      max_recovery_minutes BETWEEN 1 AND 1440
      AND max_concurrent BETWEEN 1 AND 20
      AND max_scope_rows BETWEEN 1 AND 1000
    );
  END IF;
END $$;

-- Tighter budgets where the risk is higher. A performance recovery may take
-- its time; a workflow one should not sit half-recovered for an hour.
UPDATE public.founder_recovery_policies SET max_recovery_minutes = 30, max_concurrent = 3, max_scope_rows = 1
 WHERE failure_class = 'TRANSIENT';
UPDATE public.founder_recovery_policies SET max_recovery_minutes = 45, max_concurrent = 2, max_scope_rows = 1
 WHERE failure_class = 'DEPENDENCY';
UPDATE public.founder_recovery_policies SET max_recovery_minutes = 20, max_concurrent = 2, max_scope_rows = 5
 WHERE failure_class = 'WORKFLOW';
UPDATE public.founder_recovery_policies SET max_recovery_minutes = 60, max_concurrent = 1, max_scope_rows = 10
 WHERE failure_class = 'PERFORMANCE';

ALTER TABLE public.founder_recovery_attempts
  -- What this attempt actually touched. Declared by the executor and checked
  -- against the policy, so an action cannot widen its own blast radius.
  ADD COLUMN IF NOT EXISTS scope_rows int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS scope_description text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'founder_recovery_scope_positive') THEN
    ALTER TABLE public.founder_recovery_attempts ADD CONSTRAINT founder_recovery_scope_positive CHECK (
      scope_rows >= 0
    );
  END IF;
END $$;

-- The budget, enforced at the moment an attempt is written.
--
-- This runs alongside the existing action and limit guards rather than
-- replacing them; each refuses a different way of overrunning.
CREATE OR REPLACE FUNCTION public.founder_recovery_budget_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  inc public.founder_incidents%ROWTYPE;
  pol public.founder_recovery_policies%ROWTYPE;
  running int;
  elapsed_minutes numeric;
BEGIN
  SELECT * INTO inc FROM public.founder_incidents WHERE id = NEW.incident_id;
  SELECT * INTO pol FROM public.founder_recovery_policies WHERE failure_class = inc.failure_class;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Time. Measured from detection, so a recovery cannot creep across days by
  -- staying inside its attempt count.
  elapsed_minutes := EXTRACT(EPOCH FROM (now() - inc.detected_at)) / 60.0;
  IF elapsed_minutes > pol.max_recovery_minutes THEN
    RAISE EXCEPTION
      'the recovery budget for a % failure is % minute(s); this incident was detected % minute(s) ago',
      inc.failure_class, pol.max_recovery_minutes, round(elapsed_minutes)
      USING ERRCODE = 'check_violation';
  END IF;

  -- Breadth. An action may not touch more than its class permits.
  IF NEW.scope_rows > pol.max_scope_rows THEN
    RAISE EXCEPTION
      'a % recovery may touch at most % row(s); this attempt declares %',
      inc.failure_class, pol.max_scope_rows, NEW.scope_rows
      USING ERRCODE = 'check_violation';
  END IF;

  -- Concurrency, across the engine. Counted on insert only, so an update to
  -- an existing attempt does not trip it.
  IF TG_OP = 'INSERT' THEN
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
END $$;

DROP TRIGGER IF EXISTS founder_recovery_budget_guard ON public.founder_recovery_attempts;
CREATE TRIGGER founder_recovery_budget_guard
  BEFORE INSERT OR UPDATE ON public.founder_recovery_attempts
  FOR EACH ROW EXECUTE FUNCTION public.founder_recovery_budget_guard();

-- What each class is allowed to spend, in one place for a screen to show.
CREATE OR REPLACE VIEW public.founder_recovery_budgets
WITH (security_invoker = true) AS
SELECT
  p.failure_class,
  p.autonomous,
  p.max_attempts,
  p.max_recovery_minutes,
  p.max_concurrent,
  p.max_scope_rows,
  (SELECT count(*) FROM public.founder_incidents i
    WHERE i.failure_class = p.failure_class AND i.state = 'RECOVERING') AS currently_recovering,
  (SELECT count(*) FROM public.founder_incidents i
    WHERE i.failure_class = p.failure_class
      AND i.state IN ('ELIGIBLE','RETRY_PENDING') AND i.circuit_open = false) AS awaiting
FROM public.founder_recovery_policies p;

GRANT SELECT ON public.founder_recovery_budgets TO service_role;
