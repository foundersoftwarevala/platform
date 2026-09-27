-- The off switch, and the Founder's hand on it.
--
-- An autonomous worker without an authoritative way to stop it is the part of
-- this design that could actually hurt. Everything else in the engine limits
-- what recovery may do; this decides whether recovery happens at all, and it
-- is built so that "off" cannot be overridden by the thing being switched
-- off.
--
-- Two levels, and both are enforced in the database rather than in the worker
-- that reads them, because a worker with a bug is exactly the situation the
-- switch exists for.
--
--   The global switch stops all autonomous recovery. Incidents keep being
--   raised, escalation keeps working and the dashboard keeps showing the
--   truth — what stops is execution. Nothing is deleted and nothing is
--   hidden, because an emergency is the worst time to lose visibility.
--
--   A per-incident block lets the Founder stop one recovery without stopping
--   the engine, which is the common case: something is being worked on by a
--   person and the system should keep its hands off that one thing.

CREATE TABLE IF NOT EXISTS public.founder_healing_control (
  -- One row. The primary key is a constant so a second row cannot exist and
  -- leave two switches disagreeing about whether healing is on.
  id                boolean PRIMARY KEY DEFAULT true,
  enabled           boolean NOT NULL DEFAULT true,
  -- Required when off: an unexplained kill switch is one nobody dares turn
  -- back on.
  disabled_reason   text,
  disabled_by       uuid,
  disabled_at       timestamptz,
  -- The most any single pass may work, so a stuck queue cannot become a
  -- stuck worker.
  max_incidents_per_pass int NOT NULL DEFAULT 5,
  -- How long one recovery may take before the lock is considered abandoned.
  attempt_timeout_seconds int NOT NULL DEFAULT 300,
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT founder_healing_control_single_row CHECK (id = true),
  CONSTRAINT founder_healing_control_disabled_is_explained CHECK (
    enabled = true
    OR (disabled_reason IS NOT NULL AND length(btrim(disabled_reason)) > 0
        AND disabled_at IS NOT NULL)
  ),
  CONSTRAINT founder_healing_control_budget_bounded CHECK (
    max_incidents_per_pass BETWEEN 1 AND 50
  ),
  CONSTRAINT founder_healing_control_timeout_bounded CHECK (
    attempt_timeout_seconds BETWEEN 30 AND 3600
  )
);

INSERT INTO public.founder_healing_control (id, enabled)
VALUES (true, true)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.founder_healing_control IS
  'The global self-healing switch. Turning it off stops execution only: detection, escalation and visibility continue.';

ALTER TABLE public.founder_incidents
  -- A person has taken this one. The worker must not touch it.
  ADD COLUMN IF NOT EXISTS recovery_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_by uuid,
  ADD COLUMN IF NOT EXISTS block_reason text,
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'founder_incidents_block_is_explained') THEN
    ALTER TABLE public.founder_incidents ADD CONSTRAINT founder_incidents_block_is_explained CHECK (
      recovery_blocked = false
      OR (block_reason IS NOT NULL AND length(btrim(block_reason)) > 0 AND blocked_at IS NOT NULL)
    );
  END IF;
END $$;

-- The claim function is the single door into autonomous recovery, so both
-- switches are enforced there rather than in the worker. A worker that
-- forgets to check still gets nothing.
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
  v_enabled boolean;
  v_timeout int;
BEGIN
  SELECT enabled, attempt_timeout_seconds INTO v_enabled, v_timeout
    FROM public.founder_healing_control WHERE id = true;

  -- Off means off. No incident is handed out, and the caller gets nothing
  -- rather than an error, so a worker polling a disabled engine simply idles.
  IF v_enabled IS NOT TRUE THEN
    RETURN;
  END IF;

  SELECT i.id INTO v_id
    FROM public.founder_incidents i
    JOIN public.founder_recovery_policies p ON p.failure_class = i.failure_class
   WHERE i.state IN ('ELIGIBLE', 'RETRY_PENDING')
     AND i.circuit_open = false
     -- The Founder's hand on this one incident.
     AND i.recovery_blocked = false
     AND p.autonomous = true
     AND (i.next_attempt_at IS NULL OR i.next_attempt_at <= now())
     AND (i.locked_at IS NULL
          OR i.locked_at < now() - make_interval(secs => coalesce(v_timeout, p_lock_timeout_seconds)))
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

