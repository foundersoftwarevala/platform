-- The Worker Agent roster, and the permissions that bound it.
--
-- The platform already has an agent register: public.ai_agents, which the
-- Agents screen reads. It holds a name, a purpose, a model, a system prompt
-- and two counters. That is enough to list an agent and not nearly enough to
-- let one act: there is nowhere to say what an agent may do, nowhere to record
-- what it did, and `status` is free text with no valid transitions.
--
-- So this extends that table rather than creating a second one beside it.
-- Every existing column keeps its meaning, `status` keeps its current values
-- and the Agents screen is unaffected. What is added is the part that makes
-- the owner's permission model enforceable rather than merely written down.
--
-- The central guarantee is the permission constraint below. A Worker Agent's
-- permissions may only ever be drawn from five verbs. APPROVE is not one of
-- them, and neither is anything to do with code, git, deployment or
-- infrastructure. That is not a convention a future caller can forget: the
-- database will refuse the row.

-- ---------------------------------------------------------------- agents

ALTER TABLE public.ai_agents
  -- A stable handle, so a row can be found and re-configured without matching
  -- on a display name that may be translated or edited.
  ADD COLUMN IF NOT EXISTS agent_key      text,
  ADD COLUMN IF NOT EXISTS specialization text,
  -- Which routed capability this agent asks the AI API Manager for. It is a
  -- capability, never a model: the route table decides the provider, so no
  -- model name is pinned here.
  ADD COLUMN IF NOT EXISTS capability     text,
  ADD COLUMN IF NOT EXISTS lifecycle      text NOT NULL DEFAULT 'CREATED',
  ADD COLUMN IF NOT EXISTS permissions    text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS max_concurrent int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz,
  ADD COLUMN IF NOT EXISTS blocked_reason text;

CREATE UNIQUE INDEX IF NOT EXISTS ai_agents_agent_key_unique
  ON public.ai_agents (agent_key) WHERE agent_key IS NOT NULL;

