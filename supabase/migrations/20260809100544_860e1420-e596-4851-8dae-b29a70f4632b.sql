CREATE TABLE public.ai_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  category text NOT NULL DEFAULT 'ai',
  status text NOT NULL DEFAULT 'active',
  base_url text,
  region text NOT NULL DEFAULT 'global',
  docs_url text,
  monthly_cost_usd numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.api_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  provider_id uuid REFERENCES public.ai_providers(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'external',
  category text NOT NULL DEFAULT 'general',
  status text NOT NULL DEFAULT 'active',
  endpoint_url text,
  health_status text NOT NULL DEFAULT 'unknown',
  uptime_pct numeric(5,2) NOT NULL DEFAULT 100,
  avg_latency_ms integer NOT NULL DEFAULT 0,
  version text NOT NULL DEFAULT 'v1',
  owner_team text NOT NULL DEFAULT 'Platform',
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  provider_id uuid REFERENCES public.ai_providers(id) ON DELETE SET NULL,
  service_id uuid REFERENCES public.api_services(id) ON DELETE SET NULL,
  environment text NOT NULL DEFAULT 'production',
  key_prefix text NOT NULL DEFAULT 'sv',
  last_four text NOT NULL DEFAULT '0000',
  fingerprint text NOT NULL,
  secret_encrypted text,
  scopes text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  rotation_days integer NOT NULL DEFAULT 90,
  last_rotated_at timestamptz,
  expires_at timestamptz,
  last_used_at timestamptz,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES public.ai_providers(id) ON DELETE SET NULL,
  name text NOT NULL,
  model_id text NOT NULL UNIQUE,
  modality text NOT NULL DEFAULT 'text',
  context_window integer NOT NULL DEFAULT 128000,
  input_cost_per_1k numeric(10,5) NOT NULL DEFAULT 0,
  output_cost_per_1k numeric(10,5) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  latency_ms integer NOT NULL DEFAULT 0,
  quality_score numeric(4,1) NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  purpose text NOT NULL,
  model_id uuid REFERENCES public.ai_models(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  system_prompt text NOT NULL DEFAULT '',
  temperature numeric(3,2) NOT NULL DEFAULT 0.7,
  max_tokens integer NOT NULL DEFAULT 2048,
  tools jsonb NOT NULL DEFAULT '[]'::jsonb,
  runs_30d integer NOT NULL DEFAULT 0,
  success_rate numeric(5,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.api_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  provider_id uuid REFERENCES public.ai_providers(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'general',
  status text NOT NULL DEFAULT 'connected',
  direction text NOT NULL DEFAULT 'outbound',
  auth_type text NOT NULL DEFAULT 'api_key',
  webhook_url text,
  last_sync_at timestamptz,
  sync_frequency text NOT NULL DEFAULT 'realtime',
  error_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.product_apis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product text NOT NULL,
  service_id uuid REFERENCES public.api_services(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  quota_monthly integer NOT NULL DEFAULT 100000,
  used_this_month integer NOT NULL DEFAULT 0,
  plan text NOT NULL DEFAULT 'standard',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.role_api_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name text NOT NULL,
  service_id uuid REFERENCES public.api_services(id) ON DELETE CASCADE,
  can_read boolean NOT NULL DEFAULT true,
  can_write boolean NOT NULL DEFAULT false,
  can_admin boolean NOT NULL DEFAULT false,
  rate_limit_per_min integer NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid REFERENCES public.api_services(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'global',
  window_seconds integer NOT NULL DEFAULT 60,
  max_requests integer NOT NULL DEFAULT 1000,
  burst integer NOT NULL DEFAULT 100,
  current_usage integer NOT NULL DEFAULT 0,
  action_on_exceed text NOT NULL DEFAULT 'throttle',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  service_id uuid REFERENCES public.api_services(id) ON DELETE SET NULL,
  model_id uuid REFERENCES public.ai_models(id) ON DELETE SET NULL,
  product text NOT NULL DEFAULT 'platform',
  requests integer NOT NULL DEFAULT 1,
  tokens_in integer NOT NULL DEFAULT 0,
  tokens_out integer NOT NULL DEFAULT 0,
  cost_usd numeric(12,6) NOT NULL DEFAULT 0,
  latency_ms integer NOT NULL DEFAULT 0,
  status_code integer NOT NULL DEFAULT 200,
  success boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'app'
);
CREATE INDEX usage_events_occurred_idx ON public.usage_events (occurred_at DESC);

CREATE TABLE public.usage_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day date NOT NULL,
  service_id uuid REFERENCES public.api_services(id) ON DELETE CASCADE,
  model_id uuid REFERENCES public.ai_models(id) ON DELETE SET NULL,
  requests integer NOT NULL DEFAULT 0,
  tokens integer NOT NULL DEFAULT 0,
  cost_usd numeric(12,4) NOT NULL DEFAULT 0,
  errors integer NOT NULL DEFAULT 0,
  avg_latency_ms integer NOT NULL DEFAULT 0,
  UNIQUE (day, service_id, model_id)
);

CREATE TABLE public.billing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  provider_id uuid REFERENCES public.ai_providers(id) ON DELETE SET NULL,
  billing_cycle text NOT NULL DEFAULT 'monthly',
  included_requests integer NOT NULL DEFAULT 0,
  overage_per_1k numeric(10,4) NOT NULL DEFAULT 0,
  monthly_fee numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'active',
  renewal_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  provider_id uuid REFERENCES public.ai_providers(id) ON DELETE SET NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  amount_usd numeric(12,2) NOT NULL DEFAULT 0,
  tax_usd numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  issued_at date NOT NULL DEFAULT CURRENT_DATE,
  due_at date,
  paid_at date
);

CREATE TABLE public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  balance numeric(14,2) NOT NULL DEFAULT 0,
  low_balance_threshold numeric(14,2) NOT NULL DEFAULT 100,
  auto_topup boolean NOT NULL DEFAULT false,
  auto_topup_amount numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid REFERENCES public.wallets(id) ON DELETE CASCADE,
  type text NOT NULL,
  amount numeric(14,2) NOT NULL,
  balance_after numeric(14,2) NOT NULL DEFAULT 0,
  reference text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cost_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'optimization',
  detail text NOT NULL DEFAULT '',
  estimated_monthly_saving numeric(12,2) NOT NULL DEFAULT 0,
  effort text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  service_id uuid REFERENCES public.api_services(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.api_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  service_id uuid REFERENCES public.api_services(id) ON DELETE SET NULL,
  method text NOT NULL DEFAULT 'GET',
  path text NOT NULL DEFAULT '/',
  status_code integer NOT NULL DEFAULT 200,
  latency_ms integer NOT NULL DEFAULT 0,
  ip text,
  user_agent text,
  request_id text,
  error_message text
);
CREATE INDEX api_request_logs_occurred_idx ON public.api_request_logs (occurred_at DESC);

CREATE TABLE public.ai_decision_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  agent_id uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  model_id uuid REFERENCES public.ai_models(id) ON DELETE SET NULL,
  decision text NOT NULL,
  confidence numeric(5,2) NOT NULL DEFAULT 0,
  input_summary text,
  output_summary text,
  tokens integer NOT NULL DEFAULT 0,
  cost_usd numeric(12,6) NOT NULL DEFAULT 0,
  outcome text NOT NULL DEFAULT 'accepted'
);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor text NOT NULL DEFAULT 'system',
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  severity text NOT NULL DEFAULT 'info',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text
);
CREATE INDEX audit_logs_occurred_idx ON public.audit_logs (occurred_at DESC);

CREATE TABLE public.security_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  detected_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  category text NOT NULL DEFAULT 'access',
  source text NOT NULL DEFAULT 'gateway',
  status text NOT NULL DEFAULT 'open',
  description text,
  resolved_at timestamptz
);

