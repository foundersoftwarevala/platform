-- Recovered from the Supabase migration history (supabase_migrations.schema_migrations).
-- Already applied in production; committed so the repository carries the full history.

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
-- 1 pages
CREATE TABLE public.seo_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL UNIQUE,
  title text NOT NULL,
  meta_title text,
  meta_description text,
  h1 text,
  canonical_url text,
  word_count integer NOT NULL DEFAULT 0,
  seo_score integer NOT NULL DEFAULT 0,
  index_status text NOT NULL DEFAULT 'indexed',
  page_type text NOT NULL DEFAULT 'page',
  issues_count integer NOT NULL DEFAULT 0,
  last_crawled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- 2 keywords
CREATE TABLE public.seo_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL,
  target_url text,
  position integer,
  previous_position integer,
  search_volume integer NOT NULL DEFAULT 0,
  difficulty integer NOT NULL DEFAULT 0,
  cpc numeric(10,2) NOT NULL DEFAULT 0,
  intent text NOT NULL DEFAULT 'informational',
  industry text,
  country text,
  region text NOT NULL DEFAULT 'global',
  status text NOT NULL DEFAULT 'tracking',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (keyword, country)
);
-- 3 ranking history
CREATE TABLE public.seo_keyword_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id uuid NOT NULL REFERENCES public.seo_keywords(id) ON DELETE CASCADE,
  recorded_on date NOT NULL,
  position integer NOT NULL,
  clicks integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (keyword_id, recorded_on)
);
-- 4 meta rules
CREATE TABLE public.seo_meta_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url_pattern text NOT NULL,
  title_template text NOT NULL,
  description_template text NOT NULL,
  og_image_template text,
  priority integer NOT NULL DEFAULT 10,
  applies_to integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- 5 indexing
CREATE TABLE public.seo_indexing_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  source text NOT NULL DEFAULT 'sitemap',
  crawl_status text NOT NULL DEFAULT 'crawled',
  index_state text NOT NULL DEFAULT 'indexed',
  http_status integer NOT NULL DEFAULT 200,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  last_crawled_at timestamptz,
  indexed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- 6 performance metrics
CREATE TABLE public.seo_performance_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_on date NOT NULL UNIQUE,
  clicks integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  ctr numeric(6,3) NOT NULL DEFAULT 0,
  avg_position numeric(6,2) NOT NULL DEFAULT 0,
  organic_sessions integer NOT NULL DEFAULT 0,
  conversions integer NOT NULL DEFAULT 0,
  lcp_ms integer NOT NULL DEFAULT 0,
  inp_ms integer NOT NULL DEFAULT 0,
  cls numeric(5,3) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- 7 automations + runs
CREATE TABLE public.seo_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  automation_type text NOT NULL,
  description text,
  schedule text NOT NULL DEFAULT 'daily',
  status text NOT NULL DEFAULT 'active',
  last_run_at timestamptz,
  next_run_at timestamptz,
  runs_count integer NOT NULL DEFAULT 0,
  success_rate numeric(5,2) NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.seo_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.seo_automations(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'success',
  items_processed integer NOT NULL DEFAULT 0,
  message text
);
-- 8 issues
CREATE TABLE public.seo_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_url text NOT NULL,
  issue_type text NOT NULL,
  category text NOT NULL DEFAULT 'on-page',
  severity text NOT NULL DEFAULT 'medium',
  description text NOT NULL,
  fix_suggestion text,
  status text NOT NULL DEFAULT 'open',
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- 9 reports
CREATE TABLE public.seo_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  report_type text NOT NULL DEFAULT 'monthly',
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'ready',
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- 10 audits
CREATE TABLE public.seo_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'completed',
  score integer NOT NULL DEFAULT 0,
  pages_crawled integer NOT NULL DEFAULT 0,
  issues_found integer NOT NULL DEFAULT 0,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- 11 backlinks
CREATE TABLE public.seo_backlinks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_domain text NOT NULL,
  source_url text NOT NULL,
  target_url text NOT NULL,
  anchor_text text,
  domain_authority integer NOT NULL DEFAULT 0,
  link_type text NOT NULL DEFAULT 'dofollow',
  status text NOT NULL DEFAULT 'active',
  spam_score integer NOT NULL DEFAULT 0,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- 12 competitors + gaps
CREATE TABLE public.seo_competitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  domain text NOT NULL UNIQUE,
  region text NOT NULL DEFAULT 'global',
  visibility_score numeric(5,2) NOT NULL DEFAULT 0,
  keywords_count integer NOT NULL DEFAULT 0,
  backlinks_count integer NOT NULL DEFAULT 0,
  traffic_estimate integer NOT NULL DEFAULT 0,
  domain_authority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.seo_competitor_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id uuid NOT NULL REFERENCES public.seo_competitors(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  their_position integer,
  our_position integer,
  search_volume integer NOT NULL DEFAULT 0,
  opportunity text NOT NULL DEFAULT 'medium',
  created_at timestamptz NOT NULL DEFAULT now()
);
-- 13 ai suggestions
CREATE TABLE public.seo_ai_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL DEFAULT 'page',
  target_ref text,
  title text NOT NULL,
  suggestion text NOT NULL,
  impact text NOT NULL DEFAULT 'medium',
  confidence integer NOT NULL DEFAULT 80,
  status text NOT NULL DEFAULT 'pending',
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- 14 content
CREATE TABLE public.seo_content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content_type text NOT NULL DEFAULT 'blog',
  target_keyword text,
  body text,
  word_count integer NOT NULL DEFAULT 0,
  seo_score integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  url text,
  model text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- 15 technical checks
