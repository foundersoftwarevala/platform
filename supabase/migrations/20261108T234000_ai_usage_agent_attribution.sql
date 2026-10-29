-- Add queryable attribution for centrally metered agent model calls.
ALTER TABLE public.usage_events
  ADD COLUMN IF NOT EXISTS ai_agent_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'usage_events_ai_agent_id_fkey'
       AND conrelid = 'public.usage_events'::regclass
  ) THEN
    ALTER TABLE public.usage_events
      ADD CONSTRAINT usage_events_ai_agent_id_fkey
      FOREIGN KEY (ai_agent_id) REFERENCES public.ai_agents(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS usage_events_agent_occurred_idx
  ON public.usage_events (ai_agent_id, occurred_at DESC)
  WHERE ai_agent_id IS NOT NULL;
