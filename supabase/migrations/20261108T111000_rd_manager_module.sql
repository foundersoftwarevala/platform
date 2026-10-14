-- Full owned r-d-manager schema, adapted from b85609dce3b298170b3591837c46e360f3e27e08.
-- Ordered after recovered platform schema. No sample business records are imported.
-- Internal reads use the existing Control Panel identity; source anonymous policies are not copied.

-- Source migration: 0000_rnd_module.sql
CREATE TABLE IF NOT EXISTS public.rnd_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'ai',
  priority text NOT NULL DEFAULT 'medium',
  feasibility integer NOT NULL DEFAULT 0,
  author text NOT NULL DEFAULT 'vala(rnd)0000',
  votes integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'evaluating',
  research_links integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.rnd_ideas TO service_role;
ALTER TABLE public.rnd_ideas ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.rnd_prototypes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  modules text[] NOT NULL DEFAULT '{}',
  progress integer NOT NULL DEFAULT 0,
  estimated_hours integer NOT NULL DEFAULT 0,
  completed_hours integer NOT NULL DEFAULT 0,
  team text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  integrations text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.rnd_prototypes TO service_role;
ALTER TABLE public.rnd_prototypes ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.rnd_impact_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature text NOT NULL,
  revenue_impact text NOT NULL DEFAULT 'medium',
  effort_level text NOT NULL DEFAULT 'medium',
  technical_risk text NOT NULL DEFAULT 'low',
  user_demand integer NOT NULL DEFAULT 0,
  performance_load integer NOT NULL DEFAULT 0,
  maintenance_cost text NOT NULL DEFAULT 'low',
  ai_recommendation text NOT NULL DEFAULT '',
  score_revenue integer NOT NULL DEFAULT 0,
  score_effort integer NOT NULL DEFAULT 0,
  score_risk integer NOT NULL DEFAULT 0,
  score_demand integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.rnd_impact_analyses TO service_role;
ALTER TABLE public.rnd_impact_analyses ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.rnd_trends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  source text NOT NULL DEFAULT 'Industry Analysis',
  impact text NOT NULL DEFAULT 'medium',
  relevance integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'emerging',
  competitors text[] NOT NULL DEFAULT '{}',
  opportunity text NOT NULL DEFAULT '',
  detected_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.rnd_trends TO service_role;
ALTER TABLE public.rnd_trends ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.rnd_market_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gap text NOT NULL,
  potential text NOT NULL DEFAULT 'medium',
  difficulty text NOT NULL DEFAULT 'medium',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.rnd_market_gaps TO service_role;
ALTER TABLE public.rnd_market_gaps ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.rnd_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  source text NOT NULL DEFAULT 'survey',
  sentiment text NOT NULL DEFAULT 'neutral',
  sentiment_score numeric NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'feature_request',
  votes integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'in_review',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.rnd_feedback TO service_role;
ALTER TABLE public.rnd_feedback ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.rnd_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  type text NOT NULL DEFAULT 'feature',
  status text NOT NULL DEFAULT 'pending',
  submitted_by text NOT NULL DEFAULT 'vala(rnd)0000',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  ai_score integer NOT NULL DEFAULT 0,
  votes_approve integer NOT NULL DEFAULT 0,
  votes_reject integer NOT NULL DEFAULT 0,
  votes_hold integer NOT NULL DEFAULT 0,
  estimated_cost integer NOT NULL DEFAULT 0,
  estimated_time text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'medium'
);
GRANT ALL ON public.rnd_decisions TO service_role;
ALTER TABLE public.rnd_decisions ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.rnd_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'idea',
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  read boolean NOT NULL DEFAULT false,
  dismissed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.rnd_notifications TO service_role;
ALTER TABLE public.rnd_notifications ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.rnd_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL,
  total_budget integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.rnd_budgets TO service_role;
