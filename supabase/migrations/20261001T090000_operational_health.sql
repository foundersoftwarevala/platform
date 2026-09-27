-- Founder AI's own health, counted in SQL.
--
-- The platform already monitors the things around it: security signals, paid
-- API spend, the live action stream. What nothing answered was how Founder AI
-- itself is doing — how many agents can take work, how much is queued, how
-- much is waiting on a person, and how much has been completed but never
-- verified.
--
-- That last figure is the one worth having. Completion is easy to produce and
-- easy to mistake for success; a growing verification backlog is what tells
-- an operator that work is being finished and never checked. It is counted
-- here rather than derived on a screen, so it stays true however large the
-- tables get.
--
-- Nothing here is a new monitoring system. Every number comes from a table
-- that already owns it, and a state nobody has recorded counts as zero rows,
-- never as healthy.

CREATE OR REPLACE VIEW public.founder_operational_health
WITH (security_invoker = true) AS
SELECT
  -- The workforce.
  (SELECT count(*) FROM public.ai_agents WHERE agent_key IS NOT NULL)                       AS agents_registered,
  (SELECT count(*) FROM public.ai_agents WHERE lifecycle IN ('CONFIGURED','AVAILABLE'))     AS agents_open_to_work,
  (SELECT count(*) FROM public.ai_agents WHERE lifecycle = 'BLOCKED')                       AS agents_blocked,
  (SELECT count(*) FROM public.ai_agents WHERE lifecycle = 'PAUSED')                        AS agents_paused,
  (SELECT count(*) FROM public.ai_agents
    WHERE agent_key IS NOT NULL AND NOT ('CREATE' = ANY (permissions)))                     AS agents_cannot_file,

  -- What the agents have actually done.
  (SELECT count(*) FROM public.ai_agent_runs WHERE state IN ('RUNNING','WAITING'))          AS runs_in_flight,
  (SELECT count(*) FROM public.ai_agent_runs WHERE state = 'BLOCKED')                       AS runs_blocked,
  (SELECT count(*) FROM public.ai_agent_runs WHERE state = 'FAILED')                        AS runs_failed,
  -- Finished, but nobody has checked the outcome. This is the backlog that
  -- matters: it is the gap between "done" and "true".
  (SELECT count(*) FROM public.ai_agent_runs
    WHERE state = 'COMPLETED' AND verification = 'UNVERIFIED')                              AS runs_awaiting_verification,
  (SELECT count(*) FROM public.ai_agent_runs WHERE verification = 'FAILED')                 AS runs_verification_failed,

  -- The work itself, from the task register that already owns it.
  (SELECT count(*) FROM public.tm_tasks
    WHERE status IN ('open','available_for_claim','claimed'))                               AS tasks_queued,
  (SELECT count(*) FROM public.tm_tasks WHERE status = 'in_progress')                       AS tasks_running,
  (SELECT count(*) FROM public.tm_tasks WHERE status IN ('blocked','on_hold'))              AS tasks_blocked,
  (SELECT count(*) FROM public.tm_tasks WHERE status = 'failed')                            AS tasks_failed,
  (SELECT count(*) FROM public.tm_tasks
    WHERE deadline IS NOT NULL AND deadline < now()
      AND status NOT IN ('completed','approved','closed','cancelled'))                      AS tasks_overdue,

  -- Governance: what is sitting with a person.
  (SELECT count(*) FROM public.founder_decisions WHERE state = 'WAITING_APPROVAL')          AS decisions_waiting,
  (SELECT count(*) FROM public.founder_decisions WHERE state = 'ESCALATED')                 AS decisions_escalated,
  (SELECT count(*) FROM public.founder_approvals WHERE state IN ('REQUESTED','VIEWED'))     AS approvals_open,
  (SELECT count(*) FROM public.founder_approvals
    WHERE state IN ('REQUESTED','VIEWED') AND expires_at < now())                           AS approvals_expired,

  -- What the monitoring agents have raised.
  (SELECT count(*) FROM public.founder_attention
    WHERE status IN ('NEW','ACKNOWLEDGED','IN_PROGRESS'))                                   AS attention_open,
  (SELECT count(*) FROM public.founder_attention
    WHERE status IN ('NEW','ACKNOWLEDGED','IN_PROGRESS') AND severity = 'CRITICAL')         AS attention_critical,
  (SELECT count(*) FROM public.founder_signal_dispatch WHERE escalated)                     AS signals_escalated,

  -- Whether the AI layer is being used at all, and how it is faring.
  (SELECT count(*) FROM public.founder_ai_requests)                                         AS ai_requests,
  (SELECT count(*) FROM public.founder_ai_requests WHERE outcome <> 'OK')                   AS ai_requests_failed;

COMMENT ON VIEW public.founder_operational_health IS
  'Founder AI''s own health, counted in SQL. runs_awaiting_verification is the gap between work being finished and its outcome being checked.';

GRANT SELECT ON public.founder_operational_health TO service_role;
