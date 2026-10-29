-- Batch 3 sales contracts. Apply to the VPS sv_platform database only.
-- All customer-facing text is kept in a service-role-only review queue; nothing is sent.

CREATE TABLE IF NOT EXISTS public.ai_agent_outreach_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE RESTRICT,
  target_type text NOT NULL CHECK (target_type IN (
    'lead', 'demo_request', 'server_subscription', 'marketplace_order_item',
    'reseller', 'marketplace_seller', 'chat_session'
  )),
  target_id text NOT NULL CHECK (length(btrim(target_id)) > 0),
  lead_id uuid REFERENCES public.leads(id) ON DELETE RESTRICT,
  draft_body text NOT NULL CHECK (length(btrim(draft_body)) > 0),
  model text NOT NULL CHECK (length(btrim(model)) > 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_agent_outreach_drafts_lead_target CHECK (
    (target_type = 'lead' AND lead_id IS NOT NULL AND target_id = lead_id::text)
    OR (target_type <> 'lead' AND lead_id IS NULL)
  ),
  CONSTRAINT ai_agent_outreach_drafts_agent_target_key
    UNIQUE (agent_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS ai_agent_outreach_drafts_pending_recent
  ON public.ai_agent_outreach_drafts (created_at DESC)
  WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS ai_agent_outreach_drafts_lead_pending
  ON public.ai_agent_outreach_drafts (lead_id, created_at DESC)
  WHERE lead_id IS NOT NULL AND status = 'PENDING';

ALTER TABLE public.ai_agent_outreach_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_agent_outreach_drafts FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.ai_agent_outreach_drafts FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public.ai_agent_outreach_drafts FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE ON public.ai_agent_outreach_drafts TO service_role;
  END IF;
END $$;

COMMENT ON TABLE public.ai_agent_outreach_drafts IS
  'Private AI-generated sales drafts for human review; never a sent message.';

UPDATE public.ai_agents
   SET task_contract = CASE agent_key
    WHEN 'sales-lead-qualification' THEN 'Read up to five new leads without a current sales-agent score. Deterministically score only recorded budget presence, source presence, product selection, and requirement detail; append a rule_based row to public.lead_scores with factors/confidence. Never claim an AI score, overwrite leads.ai_score, or assign a lead.'
    WHEN 'sales-lead-followup' THEN 'Read up to three leads in new/contacted/follow_up/interested/negotiation with no lead activity or contact for at least 3 days and no existing draft from this agent. Use local Ollama to write a polite factual follow-up from supplied lead data and save to the private review-draft table. Never send or update the lead.'
    WHEN 'sales-demo-booking' THEN 'Read up to three pending public.demo_requests. Use local Ollama to draft a polite booking reply asking the requester for availability; no team calendar/availability source is connected, so never invent or promise time slots. Save privately for human review and never send.'
    WHEN 'sales-demo-followup' THEN 'Read up to three public.demo_requests explicitly marked completed/attended within the last 7 days. Draft a thank-you and next-step note from recorded product data only; quote only the exact catalog price label when present. Save privately for review; do not send or invent a demo outcome.'
    WHEN 'sales-trial-conversion' THEN 'Read up to three public.server_subscriptions explicitly in trial status and expiring in 2 days. Draft a neutral upgrade reminder using the recorded plan/expiry; do not invent discounts or send it. Save privately for human review.'
    WHEN 'sales-subscription-sales' THEN 'Read up to three public.server_subscriptions in active status expiring within 30 days. Draft a neutral renewal reminder using recorded plan, expiry, amount and currency; save privately for review and never send or alter subscription state.'
    WHEN 'sales-renewal-sales' THEN 'Read up to three recently expired public.server_subscriptions with no active subscription for the same user. Draft a neutral renewal check-in without loyalty discount promises; save privately for human review and do not send.'
    WHEN 'sales-upsell' THEN 'Read up to three active basic/starter subscriptions with linked public.pm_usage at or above 75 percent in any recorded usage metric. Draft a Pro review suggestion using only recorded usage and catalog facts; never claim an unverified feature or send.'
    WHEN 'sales-cross-sell' THEN 'Read up to three paid order items whose recorded product name explicitly identifies a POS/point-of-sale product. Recommend only visible catalog products explicitly named Inventory or Accounting; save a review draft and never send.'
    WHEN 'sales-enterprise-sales' THEN 'Read up to three new leads whose requirements explicitly state more than 50 employees/staff/users. Create an internal manual-outreach brief for human review; do not infer company size or contact the lead.'
    WHEN 'sales-smb-sales' THEN 'Read up to three new leads whose requirements explicitly state 50 or fewer employees/staff/users. Draft a starter-pack discussion using only available catalog facts; do not invent pricing or send.'
    WHEN 'sales-reseller-sales' THEN 'Read up to three active public.resellers with a recorded last_active_at at least 30 days old. Draft a respectful reseller re-engagement note without promising a discount; save privately for human review and do not send.'
    WHEN 'sales-marketplace-sales' THEN 'Read up to three newly approved public.marketplace_sellers from the last 30 days. Draft a welcome/onboarding note using recorded seller and public marketplace details; save privately for human review and never send.'
    WHEN 'sales-objection-handling' THEN 'Read up to three recent chat sessions explicitly marked negative that have recorded messages. Send only a bounded transcript excerpt to local Ollama to draft an internal respectful response script; do not contact users or expose transcript in logs.'
    WHEN 'sales-proposal' THEN 'Read up to three leads explicitly marked high priority with positive deal_value and a selected visible catalog product. Draft proposal text using only recorded requirements and catalog price label; no PDF generation or unverified discounts/prices. Save privately for human review and never send.'
   END,
       status = 'active',
       lifecycle = 'AVAILABLE',
       blocked_reason = NULL
 WHERE agent_key IN ('sales-lead-qualification', 'sales-lead-followup', 'sales-demo-booking', 'sales-demo-followup', 'sales-trial-conversion', 'sales-subscription-sales', 'sales-renewal-sales', 'sales-upsell', 'sales-cross-sell', 'sales-enterprise-sales', 'sales-smb-sales', 'sales-reseller-sales', 'sales-marketplace-sales', 'sales-objection-handling', 'sales-proposal');

DO $$
DECLARE
  missing text[];
BEGIN
  SELECT array_agg(expected.agent_key)
    INTO missing
    FROM (VALUES
      ('sales-lead-qualification'),
      ('sales-lead-followup'),
      ('sales-demo-booking'),
      ('sales-demo-followup'),
      ('sales-trial-conversion'),
      ('sales-subscription-sales'),
      ('sales-renewal-sales'),
      ('sales-upsell'),
      ('sales-cross-sell'),
      ('sales-enterprise-sales'),
      ('sales-smb-sales'),
      ('sales-reseller-sales'),
      ('sales-marketplace-sales'),
      ('sales-objection-handling'),
      ('sales-proposal')
    ) AS expected(agent_key)
   WHERE NOT EXISTS (
     SELECT 1 FROM public.ai_agents a
      WHERE a.agent_key = expected.agent_key
        AND a.status = 'active'
        AND a.lifecycle = 'AVAILABLE'
        AND a.task_contract = CASE a.agent_key
    WHEN 'sales-lead-qualification' THEN 'Read up to five new leads without a current sales-agent score. Deterministically score only recorded budget presence, source presence, product selection, and requirement detail; append a rule_based row to public.lead_scores with factors/confidence. Never claim an AI score, overwrite leads.ai_score, or assign a lead.'
    WHEN 'sales-lead-followup' THEN 'Read up to three leads in new/contacted/follow_up/interested/negotiation with no lead activity or contact for at least 3 days and no existing draft from this agent. Use local Ollama to write a polite factual follow-up from supplied lead data and save to the private review-draft table. Never send or update the lead.'
    WHEN 'sales-demo-booking' THEN 'Read up to three pending public.demo_requests. Use local Ollama to draft a polite booking reply asking the requester for availability; no team calendar/availability source is connected, so never invent or promise time slots. Save privately for human review and never send.'
    WHEN 'sales-demo-followup' THEN 'Read up to three public.demo_requests explicitly marked completed/attended within the last 7 days. Draft a thank-you and next-step note from recorded product data only; quote only the exact catalog price label when present. Save privately for review; do not send or invent a demo outcome.'
    WHEN 'sales-trial-conversion' THEN 'Read up to three public.server_subscriptions explicitly in trial status and expiring in 2 days. Draft a neutral upgrade reminder using the recorded plan/expiry; do not invent discounts or send it. Save privately for human review.'
    WHEN 'sales-subscription-sales' THEN 'Read up to three public.server_subscriptions in active status expiring within 30 days. Draft a neutral renewal reminder using recorded plan, expiry, amount and currency; save privately for review and never send or alter subscription state.'
    WHEN 'sales-renewal-sales' THEN 'Read up to three recently expired public.server_subscriptions with no active subscription for the same user. Draft a neutral renewal check-in without loyalty discount promises; save privately for human review and do not send.'
    WHEN 'sales-upsell' THEN 'Read up to three active basic/starter subscriptions with linked public.pm_usage at or above 75 percent in any recorded usage metric. Draft a Pro review suggestion using only recorded usage and catalog facts; never claim an unverified feature or send.'
    WHEN 'sales-cross-sell' THEN 'Read up to three paid order items whose recorded product name explicitly identifies a POS/point-of-sale product. Recommend only visible catalog products explicitly named Inventory or Accounting; save a review draft and never send.'
    WHEN 'sales-enterprise-sales' THEN 'Read up to three new leads whose requirements explicitly state more than 50 employees/staff/users. Create an internal manual-outreach brief for human review; do not infer company size or contact the lead.'
    WHEN 'sales-smb-sales' THEN 'Read up to three new leads whose requirements explicitly state 50 or fewer employees/staff/users. Draft a starter-pack discussion using only available catalog facts; do not invent pricing or send.'
    WHEN 'sales-reseller-sales' THEN 'Read up to three active public.resellers with a recorded last_active_at at least 30 days old. Draft a respectful reseller re-engagement note without promising a discount; save privately for human review and do not send.'
    WHEN 'sales-marketplace-sales' THEN 'Read up to three newly approved public.marketplace_sellers from the last 30 days. Draft a welcome/onboarding note using recorded seller and public marketplace details; save privately for human review and never send.'
    WHEN 'sales-objection-handling' THEN 'Read up to three recent chat sessions explicitly marked negative that have recorded messages. Send only a bounded transcript excerpt to local Ollama to draft an internal respectful response script; do not contact users or expose transcript in logs.'
    WHEN 'sales-proposal' THEN 'Read up to three leads explicitly marked high priority with positive deal_value and a selected visible catalog product. Draft proposal text using only recorded requirements and catalog price label; no PDF generation or unverified discounts/prices. Save privately for human review and never send.'
        END
        AND 'CREATE' = ANY(a.permissions)
   );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Batch 3 sales agents not ready or missing CREATE permission: %',
      array_to_string(missing, ', ');
  END IF;
END $$;