CREATE TABLE public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  severity text NOT NULL DEFAULT 'sev3',
  status text NOT NULL DEFAULT 'open',
  started_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  impact text,
  root_cause text,
  service_id uuid REFERENCES public.api_services(id) ON DELETE SET NULL,
  postmortem_url text
);

CREATE TABLE public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trigger_type text NOT NULL DEFAULT 'threshold',
  condition jsonb NOT NULL DEFAULT '{}'::jsonb,
  action_type text NOT NULL DEFAULT 'notify',
  action_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  run_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.emergency_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  engaged boolean NOT NULL DEFAULT false,
  engaged_at timestamptz,
  engaged_by text,
  scope text NOT NULL DEFAULT 'global'
);

CREATE TABLE public.prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  category text NOT NULL DEFAULT 'general',
  current_version integer NOT NULL DEFAULT 1,
  owner text NOT NULL DEFAULT 'AI Platform',
  status text NOT NULL DEFAULT 'active',
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid REFERENCES public.prompts(id) ON DELETE CASCADE,
  version integer NOT NULL,
  content text NOT NULL,
  notes text,
  is_active boolean NOT NULL DEFAULT false,
  created_by text NOT NULL DEFAULT 'AI Platform',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fine_tuning_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  base_model text NOT NULL,
  dataset_name text NOT NULL,
  dataset_rows integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'queued',
  progress integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  cost_usd numeric(12,2) NOT NULL DEFAULT 0,
  result_model_id text,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.model_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid REFERENCES public.ai_models(id) ON DELETE CASCADE,
  suite text NOT NULL,
  metric text NOT NULL,
  score numeric(6,2) NOT NULL DEFAULT 0,
  baseline numeric(6,2) NOT NULL DEFAULT 0,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'passed',
  notes text
);

