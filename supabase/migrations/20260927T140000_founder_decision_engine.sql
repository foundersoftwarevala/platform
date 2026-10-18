-- Founder AI — Decision Engine and its governance layer.
--
-- A decision here is not a chat reply. It is a record with a lifecycle: it is
-- detected from something, built out of evidence that says where it came from,
-- given options rather than one answer, weighed for risk and impact, judged
-- against a policy that was in force at the time, approved by a person who is
-- allowed to approve it, and then held to an outcome.
--
-- What this reuses rather than rebuilds: permissions stay in role_permissions,
-- which already carries 214 rows in a `domain.action` convention and gains the
-- decision.* rows below; notifications stay in the notifications table; the
-- audit trail stays in audit_logs; risks stay in founder_risks from Part 3; the
-- company state, KPIs and events stay where Part 3 put them. The approval
-- shape follows assist_approvals, which already had expiry and an awaiting
-- role, and the lifecycle follows seo_change_requests, which already ran
-- propose → approve → publish → rollback in production.
--
-- Three rules are enforced by the database because they are the ones that
-- matter most and the ones most easily lost in a code path:
--
--   An inference is never stored as a fact. The evidence kind is an enum and
--   the thing it describes has to say which it is.
--
--   A confidence score cannot be asserted. It must arrive with the factors it
--   was derived from, or it is refused — an arbitrary number with a percent
--   sign is exactly what section 11 rules out.
--
--   A decision that has been verified or closed cannot be quietly edited. A
--   correction has to be an amendment, which leaves the original standing.

-- ---------------------------------------------------------------------------
-- Vocabulary
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'founder_decision_state') THEN
    CREATE TYPE founder_decision_state AS ENUM (
      'DETECTED', 'CONTEXT_BUILDING', 'ANALYZING', 'OPTIONS_READY',
      'RECOMMENDATION_READY', 'WAITING_APPROVAL', 'APPROVED', 'REJECTED',
      'EXECUTING', 'VERIFICATION', 'VERIFIED', 'FAILED', 'ESCALATED',
      'CANCELLED', 'CLOSED'
    );
  END IF;

  -- What a piece of evidence actually is. The whole point of the enum is that
  -- an INFERENCE cannot be presented as a FACT anywhere downstream.
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'founder_evidence_kind') THEN
    CREATE TYPE founder_evidence_kind AS ENUM (
      'FACT', 'OBSERVATION', 'CALCULATION', 'ASSUMPTION', 'INFERENCE', 'RECOMMENDATION'
    );
  END IF;

  -- Why a decision could not be made on the evidence available. These route
  -- differently from a real recommendation and must not be dressed up as one.
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'founder_evidence_gap') THEN
    CREATE TYPE founder_evidence_gap AS ENUM (
      'NONE', 'UNKNOWN', 'INSUFFICIENT_DATA', 'STALE_DATA', 'CONFLICTING_DATA'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'founder_approval_state') THEN
    CREATE TYPE founder_approval_state AS ENUM (
      'REQUESTED', 'VIEWED', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'EXPIRED', 'CANCELLED'
    );
  END IF;

  -- What an AI-originated action is allowed to be. Part 4 stops at APPROVE and
  -- AUDIT; EXECUTE exists in the type so later orchestration has a name for it,
  -- and nothing in this module issues one.
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'founder_action_class') THEN
    CREATE TYPE founder_action_class AS ENUM (
      'READ', 'ANALYZE', 'RECOMMEND', 'REQUEST_APPROVAL', 'APPROVE', 'EXECUTE', 'VERIFY', 'AUDIT'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'founder_risk_state') THEN
    CREATE TYPE founder_risk_state AS ENUM (
      'IDENTIFIED', 'ASSESSED', 'MITIGATING', 'MONITORING', 'RESOLVED', 'ACCEPTED', 'ESCALATED'
    );
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Policy, and the version that was in force
-- ---------------------------------------------------------------------------

