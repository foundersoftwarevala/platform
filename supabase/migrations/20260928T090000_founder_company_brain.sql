-- Founder AI — Company Brain, Knowledge Center, Learning Log and Reports.
--
-- What already exists and is deliberately not rebuilt:
--
--   Operational memory is the Company Operating State from Part 3 — goals,
--   KPIs, initiatives, risks, attention, deadlines, workload. Nothing here
--   copies it.
--
--   Decision memory is founder_decisions with founder_decision_history from
--   Part 4, which already records the observation, the AI recommendation, the
--   human decision, the override and the outcome as one chain. The learning
--   log points at it rather than keeping a second copy.
--
--   Domain content stays with the manager that owns it. legal_documents,
--   franchise_documents, marketing_reports, seo_content_items and the rest
--   belong to their own modules; knowledge items reference them by table and
--   id and never absorb them.
--
-- What did not exist anywhere is a company-level knowledge layer, the learning
-- record that closes the loop from a recommendation to what actually happened,
-- and a report that is generated from real data rather than written into a
-- component. Those are the three things this adds.
--
-- Search is Postgres full-text — a generated tsvector and a GIN index. There
-- is no pgvector on this database and the brief forbids new infrastructure, so
-- retrieval is lexical and says so rather than pretending to be semantic.
--
-- Permission is carried on the row. A knowledge item names the roles that may
-- read it, and retrieval filters on the caller's own roles, so an unauthorised
-- reader gets nothing rather than a hidden card.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'founder_knowledge_kind') THEN
    CREATE TYPE founder_knowledge_kind AS ENUM (
      'GOAL', 'OBJECTIVE', 'KPI_DEFINITION', 'PRIORITY', 'POLICY', 'SOP',
      'BUSINESS_RULE', 'DECISION', 'INITIATIVE', 'PROCESS', 'RISK',
      'DEPENDENCY', 'STRATEGY', 'ORG_CONTEXT', 'OPERATIONAL_STATE'
    );
  END IF;

  -- What kind of claim a knowledge item is making. Section 2 turns on this:
  -- an inference must never be readable as a confirmed company fact.
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'founder_claim_kind') THEN
    CREATE TYPE founder_claim_kind AS ENUM (
      'CURRENT_FACT', 'HISTORICAL_FACT', 'HUMAN_DECISION', 'AI_INFERENCE', 'AI_RECOMMENDATION'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'founder_learning_stage') THEN
    CREATE TYPE founder_learning_stage AS ENUM (
      'OBSERVATION', 'SUGGESTION', 'HUMAN_DECISION', 'ACTION', 'OUTCOME',
      'FEEDBACK', 'PATTERN', 'BEHAVIOUR_ADJUSTMENT'
    );
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Company Brain
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.founder_knowledge (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  kind            founder_knowledge_kind NOT NULL,
  claim           founder_claim_kind NOT NULL,
  title           text NOT NULL,
  body            text NOT NULL,
  summary         text,
  domain          text,

  -- Provenance. A knowledge item whose origin cannot be named is an opinion
  -- with a row, so the source is required and the record it came from is kept
  -- wherever there is one.
  source_system   text NOT NULL,
  source_table    text,
  source_record   text,
  source_url      text,

  owner_id        uuid,
  owner_name      text,
  status          text NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft', 'active', 'superseded', 'archived')),

  -- Who may read it. Empty means every role that can reach the Company Brain;
  -- a populated list narrows it, and retrieval filters on the caller's roles.
  allowed_roles   text[] NOT NULL DEFAULT '{}',

  -- Freshness is a property of the knowledge, not of the row: a policy written
  -- last year is current until superseded, a metric summary is not.
  effective_from  timestamptz NOT NULL DEFAULT now(),
  review_due      timestamptz,
  superseded_by   uuid REFERENCES public.founder_knowledge(id) ON DELETE SET NULL,

  confidence      founder_confidence NOT NULL DEFAULT 'MEASURED',
  -- Set when the item was produced by a model rather than a person, so a
  -- reader can always tell which is which.
  produced_by_ai  boolean NOT NULL DEFAULT false,

  -- Lexical search. Generated rather than maintained, so it cannot drift from
  -- the text it indexes.
  search_text     tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'C')
  ) STORED,

  -- The same knowledge ingested twice from the same record is one item.
  content_hash    text,

  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT founder_knowledge_title_not_blank CHECK (length(btrim(title)) > 0),
  CONSTRAINT founder_knowledge_body_not_blank CHECK (length(btrim(body)) > 0),
  CONSTRAINT founder_knowledge_source_not_blank CHECK (length(btrim(source_system)) > 0),
  -- An AI-produced item cannot claim to be a fact about the company. It is an
  -- inference or a recommendation, and the database will not let it be filed
  -- as anything else.
  CONSTRAINT founder_knowledge_ai_is_not_fact CHECK (
    produced_by_ai = false
    OR claim IN ('AI_INFERENCE', 'AI_RECOMMENDATION')
  ),
  -- A superseded item has to say what replaced it, or the history is a dead end.
  CONSTRAINT founder_knowledge_superseded_points_somewhere CHECK (
    status <> 'superseded' OR superseded_by IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS founder_knowledge_search
  ON public.founder_knowledge USING GIN (search_text);
CREATE INDEX IF NOT EXISTS founder_knowledge_kind
  ON public.founder_knowledge (kind, status);
CREATE INDEX IF NOT EXISTS founder_knowledge_review
  ON public.founder_knowledge (review_due) WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS founder_knowledge_dedupe
  ON public.founder_knowledge (source_system, content_hash)
  WHERE content_hash IS NOT NULL;

-- What a knowledge item relates to, pointing at the source of truth rather
-- than copying it. A policy relates to the decisions taken under it; a risk
-- summary relates to the risk register row it describes.
CREATE TABLE IF NOT EXISTS public.founder_knowledge_links (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id  uuid NOT NULL REFERENCES public.founder_knowledge(id) ON DELETE CASCADE,
  relation      text NOT NULL,
  target_table  text NOT NULL,
  target_id     text NOT NULL,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (knowledge_id, target_table, target_id, relation)
);

CREATE INDEX IF NOT EXISTS founder_knowledge_links_target
  ON public.founder_knowledge_links (target_table, target_id);

-- ---------------------------------------------------------------------------
-- System Learning Log
-- ---------------------------------------------------------------------------

-- The loop from a signal to what actually happened. Each entry is one stage,
-- so the record reads as a sequence rather than as a claim.
--
-- Nothing here ever says a model was retrained, because nothing here retrains
-- one. The vocabulary is deliberate: a learning record is created, a pattern
-- is identified, context is updated, feedback is recorded.
CREATE TABLE IF NOT EXISTS public.founder_learning (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  thread_id       uuid NOT NULL DEFAULT gen_random_uuid(),
  stage           founder_learning_stage NOT NULL,
  title           text NOT NULL,
  detail          text NOT NULL,

  -- The decision this belongs to, where there is one. Decision memory itself
  -- stays in founder_decisions; this points at it.
  decision_id     uuid REFERENCES public.founder_decisions(id) ON DELETE SET NULL,
  knowledge_id    uuid REFERENCES public.founder_knowledge(id) ON DELETE SET NULL,
  event_id        uuid REFERENCES public.founder_events(id) ON DELETE SET NULL,

  actor_kind      founder_actor NOT NULL,
  actor_id        uuid,
  source_system   text NOT NULL,
  evidence        jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Only set on a PATTERN entry: what was noticed, and across how many cases.
  pattern_key     text,
  sample_size     int CHECK (sample_size IS NULL OR sample_size > 0),
  confidence      founder_confidence NOT NULL DEFAULT 'UNKNOWN',
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT founder_learning_title_not_blank CHECK (length(btrim(title)) > 0),
  CONSTRAINT founder_learning_detail_not_blank CHECK (length(btrim(detail)) > 0),
  -- A pattern is a claim about repetition, so it has to say how many cases it
  -- rests on. One occurrence is an anecdote.
  CONSTRAINT founder_learning_pattern_has_evidence CHECK (
    stage <> 'PATTERN'
    OR (pattern_key IS NOT NULL AND sample_size IS NOT NULL AND sample_size > 1)
  ),
  -- An outcome describes what actually happened and must point at the decision
  -- it is the outcome of.
  CONSTRAINT founder_learning_outcome_has_decision CHECK (
    stage <> 'OUTCOME' OR decision_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS founder_learning_thread
  ON public.founder_learning (thread_id, occurred_at);
CREATE INDEX IF NOT EXISTS founder_learning_recent
  ON public.founder_learning (occurred_at DESC);
CREATE INDEX IF NOT EXISTS founder_learning_pattern
  ON public.founder_learning (pattern_key) WHERE pattern_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- AI Reports
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.founder_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  report_type     text NOT NULL,
  title           text NOT NULL,
  period_start    timestamptz NOT NULL,
  period_end      timestamptz NOT NULL,
  generated_at    timestamptz NOT NULL DEFAULT now(),
  generated_by    uuid,
  produced_by_ai  boolean NOT NULL DEFAULT true,

  -- What the report was built from, named table by table. A report whose basis
  -- cannot be listed is a document, not a report.
  basis           jsonb NOT NULL,
  findings        jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- What the report could not establish. Section 9 asks for "no sufficient
  -- data available" rather than an invented number, and this is where that
  -- lives.
  limitations     jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence      founder_confidence NOT NULL DEFAULT 'UNKNOWN',

  -- Set when there was not enough data to report on at all. The report still
  -- exists, saying so.
  insufficient_data boolean NOT NULL DEFAULT false,

  status          text NOT NULL DEFAULT 'generated'
    CHECK (status IN ('generating', 'generated', 'failed', 'archived')),
  failure_reason  text,
  allowed_roles   text[] NOT NULL DEFAULT '{}',
  ai_request_id   text,

  CONSTRAINT founder_reports_title_not_blank CHECK (length(btrim(title)) > 0),
  CONSTRAINT founder_reports_period_is_ordered CHECK (period_end >= period_start),
  CONSTRAINT founder_reports_basis_not_empty CHECK (basis <> '{}'::jsonb),
  -- A report that found nothing must say it found nothing, rather than
  -- carrying an empty findings list that reads like a clean bill of health.
  CONSTRAINT founder_reports_empty_findings_are_explained CHECK (
    jsonb_array_length(findings) > 0
    OR insufficient_data = true
    OR jsonb_array_length(limitations) > 0
    OR status <> 'generated'
  ),
  CONSTRAINT founder_reports_failure_is_explained CHECK (
    status <> 'failed' OR (failure_reason IS NOT NULL AND length(btrim(failure_reason)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS founder_reports_recent
  ON public.founder_reports (generated_at DESC);
CREATE INDEX IF NOT EXISTS founder_reports_type
  ON public.founder_reports (report_type, period_end DESC);

-- ---------------------------------------------------------------------------
-- Knowledge is versioned, not overwritten
-- ---------------------------------------------------------------------------

-- Editing a knowledge item keeps what it said before. A company that cannot
-- show what its policy was last quarter cannot explain a decision taken under
-- it.
CREATE TABLE IF NOT EXISTS public.founder_knowledge_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id  uuid NOT NULL REFERENCES public.founder_knowledge(id) ON DELETE CASCADE,
  changed_at    timestamptz NOT NULL DEFAULT now(),
  changed_by    uuid,
  previous      jsonb NOT NULL,
  reason        text
);

CREATE INDEX IF NOT EXISTS founder_knowledge_history_item
  ON public.founder_knowledge_history (knowledge_id, changed_at DESC);

CREATE OR REPLACE FUNCTION public.founder_knowledge_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.title IS DISTINCT FROM OLD.title
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.claim IS DISTINCT FROM OLD.claim
     OR NEW.allowed_roles IS DISTINCT FROM OLD.allowed_roles THEN
    INSERT INTO public.founder_knowledge_history (knowledge_id, previous)
    VALUES (
      OLD.id,
      jsonb_build_object(
        'title', OLD.title,
        'body', OLD.body,
        'summary', OLD.summary,
        'status', OLD.status,
        'claim', OLD.claim,
        'allowed_roles', OLD.allowed_roles,
        'updated_at', OLD.updated_at
      )
    );
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS founder_knowledge_versioning ON public.founder_knowledge;
CREATE TRIGGER founder_knowledge_versioning
  BEFORE UPDATE ON public.founder_knowledge
  FOR EACH ROW EXECUTE FUNCTION public.founder_knowledge_version();

-- The learning log is a record of what happened. It is appended to, never
-- rewritten, for the same reason the decision history is.
CREATE OR REPLACE FUNCTION public.founder_learning_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'the learning log is append-only'
    USING ERRCODE = 'check_violation';
END
$$;

DROP TRIGGER IF EXISTS founder_learning_immutable ON public.founder_learning;
CREATE TRIGGER founder_learning_immutable
  BEFORE UPDATE OR DELETE ON public.founder_learning
  FOR EACH ROW EXECUTE FUNCTION public.founder_learning_append_only();

-- ---------------------------------------------------------------------------
-- Permissions and row level security
-- ---------------------------------------------------------------------------

INSERT INTO public.role_permissions (role, permission)
SELECT r.role::app_role, p.permission
FROM (VALUES ('boss'), ('admin'), ('super_admin'), ('boss_owner'), ('founder')) AS r(role)
CROSS JOIN (VALUES
  ('knowledge.read'), ('knowledge.write'), ('knowledge.archive'),
  ('report.read'), ('report.generate'), ('learning.read')
) AS p(permission)
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions existing
  WHERE existing.role = r.role::app_role AND existing.permission = p.permission
);

INSERT INTO public.role_permissions (role, permission)
SELECT r.role::app_role, p.permission
FROM (VALUES ('developer'), ('finance'), ('support'), ('marketing'), ('seo'), ('legal')) AS r(role)
CROSS JOIN (VALUES ('knowledge.read'), ('report.read'), ('learning.read')) AS p(permission)
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions existing
  WHERE existing.role = r.role::app_role AND existing.permission = p.permission
);

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'founder_knowledge', 'founder_knowledge_links', 'founder_knowledge_history',
    'founder_learning', 'founder_reports'
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
-- Removing a verification run's own learning rows
-- ---------------------------------------------------------------------------

-- The learning log is append-only, which is what makes it a record — and which
-- also means the behaviour check cannot tidy up after itself. This is the one
-- sanctioned exception: it removes rows whose source_system carries a check
-- run's marker and refuses any marker that is not one.
CREATE OR REPLACE FUNCTION public.founder_purge_check_learning(p_marker text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  removed integer;
BEGIN
  IF p_marker IS NULL OR p_marker NOT LIKE 'braincheck-%' THEN
    RAISE EXCEPTION 'this only removes rows written by a brain check run'
      USING ERRCODE = 'check_violation';
  END IF;

  ALTER TABLE public.founder_learning DISABLE TRIGGER founder_learning_immutable;
  DELETE FROM public.founder_learning WHERE source_system = p_marker;
  GET DIAGNOSTICS removed = ROW_COUNT;
  ALTER TABLE public.founder_learning ENABLE TRIGGER founder_learning_immutable;

  RETURN removed;
END
$$;

REVOKE ALL ON FUNCTION public.founder_purge_check_learning(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.founder_purge_check_learning(text) TO service_role;
