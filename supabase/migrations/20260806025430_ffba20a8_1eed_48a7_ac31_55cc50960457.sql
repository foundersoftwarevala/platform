-- Recovered from the Supabase migration history (supabase_migrations.schema_migrations).
-- Already applied in production; committed so the repository carries the full history.

CREATE INDEX IF NOT EXISTS idx_mkt_ad_groups_campaign ON public.marketing_ad_groups (campaign_id);
CREATE INDEX IF NOT EXISTS idx_mkt_ad_groups_spend ON public.marketing_ad_groups (spend DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_creatives_campaign ON public.marketing_creatives (campaign_id);
CREATE INDEX IF NOT EXISTS idx_mkt_creatives_score ON public.marketing_creatives (performance_score DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_schedules_campaign ON public.marketing_schedules (campaign_id);
CREATE INDEX IF NOT EXISTS idx_mkt_schedules_at ON public.marketing_schedules (scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_messages_campaign ON public.marketing_messages (campaign_id);
CREATE INDEX IF NOT EXISTS idx_mkt_social_posts_campaign ON public.marketing_social_posts (campaign_id);
CREATE INDEX IF NOT EXISTS idx_mkt_leads_campaign ON public.marketing_leads (campaign_id);
CREATE INDEX IF NOT EXISTS idx_mkt_leads_source ON public.marketing_leads (source_id);
CREATE INDEX IF NOT EXISTS idx_mkt_leads_created ON public.marketing_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_ai_recs_campaign ON public.marketing_ai_recommendations (campaign_id);
CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_created ON public.marketing_campaigns (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_status ON public.marketing_campaigns (status);
CREATE INDEX IF NOT EXISTS idx_mkt_audit_created ON public.marketing_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_alerts_created ON public.marketing_alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_content_created ON public.marketing_content_items (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_offers_created ON public.marketing_offers (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_seo_keywords_updated ON public.marketing_seo_keywords (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_channel_perf_spend ON public.marketing_channel_performance (spend DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_approvals_requested ON public.marketing_approvals (requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_reports_generated ON public.marketing_reports (generated_at DESC);
ANALYZE public.marketing_campaigns;
ANALYZE public.marketing_creatives;
ANALYZE public.marketing_schedules;
ANALYZE public.marketing_kpi_snapshots;
