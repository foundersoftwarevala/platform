-- What happens to a signal after a Monitoring Agent raises it.
--
-- Sixty agents watch sixty things. Without a rule for what each severity
-- earns, every one of them either shouts or is ignored, and the difference
-- between "stock moved a little" and "payments are failing" is left to
-- whoever happens to be reading. This is that rule, and it is a table rather
-- than code so the Founder can change the ladder without a deployment.
--
-- The ladder, as the owner set it:
--
--   INFO      silently monitored - recorded as an event, nothing raised
--   LOW       reaches the dashboard
--   MEDIUM    reaches the Founder AI attention queue
--   HIGH      alerts the Founder
--   CRITICAL  alerts immediately and escalates, and opens a decision
--
-- Nothing here invents a severity. The agent states one, the route decides
-- what it earns, and every step is recorded against the event that caused it.

CREATE TABLE IF NOT EXISTS public.founder_signal_routes (
  severity           founder_severity PRIMARY KEY,
  label              text NOT NULL,

  -- Does this band create something a person can see and work?
  raises_attention   boolean NOT NULL,
  -- 1 is the most urgent; founder_attention.priority uses the same scale.
  attention_priority int NOT NULL DEFAULT 3,

  -- Does it reach a person directly, through the existing notification table?
  notifies           boolean NOT NULL DEFAULT false,
  -- Does it demand a named human response rather than a queue entry?
  escalates          boolean NOT NULL DEFAULT false,
  -- Does it open a governed decision, so a recommendation can be approved?
  opens_decision     boolean NOT NULL DEFAULT false,

  -- How long the same signal keeps folding into one open item instead of
  -- creating another. Sixty agents on a five-minute loop would otherwise
  -- bury the queue in copies of one problem.
  correlation_window interval NOT NULL DEFAULT '1 hour',

  notes              text,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid,

  CONSTRAINT founder_signal_routes_priority_range CHECK (attention_priority BETWEEN 1 AND 5),
  -- An escalation nobody is told about is not an escalation.
  CONSTRAINT founder_signal_routes_escalation_notifies CHECK (escalates = false OR notifies = true),
  -- Anything that notifies has to exist somewhere a person can work it.
  CONSTRAINT founder_signal_routes_notify_has_item CHECK (notifies = false OR raises_attention = true),
  CONSTRAINT founder_signal_routes_window_positive CHECK (correlation_window > interval '0')
);

COMMENT ON TABLE public.founder_signal_routes IS
  'What each severity earns. Changing a row changes the behaviour of every Monitoring Agent at once, with no deployment.';

INSERT INTO public.founder_signal_routes
  (severity, label, raises_attention, attention_priority, notifies, escalates, opens_decision, correlation_window, notes)
VALUES
  ('INFO', 'silently monitored', false, 5, false, false, false, interval '6 hours',
   'Recorded as an event and nothing more. The history is kept so a pattern can be found later.'),
  ('LOW', 'dashboard', true, 4, false, false, false, interval '4 hours',
   'Visible on the dashboard. Nobody is interrupted.'),
  ('MEDIUM', 'attention queue', true, 3, false, false, false, interval '2 hours',
   'Enters the Founder AI attention queue to be worked in turn.'),
  ('HIGH', 'alerts the Founder', true, 2, true, false, false, interval '1 hour',
   'Reaches a person directly through the existing notification table.'),
  ('CRITICAL', 'immediate alert and escalation', true, 1, true, true, true, interval '15 minutes',
   'Alerts immediately, escalates to a named human, and opens a governed decision so a recommendation can be approved.')
ON CONFLICT (severity) DO UPDATE SET
  label              = EXCLUDED.label,
  raises_attention   = EXCLUDED.raises_attention,
  attention_priority = EXCLUDED.attention_priority,
  notifies           = EXCLUDED.notifies,
  escalates          = EXCLUDED.escalates,
  opens_decision     = EXCLUDED.opens_decision,
  correlation_window = EXCLUDED.correlation_window,
  notes              = EXCLUDED.notes,
  updated_at         = now();