-- Policies decide what an AI-originated action is allowed to do without a
-- human. They are versioned because a decision made last month has to stay
-- explainable against the rules that applied last month, not today's.
CREATE TABLE IF NOT EXISTS public.founder_policies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  policy_key      text NOT NULL,
  version         int  NOT NULL DEFAULT 1,
  name            text NOT NULL,
  description     text NOT NULL,
  domain          text,
  decision_type   text,
  -- The action class this policy governs.
  action_class    founder_action_class NOT NULL,
  -- At or above this risk level the policy applies.
  min_risk        founder_severity NOT NULL DEFAULT 'LOW',
  requires_approval        boolean NOT NULL DEFAULT true,
  requires_second_reviewer boolean NOT NULL DEFAULT false,
  -- Separation of duties: the actor that raised a decision may not approve it.
  forbid_self_approval     boolean NOT NULL DEFAULT true,
  escalate_above           founder_severity,
  blocked                  boolean NOT NULL DEFAULT false,
  max_financial_exposure   numeric,
  approver_roles  text[] NOT NULL DEFAULT '{}',
  approval_ttl_hours int NOT NULL DEFAULT 72 CHECK (approval_ttl_hours > 0),
  effective_from  timestamptz NOT NULL DEFAULT now(),
  effective_until timestamptz,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'retired')),
  created_by      uuid,
  approved_by     uuid,
  change_reason   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (policy_key, version)
);

CREATE INDEX IF NOT EXISTS founder_policies_lookup
  ON public.founder_policies (status, action_class, effective_from DESC);

