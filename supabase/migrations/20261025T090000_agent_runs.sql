-- Recording what an agent actually did.
--
-- ai_agent_runs was created with the worker/agent roster and has never held a
-- row. The roster has 134 agents, seven of them the Demo Operations team, all
-- active; the queue has run health, scan and sync jobs through to completion;
-- and the table that the governance section calls "the only place a run is
-- recorded" is empty. Founder AI can therefore say which agents exist and
-- cannot say that any of them has ever done anything.
--
-- That is not only a missing display. self-healing's reduce_concurrency
-- verifies itself by counting runs in flight against the agent's
-- max_concurrent:
--
--     const open = await get(`ai_agent_runs?...&state=in.(RUNNING,WAITING)`)
--     const within = open.length <= Number(agent.max_concurrent ?? 1)
--
-- With no rows, open.length is 0, every ceiling is satisfied, and the check
-- passes without examining anything. An empty table makes a guardrail report
-- success for free, which is worse than not having the check at all.
--
-- What is added here is the pair of calls a worker needs, and nothing else. No
-- table, no counter, no second roster. fa_jobs.correlation_id already exists
-- for exactly this and its own comment says so — "ties a job to the agent run
-- that asked for it, so the chain from a Founder AI decision through to a
-- provider call can be followed in one direction" — so the run id goes there
-- rather than into a new column, and the index on it already answers "which
-- job was this run doing".
--
-- Verification is deliberately not here. The table's own comment draws the
-- line: "Completing is not the same as being right. A run that finished says
-- COMPLETED; only a separate check moves it to VERIFIED." A worker closing its
-- own run may say that it finished. It may not say that it was right. So
-- fa_agent_run_close cannot write VERIFIED, and the Demo Sync worker — whose
-- whole job is verifying a demo — still leaves its own run UNVERIFIED, because
-- the thing it verified is the demo, not its own conduct.

-- ------------------------------------------------------------------- open
CREATE OR REPLACE FUNCTION public.fa_agent_run_open(
  p_agent_key    text,
  p_scope        text,
  p_permission   text,
  p_input_source text,
  p_action       text,
  p_job          uuid DEFAULT NULL,
  p_task         uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_agent  public.ai_agents%ROWTYPE;
  v_run    public.ai_agent_runs%ROWTYPE;
  v_reaped int := 0;
BEGIN
  IF coalesce(btrim(p_agent_key), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'agent_key_required');
  END IF;

  SELECT * INTO v_agent FROM public.ai_agents WHERE agent_key = btrim(p_agent_key);
  IF NOT FOUND THEN
    -- Worth refusing rather than inventing. A worker naming an agent that is
    -- not on the roster is a misconfiguration, and a run attributed to nobody
    -- would be worse than no run at all.
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_agent',
      'agent_key', btrim(p_agent_key));
  END IF;

  IF v_agent.status IS DISTINCT FROM 'active' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'agent_not_active',
      'agent_key', v_agent.agent_key, 'status', v_agent.status);
  END IF;

  -- Close this agent's abandoned runs before opening another.
  --
  -- A worker killed mid-job — the cron timeout, a deploy, the machine — leaves
  -- its run at RUNNING with nothing left to close it, and that row then counts
  -- against max_concurrent for good. Two things keep this from touching a run
  -- that is genuinely in progress: the run's job must not still be queued,
  -- running or retrying, and the run must be older than an hour. The hour
  -- matters because a worker closes its job before closing its run, so for a
  -- moment every healthy run looks finished-but-open; leases here are five to
  -- ten minutes, so an hour is far outside any real one.
  WITH abandoned AS (
    UPDATE public.ai_agent_runs r
       SET state       = 'FAILED',
           error       = coalesce(
             'the worker stopped without closing this run; its job is '
               || (SELECT j.status FROM public.fa_jobs j WHERE j.correlation_id = r.id LIMIT 1),
             'the worker stopped without closing this run'),
           finished_at = now()
     WHERE r.agent_id = v_agent.id
       AND r.state IN ('RUNNING','WAITING')
       AND r.started_at < now() - interval '1 hour'
       AND NOT EXISTS (
         SELECT 1 FROM public.fa_jobs j
          WHERE j.correlation_id = r.id
            AND j.status IN ('queued','running','retrying')
       )
    RETURNING 1
  )
  SELECT count(*) INTO v_reaped FROM abandoned;

  -- The permission is not re-checked here: ai_agent_runs_permission_guard
  -- already refuses a permission the agent does not hold, and one guard is
  -- better than two that could drift apart.
  INSERT INTO public.ai_agent_runs
    (agent_id, task_id, scope, permission_used, input_source, action, state)
  VALUES
    (v_agent.id, p_task, btrim(p_scope), p_permission, p_input_source,
     p_action, 'RUNNING')
  RETURNING * INTO v_run;

  IF p_job IS NOT NULL THEN
    UPDATE public.fa_jobs SET correlation_id = v_run.id WHERE id = p_job;
  END IF;

  RETURN jsonb_build_object('ok', true, 'run_id', v_run.id,
    'agent_id', v_agent.id, 'reaped', v_reaped);
