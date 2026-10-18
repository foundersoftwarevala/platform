-- Long-term memory, and the rule that stale memory cannot win.
--
-- The Company Brain already holds knowledge and the learning log holds what
-- was decided and what followed. What neither holds is memory in the sense
-- this needs: a durable statement about the Founder, the company or an
-- ongoing situation, which stays true until something replaces it and then
-- stops being true the moment it does.
--
-- The one guarantee everything else rests on: for any given thing remembered
-- there is exactly one current memory. A partial unique index enforces it, so
-- recording something new about a subject is not "adding a second opinion" —
-- it requires superseding what was there, with a reason. That is what makes
-- "never allow stale memory to silently override newer verified information"
-- structurally true rather than a hope about the code that writes here.
--
-- Working memory is temporary by definition and must say when it stops being
-- relevant, so a scratch note from one conversation cannot quietly become a
-- standing belief about the company.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'founder_memory_scope') THEN
    CREATE TYPE founder_memory_scope AS ENUM (
      'FOUNDER',      -- the Founder's own preferences and standing instructions
      'COMPANY',      -- durable facts about the company
      'OPERATIONAL',  -- an ongoing situation
      'CONVERSATION', -- what was said, and by whom
      'DECISION',     -- a decision's standing effect
      'LEARNING',     -- a pattern that has been identified
      'WORKING'       -- temporary context for a task in hand
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'founder_memory_status') THEN
    CREATE TYPE founder_memory_status AS ENUM ('ACTIVE', 'SUPERSEDED', 'EXPIRED', 'RETRACTED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.founder_memory (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  scope           founder_memory_scope NOT NULL,

  -- A stable handle for the thing remembered, e.g. 'preferred_language' or
  -- 'payments.gateway_a.reliability'. Supersession works on this, so two
  -- memories about the same subject must agree on what to call it.
  subject         text NOT NULL,
  -- What is remembered, in one sentence a person can disagree with.
  statement       text NOT NULL,
  detail          text,

  -- Where it came from. A memory with no source is an assumption.
  source_system   text NOT NULL,
  source_ref      text,
  recorded_by     uuid,
  actor_kind      founder_actor NOT NULL DEFAULT 'AI',

  confidence      founder_confidence NOT NULL DEFAULT 'UNKNOWN',
  -- When somebody or something last confirmed this is still true.
  verified_at     timestamptz,
  -- How long it is worth anything. Required for WORKING memory.
  valid_from      timestamptz NOT NULL DEFAULT now(),
  valid_until     timestamptz,

  status          founder_memory_status NOT NULL DEFAULT 'ACTIVE',
  superseded_by   uuid REFERENCES public.founder_memory(id) ON DELETE SET NULL,
  superseded_at   timestamptz,
  supersede_reason text,
  retracted_reason text,

  -- Who may read it. Empty means anyone holding the founder read permission.
  allowed_roles   text[] NOT NULL DEFAULT '{}',

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT founder_memory_statement_not_blank CHECK (length(btrim(statement)) > 0),
  CONSTRAINT founder_memory_subject_not_blank CHECK (length(btrim(subject)) > 0),
  CONSTRAINT founder_memory_source_not_blank CHECK (length(btrim(source_system)) > 0),
  CONSTRAINT founder_memory_validity_ordered CHECK (
    valid_until IS NULL OR valid_until > valid_from
  ),
  -- Working memory is temporary. Without an end it becomes a standing belief
  -- about the company by accident, which is the failure this prevents.
  CONSTRAINT founder_memory_working_is_temporary CHECK (
    scope <> 'WORKING' OR valid_until IS NOT NULL
  ),
  -- Superseding has to say what replaced it and why.
  CONSTRAINT founder_memory_supersession_is_explained CHECK (
    status <> 'SUPERSEDED'
    OR (superseded_by IS NOT NULL AND superseded_at IS NOT NULL
        AND supersede_reason IS NOT NULL AND length(btrim(supersede_reason)) > 0)
  ),
  CONSTRAINT founder_memory_retraction_is_explained CHECK (
    status <> 'RETRACTED'
    OR (retracted_reason IS NOT NULL AND length(btrim(retracted_reason)) > 0)
  ),
  CONSTRAINT founder_memory_not_self_superseding CHECK (superseded_by IS DISTINCT FROM id),
  -- Nothing may claim to be verified without saying when.
  CONSTRAINT founder_memory_verified_has_time CHECK (
    confidence <> 'MEASURED' OR verified_at IS NOT NULL
  )
);