DO $$
BEGIN
  -- The twelve states the brief names, and nothing else.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_agents_lifecycle_is_known') THEN
    ALTER TABLE public.ai_agents ADD CONSTRAINT ai_agents_lifecycle_is_known CHECK (
      lifecycle IN ('CREATED','CONFIGURED','AVAILABLE','ASSIGNED','WORKING','WAITING',
                    'BLOCKED','PAUSED','COMPLETED','FAILED','VERIFIED','ARCHIVED')
    );
  END IF;

  -- The whole permission model, as one constraint.
  --
  -- Only these five verbs exist for a Worker Agent. APPROVE is absent by
  -- design: approval stays with a human, and an agent cannot be granted it
  -- even by accident. Destructive, financial and high-risk actions have no
  -- verb at all, so they cannot be expressed; development, git, deployment
  -- and infrastructure likewise.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_agents_permissions_are_permitted') THEN
    ALTER TABLE public.ai_agents ADD CONSTRAINT ai_agents_permissions_are_permitted CHECK (
      permissions <@ ARRAY['READ','ANALYZE','RECOMMEND','CREATE','EXECUTE_LOW_RISK']::text[]
    );
  END IF;

  -- An agent that is blocked has to say why. A blocked agent with no reason
  -- is a dead end for whoever has to clear it.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_agents_blocked_is_explained') THEN
    ALTER TABLE public.ai_agents ADD CONSTRAINT ai_agents_blocked_is_explained CHECK (
      lifecycle <> 'BLOCKED' OR (blocked_reason IS NOT NULL AND length(btrim(blocked_reason)) > 0)
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_agents_capacity_is_positive') THEN
    ALTER TABLE public.ai_agents ADD CONSTRAINT ai_agents_capacity_is_positive CHECK (
      max_concurrent >= 1
    );
  END IF;
END $$;

COMMENT ON COLUMN public.ai_agents.permissions IS
  'What this agent may do. Only READ, ANALYZE, RECOMMEND, CREATE and EXECUTE_LOW_RISK exist; APPROVE and anything destructive, financial or development-related cannot be granted.';

-- Only the transitions the lifecycle actually allows.
CREATE OR REPLACE FUNCTION public.ai_agents_lifecycle_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  allowed text[];
BEGIN
  IF NEW.lifecycle = OLD.lifecycle THEN
    RETURN NEW;
  END IF;

  allowed := CASE OLD.lifecycle
    WHEN 'CREATED'    THEN ARRAY['CONFIGURED','ARCHIVED']
    WHEN 'CONFIGURED' THEN ARRAY['AVAILABLE','PAUSED','ARCHIVED']
    WHEN 'AVAILABLE'  THEN ARRAY['ASSIGNED','PAUSED','BLOCKED','ARCHIVED']
    WHEN 'ASSIGNED'   THEN ARRAY['WORKING','WAITING','BLOCKED','FAILED','AVAILABLE']
    WHEN 'WORKING'    THEN ARRAY['WAITING','BLOCKED','COMPLETED','FAILED','PAUSED']
    WHEN 'WAITING'    THEN ARRAY['WORKING','BLOCKED','FAILED','COMPLETED']
    WHEN 'BLOCKED'    THEN ARRAY['AVAILABLE','WORKING','FAILED','PAUSED','ARCHIVED']
    WHEN 'PAUSED'     THEN ARRAY['AVAILABLE','ARCHIVED']
    -- A completed run is verified by something other than the agent that ran
    -- it; an agent cannot declare its own work verified by moving itself.
    WHEN 'COMPLETED'  THEN ARRAY['VERIFIED','FAILED','AVAILABLE']
    WHEN 'FAILED'     THEN ARRAY['AVAILABLE','BLOCKED','ARCHIVED']
    WHEN 'VERIFIED'   THEN ARRAY['AVAILABLE','ARCHIVED']
    WHEN 'ARCHIVED'   THEN ARRAY[]::text[]
    ELSE ARRAY[]::text[]
  END;

  IF NOT (NEW.lifecycle = ANY (allowed)) THEN
    RAISE EXCEPTION 'an agent cannot go from % to %', OLD.lifecycle, NEW.lifecycle
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS ai_agents_lifecycle_guard ON public.ai_agents;
CREATE TRIGGER ai_agents_lifecycle_guard
  BEFORE UPDATE ON public.ai_agents
  FOR EACH ROW EXECUTE FUNCTION public.ai_agents_lifecycle_guard();

-- ------------------------------------------------------------- audit log

-- One row per thing an agent actually did.
--
-- The governance section asks that every agent action record the agent, the
-- task, the scope, the permission used, the input, the action, the result,
-- the time and the verification status. That is this table, and it is the
-- only place a run is recorded — there is no counter anywhere that can be
-- incremented without a row landing here.
CREATE TABLE IF NOT EXISTS public.ai_agent_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id         uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  task_id          uuid REFERENCES public.tm_tasks(id) ON DELETE SET NULL,

  -- Whose data this ran against. Recorded so a run can be shown to, and
  -- audited by, the business it touched.
  scope            text NOT NULL,
  permission_used  text NOT NULL,
  input_source     text NOT NULL,
  action           text NOT NULL,
  result           text,

  state            text NOT NULL DEFAULT 'RUNNING',
  -- Completing is not the same as being right. A run that finished says
  -- COMPLETED; only a separate check moves it to VERIFIED.
  verification     text NOT NULL DEFAULT 'UNVERIFIED',
  verified_by      uuid,
  verified_at      timestamptz,

  error            text,
  started_at       timestamptz NOT NULL DEFAULT now(),
  finished_at      timestamptz,

  CONSTRAINT ai_agent_runs_state_is_known CHECK (
    state IN ('RUNNING','WAITING','BLOCKED','COMPLETED','FAILED','CANCELLED','ESCALATED')
  ),
  CONSTRAINT ai_agent_runs_verification_is_known CHECK (
    verification IN ('UNVERIFIED','VERIFIED','FAILED')
  ),
  CONSTRAINT ai_agent_runs_permission_is_permitted CHECK (
    permission_used IN ('READ','ANALYZE','RECOMMEND','CREATE','EXECUTE_LOW_RISK')
  ),
  -- Nothing may be presented as verified without something to point at.
  CONSTRAINT ai_agent_runs_verified_has_result CHECK (
    verification <> 'VERIFIED' OR (result IS NOT NULL AND verified_at IS NOT NULL)
  ),
  -- A failure has to say what went wrong.
  CONSTRAINT ai_agent_runs_failure_is_explained CHECK (
    state <> 'FAILED' OR (error IS NOT NULL AND length(btrim(error)) > 0)
  ),
  CONSTRAINT ai_agent_runs_scope_not_blank CHECK (length(btrim(scope)) > 0)
);

CREATE INDEX IF NOT EXISTS ai_agent_runs_agent_idx ON public.ai_agent_runs (agent_id, started_at DESC);
CREATE INDEX IF NOT EXISTS ai_agent_runs_task_idx ON public.ai_agent_runs (task_id);
CREATE INDEX IF NOT EXISTS ai_agent_runs_open_idx ON public.ai_agent_runs (state)
  WHERE state IN ('RUNNING','WAITING','BLOCKED','ESCALATED');

