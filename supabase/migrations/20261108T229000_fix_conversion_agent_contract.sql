-- Correct the Batch 4 conversion-monitor contract to match the fixed runner.
-- VPS sv_platform only; do not infer session-linked funnel behavior.
UPDATE public.ai_agents
   SET task_contract = 'Read aggregate analytics_events and marketplace_orders checkout/cart signals for the last 7 days. Report observed counts only; without a validated user/session-linked funnel do not claim drop-offs or attribute lost checkouts. Save suggested instrumentation/improvement notes in ai_agent_runs.'
 WHERE agent_key = 'mon-conversion'
   AND status = 'active'
   AND lifecycle = 'AVAILABLE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.ai_agents
     WHERE agent_key = 'mon-conversion'
       AND status = 'active'
       AND lifecycle = 'AVAILABLE'
       AND task_contract = 'Read aggregate analytics_events and marketplace_orders checkout/cart signals for the last 7 days. Report observed counts only; without a validated user/session-linked funnel do not claim drop-offs or attribute lost checkouts. Save suggested instrumentation/improvement notes in ai_agent_runs.'
  ) THEN
    RAISE EXCEPTION 'Batch 4 conversion agent contract was not updated';
  END IF;
END;
$$;
