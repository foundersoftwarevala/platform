-- Section 19: the automation engine.
--
-- The rules table existed and the screen could write to it, but nothing ever
-- read it. A rule you can save and that never fires is worse than no rule,
-- because the operator believes the cover is there.

alter table public.tm_automations drop constraint if exists tm_automations_trigger_type_check;
alter table public.tm_automations add constraint tm_automations_trigger_type_check
  check (trigger_type = any (array[
    'task_created','task_assigned','status_changed','sla_at_risk','sla_breached',
    'unassigned_timeout','approval_pending','task_blocked','task_submitted',
    'task_approved','task_completed','task_cancelled','daily_digest'
  ]));

alter table public.tm_automations drop constraint if exists tm_automations_action_type_check;
alter table public.tm_automations add constraint tm_automations_action_type_check
  check (action_type = any (array[
    'assign','reassign','notify','notify_manager','escalate','set_priority',
    'add_tag','buzzer','start_buzzer','stop_buzzer','ai_review','update_status',
    'create_subtask','audit'
  ]));

CREATE OR REPLACE FUNCTION public.tm_condition_matches(p_task jsonb, p_condition jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_clauses jsonb;
  v_clause  jsonb;
  v_mode    text := 'all';
  v_field   text;
  v_op      text;
  v_value   jsonb;
  v_actual  text;
  v_hit     boolean;
  v_any     boolean := false;
begin
  if p_condition is null or p_condition = 'null'::jsonb or p_condition = '{}'::jsonb then
    return true;
  end if;

  if p_condition ? 'all' then
    v_clauses := p_condition -> 'all';
  elsif p_condition ? 'any' then
    v_clauses := p_condition -> 'any';
    v_mode := 'any';
  else
    -- The shape the rule editor writes: {"priority": "critical"} means equality.
    select coalesce(jsonb_agg(jsonb_build_object('field', k, 'op', 'eq', 'value', v)), '[]'::jsonb)
      into v_clauses
    from jsonb_each(p_condition) as e(k, v);
  end if;

  for v_clause in select * from jsonb_array_elements(v_clauses)
  loop
    v_field  := v_clause ->> 'field';
    v_op     := coalesce(v_clause ->> 'op', 'eq');
    v_value  := v_clause -> 'value';
    v_actual := p_task ->> v_field;

    v_hit := case v_op
      when 'eq'       then v_actual is not distinct from (v_value #>> '{}')
      when 'ne'       then v_actual is distinct from (v_value #>> '{}')
      when 'gt'       then v_actual is not null and v_actual::numeric >  (v_value #>> '{}')::numeric
      when 'gte'      then v_actual is not null and v_actual::numeric >= (v_value #>> '{}')::numeric
      when 'lt'       then v_actual is not null and v_actual::numeric <  (v_value #>> '{}')::numeric
      when 'lte'      then v_actual is not null and v_actual::numeric <= (v_value #>> '{}')::numeric
      when 'is_null'  then v_actual is null
      when 'not_null' then v_actual is not null
      when 'contains' then v_actual is not null and position((v_value #>> '{}') in v_actual) > 0
      when 'in'       then v_actual is not null and exists (
                            select 1 from jsonb_array_elements_text(v_value) x where x = v_actual)
      when 'not_in'   then v_actual is null or not exists (
                            select 1 from jsonb_array_elements_text(v_value) x where x = v_actual)
      else false
    end;

    if v_mode = 'all' and not v_hit then
      return false;
    end if;
    if v_hit then
      v_any := true;
    end if;
  end loop;

  return case when v_mode = 'all' then true else v_any end;
end;
$function$;

CREATE OR REPLACE FUNCTION public.tm_run_automations(p_task_id uuid, p_trigger text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_task    public.tm_tasks%rowtype;
  v_json    jsonb;
  v_rule    public.tm_automations%rowtype;
  v_fired   int := 0;
  v_skipped int := 0;
  v_failed  int := 0;
  v_cfg     jsonb;
  v_target  text;
begin
  select * into v_task from public.tm_tasks where id = p_task_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_such_task');
  end if;
  v_json := to_jsonb(v_task);

  for v_rule in
    select * from public.tm_automations
    where enabled and trigger_type = p_trigger
    order by created_at
  loop
    if not public.tm_condition_matches(v_json, v_rule.condition_json) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_cfg := coalesce(v_rule.action_config, '{}'::jsonb);

    begin
      case v_rule.action_type

        when 'notify', 'notify_manager' then
          insert into public.tm_notifications (task_id, title, message, level, channel)
          values (p_task_id,
                  coalesce(v_cfg ->> 'title', v_rule.name),
                  coalesce(v_cfg ->> 'message',
                           format('%s (%s) - %s', v_task.title, v_task.code, p_trigger)),
                  coalesce(v_cfg ->> 'level', case when v_rule.action_type = 'notify_manager'
                                                   then 'warning' else 'info' end),
                  coalesce(v_cfg ->> 'channel', 'in_app'));

        when 'buzzer', 'start_buzzer', 'stop_buzzer' then
          -- 'buzzer' takes its direction from the config; the other two are explicit.
          if v_rule.action_type = 'stop_buzzer'
             or coalesce(v_cfg ->> 'state', 'start') = 'stop' then
            update public.tm_tasks set buzzer_active = false
             where id = p_task_id and buzzer_active is distinct from false;
          else
            update public.tm_tasks set buzzer_active = true, buzzer_acknowledged_at = null
             where id = p_task_id and buzzer_active is distinct from true;
          end if;

        when 'set_priority' then
          v_target := v_cfg ->> 'priority';
          if v_target = any (array['low','medium','high','critical']) then
            update public.tm_tasks set priority = v_target where id = p_task_id;
          else
            v_failed := v_failed + 1;
            continue;
          end if;

        when 'add_tag' then
          v_target := v_cfg ->> 'tag';
          if v_target is not null then
            update public.tm_tasks
               set tags = (select array(select distinct unnest(coalesce(tags, '{}') || v_target)))
             where id = p_task_id;
          end if;

        when 'ai_review' then
          if 'ai_review' = any (public.tm_allowed_transitions(v_task.status)) then
            update public.tm_tasks set status = 'ai_review' where id = p_task_id;
          else
            v_failed := v_failed + 1;
            continue;
          end if;

        when 'escalate' then
          insert into public.tm_escalations (task_id, level, reason, raised_by, raised_to, status)
          values (p_task_id,
                  coalesce((v_cfg ->> 'level')::int, least(v_task.escalation_level + 1, 4)),
                  coalesce(v_cfg ->> 'reason', format('automation: %s', v_rule.name)),
                  'automation',
                  coalesce(v_cfg ->> 'raised_to', 'manager'),
                  'open');
          update public.tm_tasks
             set escalation_level = greatest(escalation_level,
                   coalesce((v_cfg ->> 'level')::int, least(v_task.escalation_level + 1, 4)))
           where id = p_task_id;

        when 'assign', 'reassign' then
          v_target := v_cfg ->> 'member_id';
          if v_target is not null then
            update public.tm_tasks
               set assigned_to = v_target::uuid,
                   status = case when status = 'new' then 'assigned' else status end
             where id = p_task_id;
          end if;

        when 'update_status' then
          v_target := v_cfg ->> 'status';
          if v_target is not null
             and v_target = any (public.tm_allowed_transitions(v_task.status)) then
            update public.tm_tasks set status = v_target where id = p_task_id;
          else
            -- A rule may not smuggle a task through a transition a person
            -- would be refused.
            v_failed := v_failed + 1;
            continue;
          end if;

        when 'create_subtask' then
          insert into public.tm_subtasks (task_id, title, position)
          values (p_task_id,
                  coalesce(v_cfg ->> 'title', 'Follow-up'),
                  coalesce((select max(position) + 1 from public.tm_subtasks where task_id = p_task_id), 0));

        when 'audit' then
          null;  -- the audit row below is the whole action

        else
          v_failed := v_failed + 1;
          continue;
      end case;

      insert into public.tm_activity (task_id, actor_name, actor_role, action, action_type, details, meta)
      values (p_task_id, 'Automation', 'system',
              format('Rule "%s" ran', v_rule.name), 'automation',
              format('trigger %s, action %s', p_trigger, v_rule.action_type),
              jsonb_build_object('rule_id', v_rule.id, 'trigger', p_trigger,
                                 'action', v_rule.action_type));

      update public.tm_automations
         set run_count = run_count + 1, last_run_at = now()
       where id = v_rule.id;

      v_fired := v_fired + 1;

    exception when others then
      -- One broken rule must not stop the others, nor the write that triggered them.
      v_failed := v_failed + 1;
      raise warning 'automation % failed on task %: %', v_rule.id, p_task_id, sqlerrm;
    end;
  end loop;

  return jsonb_build_object('ok', true, 'trigger', p_trigger,
                            'fired', v_fired, 'skipped', v_skipped, 'failed', v_failed);
end;
$function$;

CREATE OR REPLACE FUNCTION public.tm_fire_automations()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  -- An automation that edits the task would otherwise re-enter this trigger.
  if pg_trigger_depth() > 1 then
    return null;
  end if;

  if tg_op = 'INSERT' then
    perform public.tm_run_automations(new.id, 'task_created');
    if new.assigned_to is not null then
      perform public.tm_run_automations(new.id, 'task_assigned');
    end if;
    return null;
  end if;

  if new.assigned_to is distinct from old.assigned_to and new.assigned_to is not null then
    perform public.tm_run_automations(new.id, 'task_assigned');
  end if;

  if new.approval_status is distinct from old.approval_status and new.approval_status = 'pending' then
    perform public.tm_run_automations(new.id, 'approval_pending');
  end if;

  if new.status is distinct from old.status then
    perform public.tm_run_automations(new.id, 'status_changed');
    case new.status
      when 'blocked'   then perform public.tm_run_automations(new.id, 'task_blocked');
      when 'submitted' then perform public.tm_run_automations(new.id, 'task_submitted');
      when 'approved'  then perform public.tm_run_automations(new.id, 'task_approved');
      when 'completed' then perform public.tm_run_automations(new.id, 'task_completed');
      when 'cancelled' then perform public.tm_run_automations(new.id, 'task_cancelled');
      else null;
    end case;
  end if;

  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.tm_sla_state(p_task_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  t               public.tm_tasks%rowtype;
  v_start         timestamptz;
  v_deadline      timestamptz;
  v_total_seconds numeric;
  v_used_seconds  numeric;
  v_pct           numeric;
  v_state         text;
  v_warn          integer;
begin
  select * into t from public.tm_tasks where id = p_task_id;
  if not found then
    return jsonb_build_object('state', 'unknown', 'reason', 'no_such_task',
                              'server_time', now());
  end if;

  -- A finished task has no clock left to run. Every resting state counts,
  -- not only the two that existed when this was first written.
  if t.status in ('completed', 'cancelled', 'approved', 'closed', 'failed') then
    return jsonb_build_object('state', 'closed', 'status', t.status,
                              'deadline', t.deadline,
                              'server_time', now());
  end if;

  select coalesce(max(sla_warning_percent), 75) into v_warn from public.tm_settings;

  v_start := coalesce(t.accepted_at, t.created_at);
  v_deadline := coalesce(t.deadline, v_start + make_interval(hours => coalesce(t.sla_hours, 24)::int));

  v_total_seconds := greatest(extract(epoch from (v_deadline - v_start)), 1);
  -- Time the task spent on hold is not charged against the person doing it.
  v_used_seconds := greatest(
    extract(epoch from (now() - v_start)) - coalesce(t.total_paused_minutes, 0) * 60, 0);
  v_pct := round((v_used_seconds / v_total_seconds) * 100, 1);

  v_state := case
    when v_pct >= 100 then 'breached'
    when v_pct >= 90  then 'critical'
    when v_pct >= v_warn then 'warning'
    else 'on_track'
  end;

  return jsonb_build_object(
    'state', v_state,
    'status', t.status,
    'percent_used', v_pct,
    'deadline', v_deadline,
    'started_from', v_start,
    'paused_minutes', coalesce(t.total_paused_minutes, 0),
    'seconds_remaining', greatest(v_total_seconds - v_used_seconds, 0),
    'warning_percent', v_warn,
    'server_time', now()
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.tm_sla_sweep()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  r           record;
  v_state     jsonb;
  v_level     integer;
  v_checked   integer := 0;
  v_raised    integer := 0;
  v_buzzed    integer := 0;
  v_autos     integer := 0;
  v_unclaimed integer := 0;
  v_grace     integer;
  v_result    jsonb;
begin
  select coalesce(max(buzzer_repeat_minutes), 10) into v_grace from public.tm_settings;

  for r in
    select id, escalation_level, buzzer_active, status, assigned_to, created_at
    from public.tm_tasks
    where status not in ('completed', 'cancelled', 'closed', 'approved')
  loop
    v_checked := v_checked + 1;

    -- Work sitting in the pool with nobody on it is its own kind of alarm.
    if r.assigned_to is null
       and r.status in ('new', 'routed', 'available_for_claim', 'assigned')
       and r.created_at < now() - make_interval(mins => v_grace) then
      v_result := public.tm_run_automations(r.id, 'unassigned_timeout');
      v_autos := v_autos + coalesce((v_result ->> 'fired')::int, 0);
      v_unclaimed := v_unclaimed + 1;
    end if;

    v_state := public.tm_sla_state(r.id);

    v_level := case v_state ->> 'state'
      when 'warning'  then 1
      when 'critical' then 2
      when 'breached' then 3
      else 0
    end;

    if v_level = 0 then
      continue;
    end if;

    if v_level > coalesce(r.escalation_level, 0) then
      insert into public.tm_escalations (task_id, level, reason, raised_by, raised_to, status)
      values (r.id, v_level,
              format('SLA %s at %s%% of the window',
                     v_state ->> 'state', v_state ->> 'percent_used'),
              'sla_engine', 'task_manager', 'open');

      update public.tm_tasks
         set escalation_level = v_level,
             buzzer_active = (v_level >= 3),
             updated_at = now()
       where id = r.id;

      insert into public.tm_activity (task_id, actor_name, actor_role, action, action_type,
                                      from_value, to_value, details)
      values (r.id, 'sla_engine', 'system',
              format('SLA %s', v_state ->> 'state'), 'escalation',
              coalesce(r.escalation_level, 0)::text, v_level::text,
              format('%s%% of the SLA window used', v_state ->> 'percent_used'));

      v_raised := v_raised + 1;
      if v_level >= 3 then v_buzzed := v_buzzed + 1; end if;

      v_result := public.tm_run_automations(
        r.id, case when v_level >= 3 then 'sla_breached' else 'sla_at_risk' end);
      v_autos := v_autos + coalesce((v_result ->> 'fired')::int, 0);
    end if;
  end loop;

  return jsonb_build_object('checked', v_checked, 'escalations_raised', v_raised,
                            'buzzers_started', v_buzzed, 'unclaimed_seen', v_unclaimed,
                            'automations_fired', v_autos, 'swept_at', now());
end;
$function$;

drop trigger if exists tm_tasks_fire_automations on public.tm_tasks;
CREATE TRIGGER tm_tasks_fire_automations AFTER INSERT OR UPDATE ON public.tm_tasks FOR EACH ROW EXECUTE FUNCTION tm_fire_automations();