END;
$function$;

-- ------------------------------------------------------------------ close
CREATE OR REPLACE FUNCTION public.fa_agent_run_close(
  p_run    uuid,
  p_state  text,
  p_result text DEFAULT NULL,
  p_error  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_run public.ai_agent_runs%ROWTYPE;
BEGIN
  SELECT * INTO v_run FROM public.ai_agent_runs WHERE id = p_run FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_run');
  END IF;

  IF v_run.state NOT IN ('RUNNING','WAITING','BLOCKED') THEN
    -- Closing a closed run would overwrite the record of what happened, which
    -- is the one thing this table exists to keep.
    RETURN jsonb_build_object('ok', false, 'reason', 'already_closed',
      'state', v_run.state);
  END IF;

  IF p_state NOT IN ('COMPLETED','FAILED','CANCELLED','ESCALATED','BLOCKED','WAITING') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_state', 'state', p_state);
  END IF;

  -- The table already refuses a FAILED row with no explanation. Saying so here
  -- hands the worker an answer it can log, instead of an exception it would
  -- have to parse.
  IF p_state = 'FAILED' AND coalesce(btrim(p_error), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'failure_needs_a_reason');
  END IF;

  UPDATE public.ai_agent_runs
     SET state       = p_state,
         result      = coalesce(p_result, result),
         error       = CASE WHEN p_state = 'FAILED' THEN btrim(p_error) ELSE error END,
         -- WAITING and BLOCKED are not endings, so they do not get a finish.
         finished_at = CASE WHEN p_state IN ('WAITING','BLOCKED') THEN NULL ELSE now() END
   WHERE id = p_run
  RETURNING * INTO v_run;

  RETURN jsonb_build_object('ok', true, 'run_id', v_run.id, 'state', v_run.state);
END;
$function$;

-- ------------------------------------------------------------------- reap
-- The same abandonment rule, across every agent, for an operator or a schedule
-- to call. fa_agent_run_open already reaps the agent it is opening for, so
-- this is for the agent that has stopped running altogether and will therefore
-- never open another.
CREATE OR REPLACE FUNCTION public.fa_agent_run_reap()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_reaped int := 0;
BEGIN
  WITH abandoned AS (
    UPDATE public.ai_agent_runs r
       SET state       = 'FAILED',
           error       = coalesce(
             'the worker stopped without closing this run; its job is '
               || (SELECT j.status FROM public.fa_jobs j WHERE j.correlation_id = r.id LIMIT 1),
             'the worker stopped without closing this run'),
           finished_at = now()
     WHERE r.state IN ('RUNNING','WAITING')
       AND r.started_at < now() - interval '1 hour'
       AND NOT EXISTS (
         SELECT 1 FROM public.fa_jobs j
          WHERE j.correlation_id = r.id
            AND j.status IN ('queued','running','retrying')
       )
    RETURNING 1
  )
  SELECT count(*) INTO v_reaped FROM abandoned;

  RETURN jsonb_build_object('ok', true, 'reaped', v_reaped);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fa_agent_run_open(text, text, text, text, text, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fa_agent_run_close(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fa_agent_run_reap() TO service_role;

COMMENT ON FUNCTION public.fa_agent_run_open(text, text, text, text, text, uuid, uuid) IS
  'Opens an ai_agent_runs row for a worker about to act, naming the agent by agent_key, and points the job''s correlation_id at it. Refuses an unknown or inactive agent rather than attributing a run to nobody, and first closes that agent''s runs left open by a worker that died.';
COMMENT ON FUNCTION public.fa_agent_run_close(uuid, text, text, text) IS
  'Closes a run the worker opened. Cannot write VERIFIED: a worker may report that it finished, not that it was right.';
COMMENT ON FUNCTION public.fa_agent_run_reap() IS
  'Closes runs left RUNNING or WAITING by a worker that stopped, across every agent, so an abandoned row cannot count against max_concurrent forever.';