-- ---------------------------------------------------------------------------
-- The decision record
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.founder_decisions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  title           text NOT NULL,
  description     text NOT NULL,
  decision_type   text NOT NULL,
  domain          text NOT NULL,
  state           founder_decision_state NOT NULL DEFAULT 'DETECTED',
  priority        int NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),

  -- Where this came from, and the record that proves it. A decision whose
  -- trigger cannot be traced is an opinion with a database row.
  trigger_type      text NOT NULL,
  trigger_reference text,
  trigger_event_id  uuid REFERENCES public.founder_events(id) ON DELETE SET NULL,

  -- Confidence is derived, never asserted: the factors it came from are
  -- required alongside the score, and the constraint below enforces it.
  confidence_score   numeric CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100)),
  confidence_level   text,
  confidence_factors jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- What is missing, if anything. A decision with a gap does not get to
  -- recommend as though it had none.
  evidence_gap    founder_evidence_gap NOT NULL DEFAULT 'NONE',
  risk_level      founder_severity NOT NULL DEFAULT 'LOW',
  impact_level    founder_severity NOT NULL DEFAULT 'LOW',

  recommended_option_id uuid,
  selected_option_id    uuid,
  -- Set when a human chose something other than the recommendation. The
  -- recommendation itself is never rewritten.
  override_reason  text,
  overridden_by    uuid,
  overridden_at    timestamptz,

  approval_required boolean NOT NULL DEFAULT true,
  policy_id         uuid REFERENCES public.founder_policies(id) ON DELETE SET NULL,
  policy_version    int,

  execution_status     text,
  verification_status  text,
  outcome              text,
  outcome_recorded_at  timestamptz,

  decision_due_at     timestamptz,
  approval_due_at     timestamptz,
  execution_due_at    timestamptz,
  verification_due_at timestamptz,

  -- Repeated analysis of the same condition must not produce a second
  -- decision; this is what makes the engine safe to run on a schedule.
  idempotency_key text,

  created_by     uuid,
  actor_kind     founder_actor NOT NULL DEFAULT 'AI',
  decision_owner uuid,
  context_ref    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT founder_decisions_trigger_not_blank CHECK (length(btrim(trigger_type)) > 0),
  CONSTRAINT founder_decisions_confidence_is_derived CHECK (
    confidence_score IS NULL OR confidence_factors <> '{}'::jsonb
  ),
  CONSTRAINT founder_decisions_override_is_accountable CHECK (
    overridden_by IS NULL
    OR (override_reason IS NOT NULL AND length(btrim(override_reason)) > 0 AND overridden_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS founder_decisions_idempotency
  ON public.founder_decisions (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS founder_decisions_state ON public.founder_decisions (state, created_at DESC);
CREATE INDEX IF NOT EXISTS founder_decisions_domain ON public.founder_decisions (domain, risk_level);

-- ---------------------------------------------------------------------------
-- Options, evidence, history
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.founder_decision_options (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id       uuid NOT NULL REFERENCES public.founder_decisions(id) ON DELETE CASCADE,
  label             text NOT NULL,
  title             text NOT NULL,
  description       text NOT NULL,
  expected_benefit  text,
  expected_cost     text,
  -- Every impact dimension is nullable on purpose: an impact that cannot be
  -- estimated is left unset rather than given a made-up figure.
  financial_impact  numeric,
  financial_basis   text,
  customer_impact   founder_severity,
  operational_impact founder_severity,
  reputation_impact founder_severity,
  security_impact   founder_severity,
  compliance_impact founder_severity,
  resource_impact   text,
  time_to_effect    text,
  reversibility     text CHECK (reversibility IS NULL OR reversibility IN ('REVERSIBLE', 'PARTIAL', 'IRREVERSIBLE', 'UNKNOWN')),
  risk_summary      text,
  dependencies      jsonb NOT NULL DEFAULT '[]'::jsonb,
  constraints       jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence_score  numeric CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100)),
  is_recommended    boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (decision_id, label)
);

-- Each piece of evidence says what kind of claim it is and where it came from.
-- An AI inference and a counted fact sit in the same table and can never be
-- confused, because the kind is not optional.
CREATE TABLE IF NOT EXISTS public.founder_decision_evidence (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id   uuid NOT NULL REFERENCES public.founder_decisions(id) ON DELETE CASCADE,
  option_id     uuid REFERENCES public.founder_decision_options(id) ON DELETE CASCADE,
  kind          founder_evidence_kind NOT NULL,
  statement     text NOT NULL,
  source_system text NOT NULL,
  source_entity text,
  source_record text,
  measured_at   timestamptz,
  measurement   jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculation   text,
  freshness     text,
  confidence    founder_confidence NOT NULL DEFAULT 'UNKNOWN',
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT founder_evidence_statement_not_blank CHECK (length(btrim(statement)) > 0),
  CONSTRAINT founder_evidence_source_not_blank CHECK (length(btrim(source_system)) > 0),
  -- A FACT or a CALCULATION claims to come from somewhere real, so it has to
  -- name the record. An ASSUMPTION or INFERENCE does not, and is labelled as
  -- such instead.
  CONSTRAINT founder_evidence_fact_is_sourced CHECK (
    kind NOT IN ('FACT', 'CALCULATION', 'OBSERVATION')
    OR (source_record IS NOT NULL AND length(btrim(source_record)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS founder_evidence_decision
  ON public.founder_decision_evidence (decision_id, kind);

-- Append-only. Every state change, approval, override and outcome lands here,
-- so the history of a decision survives even when the decision itself moves on.
CREATE TABLE IF NOT EXISTS public.founder_decision_history (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id  uuid NOT NULL REFERENCES public.founder_decisions(id) ON DELETE CASCADE,
  at           timestamptz NOT NULL DEFAULT now(),
  actor_kind   founder_actor NOT NULL,
  actor_id     uuid,
  entry_type   text NOT NULL,
  from_state   founder_decision_state,
  to_state     founder_decision_state,
  reason       text,
  detail       jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS founder_decision_history_decision
  ON public.founder_decision_history (decision_id, at DESC);

-- A correction to a locked decision. The original is never edited.
CREATE TABLE IF NOT EXISTS public.founder_decision_amendments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id  uuid NOT NULL REFERENCES public.founder_decisions(id) ON DELETE CASCADE,
  amended_by   uuid NOT NULL,
  reason       text NOT NULL,
  changes      jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT founder_amendment_reason_not_blank CHECK (length(btrim(reason)) > 0),
  CONSTRAINT founder_amendment_changes_not_empty CHECK (changes <> '{}'::jsonb)
);

-- ---------------------------------------------------------------------------
-- Approvals
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.founder_approvals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  decision_id     uuid NOT NULL REFERENCES public.founder_decisions(id) ON DELETE CASCADE,
  approval_type   text NOT NULL,
  requested_by    uuid,
  requester_kind  founder_actor NOT NULL DEFAULT 'AI',
  -- Which role may act on this, resolved from policy at request time.
  awaiting_role   text,
  approver_id     uuid,
  risk_level      founder_severity NOT NULL,
  impact_level    founder_severity NOT NULL,
  reason          text NOT NULL,
  evidence        jsonb NOT NULL DEFAULT '{}'::jsonb,
  policy_id       uuid REFERENCES public.founder_policies(id) ON DELETE SET NULL,
  policy_version  int,
  state           founder_approval_state NOT NULL DEFAULT 'REQUESTED',
  decision_reason text,
  requested_at    timestamptz NOT NULL DEFAULT now(),
  viewed_at       timestamptz,
  viewed_by       uuid,
  decided_at      timestamptz,
  expires_at      timestamptz NOT NULL,
  -- One open request per decision; repeated processing must not queue a second.
  idempotency_key text,
  CONSTRAINT founder_approvals_reason_not_blank CHECK (length(btrim(reason)) > 0),
  CONSTRAINT founder_approvals_evidence_not_empty CHECK (evidence <> '{}'::jsonb),
  -- Separation of duties, at the table rather than only in a code path: the
  -- actor who asked cannot be the actor who approved.
  CONSTRAINT founder_approvals_no_self_approval CHECK (
    approver_id IS NULL OR requested_by IS NULL OR approver_id <> requested_by
  ),
  CONSTRAINT founder_approvals_decision_has_reason CHECK (
    state NOT IN ('APPROVED', 'REJECTED', 'CHANGES_REQUESTED')
    OR (decided_at IS NOT NULL AND approver_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS founder_approvals_idempotency
  ON public.founder_approvals (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS founder_approvals_one_open_per_decision
  ON public.founder_approvals (decision_id) WHERE state IN ('REQUESTED', 'VIEWED');
CREATE INDEX IF NOT EXISTS founder_approvals_open
  ON public.founder_approvals (state, expires_at);

-- ---------------------------------------------------------------------------
-- Data conflicts
-- ---------------------------------------------------------------------------

-- When two sources disagree, neither is silently chosen. The disagreement is
-- itself a record, and a decision that depends on it carries CONFLICTING_DATA
-- rather than a recommendation built on the source that happened to be read
-- first.
CREATE TABLE IF NOT EXISTS public.founder_data_conflicts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id   uuid REFERENCES public.founder_decisions(id) ON DELETE CASCADE,
  subject       text NOT NULL,
  conflict_type text NOT NULL,
  observations  jsonb NOT NULL,
  status        text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'investigating', 'resolved', 'accepted')),
  resolution    text,
  resolved_by   uuid,
  resolved_at   timestamptz,
  detected_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT founder_conflict_needs_two_sources CHECK (jsonb_array_length(observations) >= 2)
);

-- ---------------------------------------------------------------------------
-- Risk engine: the dimensions Part 3 did not carry
-- ---------------------------------------------------------------------------

ALTER TABLE public.founder_risks
  ADD COLUMN IF NOT EXISTS risk_state      founder_risk_state NOT NULL DEFAULT 'IDENTIFIED',
  ADD COLUMN IF NOT EXISTS exposure        numeric,
  ADD COLUMN IF NOT EXISTS detectability   numeric CHECK (detectability IS NULL OR (detectability >= 0 AND detectability <= 100)),
  ADD COLUMN IF NOT EXISTS reversibility   text,
  ADD COLUMN IF NOT EXISTS affected_area   text,
  ADD COLUMN IF NOT EXISTS mitigation      text,
  ADD COLUMN IF NOT EXISTS score           numeric,
  -- The formula that produced `score`, stored beside it. A score whose method
  -- is not recorded cannot be defended later, and section 17 asks for exactly
  -- this.
  ADD COLUMN IF NOT EXISTS scoring_method  text,
  ADD COLUMN IF NOT EXISTS decision_id     uuid REFERENCES public.founder_decisions(id) ON DELETE SET NULL;

ALTER TABLE public.founder_risks
  DROP CONSTRAINT IF EXISTS founder_risks_score_has_method;
ALTER TABLE public.founder_risks
  ADD CONSTRAINT founder_risks_score_has_method
  CHECK (score IS NULL OR (scoring_method IS NOT NULL AND length(btrim(scoring_method)) > 0));

-- ---------------------------------------------------------------------------
-- Decision dependencies
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.founder_decision_dependencies (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id    uuid NOT NULL REFERENCES public.founder_decisions(id) ON DELETE CASCADE,
  depends_on     text NOT NULL,
  dependency_type text NOT NULL
    CHECK (dependency_type IN ('KPI', 'GOAL', 'TASK', 'APPROVAL', 'DATA_SOURCE', 'EXTERNAL_EVENT', 'DECISION')),
  reference_id   text,
  status         text NOT NULL DEFAULT 'open',
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (decision_id, dependency_type, reference_id)
);

-- ---------------------------------------------------------------------------
-- The state machine
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.founder_decision_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  allowed founder_decision_state[];
BEGIN
  IF NEW.state = OLD.state THEN
    RETURN NEW;
  END IF;

  allowed := CASE OLD.state
    WHEN 'DETECTED'             THEN ARRAY['CONTEXT_BUILDING','CANCELLED','ESCALATED']::founder_decision_state[]
    WHEN 'CONTEXT_BUILDING'     THEN ARRAY['ANALYZING','CANCELLED','ESCALATED','FAILED']::founder_decision_state[]
    WHEN 'ANALYZING'            THEN ARRAY['OPTIONS_READY','CANCELLED','ESCALATED','FAILED']::founder_decision_state[]
    WHEN 'OPTIONS_READY'        THEN ARRAY['RECOMMENDATION_READY','CANCELLED','ESCALATED','FAILED']::founder_decision_state[]
    WHEN 'RECOMMENDATION_READY' THEN ARRAY['WAITING_APPROVAL','APPROVED','CANCELLED','ESCALATED']::founder_decision_state[]
    WHEN 'WAITING_APPROVAL'     THEN ARRAY['APPROVED','REJECTED','ESCALATED','CANCELLED']::founder_decision_state[]
    WHEN 'APPROVED'             THEN ARRAY['EXECUTING','CANCELLED','ESCALATED']::founder_decision_state[]
    WHEN 'REJECTED'             THEN ARRAY['CLOSED','ESCALATED']::founder_decision_state[]
    WHEN 'EXECUTING'            THEN ARRAY['VERIFICATION','FAILED','ESCALATED']::founder_decision_state[]
    WHEN 'VERIFICATION'         THEN ARRAY['VERIFIED','FAILED','ESCALATED']::founder_decision_state[]
    -- A verified decision is finished. It closes; it does not go back to work.
    WHEN 'VERIFIED'             THEN ARRAY['CLOSED']::founder_decision_state[]
    WHEN 'FAILED'               THEN ARRAY['ESCALATED','CLOSED']::founder_decision_state[]
    WHEN 'ESCALATED'            THEN ARRAY['WAITING_APPROVAL','APPROVED','REJECTED','CANCELLED','CLOSED']::founder_decision_state[]
    WHEN 'CANCELLED'            THEN ARRAY[]::founder_decision_state[]
    WHEN 'CLOSED'               THEN ARRAY[]::founder_decision_state[]
    ELSE ARRAY[]::founder_decision_state[]
  END;

  IF NOT (NEW.state = ANY (allowed)) THEN
    RAISE EXCEPTION 'a decision cannot move from % to %', OLD.state, NEW.state
      USING ERRCODE = 'check_violation';
  END IF;

  -- Nothing waits for approval without something to approve.
  IF NEW.state = 'WAITING_APPROVAL' AND NEW.recommended_option_id IS NULL THEN
    RAISE EXCEPTION 'a decision cannot wait for approval with no recommended option'
      USING ERRCODE = 'check_violation';
  END IF;

  -- A decision missing critical evidence must not be presented for approval as
  -- though it were complete; it escalates instead.
  IF NEW.state IN ('WAITING_APPROVAL', 'APPROVED')
     AND NEW.evidence_gap IN ('INSUFFICIENT_DATA', 'CONFLICTING_DATA') THEN
    RAISE EXCEPTION 'a decision with % cannot be approved; resolve the evidence or escalate', NEW.evidence_gap
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS founder_decision_transition_check ON public.founder_decisions;
CREATE TRIGGER founder_decision_transition_check
  BEFORE UPDATE OF state ON public.founder_decisions
  FOR EACH ROW EXECUTE FUNCTION public.founder_decision_transition();

-- Locking. Once verified or closed, the substance of a decision is history and
-- a correction has to be an amendment.
CREATE OR REPLACE FUNCTION public.founder_decision_locked()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.state IN ('VERIFIED', 'CLOSED') THEN
    IF NEW.title <> OLD.title
       OR NEW.description <> OLD.description
       OR NEW.recommended_option_id IS DISTINCT FROM OLD.recommended_option_id
       OR NEW.selected_option_id IS DISTINCT FROM OLD.selected_option_id
       OR NEW.confidence_score IS DISTINCT FROM OLD.confidence_score
       OR NEW.risk_level <> OLD.risk_level THEN
      RAISE EXCEPTION 'a % decision cannot be edited; record an amendment instead', OLD.state
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS founder_decision_lock ON public.founder_decisions;
CREATE TRIGGER founder_decision_lock
  BEFORE UPDATE ON public.founder_decisions
  FOR EACH ROW EXECUTE FUNCTION public.founder_decision_locked();

-- Approval transitions.
CREATE OR REPLACE FUNCTION public.founder_approval_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  allowed founder_approval_state[];
BEGIN
  IF NEW.state = OLD.state THEN
    RETURN NEW;
  END IF;

  allowed := CASE OLD.state
    WHEN 'REQUESTED'         THEN ARRAY['VIEWED','APPROVED','REJECTED','CHANGES_REQUESTED','EXPIRED','CANCELLED']::founder_approval_state[]
    WHEN 'VIEWED'            THEN ARRAY['APPROVED','REJECTED','CHANGES_REQUESTED','EXPIRED','CANCELLED']::founder_approval_state[]
    WHEN 'CHANGES_REQUESTED' THEN ARRAY['REQUESTED','CANCELLED','EXPIRED']::founder_approval_state[]
    ELSE ARRAY[]::founder_approval_state[]
  END;

  IF NOT (NEW.state = ANY (allowed)) THEN
    RAISE EXCEPTION 'an approval cannot move from % to %', OLD.state, NEW.state
      USING ERRCODE = 'check_violation';
  END IF;

  -- An expired request is not a decision waiting to be made. Acting on one
  -- after its deadline is exactly what section 26 forbids.
  IF NEW.state IN ('APPROVED', 'REJECTED', 'CHANGES_REQUESTED')
     AND OLD.expires_at < now() THEN
    RAISE EXCEPTION 'this approval request expired at %; it must be re-requested', OLD.expires_at
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS founder_approval_transition_check ON public.founder_approvals;
CREATE TRIGGER founder_approval_transition_check
  BEFORE UPDATE OF state ON public.founder_approvals
  FOR EACH ROW EXECUTE FUNCTION public.founder_approval_transition();

-- History is a record, not a working table.
CREATE OR REPLACE FUNCTION public.founder_history_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'decision history is append-only'
    USING ERRCODE = 'check_violation';
END
$$;

DROP TRIGGER IF EXISTS founder_history_immutable ON public.founder_decision_history;
CREATE TRIGGER founder_history_immutable
  BEFORE UPDATE OR DELETE ON public.founder_decision_history
  FOR EACH ROW EXECUTE FUNCTION public.founder_history_append_only();

-- ---------------------------------------------------------------------------
-- Permissions: extending the table that already holds them
-- ---------------------------------------------------------------------------

-- role_permissions already carries 214 rows in a `domain.action` convention.
-- These are added to it rather than to a second permission system. `role` is
-- the app_role enum, so every value here has to be one the enum already
-- defines — there is no `owner`, for instance; the equivalents are boss_owner
-- and founder.
INSERT INTO public.role_permissions (role, permission)
SELECT r.role::app_role, p.permission
FROM (VALUES ('boss'), ('admin'), ('super_admin'), ('boss_owner'), ('founder')) AS r(role)
CROSS JOIN (VALUES
  ('decision.read'), ('decision.create'), ('decision.recommend'),
  ('decision.approve'), ('decision.reject'), ('decision.override'),
  ('decision.verify'), ('decision.audit')
) AS p(permission)
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions existing
  WHERE existing.role = r.role::app_role AND existing.permission = p.permission
);

-- A reviewer can see and audit decisions without being able to approve them.
INSERT INTO public.role_permissions (role, permission)
SELECT r.role::app_role, p.permission
FROM (VALUES ('developer'), ('finance'), ('support'), ('marketing'), ('seo'), ('legal')) AS r(role)
CROSS JOIN (VALUES ('decision.read'), ('decision.audit')) AS p(permission)
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions existing
  WHERE existing.role = r.role::app_role AND existing.permission = p.permission
);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'founder_policies', 'founder_decisions', 'founder_decision_options',
    'founder_decision_evidence', 'founder_decision_history',
    'founder_decision_amendments', 'founder_approvals',
    'founder_data_conflicts', 'founder_decision_dependencies'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_service_role ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_service_role ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t, t
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role', t);
  END LOOP;
END
$$;

-- ---------------------------------------------------------------------------
-- Removing a verification run's own rows
-- ---------------------------------------------------------------------------

-- The decision history is append-only, which is what makes it worth keeping —
-- and which also means the behaviour check cannot tidy up after itself. This
-- is the one sanctioned exception: it removes decisions whose title carries a
-- check run's marker, and nothing else. A marker that does not look like one
-- is refused, so this can never be pointed at a real decision.
CREATE OR REPLACE FUNCTION public.founder_purge_check_decision(p_marker text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  removed integer;
BEGIN
  IF p_marker IS NULL OR p_marker NOT LIKE 'dcheck-%' THEN
    RAISE EXCEPTION 'this only removes rows written by a decision check run'
      USING ERRCODE = 'check_violation';
  END IF;

  ALTER TABLE public.founder_decision_history DISABLE TRIGGER founder_history_immutable;
  DELETE FROM public.founder_decisions WHERE title LIKE p_marker;
  GET DIAGNOSTICS removed = ROW_COUNT;
  ALTER TABLE public.founder_decision_history ENABLE TRIGGER founder_history_immutable;

  RETURN removed;
END
$$;

REVOKE ALL ON FUNCTION public.founder_purge_check_decision(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.founder_purge_check_decision(text) TO service_role;
