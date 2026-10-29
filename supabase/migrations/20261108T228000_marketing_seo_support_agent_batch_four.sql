-- Batch 4 marketing, SEO, support, and reporting contracts.
-- VPS sv_platform only. All agent writes are governed ai_agent_runs records.

UPDATE public.ai_agents
   SET task_contract = CASE agent_key
     WHEN 'mon-seo' THEN 'Inspect up to 100 visible, published marketplace products using actual name, description, tags, search_keywords and catalog data. Report missing title/description/keyword fields and keyword coverage gaps in ai_agent_runs. Read-only; do not rewrite product content.'
     WHEN 'mon-social' THEN 'Read only recent public.seo_social_comments mentioning Software Vala (last 7 days). Report counts of negative sentiment and pending/escalated comments in ai_agent_runs. Never auto-reply or contact users.'
     WHEN 'mon-content' THEN 'Read-only audit up to 100 visible, published catalog pages for missing product name, description, thumbnail, or cover image. Report counts and bounded product IDs in ai_agent_runs. This is catalog metadata validation, not a live browser crawl; never edit content.'
     WHEN 'mon-reputation' THEN 'Read up to three new published marketplace reviews rated below 3 with no seller response. Use local Ollama to draft a calm, polite response for human review and record it only in this governed ai_agent_runs result. Never publish or send the reply.'
     WHEN 'mon-complaint' THEN 'Read unresolved support tickets with priority critical/high (the schema has no urgent tag). Record counts and bounded ticket references for immediate human attention in ai_agent_runs. Do not change ticket state or notify customers.'
     WHEN 'mon-refund' THEN 'Read pending marketplace refund requests with their order totals. No authoritative refund-policy table/source is connected, so report policy_verdict=requires_human_policy_review; never approve, deny, or process a refund.'
     WHEN 'mon-customer' THEN 'Aggregate profiles with last_seen_at at least 30 days old; treat these as inactive accounts, not verified paying customers. Draft one generic “We miss you” email for internal review and store only the draft/count in ai_agent_runs. Never access or send email addresses.'
     WHEN 'mon-conversion' THEN 'Read aggregate analytics_events and marketplace_orders checkout/cart signals for the last 7 days. Report observed counts only; without a validated user/session-linked funnel do not claim drop-offs or attribute lost checkouts. Save suggested instrumentation/improvement notes in ai_agent_runs.'
     WHEN 'mon-campaign' THEN 'Read active marketing_campaigns metrics (impressions, clicks, conversions, leads) and report campaigns with zero recorded leads. No campaign writes or claims beyond recorded fields.'
     WHEN 'mon-competitor' THEN 'Read stored public.seo_competitors snapshot metadata and freshness only. No competitor pricing URL or verified live fetch workflow exists; report that pricing changes are unverified and do not simulate observations.'
     WHEN 'mon-pricing' THEN 'Read active marketplace_product_pricing rows for visible products; report zero/non-positive amounts and currencies. Read-only; do not alter prices.'
     WHEN 'mon-marketing-monitor' THEN 'Read active marketing_content_items of type banner and validate recorded Software Vala same-origin links only when a destination URL is present. If no banner URL field/data exists, report the check as unavailable; never rewrite banners.'
     WHEN 'mon-knowledge-monitor' THEN 'Read published FAQs and inspect bounded HTTP(S) links using the SSRF-guarded fetch helper; report empty answers and verified broken links in ai_agent_runs. Never edit FAQ content.'
     WHEN 'mon-notification' THEN 'Read-only aggregate recent email_outbox delivery states and failures. Do not send test email/SMS or call external providers; report notification API testing unavailable because no safe test API is configured.'
     WHEN 'reporting' THEN 'Aggregate current VPS database-day new leads, paid non-deleted marketplace orders, and support tickets created. Record counts and order totals grouped by currency in ai_agent_runs; never combine currencies or expose customer data.'
   END,
       status = 'active',
       lifecycle = 'AVAILABLE',
       blocked_reason = NULL
 WHERE agent_key IN (
    'mon-seo',
    'mon-social',
    'mon-content',
    'mon-reputation',
    'mon-complaint',
    'mon-refund',
    'mon-customer',
    'mon-conversion',
    'mon-campaign',
    'mon-competitor',
    'mon-pricing',
    'mon-marketing-monitor',
    'mon-knowledge-monitor',
    'mon-notification',
    'reporting'
 );

DO $$
DECLARE
  missing text[];