CREATE TABLE public.seo_technical_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'crawlability',
  status text NOT NULL DEFAULT 'pass',
  detail text,
  affected_urls integer NOT NULL DEFAULT 0,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- 16 alerts
CREATE TABLE public.seo_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  category text NOT NULL DEFAULT 'technical',
  severity text NOT NULL DEFAULT 'info',
  acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- 17 leads
CREATE TABLE public.seo_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  company text,
  email text NOT NULL,
  phone text,
  country text,
  source_channel text NOT NULL DEFAULT 'organic',
  source_keyword text,
  landing_url text,
  score integer NOT NULL DEFAULT 0,
  stage text NOT NULL DEFAULT 'new',
  estimated_value numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- 18 ad campaigns
CREATE TABLE public.seo_ad_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  channel text NOT NULL DEFAULT 'google',
  status text NOT NULL DEFAULT 'active',
  budget numeric(12,2) NOT NULL DEFAULT 0,
  spend numeric(12,2) NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  conversions integer NOT NULL DEFAULT 0,
  cpa numeric(10,2) NOT NULL DEFAULT 0,
  roas numeric(6,2) NOT NULL DEFAULT 0,
  starts_on date,
  ends_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- 19 email campaigns
CREATE TABLE public.seo_email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  segment text NOT NULL DEFAULT 'all',
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  sent_count integer NOT NULL DEFAULT 0,
  opened_count integer NOT NULL DEFAULT 0,
  clicked_count integer NOT NULL DEFAULT 0,
  replied_count integer NOT NULL DEFAULT 0,
  scheduled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- 20 social posts
CREATE TABLE public.seo_social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  content text NOT NULL,
  link_url text,
  status text NOT NULL DEFAULT 'scheduled',
  scheduled_at timestamptz,
  published_at timestamptz,
  impressions integer NOT NULL DEFAULT 0,
  engagements integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- 21 social comments
CREATE TABLE public.seo_social_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  author text NOT NULL,
  comment text NOT NULL,
  sentiment text NOT NULL DEFAULT 'neutral',
  auto_reply text,
  status text NOT NULL DEFAULT 'pending',
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- 22 inbox messages
CREATE TABLE public.seo_inbox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL DEFAULT 'website',
  contact_name text NOT NULL,
  contact_handle text,
  message text NOT NULL,
  auto_reply text,
  status text NOT NULL DEFAULT 'unread',
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- 23 automation flows
CREATE TABLE public.seo_automation_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trigger_event text NOT NULL,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  executions integer NOT NULL DEFAULT 0,
  conversion_rate numeric(5,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- 24 reels
CREATE TABLE public.seo_reels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  prompt text NOT NULL,
  script text,
  platform text NOT NULL DEFAULT 'instagram',
  duration_seconds integer NOT NULL DEFAULT 30,
  status text NOT NULL DEFAULT 'draft',
  views integer NOT NULL DEFAULT 0,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- 25 integrations
CREATE TABLE public.seo_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE,
  display_name text NOT NULL,
  category text NOT NULL DEFAULT 'analytics',
  status text NOT NULL DEFAULT 'disconnected',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- 26 regions
CREATE TABLE public.seo_regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  region_group text NOT NULL DEFAULT 'global',
  flag text,
  keywords_count integer NOT NULL DEFAULT 0,
  traffic_share numeric(5,2) NOT NULL DEFAULT 0,
  growth_pct numeric(6,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- 27 page behaviour
CREATE TABLE public.seo_page_behavior (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_url text NOT NULL,
  recorded_on date NOT NULL,
  sessions integer NOT NULL DEFAULT 0,
  avg_time_seconds integer NOT NULL DEFAULT 0,
  scroll_depth_pct integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  rage_clicks integer NOT NULL DEFAULT 0,
  bounce_rate numeric(5,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_url, recorded_on)
);
-- 28 spam events
CREATE TABLE public.seo_spam_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_ip text NOT NULL,
  event_type text NOT NULL,
  detail text,
  country text,
  blocked boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- 29 product seo library
CREATE TABLE public.seo_product_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name text NOT NULL,
  category text NOT NULL DEFAULT 'software',
  target_keywords text[] NOT NULL DEFAULT '{}',
  meta_title text,
  meta_description text,
  structured_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'seo_pages','seo_keywords','seo_keyword_rankings','seo_meta_rules','seo_indexing_records',
    'seo_performance_metrics','seo_automations','seo_automation_runs','seo_issues','seo_reports',
    'seo_audits','seo_backlinks','seo_competitors','seo_competitor_gaps','seo_ai_suggestions',
    'seo_content_items','seo_technical_checks','seo_alerts','seo_leads','seo_ad_campaigns',
    'seo_email_campaigns','seo_social_posts','seo_social_comments','seo_inbox_messages',
    'seo_automation_flows','seo_reels','seo_integrations','seo_regions','seo_page_behavior',
    'seo_spam_events','seo_product_entries'
  ] LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated;', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role;', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY "Public read %1$s" ON public.%1$I FOR SELECT USING (true);', t);
  END LOOP;
END $$;
CREATE TRIGGER trg_pages_updated BEFORE UPDATE ON public.seo_pages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_keywords_updated BEFORE UPDATE ON public.seo_keywords FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_issues_updated BEFORE UPDATE ON public.seo_issues FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_content_updated BEFORE UPDATE ON public.seo_content_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
