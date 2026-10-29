-- Batch 5 Website/API/Database/Performance/Error/Availability/SLA/Compliance/Risk/Contract/Document/Inventory/Workforce/Decision/Alert agent contracts. Apply on VPS sv_platform only.
-- All fixed runner contracts are verified exactly before work can begin.

UPDATE public.ai_agents AS a
   SET task_contract = v.task_contract,
       status = 'active',
       lifecycle = 'AVAILABLE',
       blocked_reason = NULL
  FROM (VALUES
      ('mon-website', 'Fetch only fixed public routes /marketplace and /sitemap.xml from https://softwarevala.net using bounded SSRF-guarded GETs; record HTTP status and timings in ai_agent_runs. Do not crawl arbitrary links or modify site content.'),
      ('mon-api', 'Read-only summarize public.api_request_logs for the prior 15 minutes using total, 5xx count, and aggregate latency; record stats in ai_agent_runs. Do not read IP addresses or user-agent values.'),
      ('mon-database', 'Read-only record current VPS database size and same-database connection count; record stats in ai_agent_runs. Do not read SQL text or query other databases.'),
      ('mon-performance', 'Read same-database pg_stat_database aggregate counters and database size only. Report transaction, cache-hit, and deadlock metrics in ai_agent_runs; never inspect SQL text or other databases.'),
      ('mon-error', 'Read-only summarize public.error_events from the prior 24 hours by severity and resolved flag; record counts only in ai_agent_runs. Do not read error messages/stacks or alter events.'),
      ('mon-availability', 'Read active server_instances. Treat missing last_health_check or a check older than 15 minutes as stale CPU/RAM telemetry. Create a deduplicated CRITICAL founder_attention alert for each stale instance. Do not change server configuration or metrics.'),
      ('mon-sla-monitor', 'Read unresolved support tickets and report those with sla_breached=true, negative remaining SLA minutes, or age above 24 hours. Return bounded ticket references in ai_agent_runs; never modify tickets or notify customers.'),
      ('mon-compliance-monitor', 'Read visible published marketplace product license and description fields. Report disclaimer-like text presence only; because no authoritative required disclaimer text is configured, mark legal compliance unverified and do not claim approval or edit products.'),
      ('mon-risk-monitor', 'Read open public.founder_risks and summarize high/critical severity counts with bounded risk IDs and scores in ai_agent_runs. Read-only; do not change risk status or mitigation.'),
      ('mon-contract', 'Read public.franchise_contracts and report active records expiring within 30 days or past end date, using recorded status and dates only. Store counts and bounded contract IDs in ai_agent_runs; do not contact parties or edit contracts.'),
      ('mon-document', 'Read public.legal_documents and public.franchise_documents expiry metadata. Report expired and next-30-day documents using IDs, type, and dates only; do not read document contents or storage paths and do not edit documents.'),
      ('mon-inventory-monitor', 'Check whether an authoritative public inventory relation exists. If absent, report inventory monitoring unavailable; do not infer stock from downloads, orders, or product visibility and do not modify catalog data.'),
      ('mon-agent-workforce', 'Read governed ai_agent_runs from the last 30 days and calculate success rate per agent from completed/failed runs. Report agents below 80 percent with counts and suggest human-reviewed process improvements; do not update prompts or agent permissions.'),
      ('mon-decision-monitor', 'Read public.founder_decisions aggregate counts and overdue decision/approval/execution deadlines for nonterminal states. Report bounded IDs and statuses in ai_agent_runs; do not approve, execute, or alter decisions.'),
      ('mon-alerts', 'Read-only summarize public.founder_attention open, acknowledged, and in-progress items by severity; record counts in ai_agent_runs. Do not create, dismiss, acknowledge, or modify alerts.')
  ) AS v(agent_key, task_contract)
 WHERE a.agent_key = v.agent_key
   AND a.status = 'active'
   AND 'ANALYZE' = ANY(a.permissions);

