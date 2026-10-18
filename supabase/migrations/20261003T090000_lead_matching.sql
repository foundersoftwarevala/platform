-- Matching a lead to the right agent, and being able to say why.
--
-- The Lead Manager already owns this ground: leads carries language, region,
-- four scores, assigned_agent_id and assigned_at; lead_agents carries status,
-- capacity, conversion_rate and avg_response_minutes; lead_routing_rules
-- holds six rules. None of that is rebuilt here, and assignment continues to
-- point at lead_agents, which is where it has always pointed.
--
-- What is missing is what the matching needs to be more than a guess: which
-- languages an agent actually works in, which regions and timezone, and what
-- they know. Those are added to lead_agents rather than to a parallel table,
-- because a second agent register is a second place availability could
-- disagree with itself.
--
-- The second half is the audit. An assignment that cannot say why it chose
-- that agent is a random assignment with extra steps, and the hard rule is
-- that there are no random assignments. Every one lands in
-- lead_assignment_log with the reason, the alternatives considered, and what
-- ruled the others out.

ALTER TABLE public.lead_agents
  ADD COLUMN IF NOT EXISTS languages        text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS regions          text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS timezone         text,
  -- What this agent actually knows: product families, deal sizes, sectors.
  ADD COLUMN IF NOT EXISTS expertise        text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS working_hours    text,
  -- Distinct from `capacity`, which is a headline number. This is how many
  -- open leads the agent may hold at once.
  ADD COLUMN IF NOT EXISTS max_open_leads   int NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS unavailable_reason text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lead_agents_open_leads_positive') THEN
    ALTER TABLE public.lead_agents ADD CONSTRAINT lead_agents_open_leads_positive CHECK (
      max_open_leads >= 1
    );
  END IF;

  -- An agent who is offline has to say why, so a lead that could not be
  -- placed can explain itself rather than reporting a silent absence.
  -- agent_status is an enum of online, busy and offline; there is no
  -- "unavailable", and inventing one would mean a second vocabulary for the
  -- same idea.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lead_agents_offline_explained') THEN
    ALTER TABLE public.lead_agents ADD CONSTRAINT lead_agents_offline_explained CHECK (
      status <> 'offline'
      OR (unavailable_reason IS NOT NULL AND length(btrim(unavailable_reason)) > 0)
    );
  END IF;
END $$;

COMMENT ON COLUMN public.lead_agents.languages IS
  'Languages this agent actually works in. An empty array means none recorded, which excludes them from language-matched routing rather than making them match everything.';

-- ----------------------------------------------------------- the audit

CREATE TABLE IF NOT EXISTS public.lead_assignment_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  agent_id        uuid REFERENCES public.lead_agents(id) ON DELETE SET NULL,
  -- The agent this replaced, where it replaced one.
  previous_agent_id uuid REFERENCES public.lead_agents(id) ON DELETE SET NULL,

  action          text NOT NULL,
  -- Why this agent. An assignment that cannot answer that is a random one.
  reason          text NOT NULL,
  -- The score the matcher gave, and the parts that made it up.
  score           numeric,
  factors         jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Who else was eligible, and what ruled out those who were not. This is
  -- what makes a disputed assignment reviewable.
  considered      jsonb NOT NULL DEFAULT '[]'::jsonb,
  excluded        jsonb NOT NULL DEFAULT '[]'::jsonb,

  decided_by      text NOT NULL DEFAULT 'MATCHING_ENGINE',
  decided_by_user uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT lead_assignment_log_action_known CHECK (
    action IN ('ASSIGNED', 'REASSIGNED', 'UNASSIGNED', 'NO_ELIGIBLE_AGENT', 'ESCALATED')
  ),
  CONSTRAINT lead_assignment_log_reason_given CHECK (length(btrim(reason)) > 0),
  -- An assignment has to name an agent; a failure to place one must not.
  CONSTRAINT lead_assignment_log_agent_matches_action CHECK (
    (action IN ('ASSIGNED', 'REASSIGNED') AND agent_id IS NOT NULL)
    OR (action IN ('UNASSIGNED', 'NO_ELIGIBLE_AGENT', 'ESCALATED'))
  ),
  -- A reassignment has to say who it took the lead from.
  CONSTRAINT lead_assignment_log_reassignment_has_previous CHECK (
    action <> 'REASSIGNED' OR previous_agent_id IS NOT NULL
  ),
  -- Nothing may claim there was no eligible agent without listing who was
  -- excluded and why. "Nobody was available" is a claim, not an explanation.
  CONSTRAINT lead_assignment_log_no_agent_is_explained CHECK (
    action <> 'NO_ELIGIBLE_AGENT' OR jsonb_array_length(excluded) > 0
  )
);

CREATE INDEX IF NOT EXISTS lead_assignment_log_lead_idx
  ON public.lead_assignment_log (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS lead_assignment_log_agent_idx
  ON public.lead_assignment_log (agent_id, created_at DESC);

-- The log is a record of what was decided. Correcting it means deciding
-- again, which writes another row.
CREATE OR REPLACE FUNCTION public.lead_assignment_log_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'the assignment log is append-only; record a new decision instead'
    USING ERRCODE = 'check_violation';
END $$;

DROP TRIGGER IF EXISTS lead_assignment_log_immutable ON public.lead_assignment_log;
CREATE TRIGGER lead_assignment_log_immutable
  BEFORE UPDATE OR DELETE ON public.lead_assignment_log
  FOR EACH ROW EXECUTE FUNCTION public.lead_assignment_log_append_only();

ALTER TABLE public.lead_assignment_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='lead_assignment_log' AND policyname='lead_assignment_log_service_role'
  ) THEN
    CREATE POLICY lead_assignment_log_service_role ON public.lead_assignment_log
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- What each agent is actually carrying, counted from the leads themselves.
--
-- `capacity` and `conversion_rate` on lead_agents are stored figures that
-- nobody recomputes; open_leads here is counted, so the matcher can refuse an
-- overloaded agent on the strength of the work rather than on the strength of
-- a column somebody set once.
CREATE OR REPLACE VIEW public.lead_agent_load
WITH (security_invoker = true) AS
SELECT
  a.id AS agent_id,
  a.name,
  a.status,
  a.languages,
  a.regions,
  a.expertise,
  a.timezone,
  a.max_open_leads,
  a.conversion_rate,
  a.avg_response_minutes,
  count(l.id) FILTER (
    WHERE l.status IS NULL OR lower(l.status::text) NOT IN ('converted', 'lost', 'closed', 'rejected')
  ) AS open_leads,
  count(l.id) AS leads_ever,
  max(l.assigned_at) AS last_assigned_at
FROM public.lead_agents a
LEFT JOIN public.leads l ON l.assigned_agent_id = a.id
GROUP BY a.id, a.name, a.status, a.languages, a.regions, a.expertise, a.timezone,
         a.max_open_leads, a.conversion_rate, a.avg_response_minutes;

COMMENT ON VIEW public.lead_agent_load IS
  'Agent availability with open_leads counted from the leads table, not read from a stored figure.';

GRANT SELECT ON public.lead_agent_load TO service_role;
