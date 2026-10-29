-- Batch 6 AI/Data/Research/Operations agent contracts agent contracts. Apply on VPS sv_platform only.
-- All fixed runner contracts are verified exactly before work can begin.

UPDATE public.ai_agents AS a
   SET task_contract = v.task_contract,
       status = 'active',
       lifecycle = 'AVAILABLE',
       blocked_reason = NULL
  FROM (VALUES
      ('data-intelligence', 'Read paid non-deleted marketplace orders from the last seven days, join order items to catalog categories, and report order quantities and revenue grouped by category and currency. Do not combine currencies or expose buyer data.'),
      ('research', 'Analyze only the latest bounded leads requirements after contact-detail redaction using local Ollama. Identify up to three recurring feature requests; do not expose lead identities or raw requirements in run results.'),
      ('task-operations', 'Read public.tm_tasks with a past deadline and a nonterminal status. Report overdue task IDs, codes, severity, and deadline in ai_agent_runs; do not reassign, edit, or create tasks or alerts.'),
      ('knowledge-operations', 'Compare support-ticket categories from the last 30 days with active founder_knowledge titles/domains. Report categories without a matching knowledge entry as FAQ candidates; do not create or edit knowledge records and do not expose ticket text.'),
      ('customer-operations', 'Read unresolved support tickets created at least 48 hours ago with no first_response_at. Report bounded ticket references and age in ai_agent_runs; do not access customer contact data, reply, or change tickets.'),
      ('risk', 'Read open public.founder_risks and summarize high/critical items using recorded severity, score, and mitigation status only. Store aggregate and bounded IDs in ai_agent_runs; do not update risks.'),
      ('compliance', 'Audit visible published marketplace product text for disclaimer-like wording, but mark legal compliance unverified because no authoritative required disclaimer source is configured. Report bounded product IDs in ai_agent_runs; never edit product content.'),
      ('reporting', 'Aggregate current VPS database-day and trailing-seven-day new leads, paid non-deleted marketplace orders, support tickets, and new profiles. Preserve per-currency totals. Save the weekly aggregate report once per VPS database week to founder_reports and every run result to ai_agent_runs; never combine currencies or expose customer data.'),
      ('monitoring', 'Read the latest four governed ai_agent_runs per agent. Report agents whose four most recent runs all failed; use aggregate states only and do not retry runs or change agent state.'),
      ('workforce-intelligence', 'Read governed ai_agent_runs for the last 30 days and calculate completed versus failed rates. Report agents below 80 percent with run counts and human-reviewed improvement suggestions; do not change prompts or permissions.'),
      ('vendor-procurement', 'Read marketplace_vendors with verified=false and created more than three days ago. Report them as unverified-vendor review candidates only because no pending-verification status exists; do not contact or update vendors.'),
      ('sales-intelligence', 'Aggregate leads by recorded source, count, and positive deal_value totals. Report the highest recorded-value sources, noting leads have no currency field; do not infer currency or contact leads.'),
      ('quality-assurance', 'Read up to 100 visible published marketplace products and report missing description, thumbnail, and cover image metadata. This validates stored metadata only, not rendered pages; do not change products.'),
      ('sla-service', 'Read unresolved support tickets and report any breached SLA flag, negative remaining minutes, or age above 24 hours. Record bounded references in ai_agent_runs; never reply, notify, or alter tickets.'),
      ('alert-escalation', 'Count unresolved HIGH/CRITICAL founder_attention items. If more than five exist, create one deduplicated CRITICAL internal founder_attention alert; never send external notifications or change existing alerts.')
  ) AS v(agent_key, task_contract)
 WHERE a.agent_key = v.agent_key
   AND a.status = 'active'
   AND 'ANALYZE' = ANY(a.permissions);

DO $$
DECLARE missing text[];
BEGIN
  SELECT array_agg(v.agent_key ORDER BY v.agent_key) INTO missing
    FROM (VALUES
      ('data-intelligence', 'Read paid non-deleted marketplace orders from the last seven days, join order items to catalog categories, and report order quantities and revenue grouped by category and currency. Do not combine currencies or expose buyer data.'),
      ('research', 'Analyze only the latest bounded leads requirements after contact-detail redaction using local Ollama. Identify up to three recurring feature requests; do not expose lead identities or raw requirements in run results.'),
      ('task-operations', 'Read public.tm_tasks with a past deadline and a nonterminal status. Report overdue task IDs, codes, severity, and deadline in ai_agent_runs; do not reassign, edit, or create tasks or alerts.'),
      ('knowledge-operations', 'Compare support-ticket categories from the last 30 days with active founder_knowledge titles/domains. Report categories without a matching knowledge entry as FAQ candidates; do not create or edit knowledge records and do not expose ticket text.'),
      ('customer-operations', 'Read unresolved support tickets created at least 48 hours ago with no first_response_at. Report bounded ticket references and age in ai_agent_runs; do not access customer contact data, reply, or change tickets.'),
      ('risk', 'Read open public.founder_risks and summarize high/critical items using recorded severity, score, and mitigation status only. Store aggregate and bounded IDs in ai_agent_runs; do not update risks.'),
      ('compliance', 'Audit visible published marketplace product text for disclaimer-like wording, but mark legal compliance unverified because no authoritative required disclaimer source is configured. Report bounded product IDs in ai_agent_runs; never edit product content.'),
      ('reporting', 'Aggregate current VPS database-day and trailing-seven-day new leads, paid non-deleted marketplace orders, support tickets, and new profiles. Preserve per-currency totals. Save the weekly aggregate report once per VPS database week to founder_reports and every run result to ai_agent_runs; never combine currencies or expose customer data.'),
      ('monitoring', 'Read the latest four governed ai_agent_runs per agent. Report agents whose four most recent runs all failed; use aggregate states only and do not retry runs or change agent state.'),
      ('workforce-intelligence', 'Read governed ai_agent_runs for the last 30 days and calculate completed versus failed rates. Report agents below 80 percent with run counts and human-reviewed improvement suggestions; do not change prompts or permissions.'),
      ('vendor-procurement', 'Read marketplace_vendors with verified=false and created more than three days ago. Report them as unverified-vendor review candidates only because no pending-verification status exists; do not contact or update vendors.'),
      ('sales-intelligence', 'Aggregate leads by recorded source, count, and positive deal_value totals. Report the highest recorded-value sources, noting leads have no currency field; do not infer currency or contact leads.'),
      ('quality-assurance', 'Read up to 100 visible published marketplace products and report missing description, thumbnail, and cover image metadata. This validates stored metadata only, not rendered pages; do not change products.'),
      ('sla-service', 'Read unresolved support tickets and report any breached SLA flag, negative remaining minutes, or age above 24 hours. Record bounded references in ai_agent_runs; never reply, notify, or alter tickets.'),
      ('alert-escalation', 'Count unresolved HIGH/CRITICAL founder_attention items. If more than five exist, create one deduplicated CRITICAL internal founder_attention alert; never send external notifications or change existing alerts.')
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