DO $$
DECLARE missing text[];
BEGIN
  SELECT array_agg(v.agent_key ORDER BY v.agent_key) INTO missing
    FROM (VALUES
      ('mon-website', 'Fetch only fixed public routes /marketplace and /sitemap.xml from https://softwarevala.net using bounded SSRF-guarded GETs; record HTTP status and timings in ai_agent_runs. Do not crawl arbitrary links or modify site content.'),
      ('mon-api', 'Read-only summarize public.api_request_logs for the prior 15 minutes using total, 5xx count, and aggregate latency; record stats in ai_agent_runs. Do not read IP addresses or user-agent values.'),
      ('mon-database', 'Read-only record current VPS database size and same-database connection count; record stats in ai_agent_runs. Do not read SQL text or query other databases.'),
      ('mon-performance', 'Read same-database pg_stat_database aggregate counters and database size only. Report transaction, cache-hit, and deadlock metrics in ai_agent_runs; never inspect SQL text or other databases.'),
      ('mon-error', 'Read-only summarize public.error_events from the prior 24 hours by severity and resolved flag; record counts only in ai_agent_runs. Do not read error messages/stacks or alter events.'),
      ('mon-availability', 'Read active server_instances. Treat missing last_health_check or a check older than 15 minutes as stale CPU/RAM telemetry. Create a deduplicated CRITICAL founder_attention alert for each stale instance. Do not change server configuration or metrics.'),
      ('mon-sla-monitor', 'Read unresolved support tickets and report those with sla_breached=true, negative remaining SLA minutes, or age above 24 hours. Return bounded ticket references in ai_agent_runs; never modify tickets or notify customers.'),
      ('mon-compliance-monitor', 'Read visible published marketplace product license and description fields. Report disclaimer-like text presence only; because no authoritative required disclaimer text is configured, mark legal compliance unverified and do not claim approval or edit products.'),
      ('mon-risk-monitor', 'Read open public.founder_risks and summarize high/critical severity counts with bounded risk IDs and scores in ai_agent_runs. Read-only; do not change risk status or mitigation.'),
      ('mon-contract', 'Read public.franchise_contracts and report active records expiring within 30 days or past end date, using recorded status and dates only. Store counts and bounded contract IDs in ai_agent_runs; do not contact parties or edit contracts.'),
      ('mon-document', 'Read public.legal_documents and public.franchise_documents expiry metadata. Report expired and next-30-day documents using IDs, type, and dates only; do not read document contents or storage paths and do not edit documents.'),
      ('mon-inventory-monitor', 'Check whether an authoritative public inventory relation exists. If absent, report inventory monitoring unavailable; do not infer stock from downloads, orders, or product visibility and do not modify catalog data.'),
      ('mon-agent-workforce', 'Read governed ai_agent_runs from the last 30 days and calculate success rate per agent from completed/failed runs. Report agents below 80 percent with counts and suggest human-reviewed process improvements; do not update prompts or agent permissions.'),
      ('mon-decision-monitor', 'Read public.founder_decisions aggregate counts and overdue decision/approval/execution deadlines for nonterminal states. Report bounded IDs and statuses in ai_agent_runs; do not approve, execute, or alter decisions.'),
      ('mon-alerts', 'Read-only summarize public.founder_attention open, acknowledged, and in-progress items by severity; record counts in ai_agent_runs. Do not create, dismiss, acknowledge, or modify alerts.')
    ) AS v(agent_key, task_contract)
   WHERE NOT EXISTS (
     SELECT 1 FROM public.ai_agents a
      WHERE a.agent_key = v.agent_key
        AND a.status = 'active'
        AND a.lifecycle = 'AVAILABLE'
        AND a.task_contract = v.task_contract
        AND 'ANALYZE' = ANY(a.permissions)
   );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Agent contract activation incomplete: %', array_to_string(missing, ', ');
  END IF;
END;
$$;
