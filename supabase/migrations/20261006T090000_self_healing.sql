-- Self-healing, and the rule that "healed" has to be earned.
--
-- The temptation in a self-healing system is to treat the disappearance of an
-- error as proof that it was fixed. It is not: a retry that happens to
-- succeed while the underlying fault remains looks identical to a repair,
-- and a system that cannot tell them apart will quietly report health it does
-- not have while the same incident recurs forever.
--
-- So an incident may only reach RESOLVED on the strength of a recovery
-- attempt that was verified — by a named method, with a result — and the
-- constraint refuses it otherwise. "The error stopped" is not a verification
-- method, and there is nowhere to record it as one.
--
-- Three tables. Policies say, per failure class, what may be attempted, how
-- often, and how the result must be checked. Incidents are what went wrong.
-- Attempts are what was tried, each carrying its own verification, so a
-- failed recovery stays visible rather than being overwritten by the next
-- try.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'founder_failure_class') THEN
    CREATE TYPE founder_failure_class AS ENUM (
      'TRANSIENT', 'CONFIGURATION', 'DATA', 'WORKFLOW',
      'DEPENDENCY', 'PERFORMANCE', 'SECURITY', 'UNKNOWN'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'founder_incident_state') THEN
    CREATE TYPE founder_incident_state AS ENUM (
      'DETECTED', 'DIAGNOSING', 'RECOVERING', 'VERIFYING',
      'RESOLVED', 'CONTAINED', 'ESCALATED', 'FAILED'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'founder_recovery_result') THEN
    CREATE TYPE founder_recovery_result AS ENUM (
      'RUNNING', 'SUCCEEDED', 'FAILED', 'INCONCLUSIVE', 'ABANDONED'
    );
  END IF;
END $$;

-- --------------------------------------------------------- the policies

CREATE TABLE IF NOT EXISTS public.founder_recovery_policies (
  failure_class     founder_failure_class PRIMARY KEY,
  label             text NOT NULL,
  -- What may be attempted for this class, and nothing else.
  allowed_actions   text[] NOT NULL,
  max_attempts      int NOT NULL DEFAULT 3,
  attempt_timeout_seconds int NOT NULL DEFAULT 120,
  risk              founder_severity NOT NULL DEFAULT 'LOW',
  -- How a recovery of this class must be checked. A class with no method
  -- cannot be auto-recovered, because nothing could confirm it worked.
  verification_method text,
  -- Whether anything here may run without a person.
  autonomous        boolean NOT NULL DEFAULT true,
  escalate_after_attempts int NOT NULL DEFAULT 2,
  notes             text,
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT founder_recovery_actions_present CHECK (array_length(allowed_actions, 1) >= 1),
  CONSTRAINT founder_recovery_attempts_bounded CHECK (max_attempts BETWEEN 1 AND 10),
  CONSTRAINT founder_recovery_escalation_before_exhaustion CHECK (
    escalate_after_attempts <= max_attempts
  ),
  -- Anything allowed to heal itself must say how success is confirmed.
  CONSTRAINT founder_recovery_autonomous_needs_verification CHECK (
    autonomous = false
    OR (verification_method IS NOT NULL AND length(btrim(verification_method)) > 0)
  )
);

INSERT INTO public.founder_recovery_policies
  (failure_class, label, allowed_actions, max_attempts, risk, verification_method,
   autonomous, escalate_after_attempts, notes)