BEGIN
  SELECT array_agg(expected.agent_key)
    INTO missing
    FROM (VALUES
      ('mon-seo'),
      ('mon-social'),
      ('mon-content'),
      ('mon-reputation'),
      ('mon-complaint'),
      ('mon-refund'),
      ('mon-customer'),
      ('mon-conversion'),
      ('mon-campaign'),
      ('mon-competitor'),
      ('mon-pricing'),
      ('mon-marketing-monitor'),
      ('mon-knowledge-monitor'),
      ('mon-notification'),
      ('reporting')
    ) AS expected(agent_key)
   WHERE NOT EXISTS (
     SELECT 1 FROM public.ai_agents a
      WHERE a.agent_key = expected.agent_key
        AND a.status = 'active'
        AND a.lifecycle = 'AVAILABLE'
        AND a.task_contract = CASE a.agent_key
     WHEN 'mon-seo' THEN 'Inspect up to 100 visible, published marketplace products using actual name, description, tags, search_keywords and catalog data. Report missing title/description/keyword fields and keyword coverage gaps in ai_agent_runs. Read-only; do not rewrite product content.'
     WHEN 'mon-social' THEN 'Read only recent public.seo_social_comments mentioning Software Vala (last 7 days). Report counts of negative sentiment and pending/escalated comments in ai_agent_runs. Never auto-reply or contact users.'
     WHEN 'mon-content' THEN 'Read-only audit up to 100 visible, published catalog pages for missing product name, description, thumbnail, or cover image. Report counts and bounded product IDs in ai_agent_runs. This is catalog metadata validation, not a live browser crawl; never edit content.'
     WHEN 'mon-reputation' THEN 'Read up to three new published marketplace reviews rated below 3 with no seller response. Use local Ollama to draft a calm, polite response for human review and record it only in this governed ai_agent_runs result. Never publish or send the reply.'
     WHEN 'mon-complaint' THEN 'Read unresolved support tickets with priority critical/high (the schema has no urgent tag). Record counts and bounded ticket references for immediate human attention in ai_agent_runs. Do not change ticket state or notify customers.'
     WHEN 'mon-refund' THEN 'Read pending marketplace refund requests with their order totals. No authoritative refund-policy table/source is connected, so report policy_verdict=requires_human_policy_review; never approve, deny, or process a refund.'
     WHEN 'mon-customer' THEN 'Aggregate profiles with last_seen_at at least 30 days old; treat these as inactive accounts, not verified paying customers. Draft one generic “We miss you” email for internal review and store only the draft/count in ai_agent_runs. Never access or send email addresses.'
     WHEN 'mon-conversion' THEN 'Read aggregate analytics_events and marketplace_orders checkout/cart signals for the last 7 days. Report observed counts only; without a validated user/session-linked funnel do not claim drop-offs or attribute lost checkouts. Save suggested instrumentation/improvement notes in ai_agent_runs.'
     WHEN 'mon-campaign' THEN 'Read active marketing_campaigns metrics (impressions, clicks, conversions, leads) and report campaigns with zero recorded leads. No campaign writes or claims beyond recorded fields.'
     WHEN 'mon-competitor' THEN 'Read stored public.seo_competitors snapshot metadata and freshness only. No competitor pricing URL or verified live fetch workflow exists; report that pricing changes are unverified and do not simulate observations.'
     WHEN 'mon-pricing' THEN 'Read active marketplace_product_pricing rows for visible products; report zero/non-positive amounts and currencies. Read-only; do not alter prices.'
     WHEN 'mon-marketing-monitor' THEN 'Read active marketing_content_items of type banner and validate recorded Software Vala same-origin links only when a destination URL is present. If no banner URL field/data exists, report the check as unavailable; never rewrite banners.'
     WHEN 'mon-knowledge-monitor' THEN 'Read published FAQs and inspect bounded HTTP(S) links using the SSRF-guarded fetch helper; report empty answers and verified broken links in ai_agent_runs. Never edit FAQ content.'
     WHEN 'mon-notification' THEN 'Read-only aggregate recent email_outbox delivery states and failures. Do not send test email/SMS or call external providers; report notification API testing unavailable because no safe test API is configured.'
     WHEN 'reporting' THEN 'Aggregate current VPS database-day new leads, paid non-deleted marketplace orders, and support tickets created. Record counts and order totals grouped by currency in ai_agent_runs; never combine currencies or expose customer data.'
        END
        AND 'ANALYZE' = ANY(a.permissions)
   );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Batch 4 agents missing or lacking ANALYZE permission: %',
      array_to_string(missing, ', ');
  END IF;
END $$;
