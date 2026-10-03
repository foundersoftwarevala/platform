-- Developers cannot pay, approve or reassign themselves.
--
-- Before this, three paths let a signed-in user change money or approval state
-- that only a reviewer or the platform should set (read from policy and
-- function text on sv_platform, 2026-10-02):
--
-- 1. developer_tasks policy developers_update_own_tasks lets the assigned
--    developer UPDATE every column of their own task: task_amount, title,
--    deadline, and status = 'completed'. The Task Manager mirror
--    (tm_sync_from_developer_task) then carries 'completed' into tm_tasks at
--    trigger depth 2, where tm_enforce_transition is skipped, and that settles
--    every promise linked to the task. Dev Manager's Payment screen sums
--    task_amount over completed tasks.
-- 2. developer_code_submissions policy developers_insert_own_submissions does
--    not constrain review_status, so a developer can file a submission that is
--    already 'approved', with a reviewer and review time of their choosing.
-- 3. pt_task_completed, pt_notify and tm_run_automations are SECURITY DEFINER,
--    check nothing about the caller, and are executable by authenticated:
--    anyone signed in can fulfil every promise linked to any task, or send any
--    notification text to a promise's parties, managers or admins.
--
-- The intended flow is already in the database: the developer works the task
-- and moves it to 'submitted' with a submission; review_developer_submission
-- (admin or boss) then sets 'completed' or 'reopened'. This migration enforces
-- that flow and changes nothing else:
--
-- * A developer may still update their own task's progress fields
--   (progress_percent, progress_note, delivery_notes, links, attachments,
--   tech_stack, started/accepted/paused/delivery times) and move its status
--   among accepted, working, in_progress, paused, on_hold, blocked and
--   submitted.
-- * Assignment, scope and money (developer_id, assigned_by, client_id,
--   task_amount, title, description, category, requirements, priority,
--   deadline, estimated_hours, tm_task_id, created_at, completed_at) and the
--   terminal statuses stay with operators, the service key (Dev Manager server
--   functions) and the Task Manager sync (nested trigger).
-- * A new submission must start unreviewed.
-- * The three helpers are callable only by their definer callers (all owned by
--   postgres) and the service role. No application code calls them directly.

create or replace function public.developer_tasks_guard_self_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Service key (no user), the Task Manager mirror (nested trigger) and
  -- platform operators keep full control.
  if auth.uid() is null or pg_trigger_depth() > 1 or public.dev_manager_is_operator() then
    return new;
  end if;

  if (new.developer_id, new.assigned_by, new.client_id, new.task_amount, new.title,
      new.description, new.category, new.requirements, new.priority, new.deadline,
      new.estimated_hours, new.tm_task_id, new.created_at, new.completed_at)
     is distinct from
     (old.developer_id, old.assigned_by, old.client_id, old.task_amount, old.title,
      old.description, old.category, old.requirements, old.priority, old.deadline,
      old.estimated_hours, old.tm_task_id, old.created_at, old.completed_at) then
    raise exception 'Only a manager can change the assignment, scope or amount of a task'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status
     and new.status not in ('accepted', 'working', 'in_progress', 'paused', 'on_hold', 'blocked', 'submitted') then
    raise exception 'A task is completed or reopened by its reviewer, not by the developer'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists developer_tasks_guard_self_update on public.developer_tasks;
create trigger developer_tasks_guard_self_update
  before update on public.developer_tasks
  for each row execute function public.developer_tasks_guard_self_update();

alter policy developers_insert_own_submissions on public.developer_code_submissions
  with check (
    developer_id in (select developers.id from public.developers where developers.user_id = auth.uid())
    and exists (
      select 1 from public.developer_tasks t
      where t.id = developer_code_submissions.task_id
        and t.developer_id = developer_code_submissions.developer_id
    )
    and coalesce(review_status, 'submitted') = 'submitted'
    and reviewed_by is null
    and reviewed_at is null
    and review_notes is null
  );

revoke execute on function public.pt_task_completed(uuid) from public, anon, authenticated;
revoke execute on function public.pt_notify(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.tm_run_automations(uuid, text) from public, anon, authenticated;