VALUES
  ('TRANSIENT', 'retry with backoff',
   ARRAY['retry','backoff','reroute']::text[], 3, 'LOW',
   'the same operation is re-run and returns a success the caller can use', true, 2,
   'The common case: a provider blinked. Retried, then escalated rather than retried forever.'),

  ('DEPENDENCY', 'fall back to the configured alternative',
   ARRAY['retry','fallback_route','reduce_concurrency']::text[], 3, 'MEDIUM',
   'the fallback route answers and the result passes the same validation as the primary', true, 2,
   'Uses the route table that already exists. No new provider layer.'),

  ('WORKFLOW', 'resume or reassign',
   ARRAY['resume','reassign','retry']::text[], 2, 'MEDIUM',
   'the workflow reaches its next lawful state and the state machine accepts the transition', true, 2,
   'Reassignment goes through the ordinary assignment path, so its audit applies.'),

  ('PERFORMANCE', 'shed load rather than add it',
   ARRAY['reduce_concurrency','rebalance','reroute']::text[], 2, 'MEDIUM',
   'the measured latency or queue depth returns below the threshold that triggered it', true, 2,
   'Never optimises by doing more work.')
ON CONFLICT (failure_class) DO NOTHING;

-- The three classes that must not heal themselves, and why.
INSERT INTO public.founder_recovery_policies
  (failure_class, label, allowed_actions, max_attempts, risk, verification_method,
   autonomous, escalate_after_attempts, notes)
VALUES
  ('CONFIGURATION', 'propose, do not apply',
   ARRAY['diagnose','propose_change']::text[], 1, 'HIGH', NULL, false, 1,
   'A configuration change is how one failure becomes several. Diagnosed and proposed; applied by a person.'),

  ('DATA', 'rebuild derived state only',
   ARRAY['diagnose','rebuild_derived','refetch']::text[], 2, 'HIGH', NULL, false, 1,
   'Authoritative business data is never rewritten to make an inconsistency go away. Only derived state may be rebuilt, and a person decides.'),

  ('SECURITY', 'contain and escalate',
   ARRAY['block','isolate','escalate']::text[], 1, 'CRITICAL', NULL, false, 1,
   'Containment is allowed; changing a permission or a policy is not, and never without authorization.'),

  ('UNKNOWN', 'contain and investigate',
   ARRAY['contain','diagnose','escalate']::text[], 1, 'HIGH', NULL, false, 1,
   'A failure nobody has classified cannot have a safe recovery chosen for it.')
ON CONFLICT (failure_class) DO NOTHING;


-- -------------------------------------------------------- the incidents

