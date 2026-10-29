-- Roll back only before any agent usage rows have been written.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.usage_events WHERE ai_agent_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Cannot remove agent attribution after usage has been recorded';
  END IF;
END
$$;

DROP INDEX IF EXISTS public.usage_events_agent_occurred_idx;
ALTER TABLE public.usage_events
  DROP CONSTRAINT IF EXISTS usage_events_ai_agent_id_fkey;
ALTER TABLE public.usage_events
  DROP COLUMN IF EXISTS ai_agent_id;