-- The guarantee. One current memory per subject, per scope.
--
-- This is what stops a stale statement sitting alongside a newer one and
-- being returned first by whichever query happened to run. Recording
-- something new about a subject means superseding what was there.
CREATE UNIQUE INDEX IF NOT EXISTS founder_memory_one_current_per_subject
  ON public.founder_memory (scope, subject) WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS founder_memory_scope_idx
  ON public.founder_memory (scope, status, valid_from DESC);
CREATE INDEX IF NOT EXISTS founder_memory_expiring_idx
  ON public.founder_memory (valid_until) WHERE status = 'ACTIVE' AND valid_until IS NOT NULL;

-- A superseded memory cannot come back, and an active one cannot be quietly
-- pointed at a replacement without changing its status.
CREATE OR REPLACE FUNCTION public.founder_memory_supersession_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IN ('SUPERSEDED', 'RETRACTED') AND NEW.status = 'ACTIVE' THEN
    RAISE EXCEPTION 'a % memory cannot be made active again; record a new one instead', OLD.status
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.superseded_by IS NOT NULL AND NEW.status = 'ACTIVE' THEN
    RAISE EXCEPTION 'this memory names a replacement but is still active'
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS founder_memory_supersession_guard ON public.founder_memory;
CREATE TRIGGER founder_memory_supersession_guard
  BEFORE UPDATE ON public.founder_memory
  FOR EACH ROW EXECUTE FUNCTION public.founder_memory_supersession_guard();

ALTER TABLE public.founder_memory ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='founder_memory' AND policyname='founder_memory_service_role'
  ) THEN
    CREATE POLICY founder_memory_service_role ON public.founder_memory
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- What is actually true now.
--
-- Every read of current memory goes through this rather than the table, so an
-- expired or superseded statement cannot be returned as though it still held.
-- Expiry is computed here rather than swept by a job: a memory whose time has
-- passed stops being current at the moment it passes, not whenever something
-- next runs.
CREATE OR REPLACE VIEW public.founder_memory_current
WITH (security_invoker = true) AS
SELECT *
FROM public.founder_memory
WHERE status = 'ACTIVE'
  AND valid_from <= now()
  AND (valid_until IS NULL OR valid_until > now());

COMMENT ON VIEW public.founder_memory_current IS
  'Memory that is true now. Expired and superseded statements are excluded here rather than swept later, so nothing stale can be read as current.';

-- Memory that has quietly gone out of date: still active, never verified, and
-- older than a quarter. Surfaced so it can be confirmed or superseded rather
-- than trusted indefinitely.
CREATE OR REPLACE VIEW public.founder_memory_stale
WITH (security_invoker = true) AS
SELECT id, scope, subject, statement, source_system, confidence, verified_at, valid_from,
       age(now(), coalesce(verified_at, valid_from)) AS unconfirmed_for
FROM public.founder_memory
WHERE status = 'ACTIVE'
  AND (valid_until IS NULL OR valid_until > now())
  AND coalesce(verified_at, valid_from) < now() - interval '90 days';

COMMENT ON VIEW public.founder_memory_stale IS
  'Active memory nobody has confirmed in ninety days. Not wrong, but no longer evidence.';

CREATE OR REPLACE VIEW public.founder_memory_totals
WITH (security_invoker = true) AS
SELECT
  count(*)                                            AS memories,
  count(*) FILTER (WHERE status = 'ACTIVE')           AS active,
  count(*) FILTER (WHERE status = 'SUPERSEDED')       AS superseded,
  count(*) FILTER (WHERE status = 'RETRACTED')        AS retracted,
  count(*) FILTER (WHERE status = 'ACTIVE' AND valid_until IS NOT NULL
                     AND valid_until <= now())        AS expired_but_active,
  count(*) FILTER (WHERE scope = 'WORKING' AND status = 'ACTIVE') AS working,
  (SELECT count(*) FROM public.founder_memory_stale)  AS unconfirmed_90d
FROM public.founder_memory;

GRANT SELECT ON public.founder_memory_current TO service_role;
GRANT SELECT ON public.founder_memory_stale TO service_role;
GRANT SELECT ON public.founder_memory_totals TO service_role;
