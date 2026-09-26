-- Founder AI — Company Operating State foundation.
--
-- This is an intelligence layer over the operational data the platform already
-- keeps. It deliberately creates nothing that exists: work stays in tm_tasks,
-- dependencies in tm_dependencies, capacity in tm_members, people in
-- team_members, raw signals in the twenty-six *_events tables, warnings in the
-- twelve *_alerts tables, decisions in ai_decision_logs, and the audit trail in
-- audit_logs. What did not exist anywhere is the layer above them — what the
-- company is trying to do, how it is measured, and what deserves attention —
-- and that is all this adds.
--
-- Two ideas run through every table here.
--
-- The first is provenance. A number without a source, a measurement time and a
-- method is an assertion, and an executive console that cannot tell a measured
-- figure from an estimated one is worse than no console. So every fact that
-- Founder AI will read carries where it came from, when it was true, how it was
-- arrived at and how confident that is — and the constraints refuse a row that
-- omits them.
--
-- The second is that absence is a real answer. Nothing here defaults a missing
-- measurement to zero. A KPI with no reading is UNKNOWN, and UNKNOWN is a state
-- the model can hold, because the alternative is Founder AI reasoning
-- confidently from a number nobody measured.
--
-- Tenancy: this platform has no organizations table and is a single company.
-- organization_id is present and nullable so isolation can be added later
-- without a rewrite, but no organisation model is invented here.

