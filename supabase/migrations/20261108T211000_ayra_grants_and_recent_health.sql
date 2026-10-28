-- VPS-only AYRA grant register and actionable verification window.
-- Apply to sv_platform only; do not apply this release to the Supabase cloud project.
-- Permission rows start disabled; Control Panel operator authorization is the
-- only access gate for editing them. This table does not grant agent execution.
CREATE TABLE IF NOT EXISTS public.ayra_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name text NOT NULL,
  permission_key text NOT NULL CHECK (permission_key ~ '^allow_[a-z0-9_]+$'),
  is_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ayra_grants_role_permission_key UNIQUE (role_name, permission_key)
);

ALTER TABLE public.ayra_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ayra_grants FROM PUBLIC;
DO $grant_roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE public.ayra_grants FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE public.ayra_grants FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ayra_grants TO service_role';
  END IF;
END
$grant_roles$;

INSERT INTO public.ayra_grants (role_name, permission_key, is_enabled)
VALUES
  ('SUPER_ADMIN', 'allow_system_coding', false),
  ('SUPER_ADMIN', 'allow_hardware_control', false),
  ('SUPER_ADMIN', 'allow_web_portal', false),
  ('SUPER_ADMIN', 'allow_database_read', false),
  ('SUPER_ADMIN', 'allow_database_write', false),
  ('SUPER_ADMIN', 'allow_deployment', false),
  ('SUPER_ADMIN', 'allow_ai_chat', false),
  ('SUPER_ADMIN', 'allow_external_models', false),
  ('SUPER_ADMIN', 'allow_customer_data_access', false),
  ('SUPER_ADMIN', 'allow_agent_reports', false),
  ('SUPER_ADMIN', 'allow_agent_task_write', false),
  ('SUPER_ADMIN', 'allow_automations', false),
  ('FRANCHISE', 'allow_system_coding', false),
  ('FRANCHISE', 'allow_hardware_control', false),
  ('FRANCHISE', 'allow_web_portal', false),
  ('FRANCHISE', 'allow_database_read', false),
  ('FRANCHISE', 'allow_database_write', false),
  ('FRANCHISE', 'allow_deployment', false),
  ('FRANCHISE', 'allow_ai_chat', false),
  ('FRANCHISE', 'allow_external_models', false),
  ('FRANCHISE', 'allow_customer_data_access', false),
  ('FRANCHISE', 'allow_agent_reports', false),
  ('FRANCHISE', 'allow_agent_task_write', false),
  ('FRANCHISE', 'allow_automations', false),
  ('AYRA_AGENT', 'allow_system_coding', false),
  ('AYRA_AGENT', 'allow_hardware_control', false),
  ('AYRA_AGENT', 'allow_web_portal', false),
  ('AYRA_AGENT', 'allow_database_read', false),
  ('AYRA_AGENT', 'allow_database_write', false),
  ('AYRA_AGENT', 'allow_deployment', false),
  ('AYRA_AGENT', 'allow_ai_chat', false),
  ('AYRA_AGENT', 'allow_external_models', false),
  ('AYRA_AGENT', 'allow_customer_data_access', false),
  ('AYRA_AGENT', 'allow_agent_reports', false),
  ('AYRA_AGENT', 'allow_agent_task_write', false),
  ('AYRA_AGENT', 'allow_automations', false)
ON CONFLICT (role_name, permission_key) DO NOTHING;

-- Reduce the live verification tile to the rolling 24-hour review queue.
-- Historical unverified runs remain in ai_agent_runs; they are not erased.
CREATE OR REPLACE VIEW public.founder_operational_health
WITH (security_invoker = true) AS
SELECT
  (SELECT count(*) FROM public.ai_agents WHERE agent_key IS NOT NULL) AS agents_registered,
  (SELECT count(*) FROM public.ai_agents WHERE lifecycle IN ('CONFIGURED','AVAILABLE')) AS agents_open_to_work,
  (SELECT count(*) FROM public.ai_agents WHERE lifecycle = 'BLOCKED') AS agents_blocked,
  (SELECT count(*) FROM public.ai_agents WHERE lifecycle = 'PAUSED') AS agents_paused,
  (SELECT count(*) FROM public.ai_agents
    WHERE agent_key IS NOT NULL AND NOT ('CREATE' = ANY (permissions))) AS agents_cannot_file,
  (SELECT count(*) FROM public.ai_agent_runs WHERE state IN ('RUNNING','WAITING')) AS runs_in_flight,
  (SELECT count(*) FROM public.ai_agent_runs WHERE state = 'BLOCKED') AS runs_blocked,
  (SELECT count(*) FROM public.ai_agent_runs WHERE state = 'FAILED') AS runs_failed,
  (SELECT count(*) FROM public.ai_agent_runs
    WHERE state = 'COMPLETED' AND verification = 'UNVERIFIED'
      AND finished_at >= statement_timestamp() - interval '24 hours'
      AND finished_at <= statement_timestamp()) AS runs_awaiting_verification,
  (SELECT count(*) FROM public.ai_agent_runs WHERE verification = 'FAILED') AS runs_verification_failed,
  (SELECT count(*) FROM public.tm_tasks
    WHERE status IN ('open','available_for_claim','claimed')) AS tasks_queued,
  (SELECT count(*) FROM public.tm_tasks WHERE status = 'in_progress') AS tasks_running,
  (SELECT count(*) FROM public.tm_tasks WHERE status IN ('blocked','on_hold')) AS tasks_blocked,
  (SELECT count(*) FROM public.tm_tasks WHERE status = 'failed') AS tasks_failed,
  (SELECT count(*) FROM public.tm_tasks
    WHERE deadline IS NOT NULL AND deadline < now()
      AND status NOT IN ('completed','approved','closed','cancelled')) AS tasks_overdue,
  (SELECT count(*) FROM public.founder_decisions WHERE state = 'WAITING_APPROVAL') AS decisions_waiting,
  (SELECT count(*) FROM public.founder_decisions WHERE state = 'ESCALATED') AS decisions_escalated,
  (SELECT count(*) FROM public.founder_approvals WHERE state IN ('REQUESTED','VIEWED')) AS approvals_open,
  (SELECT count(*) FROM public.founder_approvals
    WHERE state IN ('REQUESTED','VIEWED') AND expires_at < now()) AS approvals_expired,
  (SELECT count(*) FROM public.founder_attention
    WHERE status IN ('NEW','ACKNOWLEDGED','IN_PROGRESS')) AS attention_open,
  (SELECT count(*) FROM public.founder_attention
    WHERE status IN ('NEW','ACKNOWLEDGED','IN_PROGRESS') AND severity = 'CRITICAL') AS attention_critical,
  (SELECT count(*) FROM public.founder_signal_dispatch WHERE escalated) AS signals_escalated,
  (SELECT count(*) FROM public.founder_ai_requests) AS ai_requests,
  (SELECT count(*) FROM public.founder_ai_requests WHERE outcome <> 'OK') AS ai_requests_failed;

COMMENT ON VIEW public.founder_operational_health IS
  'Founder AI operational health. runs_awaiting_verification counts completed unverified runs finished in the rolling 24-hour window; historical rows remain in ai_agent_runs.';

DO $grant_health$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT SELECT ON public.founder_operational_health TO service_role';
  END IF;
END
$grant_health$;
