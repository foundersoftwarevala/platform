-- Founder AI — the record of every AI request the intelligence layer makes.
--
-- The AI API Manager already meters usage into usage_events: tokens, cost,
-- latency, status, per service. This does not duplicate that and does not
-- replace it. What usage_events cannot answer is the question governance
-- actually needs — which decision did this call inform, which approval did it
-- lead to, was the output accepted or rejected by validation, and did it fall
-- back to another provider. That is what this records.
--
-- Prompts are deliberately not stored. Section 8 asks that sensitive prompts
-- not be kept unnecessarily, and an operational console has no reason to hold
-- the company's own data twice. What is kept is the shape of the request: what
-- was asked for, how it was routed, what came back and whether it survived
-- validation.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'founder_ai_outcome') THEN
    CREATE TYPE founder_ai_outcome AS ENUM (
      'OK', 'VALIDATION_FAILED', 'PROVIDER_ERROR', 'TIMEOUT', 'RATE_LIMITED',
      'POLICY_REFUSED', 'CANCELLED', 'NO_PROVIDER'
    );
  END IF;

  -- What the request needed from a model, rather than which model to use.
  -- Naming a model in calling code is what section 5 rules out.
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'founder_ai_capability') THEN
    CREATE TYPE founder_ai_capability AS ENUM (
      'FAST', 'BALANCED', 'REASONING', 'LONG_CONTEXT', 'STRUCTURED_OUTPUT'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.founder_ai_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  request_id      text NOT NULL,
  task_type       text NOT NULL,
  capability      founder_ai_capability NOT NULL,

  -- Traceability: the thread from a question to a decision to an approval.
  user_id         uuid,
  conversation_id uuid,
  decision_id     uuid REFERENCES public.founder_decisions(id) ON DELETE SET NULL,
  approval_id     uuid REFERENCES public.founder_approvals(id) ON DELETE SET NULL,
  event_id        uuid REFERENCES public.founder_events(id) ON DELETE SET NULL,
  correlation_id  uuid,

  -- How it was routed, and whether the first choice answered.
  service_id      uuid,
  service_name    text,
  provider_slug   text,
  model           text,
  attempt         int NOT NULL DEFAULT 1 CHECK (attempt >= 1),
  fell_back       boolean NOT NULL DEFAULT false,
  fallback_reason text,

  outcome         founder_ai_outcome NOT NULL,
  status_code     int,
  latency_ms      int,
  -- Usage is authoritative in usage_events; these are the copy needed to show
  -- cost against a decision without joining across the whole metering table.
  tokens_in       int,
  tokens_out      int,
  cost_usd        numeric,

  -- Validation is the whole reason output is not trusted. A rejected output
  -- must say what was wrong with it.
  validated       boolean NOT NULL DEFAULT false,
  validation_error text,

  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT founder_ai_requests_request_id_not_blank CHECK (length(btrim(request_id)) > 0),
  CONSTRAINT founder_ai_requests_task_not_blank CHECK (length(btrim(task_type)) > 0),
  -- A failed validation has to name the failure, or the record is useless for
  -- working out why a model's answer was thrown away.
  CONSTRAINT founder_ai_requests_validation_is_explained CHECK (
    outcome <> 'VALIDATION_FAILED'
    OR (validation_error IS NOT NULL AND length(btrim(validation_error)) > 0)
  ),
  CONSTRAINT founder_ai_requests_fallback_is_explained CHECK (
    fell_back = false
    OR (fallback_reason IS NOT NULL AND length(btrim(fallback_reason)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS founder_ai_requests_recent
  ON public.founder_ai_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS founder_ai_requests_decision
  ON public.founder_ai_requests (decision_id) WHERE decision_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS founder_ai_requests_correlation
  ON public.founder_ai_requests (correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS founder_ai_requests_outcome
  ON public.founder_ai_requests (outcome, created_at DESC);

-- One request id is one attempt chain; a retry is a new row with a higher
-- attempt, so a flapping provider is visible rather than averaged away.
CREATE UNIQUE INDEX IF NOT EXISTS founder_ai_requests_attempt
  ON public.founder_ai_requests (request_id, attempt);

-- ---------------------------------------------------------------------------
-- Model routing, configured rather than compiled in
-- ---------------------------------------------------------------------------

-- Which registered AI service answers which kind of need. Section 5 forbids
-- "always use model X" in code, so the mapping lives here and an operator can
-- change it without a deployment.
CREATE TABLE IF NOT EXISTS public.founder_ai_routes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capability    founder_ai_capability NOT NULL,
  service_id    uuid NOT NULL,
  service_name  text NOT NULL,
  -- Lower runs first. A route is tried in order until one answers.
  priority      int NOT NULL DEFAULT 1 CHECK (priority >= 1),
  max_tokens    int,
  temperature   numeric CHECK (temperature IS NULL OR (temperature >= 0 AND temperature <= 2)),
  timeout_ms    int NOT NULL DEFAULT 45000 CHECK (timeout_ms BETWEEN 1000 AND 300000),
  max_attempts  int NOT NULL DEFAULT 2 CHECK (max_attempts BETWEEN 1 AND 5),
  -- Falling back to a more expensive model has to be a decision somebody made,
  -- not something that happens quietly under load.
  allow_fallback boolean NOT NULL DEFAULT true,
  enabled       boolean NOT NULL DEFAULT true,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (capability, service_id)
);

CREATE INDEX IF NOT EXISTS founder_ai_routes_lookup
  ON public.founder_ai_routes (capability, priority) WHERE enabled;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['founder_ai_requests', 'founder_ai_routes']
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
-- Seed the routes from what is actually registered and working
-- ---------------------------------------------------------------------------

-- Only services that are active and approved in AI API Manager are routed to,
-- and the mapping is derived from what is registered rather than typed in. An
-- account with no approved AI service gets no routes, and the intelligence
-- layer then reports NO_PROVIDER instead of inventing an answer.
INSERT INTO public.founder_ai_routes (capability, service_id, service_name, priority, notes)
SELECT c.capability::founder_ai_capability, s.id, s.name, 1,
       'seeded from the active, approved services in AI API Manager'
FROM public.api_services s
CROSS JOIN (VALUES ('FAST'), ('BALANCED'), ('REASONING'), ('LONG_CONTEXT'), ('STRUCTURED_OUTPUT'))
  AS c(capability)
WHERE s.status = 'active'
  AND s.approval_status = 'approved'
  AND s.category = 'ai'
  AND NOT EXISTS (
    SELECT 1 FROM public.founder_ai_routes r
    WHERE r.capability = c.capability::founder_ai_capability AND r.service_id = s.id
  );
