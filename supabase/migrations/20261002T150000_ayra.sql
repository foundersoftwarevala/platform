-- AYRA, the Founder's executive secretary.
--
-- Three tables, and the first is the one that matters.
--
-- ayra_capabilities is a register of what AYRA can actually do, with the
-- table or service behind each entry and, where something is not connected,
-- the reason. It exists because the failure mode of a secretary is not
-- refusing work — it is accepting work it cannot do and reporting it done.
-- A capability that is not connected cannot be executed against: the step
-- guard below refuses it and names the reason, so "book me a flight" comes
-- back as "there is no travel integration on this platform" rather than as a
-- confident silence.
--
-- Seeded from what this platform genuinely has. Email is connected because
-- email_outbox records status, attempts, last_error and sent_at, so delivery
-- can be confirmed rather than assumed. Internal messaging is connected
-- because messages and message_receipts exist. Lead follow-ups are connected
-- because lead_follow_ups exists and already carries an agent. WhatsApp,
-- Telegram, SMS, social messaging, calendar and travel are not connected, and
-- each says so with its reason.
--
-- ayra_orders is an instruction from the Founder and its lifecycle, and
-- ayra_order_steps is the plan it was broken into. An order cannot be
-- reported complete while a step is unfinished, and a step that needs
-- authority cannot execute before it is given. Both are enforced here rather
-- than in the code that happens to call it.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ayra_order_state') THEN
    CREATE TYPE ayra_order_state AS ENUM (
      'RECEIVED', 'UNDERSTOOD', 'PLANNED', 'AWAITING_AUTHORIZATION',
      'EXECUTING', 'VERIFYING', 'REPORTED', 'BLOCKED', 'FAILED', 'CANCELLED'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ayra_step_state') THEN
    CREATE TYPE ayra_step_state AS ENUM (
      'PLANNED', 'AWAITING_AUTHORIZATION', 'RUNNING', 'DONE',
      'VERIFIED', 'FAILED', 'BLOCKED', 'SKIPPED'
    );
  END IF;

  -- What an action costs if it is wrong. Everything above LOW needs a person.
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ayra_impact') THEN
    CREATE TYPE ayra_impact AS ENUM ('LOW', 'SENSITIVE', 'FINANCIAL', 'LEGAL', 'IRREVERSIBLE');
  END IF;
END $$;

-- ------------------------------------------------------ what AYRA can do

CREATE TABLE IF NOT EXISTS public.ayra_capabilities (
  capability     text PRIMARY KEY,
  label          text NOT NULL,
  connected      boolean NOT NULL,
  -- The table or service that makes it real. Required when connected.
  backing        text,
  -- Required when it is not, so a refusal can explain itself.
  not_connected_reason text,
  -- Whether using it needs the Founder's word first.
  impact         ayra_impact NOT NULL DEFAULT 'LOW',
  -- Whether the backing system reports delivery, so a claim can be checked.
  confirms_delivery boolean NOT NULL DEFAULT false,
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ayra_capabilities_connected_has_backing CHECK (
    connected = false OR (backing IS NOT NULL AND length(btrim(backing)) > 0)
  ),
  CONSTRAINT ayra_capabilities_absence_is_explained CHECK (
    connected = true
    OR (not_connected_reason IS NOT NULL AND length(btrim(not_connected_reason)) > 0)
  ),
  -- Nothing may claim to confirm delivery unless it is connected to something
  -- that actually reports it.
  CONSTRAINT ayra_capabilities_confirmation_needs_connection CHECK (
    confirms_delivery = false OR connected = true
  )
);

INSERT INTO public.ayra_capabilities
  (capability, label, connected, backing, not_connected_reason, impact, confirms_delivery)
VALUES
  ('email.read', 'Read authorized email', true, 'email_outbox, seo_inbox_messages', NULL, 'LOW', false),
  ('email.draft', 'Draft an email reply', true, 'email_outbox', NULL, 'LOW', false),
  -- Sending is outward-facing, so it is sensitive by default even though the
  -- channel is connected.
  ('email.send', 'Send an authorized email', true, 'email_outbox', NULL, 'SENSITIVE', true),
  ('message.read', 'Read internal messages', true, 'messages, chat_messages', NULL, 'LOW', false),
  ('message.send', 'Send an internal message', true, 'messages, message_receipts', NULL, 'LOW', true),
  ('followup.read', 'See due and overdue follow-ups', true, 'lead_follow_ups', NULL, 'LOW', false),
  ('followup.create', 'Schedule a follow-up', true, 'lead_follow_ups', NULL, 'LOW', false),
  ('lead.read', 'Look up a lead', true, 'leads', NULL, 'LOW', false),
  ('task.create', 'Raise a task', true, 'tm_tasks', NULL, 'LOW', false),
  ('approval.read', 'Show what is waiting on the Founder', true, 'founder_approvals, tm_approvals', NULL, 'LOW', false),
  ('report.read', 'Find a report', true, 'founder_reports', NULL, 'LOW', false),
  ('knowledge.read', 'Find recorded knowledge', true, 'founder_knowledge', NULL, 'LOW', false),
  ('priorities.read', 'Say what today needs', true, 'founder_work_plan_items, founder_attention', NULL, 'LOW', false),
  ('agent.assign', 'Give work to an agent', true, 'ai_agents, ai_agent_runs', NULL, 'LOW', false),

  ('whatsapp.send', 'Send a WhatsApp message', false, NULL,
   'No WhatsApp integration exists on this platform: no table, no registered service and no credential.', 'SENSITIVE', false),
  ('telegram.send', 'Send a Telegram message', false, NULL,
   'No Telegram integration exists on this platform.', 'SENSITIVE', false),
  ('sms.send', 'Send an SMS', false, NULL,
   'No SMS gateway is registered in the AI API Manager.', 'SENSITIVE', false),
  ('social.send', 'Post or reply on social media', false, NULL,
   'Social posting is not connected; the registered social services are read-only SEO tools.', 'SENSITIVE', false),
  ('calendar.schedule', 'Schedule a meeting', false, NULL,
   'No calendar table or scheduling integration exists on this platform.', 'LOW', false),
  ('travel.book', 'Book travel or tickets', false, NULL,
   'No travel or booking integration exists on this platform.', 'FINANCIAL', false),
  ('payment.make', 'Make a payment', false, NULL,
   'AYRA is not connected to any payment rail, and would not be permitted to use one unattended.', 'FINANCIAL', false)
ON CONFLICT (capability) DO UPDATE SET
  label = EXCLUDED.label,
  connected = EXCLUDED.connected,
  backing = EXCLUDED.backing,
  not_connected_reason = EXCLUDED.not_connected_reason,
  impact = EXCLUDED.impact,
  confirms_delivery = EXCLUDED.confirms_delivery,
  updated_at = now();

-- ----------------------------------------------------------- the orders

CREATE TABLE IF NOT EXISTS public.ayra_orders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id     uuid,
  -- What the Founder actually said, kept verbatim. A paraphrase is not an
  -- instruction, and disputes are settled against the original.
  instruction    text NOT NULL,
  language       text,
  understood_as  text,
  state          ayra_order_state NOT NULL DEFAULT 'RECEIVED',

  -- The highest impact any step in the plan carries.
  impact         ayra_impact NOT NULL DEFAULT 'LOW',
  authorized_by  uuid,
  authorized_at  timestamptz,

  -- What AYRA reported back, and when.
  report         text,
  reported_at    timestamptz,
  blocked_reason text,
  failure_reason text,

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ayra_orders_instruction_not_blank CHECK (length(btrim(instruction)) > 0),
  -- Anything above LOW cannot run until a person has said so.
  CONSTRAINT ayra_orders_high_impact_is_authorized CHECK (
    impact = 'LOW'
    OR state NOT IN ('EXECUTING', 'VERIFYING', 'REPORTED')
    OR (authorized_by IS NOT NULL AND authorized_at IS NOT NULL)
  ),
  -- "Done" has to come with what was done.
  CONSTRAINT ayra_orders_report_is_present CHECK (
    state <> 'REPORTED' OR (report IS NOT NULL AND reported_at IS NOT NULL)
  ),
  CONSTRAINT ayra_orders_blocked_is_explained CHECK (
    state <> 'BLOCKED' OR (blocked_reason IS NOT NULL AND length(btrim(blocked_reason)) > 0)
  ),
  CONSTRAINT ayra_orders_failure_is_explained CHECK (
    state <> 'FAILED' OR (failure_reason IS NOT NULL AND length(btrim(failure_reason)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS ayra_orders_open_idx ON public.ayra_orders (state, created_at DESC)
  WHERE state NOT IN ('REPORTED', 'CANCELLED');

CREATE TABLE IF NOT EXISTS public.ayra_order_steps (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       uuid NOT NULL REFERENCES public.ayra_orders(id) ON DELETE CASCADE,
  position       int NOT NULL,
  description    text NOT NULL,

  -- Which capability this step needs. Everything routes through the register,
  -- so a step can never quietly use something unconnected.
  capability     text NOT NULL REFERENCES public.ayra_capabilities(capability),

  -- What actually carried it out, where something did.
  agent_id       uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  agent_run_id   uuid REFERENCES public.ai_agent_runs(id) ON DELETE SET NULL,
  task_id        uuid REFERENCES public.tm_tasks(id) ON DELETE SET NULL,

  state          ayra_step_state NOT NULL DEFAULT 'PLANNED',
  -- What the backing system said. A step is VERIFIED only on the strength of
  -- this, never on the strength of having run.
  result         text,
  evidence       jsonb NOT NULL DEFAULT '{}'::jsonb,
  blocked_reason text,
  error          text,

  started_at     timestamptz,
  finished_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ayra_order_steps_position_positive CHECK (position >= 1),
  CONSTRAINT ayra_order_steps_description_not_blank CHECK (length(btrim(description)) > 0),
  -- Verified means something came back. Running is not a result.
  CONSTRAINT ayra_order_steps_verified_has_result CHECK (
    state <> 'VERIFIED' OR (result IS NOT NULL AND length(btrim(result)) > 0)
  ),
  CONSTRAINT ayra_order_steps_blocked_is_explained CHECK (
    state <> 'BLOCKED' OR (blocked_reason IS NOT NULL AND length(btrim(blocked_reason)) > 0)
  ),
  CONSTRAINT ayra_order_steps_failure_is_explained CHECK (
    state <> 'FAILED' OR (error IS NOT NULL AND length(btrim(error)) > 0)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ayra_order_steps_position_unique
  ON public.ayra_order_steps (order_id, position);
CREATE INDEX IF NOT EXISTS ayra_order_steps_order_idx
  ON public.ayra_order_steps (order_id, position);

-- A step may not run against a capability this platform does not have.
CREATE OR REPLACE FUNCTION public.ayra_step_capability_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  cap public.ayra_capabilities%ROWTYPE;
BEGIN
  SELECT * INTO cap FROM public.ayra_capabilities WHERE capability = NEW.capability;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AYRA has no capability called %', NEW.capability
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT cap.connected AND NEW.state IN ('RUNNING', 'DONE', 'VERIFIED') THEN
    RAISE EXCEPTION '% is not connected: %', NEW.capability, cap.not_connected_reason
      USING ERRCODE = 'check_violation';
  END IF;

  -- Something that cannot report delivery cannot be called verified. This is
  -- the rule that stops "sent" being claimed on the strength of having tried.
  IF NEW.state = 'VERIFIED' AND NOT cap.confirms_delivery
     AND NEW.capability IN ('email.send', 'message.send') THEN
    RAISE EXCEPTION '% cannot be verified: its backing system does not confirm delivery',
      NEW.capability USING ERRCODE = 'check_violation';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS ayra_step_capability_guard ON public.ayra_order_steps;
CREATE TRIGGER ayra_step_capability_guard
  BEFORE INSERT OR UPDATE ON public.ayra_order_steps
  FOR EACH ROW EXECUTE FUNCTION public.ayra_step_capability_guard();

-- An order cannot be reported while a step is still outstanding.
CREATE OR REPLACE FUNCTION public.ayra_order_report_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  outstanding int;
BEGIN
  IF NEW.state = 'REPORTED' AND OLD.state IS DISTINCT FROM 'REPORTED' THEN
    SELECT count(*) INTO outstanding
      FROM public.ayra_order_steps
     WHERE order_id = NEW.id
       AND state NOT IN ('VERIFIED', 'DONE', 'FAILED', 'BLOCKED', 'SKIPPED');

    IF outstanding > 0 THEN
      RAISE EXCEPTION 'this order still has % step(s) outstanding; it cannot be reported complete',
        outstanding USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS ayra_order_report_guard ON public.ayra_orders;
CREATE TRIGGER ayra_order_report_guard
  BEFORE UPDATE ON public.ayra_orders
  FOR EACH ROW EXECUTE FUNCTION public.ayra_order_report_guard();

ALTER TABLE public.ayra_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ayra_orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ayra_order_steps  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ayra_capabilities','ayra_orders','ayra_order_steps'] LOOP
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

-- What AYRA can honestly offer, for a screen to show without guessing.
CREATE OR REPLACE VIEW public.ayra_capability_summary
WITH (security_invoker = true) AS
SELECT
  count(*)                                   AS capabilities,
  count(*) FILTER (WHERE connected)          AS connected,
  count(*) FILTER (WHERE NOT connected)      AS not_connected,
  count(*) FILTER (WHERE connected AND impact <> 'LOW') AS needs_authorization,
  count(*) FILTER (WHERE confirms_delivery)  AS can_confirm_delivery
FROM public.ayra_capabilities;

GRANT SELECT ON public.ayra_capability_summary TO service_role;
