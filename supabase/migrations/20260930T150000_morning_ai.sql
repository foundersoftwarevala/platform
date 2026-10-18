-- Morning AI: the day's cycle, and the plan it produces.
--
-- Two tables, and both exist because nothing already held what they hold.
--
-- founder_daily_cycles is the orchestrator's own record of a day: when the
-- brief was produced, when the plan was made, when the day was closed. The
-- brief and the close are not stored here — they are reports, and they go in
-- founder_reports with the rest, so the report engine's honesty constraints
-- and its permission scoping apply to them too. A morning brief that found
-- nothing has to say so for exactly the same reason every other report does.
--
-- founder_work_plan_items is the day's prioritised work. It deliberately does
-- not hold the work itself: each row points at an attention item, a task or a
-- decision that already exists, and adds what the plan adds - the position,
-- the reason for that position, and which agent could take it. Copying the
-- work here would create a second queue that drifts from the first.
--
-- Nothing in this schema can mark work done. Completion belongs to the system
-- that owns the work, and verification is a separate column from completion
-- because an agent finishing a task is not the same as the outcome being
-- verified.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'founder_cycle_state') THEN
    CREATE TYPE founder_cycle_state AS ENUM (
      'ANALYSING', 'BRIEF_READY', 'PLANNED', 'MONITORING', 'CLOSED', 'FAILED'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'founder_plan_state') THEN
    CREATE TYPE founder_plan_state AS ENUM (
      'IDENTIFIED', 'PRIORITIZED', 'PLANNED', 'WAITING_APPROVAL',
      'ASSIGNED', 'EXECUTING', 'VERIFYING', 'COMPLETED', 'FAILED', 'DROPPED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.founder_daily_cycles (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid,
  -- The operational day this cycle is for. One cycle per day; a second run
  -- updates the first rather than producing a rival brief.
  cycle_date        date NOT NULL,
  state             founder_cycle_state NOT NULL DEFAULT 'ANALYSING',

  -- What the overnight analysis looked at, named source by source.
  analysed_from     jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Where analysis began: everything since the previous cycle closed.
  window_start      timestamptz,
  window_end        timestamptz,

  brief_report_id   uuid REFERENCES public.founder_reports(id) ON DELETE SET NULL,
  close_report_id   uuid REFERENCES public.founder_reports(id) ON DELETE SET NULL,

  -- Counted when the plan is made, so the close can be compared against it.
  planned_items     int NOT NULL DEFAULT 0,
  escalations       int NOT NULL DEFAULT 0,

  failure_reason    text,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  planned_at        timestamptz,
  closed_at         timestamptz,

  CONSTRAINT founder_daily_cycles_window_ordered CHECK (
    window_start IS NULL OR window_end IS NULL OR window_end >= window_start
  ),
  -- A cycle that says it produced a brief has to point at one.
  CONSTRAINT founder_daily_cycles_brief_present CHECK (
    state NOT IN ('BRIEF_READY', 'PLANNED', 'MONITORING', 'CLOSED')
    OR brief_report_id IS NOT NULL
  ),
  CONSTRAINT founder_daily_cycles_close_present CHECK (
    state <> 'CLOSED' OR (close_report_id IS NOT NULL AND closed_at IS NOT NULL)
  ),
  CONSTRAINT founder_daily_cycles_failure_explained CHECK (
    state <> 'FAILED' OR (failure_reason IS NOT NULL AND length(btrim(failure_reason)) > 0)
  ),
  CONSTRAINT founder_daily_cycles_counts_not_negative CHECK (
    planned_items >= 0 AND escalations >= 0
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS founder_daily_cycles_one_per_day
  ON public.founder_daily_cycles (cycle_date);

CREATE TABLE IF NOT EXISTS public.founder_work_plan_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id       uuid NOT NULL REFERENCES public.founder_daily_cycles(id) ON DELETE CASCADE,

  -- The work this points at. Exactly one of these is set: the plan never
  -- holds work of its own.
  attention_id   uuid REFERENCES public.founder_attention(id) ON DELETE CASCADE,
  task_id        uuid REFERENCES public.tm_tasks(id) ON DELETE CASCADE,
  decision_id    uuid REFERENCES public.founder_decisions(id) ON DELETE CASCADE,

  title          text NOT NULL,
  domain         text NOT NULL,
  severity       founder_severity NOT NULL DEFAULT 'LOW',

  -- 1 is worked first. The score is derived; the reason is what makes it
  -- arguable, and an unexplained priority is just an assertion.
  position       int NOT NULL,
  priority_score numeric NOT NULL,
  priority_reason text NOT NULL,

  -- Which agent could take this, and why it is eligible. A recommendation:
  -- nothing here assigns work, because assignment is governed.
  suggested_agent_id uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  allocation_reason  text,

  state          founder_plan_state NOT NULL DEFAULT 'IDENTIFIED',
  -- Completion and verification are separate on purpose.
  verification   text NOT NULL DEFAULT 'UNVERIFIED',

  blocked_reason text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT founder_work_plan_items_points_at_one CHECK (
    (attention_id IS NOT NULL)::int + (task_id IS NOT NULL)::int
      + (decision_id IS NOT NULL)::int = 1
  ),
  CONSTRAINT founder_work_plan_items_reason_given CHECK (
    length(btrim(priority_reason)) > 0
  ),
  CONSTRAINT founder_work_plan_items_position_positive CHECK (position >= 1),
  CONSTRAINT founder_work_plan_items_verification_known CHECK (
    verification IN ('UNVERIFIED', 'VERIFIED', 'FAILED')
  ),
  -- Completing is not verifying, and a plan item cannot claim both at once
  -- without the verification having actually happened.
  CONSTRAINT founder_work_plan_items_verified_is_complete CHECK (
    verification <> 'VERIFIED' OR state = 'COMPLETED'
  ),
  -- An agent suggestion has to say why that agent.
  CONSTRAINT founder_work_plan_items_allocation_explained CHECK (
    suggested_agent_id IS NULL
    OR (allocation_reason IS NOT NULL AND length(btrim(allocation_reason)) > 0)
  ),
  CONSTRAINT founder_work_plan_items_blocked_explained CHECK (
    state <> 'FAILED' OR (blocked_reason IS NOT NULL AND length(btrim(blocked_reason)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS founder_work_plan_items_cycle_idx
  ON public.founder_work_plan_items (cycle_id, position);
CREATE INDEX IF NOT EXISTS founder_work_plan_items_open_idx
  ON public.founder_work_plan_items (state)
  WHERE state NOT IN ('COMPLETED', 'DROPPED');

-- The same piece of work appears once in a day's plan.
CREATE UNIQUE INDEX IF NOT EXISTS founder_work_plan_items_attention_once
  ON public.founder_work_plan_items (cycle_id, attention_id) WHERE attention_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS founder_work_plan_items_task_once
  ON public.founder_work_plan_items (cycle_id, task_id) WHERE task_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS founder_work_plan_items_decision_once
  ON public.founder_work_plan_items (cycle_id, decision_id) WHERE decision_id IS NOT NULL;

-- Only the transitions the lifecycle allows.
CREATE OR REPLACE FUNCTION public.founder_work_plan_state_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  allowed founder_plan_state[];
BEGIN
  IF NEW.state = OLD.state THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  allowed := CASE OLD.state
    WHEN 'IDENTIFIED'       THEN ARRAY['PRIORITIZED','DROPPED']::founder_plan_state[]
    WHEN 'PRIORITIZED'      THEN ARRAY['PLANNED','DROPPED']::founder_plan_state[]
    WHEN 'PLANNED'          THEN ARRAY['WAITING_APPROVAL','ASSIGNED','DROPPED']::founder_plan_state[]
    WHEN 'WAITING_APPROVAL' THEN ARRAY['ASSIGNED','DROPPED','FAILED']::founder_plan_state[]
    WHEN 'ASSIGNED'         THEN ARRAY['EXECUTING','FAILED','DROPPED']::founder_plan_state[]
    WHEN 'EXECUTING'        THEN ARRAY['VERIFYING','FAILED']::founder_plan_state[]
    -- Work reaches COMPLETED only through VERIFYING. Nothing may jump there.
    WHEN 'VERIFYING'        THEN ARRAY['COMPLETED','FAILED']::founder_plan_state[]
    WHEN 'FAILED'           THEN ARRAY['PLANNED','DROPPED']::founder_plan_state[]
    WHEN 'COMPLETED'        THEN ARRAY[]::founder_plan_state[]
    WHEN 'DROPPED'          THEN ARRAY[]::founder_plan_state[]
    ELSE ARRAY[]::founder_plan_state[]
  END;

  IF NOT (NEW.state = ANY (allowed)) THEN
    RAISE EXCEPTION 'a plan item cannot go from % to %', OLD.state, NEW.state
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS founder_work_plan_state_guard ON public.founder_work_plan_items;
CREATE TRIGGER founder_work_plan_state_guard
  BEFORE UPDATE ON public.founder_work_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.founder_work_plan_state_guard();

ALTER TABLE public.founder_daily_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder_work_plan_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='founder_daily_cycles' AND policyname='founder_daily_cycles_service_role'
  ) THEN
    CREATE POLICY founder_daily_cycles_service_role ON public.founder_daily_cycles
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='founder_work_plan_items' AND policyname='founder_work_plan_items_service_role'
  ) THEN
    CREATE POLICY founder_work_plan_items_service_role ON public.founder_work_plan_items
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- The day, counted in SQL rather than measured from a fetched page.
CREATE OR REPLACE VIEW public.founder_cycle_totals
WITH (security_invoker = true) AS
SELECT
  c.id AS cycle_id,
  c.cycle_date,
  c.state,
  count(i.id)                                              AS planned,
  count(i.id) FILTER (WHERE i.state = 'WAITING_APPROVAL')  AS waiting_approval,
  count(i.id) FILTER (WHERE i.state = 'ASSIGNED')          AS assigned,
  count(i.id) FILTER (WHERE i.state = 'EXECUTING')         AS executing,
  count(i.id) FILTER (WHERE i.state = 'VERIFYING')         AS verifying,
  count(i.id) FILTER (WHERE i.state = 'COMPLETED')         AS completed,
  count(i.id) FILTER (WHERE i.verification = 'VERIFIED')   AS verified,
  count(i.id) FILTER (WHERE i.state = 'FAILED')            AS failed,
  count(i.id) FILTER (WHERE i.suggested_agent_id IS NOT NULL) AS with_agent
FROM public.founder_daily_cycles c
LEFT JOIN public.founder_work_plan_items i ON i.cycle_id = c.id
GROUP BY c.id, c.cycle_date, c.state;

COMMENT ON VIEW public.founder_cycle_totals IS
  'One row per operational day. Completed and verified are counted separately, because they are not the same thing.';

GRANT SELECT ON public.founder_cycle_totals TO service_role;