-- A run may only use a permission its agent actually holds.
CREATE OR REPLACE FUNCTION public.ai_agent_runs_permission_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  held text[];
BEGIN
  SELECT permissions INTO held FROM public.ai_agents WHERE id = NEW.agent_id;
  IF held IS NULL OR NOT (NEW.permission_used = ANY (held)) THEN
    RAISE EXCEPTION 'this agent does not hold %', NEW.permission_used
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS ai_agent_runs_permission_guard ON public.ai_agent_runs;
CREATE TRIGGER ai_agent_runs_permission_guard
  BEFORE INSERT OR UPDATE ON public.ai_agent_runs
  FOR EACH ROW EXECUTE FUNCTION public.ai_agent_runs_permission_guard();

ALTER TABLE public.ai_agent_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'ai_agent_runs' AND policyname = 'ai_agent_runs_service_role'
  ) THEN
    CREATE POLICY ai_agent_runs_service_role ON public.ai_agent_runs
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- --------------------------------------------------------- the roster

-- The twenty agents the owner approved, with the permissions each was
-- approved for. Every one is registered CONFIGURED rather than AVAILABLE:
-- none of them has been given a task, and none has a run. runs_30d and
-- success_rate keep their defaults of zero because zero is the truth.
INSERT INTO public.ai_agents
  (agent_key, name, purpose, specialization, capability, lifecycle, permissions, system_prompt, status)
