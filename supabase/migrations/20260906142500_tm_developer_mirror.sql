-- Section 20: work raised here now reaches the developer's board.
--
-- The bridge kept an existing pair of rows in step, which was enough while
-- every task began life in Developer Manager. A task raised in the Task
-- Manager and assigned to a developer produced no developer row at all.

create unique index if not exists developer_tasks_tm_task_id_unique
  on public.developer_tasks(tm_task_id) where tm_task_id is not null;

CREATE OR REPLACE FUNCTION public.tm_status_to_developer(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select case lower(coalesce(p, ''))
    when 'new'                 then 'assigned'
    when 'routed'              then 'assigned'
    when 'available_for_claim' then 'assigned'
    when 'claimed'             then 'accepted'
    when 'assigned'            then 'assigned'
    when 'accepted'            then 'accepted'
    when 'in_progress'         then 'working'
    when 'on_hold'             then 'paused'
    when 'blocked'             then 'blocked'
    when 'waiting_client'      then 'submitted'
    when 'ai_review'           then 'submitted'
    when 'testing'             then 'testing'
    when 'submitted'           then 'submitted'
    when 'under_review'        then 'testing'
    when 'approved'            then 'completed'
    when 'rejected'            then 'working'
    when 'completed'           then 'completed'
    when 'failed'              then 'cancelled'
    when 'closed'              then 'completed'
    when 'cancelled'           then 'cancelled'
    else 'assigned'
  end;
$function$;

CREATE OR REPLACE FUNCTION public.tm_mirror_to_developer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_dev  uuid;
  v_role text;
begin
  -- Only ever reached from a direct write; the paired trigger going the other
  -- way must not cause this one to write back.
  if pg_trigger_depth() > 1 then
    return null;
  end if;

  if new.assigned_to is null then
    return null;
  end if;

  -- Already bridged: the existing sync trigger keeps it in step.
  if exists (select 1 from public.developer_tasks where tm_task_id = new.id) then
    return null;
  end if;

  select m.role into v_role from public.tm_members m where m.id = new.assigned_to;
  v_dev := public.tm_developer_for_member(new.assigned_to);

  -- Work assigned to somebody who is not a developer does not belong on a
  -- developer board, so nothing is created for it.
  if v_dev is null and coalesce(lower(v_role), '') <> 'developer' then
    return null;
  end if;

  insert into public.developer_tasks
    (title, category, status, developer_id, progress_percent, tm_task_id)
  values (new.title,
          coalesce(new.category, 'general'),
          public.tm_status_to_developer(new.status),
          v_dev,
          coalesce(new.progress, 0),
          new.id);

  insert into public.tm_activity (task_id, actor_name, actor_role, action, action_type, details)
  values (new.id, 'Task Manager', 'system', 'Mirrored to Developer Manager', 'bridge',
          format('developer_id %s', coalesce(v_dev::text, 'unassigned')));

  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.tm_open_developer_task(p_title text, p_description text DEFAULT ''::text, p_developer_id uuid DEFAULT NULL::uuid, p_priority text DEFAULT 'medium'::text, p_deadline timestamp with time zone DEFAULT NULL::timestamp with time zone, p_amount numeric DEFAULT NULL::numeric, p_module text DEFAULT 'developer_manager'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_task public.tm_tasks%rowtype;
  v_dev  uuid;
  v_code text;
begin
  if not public.tm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  v_code := 'DEV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.tm_tasks (code, title, description, module, status, priority,
                               deadline, assigned_to, billable, cost, buzzer_active)
  values (v_code, p_title, coalesce(p_description, ''), p_module,
          case when p_developer_id is null then 'new' else 'assigned' end,
          p_priority, p_deadline,
          public.tm_member_for_developer(p_developer_id),
          p_amount is not null, coalesce(p_amount, 0),
          p_developer_id is null)
  returning * into v_task;

  -- Assigning the task above may already have mirrored it. Fill in the detail
  -- that only this call knows rather than creating a second row.
  select id into v_dev from public.developer_tasks where tm_task_id = v_task.id;

  if v_dev is null then
    insert into public.developer_tasks (title, description, status, priority,
                                        developer_id, deadline, task_amount, tm_task_id)
    values (p_title, coalesce(p_description, ''),
            public.tm_status_to_developer(v_task.status), p_priority,
            p_developer_id, p_deadline, p_amount, v_task.id)
    returning id into v_dev;
  else
    update public.developer_tasks
       set description  = coalesce(nullif(p_description, ''), description),
           priority     = p_priority,
           developer_id = coalesce(p_developer_id, developer_id),
           deadline     = coalesce(p_deadline, deadline),
           task_amount  = coalesce(p_amount, task_amount)
     where id = v_dev;
  end if;

  insert into public.tm_activity (task_id, actor_name, actor_role, action, action_type, details)
  values (v_task.id, 'developer_manager', 'operator', 'Task opened', 'create',
          'Opened on the canonical engine and mirrored to developer_tasks');

  return jsonb_build_object('ok', true, 'tm_task_id', v_task.id,
                            'developer_task_id', v_dev, 'code', v_code);
end;
$function$;

drop trigger if exists trg_tm_task_mirror_to_developer on public.tm_tasks;
CREATE TRIGGER trg_tm_task_mirror_to_developer AFTER INSERT OR UPDATE OF assigned_to ON public.tm_tasks FOR EACH ROW EXECUTE FUNCTION tm_mirror_to_developer();
