-- Second contract-bound monitoring batch; apply to VPS sv_platform only.
-- All ten contracts are aggregate/read-only except their governed run records.

UPDATE public.ai_agents
   SET task_contract = CASE agent_key
     WHEN 'mon-homepage' THEN
       'Fetch only the Software Vala homepage over HTTPS with a bounded SSRF-guarded GET; report HTTP status, timing, and whether the Software Vala page marker is present in ai_agent_runs. Do not change homepage content.'
     WHEN 'mon-vendor' THEN
       'Read-only aggregate public.marketplace_vendors visibility/verification totals and public.marketplace_sellers status totals; record counts in ai_agent_runs. Do not edit vendor/seller records or contact vendors.'
     WHEN 'mon-security' THEN
       'Read-only aggregate public.security_findings by severity and result and public.security_events count for the last 24 hours; record aggregate counts in ai_agent_runs. Do not inspect evidence/payloads or modify security records.'
     WHEN 'mon-order' THEN
       'Read-only aggregate public.marketplace_orders by status for the last 24 hours, excluding soft-deleted orders; record counts in ai_agent_runs. Do not change orders or notify buyers.'
     WHEN 'mon-payment' THEN
       'Read-only aggregate public.marketplace_payment_events by provider, event_type, and signature_verified for the last 24 hours; record counts only in ai_agent_runs. Never read payment payloads or change payment state.'
     WHEN 'mon-website' THEN
       'Fetch only fixed public routes /marketplace and /sitemap.xml from https://softwarevala.net using bounded SSRF-guarded GETs; record HTTP status and timings in ai_agent_runs. Do not crawl arbitrary links or modify site content.'
     WHEN 'mon-api' THEN
       'Read-only summarize public.api_request_logs for the prior 15 minutes using total, 5xx count, and aggregate latency; record stats in ai_agent_runs. Do not read IP addresses or user-agent values.'
     WHEN 'mon-database' THEN
       'Read-only record current VPS database size and same-database connection count; record stats in ai_agent_runs. Do not read SQL text or query other databases.'
     WHEN 'mon-error' THEN
       'Read-only summarize public.error_events from the prior 24 hours by severity and resolved flag; record counts only in ai_agent_runs. Do not read error messages/stacks or alter events.'
     WHEN 'mon-alerts' THEN
       'Read-only summarize public.founder_attention open, acknowledged, and in-progress items by severity; record counts in ai_agent_runs. Do not create, dismiss, acknowledge, or modify alerts.'
   END,
       lifecycle = CASE WHEN lifecycle = 'CONFIGURED' AND status = 'active'
                        THEN 'AVAILABLE' ELSE lifecycle END
 WHERE agent_key IN ('mon-homepage', 'mon-vendor', 'mon-security', 'mon-order', 'mon-payment', 'mon-website', 'mon-api', 'mon-database', 'mon-error', 'mon-alerts');

DO $$
DECLARE
  missing text[];
BEGIN
  SELECT array_agg(expected.agent_key)
    INTO missing
    FROM (VALUES ('mon-homepage'), ('mon-vendor'), ('mon-security'), ('mon-order'), ('mon-payment'), ('mon-website'), ('mon-api'), ('mon-database'), ('mon-error'), ('mon-alerts')) AS expected(agent_key)
   WHERE NOT EXISTS (
     SELECT 1 FROM public.ai_agents a
      WHERE a.agent_key = expected.agent_key
        AND a.status = 'active'
        AND a.lifecycle = 'AVAILABLE'
        AND a.task_contract IS NOT NULL
        AND 'ANALYZE' = ANY(a.permissions)
   );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Monitoring batch not ready: %', array_to_string(missing, ', ');
  END IF;
END $$;