VALUES
  ('monitoring', 'Monitoring Agent',
   'Watches system and business signals, detects anomalies, raises alerts and escalates critical issues.',
   'MONITORING', 'FAST', 'CONFIGURED',
   ARRAY['READ','ANALYZE','RECOMMEND','CREATE']::text[],
   'You watch operational metrics and report what you observe. You raise alerts; you never act on them yourself.', 'active'),

  ('reporting', 'Reporting Agent',
   'Generates operational reports from KPIs and business data, compares trends and prepares summaries.',
   'REPORTING', 'BALANCED', 'CONFIGURED',
   ARRAY['READ','ANALYZE','RECOMMEND','CREATE']::text[],
   'You prepare report drafts from data you were given. Where the data is absent you say so rather than estimating.', 'active'),

  ('research', 'Research Agent',
   'Performs authorized business research, collects sources, analyses information and prepares findings.',
   'RESEARCH', 'LONG_CONTEXT', 'CONFIGURED',
   ARRAY['READ','ANALYZE','RECOMMEND','CREATE']::text[],
   'You research within the sources you are given and attribute every finding. You make no purchase and take no external action.', 'active'),

  ('data-intelligence', 'Data Intelligence Agent',
   'Analyses authorized business data, detects trends and anomalies and prepares supported insights.',
   'DATA_ANALYSIS', 'REASONING', 'CONFIGURED',
   ARRAY['READ','ANALYZE','RECOMMEND']::text[],
   'You read and analyse. You calculate only metrics the data supports, and you state the uncertainty.', 'active'),

  ('compliance', 'Compliance Agent',
   'Monitors configured compliance rules, detects policy violations and maintains evidence.',
   'COMPLIANCE', 'REASONING', 'CONFIGURED',
   ARRAY['READ','ANALYZE','RECOMMEND','CREATE']::text[],
   'You check against the rules as configured and prepare alerts with evidence. You never enforce anything yourself.', 'active'),

  ('risk', 'Risk Agent',
   'Detects operational risks, assesses evidence, classifies them and prepares mitigation recommendations.',
   'RISK', 'REASONING', 'CONFIGURED',
   ARRAY['READ','ANALYZE','RECOMMEND','CREATE']::text[],
   'You classify risk from the evidence available and say what is unknown. High-impact action is never yours to take.', 'active'),

  ('customer-operations', 'Customer Operations Agent',
   'Processes authorized customer-operation tasks, organizes requests, prepares responses and tracks follow-ups.',
   'CUSTOMER_OPS', 'BALANCED', 'CONFIGURED',
   ARRAY['READ','ANALYZE','RECOMMEND','CREATE','EXECUTE_LOW_RISK']::text[],
   'You prepare customer responses and track follow-ups. Anything sent externally requires authorization first.', 'active'),

  ('knowledge-operations', 'Knowledge Operations Agent',
   'Organizes approved knowledge, maintains metadata and identifies stale or conflicting information.',
   'KNOWLEDGE_OPS', 'LONG_CONTEXT', 'CONFIGURED',
   ARRAY['READ','ANALYZE','RECOMMEND','CREATE']::text[],
   'You organize knowledge and flag what is stale or contradictory. You delete nothing.', 'active'),

  ('task-operations', 'Task Operations Agent',
   'Monitors task queues, assigns authorized tasks, tracks status and escalates blocked or failed work.',
   'TASK_OPS', 'FAST', 'CONFIGURED',
   ARRAY['READ','ANALYZE','RECOMMEND','CREATE','EXECUTE_LOW_RISK']::text[],
   'You keep the queue moving within the rules you were given. You cannot override governance, and you escalate what you cannot resolve.', 'active'),

  ('alert-escalation', 'Alert & Escalation Agent',
   'Monitors critical alerts, routes them, tracks acknowledgements and escalates unresolved issues.',
   'ALERTING', 'FAST', 'CONFIGURED',
   ARRAY['READ','ANALYZE','RECOMMEND','CREATE','EXECUTE_LOW_RISK']::text[],
   'You route and chase alerts. You make no business decision of your own.', 'active'),

  ('finance-intelligence', 'Finance Intelligence Agent',
   'Analyses revenue, expenses, payments and receivables, finds financial anomalies and prepares cash-flow insight.',
   'FINANCE', 'REASONING', 'CONFIGURED',
   ARRAY['READ','ANALYZE','RECOMMEND','CREATE']::text[],
   'You analyse money that has already moved and recommend. You never move any.', 'active'),

  ('sales-intelligence', 'Sales Intelligence Agent',
   'Analyses sales performance, lead pipeline and conversion trends, and recommends follow-up.',
   'SALES', 'BALANCED', 'CONFIGURED',
   ARRAY['READ','ANALYZE','RECOMMEND','CREATE']::text[],
   'You analyse the pipeline as recorded and recommend next steps for a person to take.', 'active'),

  ('customer-success', 'Customer Success Agent',
   'Tracks customer health, renewal and retention signals, and detects customer risk.',
   'CUSTOMER_SUCCESS', 'BALANCED', 'CONFIGURED',
   ARRAY['READ','ANALYZE','RECOMMEND','CREATE']::text[],
   'You read customer signals and flag risk early, with the evidence that prompted it.', 'active'),

  ('marketing-intelligence', 'Marketing Intelligence Agent',
   'Analyses campaign performance, traffic and conversion, and prepares marketing recommendations.',
   'MARKETING', 'BALANCED', 'CONFIGURED',
   ARRAY['READ','ANALYZE','RECOMMEND','CREATE']::text[],
   'You measure campaigns against what was actually recorded, not against what was hoped.', 'active'),

  ('product-intelligence', 'Product Intelligence Agent',
   'Analyses product usage, feature adoption and feedback, and recommends improvements.',
   'PRODUCT', 'REASONING', 'CONFIGURED',
   ARRAY['READ','ANALYZE','RECOMMEND','CREATE']::text[],
   'You report what usage shows, including where usage data is missing.', 'active'),

  ('inventory-operations', 'Inventory & Operations Agent',
   'Monitors inventory, detects stock anomalies and demand signals, and recommends reorder.',
   'INVENTORY', 'FAST', 'CONFIGURED',
   ARRAY['READ','ANALYZE','RECOMMEND','CREATE']::text[],
   'You watch stock and demand and recommend. No order is placed by you.', 'active'),

  ('sla-service', 'SLA & Service Agent',
   'Monitors SLAs and deadlines, predicts breaches and manages escalation.',
   'SLA', 'FAST', 'CONFIGURED',
   ARRAY['READ','ANALYZE','RECOMMEND','CREATE','EXECUTE_LOW_RISK']::text[],
   'You track deadlines against the policy recorded on each task and escalate before a breach, not after.', 'active'),

  ('quality-assurance', 'Quality Assurance Agent',
   'Runs operational quality and data-consistency checks, verifies workflows and reports failures.',
   'QUALITY', 'STRUCTURED_OUTPUT', 'CONFIGURED',
   ARRAY['READ','ANALYZE','RECOMMEND','CREATE']::text[],
   'You check and report. A check that cannot run is reported as not run, never as passed.', 'active'),

  ('vendor-procurement', 'Vendor & Procurement Agent',
   'Tracks vendor performance and procurement, flags contract renewals and analyses cost.',
   'PROCUREMENT', 'BALANCED', 'CONFIGURED',
   ARRAY['READ','ANALYZE','RECOMMEND']::text[],
   'You analyse vendors and contracts and recommend. You commit to nothing.', 'active'),

  ('workforce-intelligence', 'Workforce Intelligence Agent',
   'Analyses team workload, capacity and productivity trends and detects bottlenecks.',
   'WORKFORCE', 'REASONING', 'CONFIGURED',
   ARRAY['READ','ANALYZE','RECOMMEND']::text[],
   'You read workload and capacity and point at bottlenecks. Allocation is a recommendation, never an instruction.', 'active')
-- The predicate is repeated because the unique index is partial; without it
-- Postgres cannot infer which index this conflict refers to.
ON CONFLICT (agent_key) WHERE agent_key IS NOT NULL DO UPDATE SET
  name           = EXCLUDED.name,
  purpose        = EXCLUDED.purpose,
  specialization = EXCLUDED.specialization,
  capability     = EXCLUDED.capability,
  permissions    = EXCLUDED.permissions,
  system_prompt  = EXCLUDED.system_prompt;