ALTER TABLE public.rnd_budgets ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.rnd_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.rnd_budgets(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount integer NOT NULL,
  type text NOT NULL DEFAULT 'deduction',
  status text NOT NULL DEFAULT 'completed',
  occurred_on date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.rnd_transactions TO service_role;
ALTER TABLE public.rnd_transactions ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.rnd_technologies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'tools',
  ring text NOT NULL DEFAULT 'assess',
  description text NOT NULL DEFAULT '',
  relevance integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.rnd_technologies TO service_role;
ALTER TABLE public.rnd_technologies ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.rnd_pipeline_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  stage text NOT NULL DEFAULT 'ideation',
  progress integer NOT NULL DEFAULT 0,
  priority text NOT NULL DEFAULT 'medium',
  assignee text NOT NULL DEFAULT 'vala(rnd)0000',
  due_date date,
  ai_score integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.rnd_pipeline_items TO service_role;
ALTER TABLE public.rnd_pipeline_items ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.rnd_idea_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'General',
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_analysis text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.rnd_idea_evaluations TO service_role;
ALTER TABLE public.rnd_idea_evaluations ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.rnd_ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.rnd_ai_messages TO service_role;
ALTER TABLE public.rnd_ai_messages ENABLE ROW LEVEL SECURITY;

-- Source migration: 0001_pro_manager_module.sql
CREATE TABLE IF NOT EXISTS public.pm_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  product text NOT NULL,
  license text NOT NULL DEFAULT 'Annual',
  region text NOT NULL DEFAULT 'Global',
  tier text NOT NULL DEFAULT 'Standard',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pm_users TO service_role;
ALTER TABLE public.pm_users ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.pm_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_code text NOT NULL,
  product text NOT NULL,
  version text NOT NULL DEFAULT 'v1.0.0',
  modules text[] NOT NULL DEFAULT '{}',
  custom_changes text NOT NULL DEFAULT 'None',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pm_products TO service_role;
ALTER TABLE public.pm_products ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.pm_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_code text NOT NULL,
  license_type text NOT NULL DEFAULT 'Annual',
  domain text NOT NULL DEFAULT '',
  domain_status text NOT NULL DEFAULT 'bound',
  expiry text NOT NULL DEFAULT 'Never',
  transfer_status text NOT NULL DEFAULT 'Not Requested',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pm_licenses TO service_role;
ALTER TABLE public.pm_licenses ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.pm_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  user_code text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'Technical',
  severity text NOT NULL DEFAULT 'Medium',
  product text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'new',
  opened_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pm_tickets TO service_role;
ALTER TABLE public.pm_tickets ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.pm_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  build text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  ai_attempts integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pm_issues TO service_role;
ALTER TABLE public.pm_issues ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.pm_assist_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  user_code text NOT NULL,
  mode text NOT NULL DEFAULT 'View Only',
  duration_minutes integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pm_assist_sessions TO service_role;
ALTER TABLE public.pm_assist_sessions ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.pm_promises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  action text NOT NULL,
  task_code text NOT NULL DEFAULT '',
  developer_code text NOT NULL DEFAULT '',
  owner text NOT NULL DEFAULT 'Support',
  type text NOT NULL DEFAULT 'Feature Delivery',
  deadline timestamptz NOT NULL DEFAULT now(),
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'on_track',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pm_promises TO service_role;
ALTER TABLE public.pm_promises ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.pm_upgrades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  user_code text NOT NULL,
  type text NOT NULL DEFAULT 'Feature Add-on',
  item text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pm_upgrades TO service_role;
ALTER TABLE public.pm_upgrades ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.pm_renewals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  user_code text NOT NULL,
  product text NOT NULL DEFAULT '',
  expiry date NOT NULL DEFAULT CURRENT_DATE,
  grace text NOT NULL DEFAULT '7 days',
  status text NOT NULL DEFAULT 'upcoming',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pm_renewals TO service_role;
ALTER TABLE public.pm_renewals ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.pm_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_code text NOT NULL,
  api_pct integer NOT NULL DEFAULT 0,
  storage_pct integer NOT NULL DEFAULT 0,
  ai_calls_pct integer NOT NULL DEFAULT 0,
  fair_usage_alert boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pm_usage TO service_role;
ALTER TABLE public.pm_usage ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.pm_ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  user_code text NOT NULL,
  topic text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT 'English',
  status text NOT NULL DEFAULT 'active',
  resolution text NOT NULL DEFAULT 'In Progress',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pm_ai_conversations TO service_role;
ALTER TABLE public.pm_ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.pm_ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.pm_ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pm_ai_messages TO service_role;
ALTER TABLE public.pm_ai_messages ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.pm_communication_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  type text NOT NULL DEFAULT 'chat',
  user_code text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pm_communication_logs TO service_role;
ALTER TABLE public.pm_communication_logs ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.pm_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  type text NOT NULL DEFAULT 'sla',
  message text NOT NULL DEFAULT '',
  severity text NOT NULL DEFAULT 'medium',
  acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pm_alerts TO service_role;
ALTER TABLE public.pm_alerts ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.pm_satisfaction (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_code text NOT NULL,
  csat integer NOT NULL DEFAULT 0,
  feedback text NOT NULL DEFAULT '',
  risk text NOT NULL DEFAULT 'low',
  ai_prediction text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pm_satisfaction TO service_role;
ALTER TABLE public.pm_satisfaction ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.pm_compliance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_code text NOT NULL,
  agreement_accepted boolean NOT NULL DEFAULT true,
  violations integer NOT NULL DEFAULT 0,
  legal_flag boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pm_compliance TO service_role;
ALTER TABLE public.pm_compliance ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.pm_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  category text NOT NULL DEFAULT 'system',
  details text NOT NULL DEFAULT '',
  actor text NOT NULL DEFAULT 'System',
  target text NOT NULL DEFAULT '',
  ip text NOT NULL DEFAULT 'Internal',
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pm_audit_logs TO service_role;
ALTER TABLE public.pm_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.pm_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  section text NOT NULL DEFAULT 'notifications',
  enabled boolean NOT NULL DEFAULT true,
  locked boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pm_settings TO service_role;
ALTER TABLE public.pm_settings ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.pm_health_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'healthy',
  value text NOT NULL DEFAULT '',
  trend text NOT NULL DEFAULT 'stable',
  description text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pm_health_metrics TO service_role;
ALTER TABLE public.pm_health_metrics ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.pm_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  source text NOT NULL DEFAULT 'task_manager',
  source_id text NOT NULL DEFAULT '',
  subject text NOT NULL,
  description text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'pending',
  evidence text[] NOT NULL DEFAULT '{}',
  decision_note text NOT NULL DEFAULT '',
  created_by text NOT NULL DEFAULT 'SYSTEM',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pm_escalations TO service_role;
ALTER TABLE public.pm_escalations ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.pm_quality_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  pattern text NOT NULL,
  description text NOT NULL DEFAULT '',
  affected_entity text NOT NULL DEFAULT '',
  entity_type text NOT NULL DEFAULT 'team',
  severity text NOT NULL DEFAULT 'medium',
  suggested_action text NOT NULL DEFAULT '',
  confidence integer NOT NULL DEFAULT 0,
  reasoning text NOT NULL DEFAULT '',
  acknowledged boolean NOT NULL DEFAULT false,
  detected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pm_quality_alerts TO service_role;
ALTER TABLE public.pm_quality_alerts ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.pm_manager_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_code text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'task_manager',
  sla_compliance integer NOT NULL DEFAULT 0,
  escalations_handled integer NOT NULL DEFAULT 0,
  escalations_pending integer NOT NULL DEFAULT 0,
  avg_resolution_time text NOT NULL DEFAULT '0h',
  trend text NOT NULL DEFAULT 'stable',
  status text NOT NULL DEFAULT 'healthy',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pm_manager_metrics TO service_role;
ALTER TABLE public.pm_manager_metrics ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.pm_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  type text NOT NULL DEFAULT 'exception',
  subject text NOT NULL,
  description text NOT NULL DEFAULT '',
  requested_by text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'medium',
  is_financial boolean NOT NULL DEFAULT false,
  amount integer,
  status text NOT NULL DEFAULT 'pending',
  decision_note text NOT NULL DEFAULT '',
  requested_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pm_decisions TO service_role;
ALTER TABLE public.pm_decisions ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.pm_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'daily',
  size text NOT NULL DEFAULT '0 MB',
  generated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pm_reports TO service_role;
ALTER TABLE public.pm_reports ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.pm_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS pm_users_touch ON public.pm_users;
CREATE TRIGGER pm_users_touch BEFORE UPDATE ON public.pm_users FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();
DROP TRIGGER IF EXISTS pm_tickets_touch ON public.pm_tickets;
CREATE TRIGGER pm_tickets_touch BEFORE UPDATE ON public.pm_tickets FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();
DROP TRIGGER IF EXISTS pm_issues_touch ON public.pm_issues;
CREATE TRIGGER pm_issues_touch BEFORE UPDATE ON public.pm_issues FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();
DROP TRIGGER IF EXISTS pm_promises_touch ON public.pm_promises;
CREATE TRIGGER pm_promises_touch BEFORE UPDATE ON public.pm_promises FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();
DROP TRIGGER IF EXISTS pm_upgrades_touch ON public.pm_upgrades;
CREATE TRIGGER pm_upgrades_touch BEFORE UPDATE ON public.pm_upgrades FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();
DROP TRIGGER IF EXISTS pm_renewals_touch ON public.pm_renewals;
CREATE TRIGGER pm_renewals_touch BEFORE UPDATE ON public.pm_renewals FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();
DROP TRIGGER IF EXISTS pm_escalations_touch ON public.pm_escalations;
CREATE TRIGGER pm_escalations_touch BEFORE UPDATE ON public.pm_escalations FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();
DROP TRIGGER IF EXISTS pm_decisions_touch ON public.pm_decisions;
CREATE TRIGGER pm_decisions_touch BEFORE UPDATE ON public.pm_decisions FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();
DROP TRIGGER IF EXISTS pm_assist_touch ON public.pm_assist_sessions;
CREATE TRIGGER pm_assist_touch BEFORE UPDATE ON public.pm_assist_sessions FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();
DROP TRIGGER IF EXISTS pm_quality_touch ON public.pm_quality_alerts;
CREATE TRIGGER pm_quality_touch BEFORE UPDATE ON public.pm_quality_alerts FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();



-- Source migration: 0002_indexes.sql
CREATE INDEX IF NOT EXISTS idx_pm_tickets_opened_at ON public.pm_tickets (opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_pm_tickets_user_code ON public.pm_tickets (user_code);
CREATE INDEX IF NOT EXISTS idx_pm_tickets_status ON public.pm_tickets (status);
CREATE INDEX IF NOT EXISTS idx_pm_issues_created_at ON public.pm_issues (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pm_issues_status ON public.pm_issues (status);
CREATE INDEX IF NOT EXISTS idx_pm_assist_created_at ON public.pm_assist_sessions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pm_assist_user_code ON public.pm_assist_sessions (user_code);
CREATE INDEX IF NOT EXISTS idx_pm_promises_deadline ON public.pm_promises (deadline);
CREATE INDEX IF NOT EXISTS idx_pm_promises_status ON public.pm_promises (status);
CREATE INDEX IF NOT EXISTS idx_pm_upgrades_created_at ON public.pm_upgrades (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pm_upgrades_user_code ON public.pm_upgrades (user_code);
CREATE INDEX IF NOT EXISTS idx_pm_renewals_expiry ON public.pm_renewals (expiry);
CREATE INDEX IF NOT EXISTS idx_pm_renewals_user_code ON public.pm_renewals (user_code);
CREATE INDEX IF NOT EXISTS idx_pm_usage_user_code ON public.pm_usage (user_code);
CREATE INDEX IF NOT EXISTS idx_pm_products_user_code ON public.pm_products (user_code);
CREATE INDEX IF NOT EXISTS idx_pm_licenses_user_code ON public.pm_licenses (user_code);
CREATE INDEX IF NOT EXISTS idx_pm_compliance_user_code ON public.pm_compliance (user_code);
CREATE INDEX IF NOT EXISTS idx_pm_satisfaction_csat ON public.pm_satisfaction (csat DESC);
CREATE INDEX IF NOT EXISTS idx_pm_satisfaction_user_code ON public.pm_satisfaction (user_code);
CREATE INDEX IF NOT EXISTS idx_pm_users_code ON public.pm_users (code);
CREATE INDEX IF NOT EXISTS idx_pm_users_status ON public.pm_users (status);
CREATE INDEX IF NOT EXISTS idx_pm_audit_created_at ON public.pm_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pm_audit_category ON public.pm_audit_logs (category);
CREATE INDEX IF NOT EXISTS idx_pm_comm_created_at ON public.pm_communication_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pm_comm_user_code ON public.pm_communication_logs (user_code);
CREATE INDEX IF NOT EXISTS idx_pm_alerts_created_at ON public.pm_alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pm_alerts_acknowledged ON public.pm_alerts (acknowledged);
CREATE INDEX IF NOT EXISTS idx_pm_escalations_created_at ON public.pm_escalations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pm_escalations_status ON public.pm_escalations (status);
CREATE INDEX IF NOT EXISTS idx_pm_quality_detected_at ON public.pm_quality_alerts (detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_pm_decisions_requested_at ON public.pm_decisions (requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_pm_decisions_status ON public.pm_decisions (status);
CREATE INDEX IF NOT EXISTS idx_pm_reports_generated_at ON public.pm_reports (generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_pm_conversations_created_at ON public.pm_ai_conversations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pm_messages_conversation ON public.pm_ai_messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pm_settings_section ON public.pm_settings (section);
CREATE INDEX IF NOT EXISTS idx_pm_health_code ON public.pm_health_metrics (code);
CREATE INDEX IF NOT EXISTS idx_pm_manager_code ON public.pm_manager_metrics (manager_code);
CREATE INDEX IF NOT EXISTS idx_rnd_ideas_created_at ON public.rnd_ideas (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rnd_ideas_status ON public.rnd_ideas (status);
CREATE INDEX IF NOT EXISTS idx_rnd_ideas_category ON public.rnd_ideas (category);
CREATE INDEX IF NOT EXISTS idx_rnd_ideas_author ON public.rnd_ideas (author);
CREATE INDEX IF NOT EXISTS idx_rnd_prototypes_created_at ON public.rnd_prototypes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rnd_prototypes_status ON public.rnd_prototypes (status);
CREATE INDEX IF NOT EXISTS idx_rnd_impact_created_at ON public.rnd_impact_analyses (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rnd_trends_detected_at ON public.rnd_trends (detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_rnd_market_gaps_created_at ON public.rnd_market_gaps (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rnd_feedback_created_at ON public.rnd_feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rnd_feedback_category ON public.rnd_feedback (category);
CREATE INDEX IF NOT EXISTS idx_rnd_decisions_submitted_at ON public.rnd_decisions (submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_rnd_decisions_status ON public.rnd_decisions (status);
CREATE INDEX IF NOT EXISTS idx_rnd_notifications_created_at ON public.rnd_notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rnd_notifications_dismissed ON public.rnd_notifications (dismissed, read);
CREATE INDEX IF NOT EXISTS idx_rnd_transactions_budget ON public.rnd_transactions (budget_id, occurred_on DESC);
CREATE INDEX IF NOT EXISTS idx_rnd_technologies_ring ON public.rnd_technologies (ring);
CREATE INDEX IF NOT EXISTS idx_rnd_pipeline_stage ON public.rnd_pipeline_items (stage);
CREATE INDEX IF NOT EXISTS idx_rnd_pipeline_created_at ON public.rnd_pipeline_items (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rnd_evaluations_created_at ON public.rnd_idea_evaluations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rnd_ai_messages_session ON public.rnd_ai_messages (session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_rnd_budgets_current ON public.rnd_budgets (is_current);
-- Source migration: 0003_rd_opportunities.sql
CREATE TABLE IF NOT EXISTS public.rd_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_request_id text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('SOFTWARE_ON_DEMAND','SAAS_PARTNERSHIP','BUILD_WITH_US')),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  category text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text NOT NULL DEFAULT '',
  company text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','UNDER_REVIEW','RESEARCHING','FEASIBILITY','EXPERIMENT','POC','VALIDATED','APPROVED','DEVELOPMENT_HANDOFF','PARTNERSHIP','RD_PROJECT','REJECTED','ARCHIVED','DUPLICATE','NEEDS_INFORMATION')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  source text NOT NULL DEFAULT 'public_website',
  assigned_to text NOT NULL DEFAULT '',
  cluster_key text NOT NULL DEFAULT '',
  related_ref text NOT NULL DEFAULT '',
  submitter_fingerprint text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.rd_opportunities TO service_role;
ALTER TABLE public.rd_opportunities ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_rd_opp_created ON public.rd_opportunities (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rd_opp_status ON public.rd_opportunities (status);
CREATE INDEX IF NOT EXISTS idx_rd_opp_type ON public.rd_opportunities (type);
CREATE INDEX IF NOT EXISTS idx_rd_opp_cluster ON public.rd_opportunities (cluster_key);
CREATE INDEX IF NOT EXISTS idx_rd_opp_fp ON public.rd_opportunities (submitter_fingerprint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rd_opp_email ON public.rd_opportunities (lower(contact_email));

CREATE TABLE IF NOT EXISTS public.rd_opportunity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.rd_opportunities(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('created','status_change','priority_change','assigned','note','comment','info_request','evaluation','project_created','partnership_stage','duplicate_link')),
  from_value text NOT NULL DEFAULT '',
  to_value text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  actor text NOT NULL DEFAULT 'R&D Manager',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.rd_opportunity_events TO service_role;
ALTER TABLE public.rd_opportunity_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_rd_events_opp ON public.rd_opportunity_events (opportunity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.rd_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL UNIQUE REFERENCES public.rd_opportunities(id) ON DELETE CASCADE,
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  decision text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  evidence text NOT NULL DEFAULT '',
  research_links text[] NOT NULL DEFAULT '{}',
  decision_reason text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.rd_evaluations TO service_role;
ALTER TABLE public.rd_evaluations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.rd_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.rd_opportunities(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('RESEARCH','POC','DEVELOPMENT_HANDOFF','PARTNERSHIP')),
  name text NOT NULL,
  objective text NOT NULL DEFAULT '',
  research_question text NOT NULL DEFAULT '',
  owner text NOT NULL DEFAULT '',
  team text[] NOT NULL DEFAULT '{}',
  timeline text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  stage text NOT NULL DEFAULT '',
  findings text NOT NULL DEFAULT '',
  results text NOT NULL DEFAULT '',
  recommendation text NOT NULL DEFAULT '',
  acceptance_criteria text NOT NULL DEFAULT '',
  technical_notes text NOT NULL DEFAULT '',
  commercial_terms text NOT NULL DEFAULT '',
  pipeline_item_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.rd_projects TO service_role;
ALTER TABLE public.rd_projects ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_rd_projects_opp ON public.rd_projects (opportunity_id);
CREATE INDEX IF NOT EXISTS idx_rd_projects_created ON public.rd_projects (created_at DESC);

DROP TRIGGER IF EXISTS rd_opp_touch ON public.rd_opportunities;
CREATE TRIGGER rd_opp_touch BEFORE UPDATE ON public.rd_opportunities FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();
DROP TRIGGER IF EXISTS rd_eval_touch ON public.rd_evaluations;
CREATE TRIGGER rd_eval_touch BEFORE UPDATE ON public.rd_evaluations FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();
DROP TRIGGER IF EXISTS rd_proj_touch ON public.rd_projects;
CREATE TRIGGER rd_proj_touch BEFORE UPDATE ON public.rd_projects FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();
-- Source migration: 0004_team_feedback_insights.sql
CREATE TABLE IF NOT EXISTS public.rnd_team_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member text NOT NULL,
  area text NOT NULL DEFAULT 'general',
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.rnd_team_feedback TO service_role;
ALTER TABLE public.rnd_team_feedback ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_rnd_team_feedback_created ON public.rnd_team_feedback (created_at DESC);

CREATE TABLE IF NOT EXISTS public.rnd_feedback_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  summary text NOT NULL DEFAULT '',
  themes jsonb NOT NULL DEFAULT '[]'::jsonb,
  improvements jsonb NOT NULL DEFAULT '[]'::jsonb,
  feedback_count integer NOT NULL DEFAULT 0,
  model text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.rnd_feedback_insights TO service_role;
ALTER TABLE public.rnd_feedback_insights ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_rnd_feedback_insights_created ON public.rnd_feedback_insights (created_at DESC);
-- Source migration: 0005_rd_opportunity_attachments.sql
ALTER TABLE public.rd_opportunities ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
-- Source migration: 0006_rd_team_members.sql
CREATE TABLE IF NOT EXISTS public.rd_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '',
  password_hash text,
  invite_code_hash text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);
GRANT ALL ON public.rd_team_members TO service_role;
ALTER TABLE public.rd_team_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rnd_ideas FROM anon;
GRANT SELECT ON public.rnd_ideas TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.rnd_ideas;
CREATE POLICY rd_module_operator_read ON public.rnd_ideas FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.rnd_prototypes FROM anon;
GRANT SELECT ON public.rnd_prototypes TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.rnd_prototypes;
CREATE POLICY rd_module_operator_read ON public.rnd_prototypes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.rnd_impact_analyses FROM anon;
GRANT SELECT ON public.rnd_impact_analyses TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.rnd_impact_analyses;
CREATE POLICY rd_module_operator_read ON public.rnd_impact_analyses FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.rnd_trends FROM anon;
GRANT SELECT ON public.rnd_trends TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.rnd_trends;
CREATE POLICY rd_module_operator_read ON public.rnd_trends FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.rnd_market_gaps FROM anon;
GRANT SELECT ON public.rnd_market_gaps TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.rnd_market_gaps;
CREATE POLICY rd_module_operator_read ON public.rnd_market_gaps FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.rnd_feedback FROM anon;
GRANT SELECT ON public.rnd_feedback TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.rnd_feedback;
CREATE POLICY rd_module_operator_read ON public.rnd_feedback FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.rnd_decisions FROM anon;
GRANT SELECT ON public.rnd_decisions TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.rnd_decisions;
CREATE POLICY rd_module_operator_read ON public.rnd_decisions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.rnd_notifications FROM anon;
GRANT SELECT ON public.rnd_notifications TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.rnd_notifications;
CREATE POLICY rd_module_operator_read ON public.rnd_notifications FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.rnd_budgets FROM anon;
GRANT SELECT ON public.rnd_budgets TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.rnd_budgets;
CREATE POLICY rd_module_operator_read ON public.rnd_budgets FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.rnd_transactions FROM anon;
GRANT SELECT ON public.rnd_transactions TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.rnd_transactions;
CREATE POLICY rd_module_operator_read ON public.rnd_transactions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.rnd_technologies FROM anon;
GRANT SELECT ON public.rnd_technologies TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.rnd_technologies;
CREATE POLICY rd_module_operator_read ON public.rnd_technologies FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.rnd_pipeline_items FROM anon;
GRANT SELECT ON public.rnd_pipeline_items TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.rnd_pipeline_items;
CREATE POLICY rd_module_operator_read ON public.rnd_pipeline_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.rnd_idea_evaluations FROM anon;
GRANT SELECT ON public.rnd_idea_evaluations TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.rnd_idea_evaluations;
CREATE POLICY rd_module_operator_read ON public.rnd_idea_evaluations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.rnd_ai_messages FROM anon;
GRANT SELECT ON public.rnd_ai_messages TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.rnd_ai_messages;
CREATE POLICY rd_module_operator_read ON public.rnd_ai_messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.pm_users FROM anon;
GRANT SELECT ON public.pm_users TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.pm_users;
CREATE POLICY rd_module_operator_read ON public.pm_users FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.pm_products FROM anon;
GRANT SELECT ON public.pm_products TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.pm_products;
CREATE POLICY rd_module_operator_read ON public.pm_products FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.pm_licenses FROM anon;
GRANT SELECT ON public.pm_licenses TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.pm_licenses;
CREATE POLICY rd_module_operator_read ON public.pm_licenses FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.pm_tickets FROM anon;
GRANT SELECT ON public.pm_tickets TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.pm_tickets;
CREATE POLICY rd_module_operator_read ON public.pm_tickets FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.pm_issues FROM anon;
GRANT SELECT ON public.pm_issues TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.pm_issues;
CREATE POLICY rd_module_operator_read ON public.pm_issues FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.pm_assist_sessions FROM anon;
GRANT SELECT ON public.pm_assist_sessions TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.pm_assist_sessions;
CREATE POLICY rd_module_operator_read ON public.pm_assist_sessions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.pm_promises FROM anon;
GRANT SELECT ON public.pm_promises TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.pm_promises;
CREATE POLICY rd_module_operator_read ON public.pm_promises FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.pm_upgrades FROM anon;
GRANT SELECT ON public.pm_upgrades TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.pm_upgrades;
CREATE POLICY rd_module_operator_read ON public.pm_upgrades FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.pm_renewals FROM anon;
GRANT SELECT ON public.pm_renewals TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.pm_renewals;
CREATE POLICY rd_module_operator_read ON public.pm_renewals FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.pm_usage FROM anon;
GRANT SELECT ON public.pm_usage TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.pm_usage;
CREATE POLICY rd_module_operator_read ON public.pm_usage FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.pm_ai_conversations FROM anon;
GRANT SELECT ON public.pm_ai_conversations TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.pm_ai_conversations;
CREATE POLICY rd_module_operator_read ON public.pm_ai_conversations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.pm_ai_messages FROM anon;
GRANT SELECT ON public.pm_ai_messages TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.pm_ai_messages;
CREATE POLICY rd_module_operator_read ON public.pm_ai_messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.pm_communication_logs FROM anon;
GRANT SELECT ON public.pm_communication_logs TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.pm_communication_logs;
CREATE POLICY rd_module_operator_read ON public.pm_communication_logs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.pm_alerts FROM anon;
GRANT SELECT ON public.pm_alerts TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.pm_alerts;
CREATE POLICY rd_module_operator_read ON public.pm_alerts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.pm_satisfaction FROM anon;
GRANT SELECT ON public.pm_satisfaction TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.pm_satisfaction;
CREATE POLICY rd_module_operator_read ON public.pm_satisfaction FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.pm_compliance FROM anon;
GRANT SELECT ON public.pm_compliance TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.pm_compliance;
CREATE POLICY rd_module_operator_read ON public.pm_compliance FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.pm_audit_logs FROM anon;
GRANT SELECT ON public.pm_audit_logs TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.pm_audit_logs;
CREATE POLICY rd_module_operator_read ON public.pm_audit_logs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.pm_settings FROM anon;
GRANT SELECT ON public.pm_settings TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.pm_settings;
CREATE POLICY rd_module_operator_read ON public.pm_settings FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.pm_health_metrics FROM anon;
GRANT SELECT ON public.pm_health_metrics TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.pm_health_metrics;
CREATE POLICY rd_module_operator_read ON public.pm_health_metrics FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.pm_escalations FROM anon;
GRANT SELECT ON public.pm_escalations TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.pm_escalations;
CREATE POLICY rd_module_operator_read ON public.pm_escalations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.pm_quality_alerts FROM anon;
GRANT SELECT ON public.pm_quality_alerts TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.pm_quality_alerts;
CREATE POLICY rd_module_operator_read ON public.pm_quality_alerts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.pm_manager_metrics FROM anon;
GRANT SELECT ON public.pm_manager_metrics TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.pm_manager_metrics;
CREATE POLICY rd_module_operator_read ON public.pm_manager_metrics FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.pm_decisions FROM anon;
GRANT SELECT ON public.pm_decisions TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.pm_decisions;
CREATE POLICY rd_module_operator_read ON public.pm_decisions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.pm_reports FROM anon;
GRANT SELECT ON public.pm_reports TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.pm_reports;
CREATE POLICY rd_module_operator_read ON public.pm_reports FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.rd_opportunities FROM anon;
GRANT SELECT ON public.rd_opportunities TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.rd_opportunities;
CREATE POLICY rd_module_operator_read ON public.rd_opportunities FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.rd_opportunity_events FROM anon;
GRANT SELECT ON public.rd_opportunity_events TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.rd_opportunity_events;
CREATE POLICY rd_module_operator_read ON public.rd_opportunity_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.rd_evaluations FROM anon;
GRANT SELECT ON public.rd_evaluations TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.rd_evaluations;
CREATE POLICY rd_module_operator_read ON public.rd_evaluations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.rd_projects FROM anon;
GRANT SELECT ON public.rd_projects TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.rd_projects;
CREATE POLICY rd_module_operator_read ON public.rd_projects FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.rnd_team_feedback FROM anon;
GRANT SELECT ON public.rnd_team_feedback TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.rnd_team_feedback;
CREATE POLICY rd_module_operator_read ON public.rnd_team_feedback FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.rnd_feedback_insights FROM anon;
GRANT SELECT ON public.rnd_feedback_insights TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.rnd_feedback_insights;
CREATE POLICY rd_module_operator_read ON public.rnd_feedback_insights FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));
REVOKE ALL ON public.rd_team_members FROM anon;
GRANT SELECT ON public.rd_team_members TO authenticated;
DROP POLICY IF EXISTS rd_module_operator_read ON public.rd_team_members;
CREATE POLICY rd_module_operator_read ON public.rd_team_members FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('boss','boss_owner','admin','super_admin','founder','owner')));

DO $rd_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sv_app') THEN
    GRANT ALL ON public.rnd_ideas, public.rnd_prototypes, public.rnd_impact_analyses, public.rnd_trends, public.rnd_market_gaps, public.rnd_feedback, public.rnd_decisions, public.rnd_notifications, public.rnd_budgets, public.rnd_transactions, public.rnd_technologies, public.rnd_pipeline_items, public.rnd_idea_evaluations, public.rnd_ai_messages, public.pm_users, public.pm_products, public.pm_licenses, public.pm_tickets, public.pm_issues, public.pm_assist_sessions, public.pm_promises, public.pm_upgrades, public.pm_renewals, public.pm_usage, public.pm_ai_conversations, public.pm_ai_messages, public.pm_communication_logs, public.pm_alerts, public.pm_satisfaction, public.pm_compliance, public.pm_audit_logs, public.pm_settings, public.pm_health_metrics, public.pm_escalations, public.pm_quality_alerts, public.pm_manager_metrics, public.pm_decisions, public.pm_reports, public.rd_opportunities, public.rd_opportunity_events, public.rd_evaluations, public.rd_projects, public.rnd_team_feedback, public.rnd_feedback_insights, public.rd_team_members TO sv_app;
  END IF;
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit)
    VALUES ('rd-attachments', 'rd-attachments', false, 10485760)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END
$rd_grants$;
NOTIFY pgrst, 'reload schema';