CREATE TABLE IF NOT EXISTS public.founder_incidents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,

  title           text NOT NULL,
  detail          text NOT NULL,
  failure_class   founder_failure_class NOT NULL DEFAULT 'UNKNOWN',
  severity        founder_severity NOT NULL DEFAULT 'MEDIUM',
  domain          text NOT NULL,

  -- Where it was seen, and what it was about.
  source_system   text NOT NULL,
  entity_type     text,
  entity_id       text,
  -- The signal or run this came from, so an incident is traceable to the
  -- thing that noticed it.
  event_id        uuid REFERENCES public.founder_events(id) ON DELETE SET NULL,
  agent_run_id    uuid REFERENCES public.ai_agent_runs(id) ON DELETE SET NULL,

  -- What is believed to have caused it. A hypothesis, and labelled as one:
  -- a verified cause belongs in founder_causal_claims.
  root_cause_hypothesis text,
  diagnosis_evidence    jsonb NOT NULL DEFAULT '{}'::jsonb,

  state           founder_incident_state NOT NULL DEFAULT 'DETECTED',
  attempts        int NOT NULL DEFAULT 0,
  -- Set when the circuit is open: further attempts are refused until a person
  -- or a cooling period closes it.
  circuit_open    boolean NOT NULL DEFAULT false,
  circuit_reason  text,

  -- Only on RESOLVED, and only from a verified attempt.
  resolved_by_attempt uuid,
  resolved_at     timestamptz,
  escalated_at    timestamptz,
  escalation_reason text,
  contained_reason text,

  detected_at     timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT founder_incidents_title_not_blank CHECK (length(btrim(title)) > 0),
  CONSTRAINT founder_incidents_detail_not_blank CHECK (length(btrim(detail)) > 0),
  CONSTRAINT founder_incidents_attempts_not_negative CHECK (attempts >= 0),

  -- The central rule. An incident is resolved only on the strength of a
  -- recovery attempt that was verified; there is nowhere to record "the error
  -- stopped" as a reason.
  CONSTRAINT founder_incidents_resolution_is_earned CHECK (
    state <> 'RESOLVED'
    OR (resolved_by_attempt IS NOT NULL AND resolved_at IS NOT NULL)
  ),
  CONSTRAINT founder_incidents_escalation_is_explained CHECK (
    state <> 'ESCALATED'
    OR (escalation_reason IS NOT NULL AND length(btrim(escalation_reason)) > 0
        AND escalated_at IS NOT NULL)
  ),
  CONSTRAINT founder_incidents_containment_is_explained CHECK (
    state <> 'CONTAINED'
    OR (contained_reason IS NOT NULL AND length(btrim(contained_reason)) > 0)
  ),
  CONSTRAINT founder_incidents_open_circuit_is_explained CHECK (
    circuit_open = false
    OR (circuit_reason IS NOT NULL AND length(btrim(circuit_reason)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS founder_incidents_open_idx
  ON public.founder_incidents (state, detected_at DESC)
  WHERE state NOT IN ('RESOLVED', 'CONTAINED');
CREATE INDEX IF NOT EXISTS founder_incidents_entity_idx
  ON public.founder_incidents (domain, entity_type, entity_id, detected_at DESC);

-- --------------------------------------------------------- the attempts

CREATE TABLE IF NOT EXISTS public.founder_recovery_attempts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id     uuid NOT NULL REFERENCES public.founder_incidents(id) ON DELETE CASCADE,
  attempt_number  int NOT NULL,

  action          text NOT NULL,
  -- Why this action rather than another. An unexplained recovery is a
  -- restart with a nicer name.
  chosen_because  text NOT NULL,

  result          founder_recovery_result NOT NULL DEFAULT 'RUNNING',
  -- What actually came back.
  outcome         text,
  error           text,

  -- Verification is separate from the result, and this is the point of the
  -- whole table: an attempt can succeed and still fail verification.
  verification_method text,
  verified        boolean NOT NULL DEFAULT false,
  verified_at     timestamptz,
  verification_detail text,

  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,

  CONSTRAINT founder_recovery_attempt_number_positive CHECK (attempt_number >= 1),
  CONSTRAINT founder_recovery_action_not_blank CHECK (length(btrim(action)) > 0),
  CONSTRAINT founder_recovery_reason_not_blank CHECK (length(btrim(chosen_because)) > 0),
  -- A verified attempt has to say how it was verified and when.
  CONSTRAINT founder_recovery_verified_is_evidenced CHECK (
    verified = false
    OR (verification_method IS NOT NULL AND length(btrim(verification_method)) > 0
        AND verified_at IS NOT NULL
        AND verification_detail IS NOT NULL AND length(btrim(verification_detail)) > 0)
  ),
  -- Only something that succeeded can be verified. Verifying a failure is a
  -- category error and usually means the check was measuring the wrong thing.
  CONSTRAINT founder_recovery_only_success_is_verified CHECK (
    verified = false OR result = 'SUCCEEDED'
  ),
  CONSTRAINT founder_recovery_failure_is_explained CHECK (
    result <> 'FAILED' OR (error IS NOT NULL AND length(btrim(error)) > 0)
  ),
  CONSTRAINT founder_recovery_success_has_outcome CHECK (
    result <> 'SUCCEEDED' OR (outcome IS NOT NULL AND length(btrim(outcome)) > 0)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS founder_recovery_attempt_unique
  ON public.founder_recovery_attempts (incident_id, attempt_number);

-- An attempt may only use an action its policy allows, and may not exceed the
-- attempt limit. This is where infinite retry is actually prevented — not by
-- the loop remembering to stop, but by the row being refused.
CREATE OR REPLACE FUNCTION public.founder_recovery_attempt_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  inc public.founder_incidents%ROWTYPE;
  pol public.founder_recovery_policies%ROWTYPE;
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
    IF inc.circuit_open THEN
      RAISE EXCEPTION 'the circuit is open for this incident: %', inc.circuit_reason
        USING ERRCODE = 'check_violation';
    END IF;

    IF NOT (NEW.action = ANY (pol.allowed_actions)) THEN
      RAISE EXCEPTION '% is not an allowed action for a % failure (allowed: %)',
        NEW.action, inc.failure_class, array_to_string(pol.allowed_actions, ', ')
        USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.attempt_number > pol.max_attempts THEN
      RAISE EXCEPTION 'a % failure allows %  attempt(s); this is attempt %',
        inc.failure_class, pol.max_attempts, NEW.attempt_number
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- A class whose policy forbids autonomy cannot mark its own recovery
  -- verified: something else has to say it worked.
  IF NEW.verified AND NOT pol.autonomous THEN
    RAISE EXCEPTION 'a % failure is not autonomously recoverable, so it cannot self-verify',
      inc.failure_class USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS founder_recovery_attempt_guard ON public.founder_recovery_attempts;
CREATE TRIGGER founder_recovery_attempt_guard
  BEFORE INSERT OR UPDATE ON public.founder_recovery_attempts
  FOR EACH ROW EXECUTE FUNCTION public.founder_recovery_attempt_guard();

-- An incident may only be resolved by an attempt that actually verified.
CREATE OR REPLACE FUNCTION public.founder_incident_resolution_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  ok boolean;
BEGIN
  IF NEW.state = 'RESOLVED' AND OLD.state IS DISTINCT FROM 'RESOLVED' THEN
    SELECT verified INTO ok
      FROM public.founder_recovery_attempts
     WHERE id = NEW.resolved_by_attempt AND incident_id = NEW.id;

    IF ok IS NOT TRUE THEN
      RAISE EXCEPTION
        'an incident can only be resolved by a verified recovery attempt of its own'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS founder_incident_resolution_guard ON public.founder_incidents;
CREATE TRIGGER founder_incident_resolution_guard
  BEFORE UPDATE ON public.founder_incidents
  FOR EACH ROW EXECUTE FUNCTION public.founder_incident_resolution_guard();

ALTER TABLE public.founder_recovery_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder_recovery_attempts ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['founder_recovery_policies','founder_incidents','founder_recovery_attempts'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname='public'
        AND tablename = t AND policyname = t || '_service_role'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
        t || '_service_role', t);
    END IF;
  END LOOP;
END $$;

-- How the healing is actually going, counted rather than claimed.
--
-- auto_recovered counts only incidents resolved by a verified attempt, so it
-- cannot drift upward because errors stopped appearing.
CREATE OR REPLACE VIEW public.founder_healing_totals
WITH (security_invoker = true) AS
SELECT
  count(*)                                                  AS incidents,
  count(*) FILTER (WHERE state = 'RESOLVED')                AS auto_recovered,
  count(*) FILTER (WHERE state IN ('DETECTED','DIAGNOSING','RECOVERING','VERIFYING')) AS in_progress,
  count(*) FILTER (WHERE state = 'ESCALATED')               AS escalated,
  count(*) FILTER (WHERE state = 'CONTAINED')               AS contained,
  count(*) FILTER (WHERE state = 'FAILED')                  AS failed,
  count(*) FILTER (WHERE circuit_open)                      AS circuits_open,
  count(*) FILTER (WHERE failure_class = 'SECURITY')        AS security_incidents,
  (SELECT count(*) FROM public.founder_recovery_attempts)   AS attempts,
  (SELECT count(*) FROM public.founder_recovery_attempts WHERE verified) AS verified_attempts
FROM public.founder_incidents;

COMMENT ON VIEW public.founder_healing_totals IS
  'auto_recovered counts incidents resolved by a verified recovery attempt. Nothing here rises because an error stopped being reported.';

GRANT SELECT ON public.founder_healing_totals TO service_role;
