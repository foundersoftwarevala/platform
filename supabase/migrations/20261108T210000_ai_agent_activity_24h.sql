-- VPS-only: supports the VPS-backed activity monitor; do not apply to Supabase Cloud.
CREATE OR REPLACE FUNCTION public.ai_agent_activity_24h()
RETURNS TABLE (
  agent_id uuid,
  agent_name text,
  action text,
  state text,
  run_count bigint,
  latest_started_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT
    a.id,
    a.name,
    r.action,
    r.state,
    count(*)::bigint,
    max(r.started_at)
  FROM public.ai_agent_runs AS r
  JOIN public.ai_agents AS a ON a.id = r.agent_id
  WHERE r.started_at >= statement_timestamp() - interval '24 hours'
    AND r.started_at <= statement_timestamp()
  GROUP BY a.id, a.name, r.action, r.state
  ORDER BY max(r.started_at) DESC
  LIMIT 40;
$function$;

REVOKE ALL ON FUNCTION public.ai_agent_activity_24h()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_agent_activity_24h()
  TO service_role;
