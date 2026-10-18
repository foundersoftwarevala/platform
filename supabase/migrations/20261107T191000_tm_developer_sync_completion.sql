-- M10: a task completed in Developer Manager settles its promises and runs its
-- automations, like one completed in Task Manager.
--
-- tm_sync_from_developer_task copies a developer task's status onto its
-- Task Manager task. That write happens one trigger level down, and the
-- promise settlement (tm_task_completion_to_promises) and the automations
-- (tm_fire_automations) both returned early at any depth above 1 - a guard
-- meant to stop the two systems mirroring each other forever and automations
-- re-entering themselves. So completions from Developer Manager never settled
-- their promises or fired their automations.
--
-- The sync now marks its own write (sv.tm_origin = 'developer', for that one
-- statement), and the two triggers accept exactly that write at depth 2.
-- Anything deeper - an automation editing the task again - is still stopped,
-- and the mirror back to developer_tasks still stops at depth 2 as before.

begin;

create or replace function public.tm_sync_from_developer_task()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
BEGIN
  -- fired by the other trigger's write; the change is already applied
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF NEW.tm_task_id IS NULL THEN RETURN NEW; END IF;
  -- Lets promise settlement and automations treat this write as a real
  -- status change rather than as a mirror echo.
  PERFORM set_config('sv.tm_origin', 'developer', true);
  UPDATE public.tm_tasks t
     SET status      = public.tm_status_from_developer(NEW.status),
         progress    = coalesce(NEW.progress_percent, t.progress),
         deadline    = coalesce(NEW.deadline, t.deadline),
         assigned_to = coalesce(public.tm_member_for_developer(NEW.developer_id), t.assigned_to),
         updated_at  = now()
   WHERE t.id = NEW.tm_task_id
     AND (t.status IS DISTINCT FROM public.tm_status_from_developer(NEW.status)
          OR t.progress IS DISTINCT FROM coalesce(NEW.progress_percent, t.progress));
  PERFORM set_config('sv.tm_origin', '', true);
  RETURN NEW;
END;
$function$;

create or replace function public.tm_task_completion_to_promises()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  -- Deeper writes are echoes; the developer sync's own write is not.
  if pg_trigger_depth() > 1
     and not (pg_trigger_depth() = 2 and coalesce(current_setting('sv.tm_origin', true), '') = 'developer') then
    return null;
  end if;
  if new.status is distinct from old.status
     and new.status in ('completed', 'approved', 'closed') then
    perform public.pt_task_completed(new.id);
  end if;
  return null;
end;
$function$;

create or replace function public.tm_fire_automations()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  -- An automation that edits the task would otherwise re-enter this trigger.
  -- The developer sync's own write (depth 2) is a real change and runs.
  if pg_trigger_depth() > 1
     and not (pg_trigger_depth() = 2 and coalesce(current_setting('sv.tm_origin', true), '') = 'developer') then
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

commit;
