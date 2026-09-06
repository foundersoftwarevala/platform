-- SLA measured by the server's clock, not the viewer's.
--
-- The screens computed remaining time from Date.now(), which means a laptop with
-- a wrong clock reports a wrong breach, and two people looking at the same task
-- disagree. These compute it in the database, subtract time the task spent on
-- hold, and escalate at most once per level so a sweep can run on a schedule
-- without raising the same alarm repeatedly.

CREATE OR REPLACE FUNCTION public.tm_sla_state(p_task_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t public.tm_tasks%ROWTYPE;
  v_start timestamptz;
  v_deadline timestamptz;
  v_total_seconds numeric;
  v_used_seconds numeric;
  v_pct numeric;
  v_state text;
BEGIN
  SELECT * INTO t FROM public.tm_tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('state', 'unknown', 'reason', 'no_such_task');
  END IF;

  -- A finished task has no clock left to run.
  IF t.status IN ('completed', 'cancelled') THEN
    RETURN jsonb_build_object('state', 'closed', 'status', t.status,
                              'deadline', t.deadline);
  END IF;

  v_start := coalesce(t.accepted_at, t.created_at);
  v_deadline := coalesce(t.deadline, v_start + make_interval(hours => t.sla_hours::int));

  v_total_seconds := greatest(extract(epoch FROM (v_deadline - v_start)), 1);
  -- Time spent on hold is not the assignee's to lose.
  v_used_seconds := greatest(
    extract(epoch FROM (now() - v_start)) - (coalesce(t.total_paused_minutes, 0) * 60),
    0);

  v_pct := round((v_used_seconds / v_total_seconds) * 100, 1);

  v_state := CASE
    WHEN v_used_seconds >= v_total_seconds THEN 'breached'
    WHEN v_pct >= 90 THEN 'critical'
    WHEN v_pct >= 75 THEN 'warning'
    ELSE 'on_track'
  END;

  RETURN jsonb_build_object(
    'state', v_state,
    'status', t.status,
    'started_at', v_start,
    'deadline', v_deadline,
    'sla_hours', t.sla_hours,
    'percent_used', v_pct,
    'seconds_remaining', round(v_total_seconds - v_used_seconds),
    'paused_minutes', coalesce(t.total_paused_minutes, 0),
    'escalation_level', t.escalation_level,
    'server_time', now()
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.tm_sla_sweep()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_state jsonb;
  v_level integer;
  v_checked integer := 0;
  v_raised integer := 0;
  v_buzzed integer := 0;
BEGIN
  FOR r IN
    SELECT id, escalation_level, buzzer_active, status
    FROM public.tm_tasks
    WHERE status NOT IN ('completed', 'cancelled')
  LOOP
    v_checked := v_checked + 1;
    v_state := public.tm_sla_state(r.id);

    v_level := CASE v_state->>'state'
      WHEN 'warning'  THEN 1
      WHEN 'critical' THEN 2
      WHEN 'breached' THEN 3
      ELSE 0
    END;

    IF v_level = 0 THEN
      CONTINUE;
    END IF;

    -- Only step up. A task already escalated to 3 is not re-raised at 3.
    IF v_level > coalesce(r.escalation_level, 0) THEN
      INSERT INTO public.tm_escalations (task_id, level, reason, raised_by, raised_to, status)
      VALUES (r.id, v_level,
              format('SLA %s at %s%% of the window',
                     v_state->>'state', v_state->>'percent_used'),
              'sla_engine', 'task_manager', 'open');

      UPDATE public.tm_tasks
         SET escalation_level = v_level,
             buzzer_active = (v_level >= 3),
             updated_at = now()
       WHERE id = r.id;

      INSERT INTO public.tm_activity (task_id, actor_name, actor_role, action, action_type,
                                      from_value, to_value, details)
      VALUES (r.id, 'sla_engine', 'system',
              format('SLA %s', v_state->>'state'), 'escalation',
              coalesce(r.escalation_level, 0)::text, v_level::text,
              format('%s%% of the SLA window used', v_state->>'percent_used'));

      v_raised := v_raised + 1;
      IF v_level >= 3 THEN v_buzzed := v_buzzed + 1; END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('checked', v_checked, 'escalations_raised', v_raised,
                            'buzzers_started', v_buzzed, 'swept_at', now());
END;
$function$;
