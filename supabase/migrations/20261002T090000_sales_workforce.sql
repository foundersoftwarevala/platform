-- The sales workforce, on the register that already exists.
--
-- public.ai_agents already holds eighty agents under one permission
-- constraint and one audit table. Sales agents go on the same register rather
-- than beside it: a second workforce would mean a second place permissions
-- could be granted, and the whole value of that constraint is that there is
-- only one.
--
-- What sales work needs that operational work did not is where an agent
-- sells, in what languages, and through which channels. Those are added as
-- columns here.
--
-- The channels column is the honest part. An agent may only list a channel
-- the platform can actually reach, and the check below names them: email,
-- because email_outbox exists and records delivery; internal_message, because
-- messages and message_receipts exist; and lead_followup, because
-- lead_follow_ups exists and already carries an agent. WhatsApp, Telegram,
-- SMS and social messaging have no table, no service and no credential in
-- this platform, so they are not permitted values — an agent cannot be
-- configured to claim a channel that does not exist.
--
-- No sales agent is granted EXECUTE_LOW_RISK. They research, qualify, draft
-- and recommend; sending anything outward is a governed act that belongs to a
-- person, and the permission constraint on ai_agents is what enforces it.

ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS region        text,
  ADD COLUMN IF NOT EXISTS market        text,
  ADD COLUMN IF NOT EXISTS languages     text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS territory     text,
  ADD COLUMN IF NOT EXISTS channels      text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS working_hours text;

DO $$
BEGIN
  -- Only channels this platform can actually reach.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_agents_channels_are_connected') THEN
    ALTER TABLE public.ai_agents ADD CONSTRAINT ai_agents_channels_are_connected CHECK (
      channels <@ ARRAY['email', 'internal_message', 'lead_followup']::text[]
    );
  END IF;

  -- A sales agent without a region is not assigned to anything.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_agents_sales_has_region') THEN
    ALTER TABLE public.ai_agents ADD CONSTRAINT ai_agents_sales_has_region CHECK (
      specialization IS DISTINCT FROM 'SALES' OR region IS NOT NULL
    );
  END IF;
END $$;

COMMENT ON COLUMN public.ai_agents.channels IS
  'Channels this agent may work through. Only email, internal_message and lead_followup exist on this platform; nothing else can be configured.';

CREATE INDEX IF NOT EXISTS ai_agents_region_idx ON public.ai_agents (region)
  WHERE region IS NOT NULL;

-- What each sales agent has actually done, counted from the records that own
-- it. Nothing here is a stored performance number: a success rate written
-- into a column is a number nobody can check.
CREATE OR REPLACE VIEW public.founder_sales_agent_totals
WITH (security_invoker = true) AS
SELECT
  a.id AS agent_id,
  a.agent_key,
  a.name,
  a.region,
  a.market,
  a.languages,
  a.lifecycle,
  count(f.id)                                        AS follow_ups_assigned,
  count(f.id) FILTER (WHERE f.is_completed)          AS follow_ups_completed,
  count(f.id) FILTER (WHERE NOT f.is_completed
                        AND f.scheduled_at < now())  AS follow_ups_overdue,
  max(f.completed_at)                                AS last_completed_at,
  count(r.id)                                        AS runs,
  count(r.id) FILTER (WHERE r.verification = 'VERIFIED') AS runs_verified
FROM public.ai_agents a
LEFT JOIN public.lead_follow_ups f ON f.agent_id = a.id
LEFT JOIN public.ai_agent_runs r   ON r.agent_id = a.id
WHERE a.specialization = 'SALES'
GROUP BY a.id, a.agent_key, a.name, a.region, a.market, a.languages, a.lifecycle;

COMMENT ON VIEW public.founder_sales_agent_totals IS
  'Sales agent activity, counted from lead_follow_ups and ai_agent_runs. No stored performance figure exists to disagree with it.';

GRANT SELECT ON public.founder_sales_agent_totals TO service_role;
