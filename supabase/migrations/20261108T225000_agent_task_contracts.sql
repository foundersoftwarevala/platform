-- Contract-bound pilot for five agents. This migration is applied to the VPS
-- database only; a matching cloud migration is not authorized.

ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS task_contract text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_agents_task_contract_not_blank'
  ) THEN
    ALTER TABLE public.ai_agents
      ADD CONSTRAINT ai_agents_task_contract_not_blank
      CHECK (task_contract IS NULL OR length(btrim(task_contract)) > 0);
  END IF;
END $$;

-- Customer-facing output is stored as a human-review draft, never as a live
-- chat message. messages is conversation-bound and its insert trigger publishes
-- a chat event, so it is not an appropriate draft store.
CREATE TABLE IF NOT EXISTS public.ai_agent_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE RESTRICT,
  lead_id uuid REFERENCES public.leads(id) ON DELETE RESTRICT,
  ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE RESTRICT,
  draft_body text NOT NULL CHECK (length(btrim(draft_body)) > 0),
  model text NOT NULL CHECK (length(btrim(model)) > 0),
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_agent_drafts_one_source CHECK (num_nonnulls(lead_id, ticket_id) = 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_agent_drafts_one_lead_per_agent
  ON public.ai_agent_drafts (agent_id, lead_id) WHERE lead_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ai_agent_drafts_one_ticket_per_agent
  ON public.ai_agent_drafts (agent_id, ticket_id) WHERE ticket_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ai_agent_drafts_pending_recent
  ON public.ai_agent_drafts (created_at DESC) WHERE status = 'PENDING';

ALTER TABLE public.ai_agent_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_agent_drafts FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.ai_agent_drafts FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public.ai_agent_drafts FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT ON public.ai_agent_drafts TO service_role;
  END IF;
END $$;

COMMENT ON TABLE public.ai_agent_drafts IS
  'AI-generated sales/support text for human review; never a sent message.';

INSERT INTO public.ai_agents
  (agent_key, name, purpose, status, lifecycle, specialization, capability,
   permissions, max_concurrent, system_prompt)
VALUES
  ('support-reply-drafter', 'Support Reply Drafting Agent',
   'Analyses one open support ticket at a time and creates a polite reply draft for human review. It never posts or sends a reply.',
   'active', 'CONFIGURED', 'SUPPORT', 'STRUCTURED_OUTPUT',
   ARRAY['READ','ANALYZE','CREATE']::text[], 1,
   'Draft calm, professional support replies based only on the supplied ticket. Do not promise refunds, timelines, or outcomes that are not verified. Do not claim an issue is resolved. Output a draft for human review only; never send it.')
ON CONFLICT (agent_key) DO NOTHING;

UPDATE public.ai_agents
   SET task_contract = CASE agent_key
     WHEN 'demo-scanner' THEN
       'Read up to five active public.product_demo_urls rows, make bounded SSRF-guarded HTTP GET checks without using stored credentials, save status/timing/check time to the existing demo URL health fields, and record each outcome in ai_agent_runs. Never activate or otherwise modify a demo.'
     WHEN 'sales-lead-followup' THEN
       'Read up to three leads with status=new that do not already have a draft from this agent, newest first. Use local Ollama to write polite follow-up drafts using only supplied lead data. Save each draft to ai_agent_drafts for human review; never send a message or change the lead.'
     WHEN 'support-reply-drafter' THEN
       'Read at most one open support ticket (new, assigned, in_progress, or waiting) without an existing draft from this agent. Use local Ollama to write a polite, factual reply draft. Save it to ai_agent_drafts for human review; never post a reply, contact the customer, or change the ticket.'
     WHEN 'mon-availability' THEN
       'Read active server_instances. Treat missing last_health_check or a check older than 15 minutes as stale CPU/RAM telemetry. Create a deduplicated CRITICAL founder_attention alert for each stale instance. Do not change server configuration or metrics.'
     WHEN 'finance-intelligence' THEN
       'Read marketplace_orders with status=paid for the current VPS database day, excluding soft-deleted orders. Calculate exact totals grouped by currency (never add different currencies together) and record counts and totals in ai_agent_runs. Do not modify orders or financial records.'
   END,
   blocked_reason = NULL,
   lifecycle = CASE WHEN lifecycle = 'CONFIGURED' AND status = 'active'
                    THEN 'AVAILABLE' ELSE lifecycle END
 WHERE agent_key IN (
   'demo-scanner', 'sales-lead-followup', 'support-reply-drafter',
   'mon-availability', 'finance-intelligence'
 );

DO $$
DECLARE
  missing text[];
BEGIN
  SELECT array_agg(expected.agent_key)
    INTO missing
    FROM (VALUES
      ('demo-scanner'), ('sales-lead-followup'), ('support-reply-drafter'),
      ('mon-availability'), ('finance-intelligence')
    ) AS expected(agent_key)
   WHERE NOT EXISTS (
     SELECT 1 FROM public.ai_agents a
      WHERE a.agent_key = expected.agent_key
        AND a.status = 'active'
        AND a.lifecycle = 'AVAILABLE'
        AND a.task_contract IS NOT NULL
   );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Agent contract pilot not ready: %', array_to_string(missing, ', ');
  END IF;
END $$;