-- Belt and braces: even if something claims an incident another way, an
-- attempt against a blocked incident or a disabled engine is refused at the
-- point of writing it down.
CREATE OR REPLACE FUNCTION public.founder_recovery_control_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_enabled boolean;
  v_blocked boolean;
  v_reason text;
BEGIN
  SELECT enabled INTO v_enabled FROM public.founder_healing_control WHERE id = true;
  IF v_enabled IS NOT TRUE THEN
    RAISE EXCEPTION 'self-healing is switched off; no recovery may be executed'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT recovery_blocked, block_reason INTO v_blocked, v_reason
    FROM public.founder_incidents WHERE id = NEW.incident_id;

  IF v_blocked THEN
    RAISE EXCEPTION 'recovery of this incident is blocked: %', coalesce(v_reason, 'no reason given')
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS founder_recovery_control_guard ON public.founder_recovery_attempts;
CREATE TRIGGER founder_recovery_control_guard
  BEFORE INSERT ON public.founder_recovery_attempts
  FOR EACH ROW EXECUTE FUNCTION public.founder_recovery_control_guard();

ALTER TABLE public.founder_healing_control ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='founder_healing_control' AND policyname='founder_healing_control_service_role'
  ) THEN
    CREATE POLICY founder_healing_control_service_role ON public.founder_healing_control
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Whether the engine itself is well.
--
-- It reports its own degradation rather than trying to heal itself: a
-- self-healing system that claims to have repaired its own repair loop is
-- the one claim nobody should accept.
CREATE OR REPLACE VIEW public.founder_healing_self_check
WITH (security_invoker = true) AS
SELECT
  (SELECT enabled FROM public.founder_healing_control WHERE id = true) AS enabled,
  (SELECT disabled_reason FROM public.founder_healing_control WHERE id = true) AS disabled_reason,
  (SELECT count(*) FROM public.founder_incidents
    WHERE state IN ('ELIGIBLE','RETRY_PENDING') AND circuit_open = false
      AND recovery_blocked = false)                                     AS awaiting_recovery,
  (SELECT count(*) FROM public.founder_incidents WHERE circuit_open)    AS circuits_open,
  (SELECT count(*) FROM public.founder_incidents WHERE recovery_blocked) AS blocked_by_founder,
  -- A lock older than an hour means a worker died holding an incident.
  (SELECT count(*) FROM public.founder_incidents
    WHERE locked_at IS NOT NULL AND locked_at < now() - interval '1 hour'
      AND state = 'RECOVERING')                                          AS stale_locks,
  (SELECT count(*) FROM public.founder_recovery_attempts
    WHERE result = 'SUCCEEDED' AND verified = false)                     AS succeeded_unverified,
  (SELECT count(*) FROM public.founder_incidents
    WHERE state = 'ESCALATED')                                           AS escalated,
  -- The engine is degraded if it is holding locks nobody will release, or
  -- the switch is off. Both are states a person needs to know about.
  ((SELECT enabled FROM public.founder_healing_control WHERE id = true) IS NOT TRUE
   OR (SELECT count(*) FROM public.founder_incidents
        WHERE locked_at IS NOT NULL AND locked_at < now() - interval '1 hour'
          AND state = 'RECOVERING') > 0)                                 AS degraded;

COMMENT ON VIEW public.founder_healing_self_check IS
  'The self-healing engine reporting on itself. It never repairs its own repair loop; degradation is escalated, not healed.';

GRANT SELECT ON public.founder_healing_self_check TO service_role;