ALTER TABLE public.founder_signal_routes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'founder_signal_routes' AND policyname = 'founder_signal_routes_service_role'
  ) THEN
    CREATE POLICY founder_signal_routes_service_role ON public.founder_signal_routes
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Correlation needs to find the open item for the same thing quickly. Without
-- this the fold-in query degrades exactly when the queue is busiest, which is
-- the moment it matters.
CREATE INDEX IF NOT EXISTS founder_attention_open_correlation_idx
  ON public.founder_attention (domain, kind, entity_type, entity_id, created_at DESC)
  WHERE status IN ('NEW', 'ACKNOWLEDGED', 'IN_PROGRESS');

-- Which agent raised a signal, and what it turned into.
--
-- founder_events already holds the signal and founder_attention holds the
-- item, but nothing joined the two to the agent that noticed. Without that,
-- "which agent is producing noise" and "which agent caught the outage" are
-- both unanswerable.
CREATE TABLE IF NOT EXISTS public.founder_signal_dispatch (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid NOT NULL REFERENCES public.founder_events(id) ON DELETE CASCADE,
  agent_id       uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  agent_run_id   uuid REFERENCES public.ai_agent_runs(id) ON DELETE SET NULL,

  severity       founder_severity NOT NULL,
  -- What the route decided, recorded as it was at the time. A later change to
  -- the ladder must not rewrite what happened.
  route_label    text NOT NULL,
  attention_id   uuid REFERENCES public.founder_attention(id) ON DELETE SET NULL,
  decision_id    uuid REFERENCES public.founder_decisions(id) ON DELETE SET NULL,
  notified       boolean NOT NULL DEFAULT false,
  escalated      boolean NOT NULL DEFAULT false,
  -- True where this signal folded into an item that already existed.
  correlated     boolean NOT NULL DEFAULT false,

  dispatched_at  timestamptz NOT NULL DEFAULT now(),

  -- A dispatch that says it raised something has to point at it.
  CONSTRAINT founder_signal_dispatch_attention_present CHECK (
    correlated = false OR attention_id IS NOT NULL
  ),
  CONSTRAINT founder_signal_dispatch_route_named CHECK (length(btrim(route_label)) > 0)
);

CREATE INDEX IF NOT EXISTS founder_signal_dispatch_agent_idx
  ON public.founder_signal_dispatch (agent_id, dispatched_at DESC);
CREATE INDEX IF NOT EXISTS founder_signal_dispatch_attention_idx
  ON public.founder_signal_dispatch (attention_id);
CREATE UNIQUE INDEX IF NOT EXISTS founder_signal_dispatch_event_unique
  ON public.founder_signal_dispatch (event_id);

ALTER TABLE public.founder_signal_dispatch ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'founder_signal_dispatch' AND policyname = 'founder_signal_dispatch_service_role'
  ) THEN
    CREATE POLICY founder_signal_dispatch_service_role ON public.founder_signal_dispatch
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- What each agent's signals actually turned into, counted in SQL.
--
-- This is how "Agent Workforce Monitoring" answers questions about the other
-- fifty-nine: how much each one raised, how much of it was merely folded into
-- something already open, and how much reached a person.
CREATE OR REPLACE VIEW public.founder_signal_agent_totals
WITH (security_invoker = true) AS
SELECT
  a.id   AS agent_id,
  a.agent_key,
  a.name,
  count(d.id)                                         AS signals,
  count(d.id) FILTER (WHERE d.correlated)             AS folded_into_existing,
  count(d.id) FILTER (WHERE d.attention_id IS NOT NULL) AS raised_items,
  count(d.id) FILTER (WHERE d.notified)               AS notified,
  count(d.id) FILTER (WHERE d.escalated)              AS escalated,
  count(d.id) FILTER (WHERE d.decision_id IS NOT NULL) AS opened_decisions,
  max(d.dispatched_at)                                AS last_signal_at
FROM public.ai_agents a
LEFT JOIN public.founder_signal_dispatch d ON d.agent_id = a.id
WHERE a.agent_key IS NOT NULL
GROUP BY a.id, a.agent_key, a.name;

COMMENT ON VIEW public.founder_signal_agent_totals IS
  'Per-agent signal counts, computed in SQL. A noisy agent and a silent one are both visible here.';

GRANT SELECT ON public.founder_signal_agent_totals TO service_role;