CREATE TABLE public.safety_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'content',
  severity_threshold text NOT NULL DEFAULT 'medium',
  action text NOT NULL DEFAULT 'block',
  enabled boolean NOT NULL DEFAULT true,
  violations_30d integer NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.data_governance_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  data_class text NOT NULL DEFAULT 'internal',
  region text NOT NULL DEFAULT 'global',
  retention_days integer NOT NULL DEFAULT 365,
  masking text NOT NULL DEFAULT 'none',
  encryption text NOT NULL DEFAULT 'aes-256',
  compliance_tags text[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.on_device_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  framework text NOT NULL DEFAULT 'onnx',
  size_mb numeric(10,2) NOT NULL DEFAULT 0,
  platforms text[] NOT NULL DEFAULT '{}',
  version text NOT NULL DEFAULT '1.0.0',
  status text NOT NULL DEFAULT 'published',
  downloads integer NOT NULL DEFAULT 0,
  accuracy numeric(5,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.model_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid REFERENCES public.ai_models(id) ON DELETE CASCADE,
  version text NOT NULL,
  stage text NOT NULL DEFAULT 'production',
  released_at date,
  deprecate_at date,
  retire_at date,
  notes text
);

CREATE TABLE public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  value text NOT NULL DEFAULT '',
  value_type text NOT NULL DEFAULT 'text',
  category text NOT NULL DEFAULT 'general',
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.error_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL CHECK (source IN ('server_fn','client','ssr')),
  severity text NOT NULL DEFAULT 'error',
  fingerprint text NOT NULL,
  message text NOT NULL,
  stack text,
  route text,
  fn_name text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX error_events_occurred_at_idx ON public.error_events (occurred_at DESC);
CREATE INDEX error_events_fingerprint_idx ON public.error_events (fingerprint);

CREATE TABLE public.router_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  pattern text NOT NULL,
  target_model text NOT NULL,
  fallback_model text,
  priority text NOT NULL DEFAULT 'medium',
  active boolean NOT NULL DEFAULT true,
  matches_30d integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cache_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL,
  model text NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  cost_saved_usd numeric NOT NULL DEFAULT 0,
  ttl_hours integer NOT NULL DEFAULT 24,
  size_kb numeric NOT NULL DEFAULT 0,
  last_hit_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.failover_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  from_model text NOT NULL,
  to_model text NOT NULL,
  reason text NOT NULL,
  extra_latency_ms integer NOT NULL DEFAULT 0,
  result text NOT NULL DEFAULT 'success'
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ai_providers','api_services','api_keys','ai_models','ai_agents','api_integrations',
    'product_apis','role_api_permissions','rate_limits','usage_events','usage_daily',
    'billing_plans','invoices','wallets','wallet_transactions','cost_recommendations',
    'api_request_logs','ai_decision_logs','audit_logs','security_alerts','incidents',
    'automation_rules','emergency_controls','prompts','prompt_versions','fine_tuning_jobs',
    'model_evaluations','safety_policies','data_governance_rules','on_device_models',
    'model_versions','system_settings','error_events','router_rules','cache_entries','failover_events'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

CREATE POLICY "service role manages error events"
ON public.error_events FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE TABLE public.extensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  vendor text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  description text,
  version text NOT NULL DEFAULT '1.0.0',
  docs_url text,
  webhook_url text,
  base_url text,
  scopes text[] NOT NULL DEFAULT '{}',
  price_usd_month numeric(10,2) NOT NULL DEFAULT 0,
  is_official boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'available',
  install_count integer NOT NULL DEFAULT 0,
  rating numeric(3,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.extension_installs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extension_id uuid NOT NULL REFERENCES public.extensions(id) ON DELETE CASCADE,
  product text NOT NULL DEFAULT 'platform',
  environment text NOT NULL DEFAULT 'production',
  status text NOT NULL DEFAULT 'active',
  health text NOT NULL DEFAULT 'healthy',
  granted_scopes text[] NOT NULL DEFAULT '{}',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  installed_by text NOT NULL DEFAULT 'console',
  monthly_cost_usd numeric(12,2) NOT NULL DEFAULT 0,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.extension_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extension_id uuid REFERENCES public.extensions(id) ON DELETE CASCADE,
  install_id uuid REFERENCES public.extension_installs(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'success',
  message text,
  latency_ms integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_extension_installs_extension ON public.extension_installs(extension_id);
CREATE INDEX idx_extension_events_extension ON public.extension_events(extension_id);
CREATE INDEX idx_extension_events_occurred ON public.extension_events(occurred_at DESC);

GRANT SELECT ON public.extensions TO authenticated;
GRANT ALL ON public.extensions TO service_role;
GRANT ALL ON public.extension_installs TO service_role;
GRANT ALL ON public.extension_events TO service_role;

ALTER TABLE public.extensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extension_installs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extension_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Extensions catalog readable by console users" ON public.extensions FOR SELECT TO authenticated USING (true);

CREATE TRIGGER update_extensions_updated_at BEFORE UPDATE ON public.extensions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_extension_installs_updated_at BEFORE UPDATE ON public.extension_installs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.extensions (slug, name, vendor, category, description, version, docs_url, base_url, scopes, price_usd_month, is_official, status) VALUES
('stripe-payments','Stripe Payments','Stripe','payments','Card, UPI and wallet collection with automatic reconciliation into the billing engine.','2024-11-20','https://docs.stripe.com/api','https://api.stripe.com','{payments.read,payments.write,invoices.write}',0,true,'available'),
('razorpay-upi','Razorpay UPI','Razorpay','payments','UPI intent, collect and mandate flows for wallet top-ups in India.','1.8.4','https://razorpay.com/docs/api/','https://api.razorpay.com','{wallet.write,payments.read}',0,true,'available'),
('twilio-messaging','Twilio Messaging','Twilio','messaging','Programmable SMS and WhatsApp delivery with per-message cost attribution.','2010-04-01','https://www.twilio.com/docs/usage/api','https://api.twilio.com','{messaging.send,usage.write}',0,true,'available'),
('sendgrid-email','SendGrid Email','Twilio SendGrid','messaging','Transactional email delivery, bounce handling and template management.','3.0.0','https://www.twilio.com/docs/sendgrid/api-reference','https://api.sendgrid.com','{email.send,email.read}',0,false,'available'),
('sentry-errors','Sentry Error Tracking','Functional Software','monitoring','Streams runtime exceptions from the console into the error monitoring module.','8.0.0','https://docs.sentry.io/api/','https://sentry.io/api/0','{errors.write,incidents.write}',26.00,false,'available'),
('datadog-apm','Datadog APM','Datadog','monitoring','Latency, throughput and error-rate metrics for every registered API service.','v1','https://docs.datadoghq.com/api/latest/','https://api.datadoghq.com/api/v1','{monitoring.read,monitoring.write}',31.00,false,'available'),
('slack-alerts','Slack Alerts','Slack','automation','Routes wallet, cost-spike and security alerts to Slack channels.','2.0','https://api.slack.com/web','https://slack.com/api','{alerts.read,notifications.send}',0,true,'available'),
('github-deploy','GitHub Deployments','GitHub','automation','Links deployments and model version releases to repository commits.','2022-11-28','https://docs.github.com/en/rest','https://api.github.com','{deployments.read,audit.write}',0,false,'available'),
('hubspot-crm','HubSpot CRM','HubSpot','crm','Syncs resellers and franchise accounts with CRM contacts and deals.','v3','https://developers.hubspot.com/docs/api/overview','https://api.hubapi.com','{customers.read,customers.write}',45.00,false,'available'),
('aws-s3-storage','AWS S3 Storage','Amazon Web Services','storage','Archives request logs, invoices and export bundles to object storage.','2006-03-01','https://docs.aws.amazon.com/AmazonS3/latest/API/','https://s3.amazonaws.com','{storage.read,storage.write,audit.read}',12.00,false,'available'),
('cloudflare-waf','Cloudflare WAF','Cloudflare','security','IP and region restriction sync plus abuse-rule enforcement at the edge.','v4','https://developers.cloudflare.com/api/','https://api.cloudflare.com/client/v4','{security.read,security.write}',20.00,false,'available'),
('zapier-workflows','Zapier Workflows','Zapier','automation','No-code automations triggered by console events and thresholds.','v1','https://docs.zapier.com/platform/home','https://api.zapier.com/v1','{automation.read,automation.write}',19.00,false,'available');