-- ---------------------------------------------------------------------------
-- Shared vocabulary
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  -- How a value came to be known. MEASURED is read from a source; ESTIMATED is
  -- derived; UNKNOWN is the honest answer when nothing is known; STALE is a
  -- measurement too old to act on.
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'founder_confidence') THEN
    CREATE TYPE founder_confidence AS ENUM ('MEASURED', 'ESTIMATED', 'STALE', 'UNKNOWN');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'founder_health') THEN
    CREATE TYPE founder_health AS ENUM ('HEALTHY', 'WATCH', 'AT_RISK', 'CRITICAL', 'UNKNOWN');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'founder_severity') THEN
    CREATE TYPE founder_severity AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
  END IF;

  -- Who acted. An AI recommendation and a human decision are never the same
  -- actor, because the whole governance model rests on telling them apart.
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'founder_actor') THEN
    CREATE TYPE founder_actor AS ENUM ('HUMAN', 'AI', 'SYSTEM', 'EXTERNAL');
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Goals, objectives, initiatives, milestones
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.founder_goals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  title           text NOT NULL,
  description     text,
  domain          text NOT NULL,
  owner_id        uuid,
  owner_name      text,
  starts_on       date,
  target_on       date,
  status          text NOT NULL DEFAULT 'active',
  priority        int  NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  -- Progress is null until something measures it. Zero would read as "measured
  -- and nothing has happened", which is a different and usually untrue claim.
  progress        numeric CHECK (progress IS NULL OR (progress >= 0 AND progress <= 100)),
  health          founder_health NOT NULL DEFAULT 'UNKNOWN',
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.founder_objectives (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id         uuid NOT NULL REFERENCES public.founder_goals(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  owner_id        uuid,
  status          text NOT NULL DEFAULT 'active',
  priority        int  NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  progress        numeric CHECK (progress IS NULL OR (progress >= 0 AND progress <= 100)),
  health          founder_health NOT NULL DEFAULT 'UNKNOWN',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.founder_initiatives (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id         uuid REFERENCES public.founder_goals(id) ON DELETE SET NULL,
  objective_id    uuid REFERENCES public.founder_objectives(id) ON DELETE SET NULL,
  title           text NOT NULL,
  description     text,
  owner_id        uuid,
  owner_name      text,
  domain          text,
  status          text NOT NULL DEFAULT 'planned',
  priority        int  NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  starts_on       date,
  target_on       date,
  progress        numeric CHECK (progress IS NULL OR (progress >= 0 AND progress <= 100)),
  health          founder_health NOT NULL DEFAULT 'UNKNOWN',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.founder_milestones (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id       uuid NOT NULL REFERENCES public.founder_initiatives(id) ON DELETE CASCADE,
  title               text NOT NULL,
  owner_id            uuid,
  due_on              date,
  status              text NOT NULL DEFAULT 'open',
  completion_criteria text,
  -- What proves it is done. A milestone closed without evidence is an opinion.
  evidence            jsonb NOT NULL DEFAULT '{}'::jsonb,
  blocked_reason      text,
  completed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- A task belongs to an initiative without tm_tasks being altered: the task
-- manager owns its own table and keeps owning it.
CREATE TABLE IF NOT EXISTS public.founder_initiative_tasks (
  initiative_id uuid NOT NULL REFERENCES public.founder_initiatives(id) ON DELETE CASCADE,
  task_id       uuid NOT NULL,
  linked_at     timestamptz NOT NULL DEFAULT now(),
  linked_by     uuid,
  PRIMARY KEY (initiative_id, task_id)
);

-- ---------------------------------------------------------------------------
-- KPIs: a registry, and readings that must say where they came from
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.founder_kpis (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid,
  key               text NOT NULL UNIQUE,
  name              text NOT NULL,
  definition        text NOT NULL,
  unit              text NOT NULL,
  domain            text NOT NULL,
  -- The query, table or endpoint this is measured from, in words. A KPI whose
  -- source cannot be named cannot be trusted, so this is NOT NULL.
  source            text NOT NULL,
  measurement_hours int,
  target_value      numeric,
  baseline_value    numeric,
  -- Thresholds turn a number into a status. Without them `status` would be a
  -- label somebody typed, which section 12 of the brief rules out.
  warn_below        numeric,
  critical_below    numeric,
  warn_above        numeric,
  critical_above    numeric,
  higher_is_better  boolean NOT NULL DEFAULT true,
  owner_id          uuid,
  goal_id           uuid REFERENCES public.founder_goals(id) ON DELETE SET NULL,
  objective_id      uuid REFERENCES public.founder_objectives(id) ON DELETE SET NULL,
  active            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT founder_kpis_source_not_blank CHECK (length(btrim(source)) > 0)
);

CREATE TABLE IF NOT EXISTS public.founder_kpi_readings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id       uuid NOT NULL REFERENCES public.founder_kpis(id) ON DELETE CASCADE,
  -- Null is allowed and meaningful: "we looked and there was nothing to
  -- measure" is different from "we never looked", and confidence says which.
  value        numeric,
  measured_at  timestamptz NOT NULL,
  recorded_at  timestamptz NOT NULL DEFAULT now(),
  source       text NOT NULL,
  method       text NOT NULL,
  confidence   founder_confidence NOT NULL,
  status       founder_health NOT NULL DEFAULT 'UNKNOWN',
  evidence     jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT founder_kpi_readings_source_not_blank CHECK (length(btrim(source)) > 0),
  CONSTRAINT founder_kpi_readings_method_not_blank CHECK (length(btrim(method)) > 0),
  -- A reading that claims to be measured must carry a number; one without a
  -- number must say so. This is the constraint that stops an invented figure.
  CONSTRAINT founder_kpi_readings_measured_has_value
    CHECK ((confidence = 'MEASURED' AND value IS NOT NULL) OR confidence <> 'MEASURED'),
  CONSTRAINT founder_kpi_readings_unknown_has_no_value
    CHECK ((confidence = 'UNKNOWN' AND value IS NULL) OR confidence <> 'UNKNOWN')
);

CREATE INDEX IF NOT EXISTS founder_kpi_readings_kpi_time
  ON public.founder_kpi_readings (kpi_id, measured_at DESC);

-- ---------------------------------------------------------------------------
-- Risks
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.founder_risks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  title           text NOT NULL,
  description     text,
  domain          text NOT NULL,
  severity        founder_severity NOT NULL,
  likelihood      numeric CHECK (likelihood IS NULL OR (likelihood >= 0 AND likelihood <= 100)),
  impact          text,
  status          text NOT NULL DEFAULT 'open',
  owner_id        uuid,
  -- Where this risk was seen. A risk nobody can trace back is an opinion.
  source          text NOT NULL,
  evidence        jsonb NOT NULL DEFAULT '{}'::jsonb,
  goal_id         uuid REFERENCES public.founder_goals(id) ON DELETE SET NULL,
  initiative_id   uuid REFERENCES public.founder_initiatives(id) ON DELETE SET NULL,
  detected_at     timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT founder_risks_source_not_blank CHECK (length(btrim(source)) > 0),
  CONSTRAINT founder_risks_evidence_not_empty CHECK (evidence <> '{}'::jsonb)
);

-- ---------------------------------------------------------------------------
-- Normalized operational events
-- ---------------------------------------------------------------------------

-- The platform has twenty-six *_events tables, each shaped for its own domain.
-- This does not replace them and does not copy them wholesale: it is the
-- normalized projection Founder AI reasons over, and every row points back at
-- the record it came from so the original remains the authority.
CREATE TABLE IF NOT EXISTS public.founder_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  event_type      text NOT NULL,
  domain          text NOT NULL,
  entity_type     text,
  entity_id       text,
  source_system   text NOT NULL,
  source_event_id text NOT NULL,
  -- When it happened, and when we heard about it. Keeping both is what lets
  -- out-of-order delivery be detected instead of silently believed.
  occurred_at     timestamptz NOT NULL,
  received_at     timestamptz NOT NULL DEFAULT now(),
  sequence        bigint,
  severity        founder_severity NOT NULL DEFAULT 'INFO',
  actor_type      founder_actor NOT NULL DEFAULT 'SYSTEM',
  actor_id        uuid,
  correlation_id  uuid,
  causation_id    uuid,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  status          text NOT NULL DEFAULT 'received',
  CONSTRAINT founder_events_source_not_blank CHECK (length(btrim(source_system)) > 0),
  CONSTRAINT founder_events_source_id_not_blank CHECK (length(btrim(source_event_id)) > 0)
);

-- Idempotency, enforced rather than hoped for: the same source event delivered
-- twice is one row. marketplace_events already solved this with a dedupe_key;
-- this is the same idea given a constraint.
CREATE UNIQUE INDEX IF NOT EXISTS founder_events_idempotency
  ON public.founder_events (source_system, source_event_id);

CREATE INDEX IF NOT EXISTS founder_events_occurred
  ON public.founder_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS founder_events_type_time
  ON public.founder_events (event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS founder_events_entity
  ON public.founder_events (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS founder_events_correlation
  ON public.founder_events (correlation_id) WHERE correlation_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Attention
-- ---------------------------------------------------------------------------

-- One list over twelve domain alert tables. Those keep their rows; this records
-- what the executive still has to deal with, and what happened to it.
CREATE TABLE IF NOT EXISTS public.founder_attention (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  kind            text NOT NULL,
  domain          text NOT NULL,
  title           text NOT NULL,
  reason          text NOT NULL,
  severity        founder_severity NOT NULL,
  priority        int NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  source_system   text NOT NULL,
  source_ref      text,
  entity_type     text,
  entity_id       text,
  evidence        jsonb NOT NULL DEFAULT '{}'::jsonb,
  status          text NOT NULL DEFAULT 'NEW'
    CHECK (status IN ('NEW', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED')),
  owner_id        uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  resolved_at     timestamptz,
  resolved_by     uuid,
  -- Dismissal without a reason is how a console becomes a place warnings go to
  -- die, so the constraint below refuses one.
  dismissed_at    timestamptz,
  dismissed_by    uuid,
  dismiss_reason  text,
  CONSTRAINT founder_attention_reason_not_blank CHECK (length(btrim(reason)) > 0),
  CONSTRAINT founder_attention_evidence_not_empty CHECK (evidence <> '{}'::jsonb),
  CONSTRAINT founder_attention_dismissal_is_accountable CHECK (
    status <> 'DISMISSED'
    OR (dismissed_by IS NOT NULL AND dismiss_reason IS NOT NULL AND length(btrim(dismiss_reason)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS founder_attention_open
  ON public.founder_attention (severity, created_at DESC)
  WHERE status IN ('NEW', 'ACKNOWLEDGED', 'IN_PROGRESS');

-- ---------------------------------------------------------------------------
-- Snapshot of the whole state
-- ---------------------------------------------------------------------------

-- A cache, and never the authority. It records which sources it was built from
-- and when each was last true, so a consumer can tell a fresh snapshot from one
-- that merely exists.
CREATE TABLE IF NOT EXISTS public.founder_state_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  built_at        timestamptz NOT NULL DEFAULT now(),
  built_by        text NOT NULL,
  -- Highest occurred_at seen when this was built; a later event means stale.
  event_watermark timestamptz,
  source_versions jsonb NOT NULL DEFAULT '{}'::jsonb,
  state           jsonb NOT NULL,
  consistency     text NOT NULL DEFAULT 'FRESH'
    CHECK (consistency IN ('FRESH', 'STALE', 'REBUILDING', 'INCONSISTENT')),
  degraded        text[] NOT NULL DEFAULT '{}',
  CONSTRAINT founder_state_snapshots_state_not_empty CHECK (state <> '{}'::jsonb)
);

CREATE INDEX IF NOT EXISTS founder_state_snapshots_recent
  ON public.founder_state_snapshots (built_at DESC);

-- ---------------------------------------------------------------------------
-- State transitions
-- ---------------------------------------------------------------------------

-- Valid moves for an attention item. An invalid transition is refused at the
-- database rather than checked in one code path and forgotten in the next.
CREATE OR REPLACE FUNCTION public.founder_attention_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  allowed text[];
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  allowed := CASE OLD.status
    WHEN 'NEW'          THEN ARRAY['ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED']
    WHEN 'ACKNOWLEDGED' THEN ARRAY['IN_PROGRESS', 'RESOLVED', 'DISMISSED']
    WHEN 'IN_PROGRESS'  THEN ARRAY['RESOLVED', 'DISMISSED', 'ACKNOWLEDGED']
    -- A closed item reopens by being raised again, not by being edited back to
    -- an earlier status, so that the history stays readable.
    WHEN 'RESOLVED'     THEN ARRAY[]::text[]
    WHEN 'DISMISSED'    THEN ARRAY[]::text[]
    ELSE ARRAY[]::text[]
  END;

  IF NOT (NEW.status = ANY (allowed)) THEN
    RAISE EXCEPTION 'attention item cannot move from % to %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS founder_attention_transition_check ON public.founder_attention;
CREATE TRIGGER founder_attention_transition_check
  BEFORE UPDATE OF status ON public.founder_attention
  FOR EACH ROW EXECUTE FUNCTION public.founder_attention_transition();

-- An event's occurred_at is a fact about the world and must not be rewritten
-- after the fact; late delivery is handled by reading occurred_at, not by
-- editing it.
CREATE OR REPLACE FUNCTION public.founder_events_immutable_occurrence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.occurred_at <> OLD.occurred_at
     OR NEW.source_system <> OLD.source_system
     OR NEW.source_event_id <> OLD.source_event_id THEN
    RAISE EXCEPTION 'an operational event''s origin and occurrence cannot be rewritten'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS founder_events_immutable ON public.founder_events;
CREATE TRIGGER founder_events_immutable
  BEFORE UPDATE ON public.founder_events
  FOR EACH ROW EXECUTE FUNCTION public.founder_events_immutable_occurrence();

-- ---------------------------------------------------------------------------
-- Row level security, matching every other table on this database
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'founder_goals', 'founder_objectives', 'founder_initiatives', 'founder_milestones',
    'founder_initiative_tasks', 'founder_kpis', 'founder_kpi_readings', 'founder_risks',
    'founder_events', 'founder_attention', 'founder_state_snapshots'
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
