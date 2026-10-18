-- Follow-ups to 20261107T230000 / T231000, from the timer, submission and
-- notification audit (sv_platform, 2026-10-02; every hole proven in a
-- rolled-back transaction with real accounts):
--
--  1. developer_tasks_guard_self_update checked only the NEW status. A developer
--     moved their own completed task back to 'working'; the mirror then took the
--     Task Manager task from completed to in_progress past tm_enforce_transition,
--     with completed_at left set. Live today for any developer with a profile.
--     Now a closed task (completed, delivered, cancelled) is not reopened by its
--     developer; reviewers reopen through review_developer_submission.
--  2. tm_tasks_member_update let the assignee write every column: complete their
--     own task with no review (the developer mirror then completed too and AMS
--     issued awards), and set cost, billing, payment reference, approval and
--     quality. A guard now limits a member's direct writes to the statuses the
--     Task Manager gives an assignee and freezes money, approval, assignment and
--     closure fields. Timer columns are untouched here (the browser timer still
--     writes them; a server-side timer is a separate change).
--  3. tm_notifications_write (FOR ALL) let an assignee edit or delete the
--     manager's alerts on their task. The app's member writes are "mark read"
--     and inserting notes; deleting and editing alert text are operator-only.
--  4. tm_time_logs: no lower bound on seconds; members could rewrite and delete
--     their own logs (the app never does either). seconds >= 0; update/delete
--     operator-only.
--  5. developer_code_submissions: a submission could be filed on a closed task,
--     and two pending submissions on one task left one undecidable forever.
--     Filing needs an open task; one pending submission per task.
--  6. A review decision told the developer nothing. review_developer_submission
--     now also writes the developer's notification (user_notifications, which
--     the bell reads), in the same transaction.
--  7. tm_status_from_developer had no mapping for 'reopened' (changes
--     requested), so the Task Manager showed the reworked task as 'assigned'.
--     It maps to in_progress.
--  8. tm_sync_from_developer_task updated tm_tasks only when status or progress
--     differed, so a reassignment (developer_id only) never reached
--     tm_tasks.assigned_to.

-- 1 ---------------------------------------------------------------------------
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
     and (old.status in ('completed', 'delivered', 'cancelled')
          or new.status not in ('accepted', 'working', 'in_progress', 'paused', 'on_hold', 'blocked', 'submitted')) then
    raise exception 'A task is completed or reopened by its reviewer, not by the developer'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- 2 ---------------------------------------------------------------------------
create or replace function public.tm_guard_member_task_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Functions running as their owner (claim, mirror, sweeps), the service key
  -- and Task Manager operators are not limited here.
  if current_user not in ('authenticated', 'anon') or public.tm_is_operator() then
    return new;
  end if;

  if new.status is distinct from old.status
     and (old.status in ('approved', 'completed', 'cancelled', 'failed', 'closed')
          or new.status not in ('accepted', 'in_progress', 'on_hold', 'blocked', 'waiting_client', 'submitted')) then
    raise exception 'This status is set by the Task Manager, not by the assignee'
      using errcode = '42501';
  end if;

  if (new.assigned_to, new.created_by, new.cost, new.billable, new.billing_status,
      new.invoice_reference, new.payment_reference, new.settled_at, new.currency,
      new.approval_status, new.approved_at, new.reviewed_at, new.closed_at, new.completed_at,
      new.quality_score, new.escalation_level, new.sla_hours, new.sla_policy, new.deadline,
      new.priority)
     is distinct from
     (old.assigned_to, old.created_by, old.cost, old.billable, old.billing_status,
      old.invoice_reference, old.payment_reference, old.settled_at, old.currency,
      old.approval_status, old.approved_at, old.reviewed_at, old.closed_at, old.completed_at,
      old.quality_score, old.escalation_level, old.sla_hours, old.sla_policy, old.deadline,
      old.priority) then
    raise exception 'Assignment, billing, approval and deadlines are set by the Task Manager'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists tm_tasks_guard_member_update on public.tm_tasks;
create trigger tm_tasks_guard_member_update
  before update on public.tm_tasks
  for each row execute function public.tm_guard_member_task_update();

-- 3 ---------------------------------------------------------------------------
drop policy if exists tm_notifications_insert on public.tm_notifications;
drop policy if exists tm_notifications_update on public.tm_notifications;
drop policy if exists tm_notifications_delete on public.tm_notifications;
drop policy if exists tm_notifications_write on public.tm_notifications;
create policy tm_notifications_insert on public.tm_notifications
  for insert to authenticated
  with check (
    tm_is_operator()
    or exists (
      select 1 from public.tm_tasks t
      where t.id = tm_notifications.task_id
        and (t.assigned_to = tm_my_member_id()
             or (t.assigned_to is null and t.status = any (tm_pool_statuses())))
    )
  );
create policy tm_notifications_update on public.tm_notifications
  for update to authenticated
  using (
    tm_is_operator()
    or exists (
      select 1 from public.tm_tasks t
      where t.id = tm_notifications.task_id and t.assigned_to = tm_my_member_id()
    )
  )
  with check (
    tm_is_operator()
    or exists (
      select 1 from public.tm_tasks t
      where t.id = tm_notifications.task_id and t.assigned_to = tm_my_member_id()
    )
  );
create policy tm_notifications_delete on public.tm_notifications
  for delete to authenticated
  using (tm_is_operator());

create or replace function public.tm_guard_member_notification_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.tm_is_operator() then
    return new;
  end if;
  -- An assignee marks an alert read; its content stays as the manager wrote it.
  if (new.task_id, new.title, new.message, new.level, new.channel, new.created_at)
     is distinct from
     (old.task_id, old.title, old.message, old.level, old.channel, old.created_at) then
    raise exception 'An assignee can only mark a Task Manager alert as read'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists tm_notifications_guard_member_update on public.tm_notifications;
create trigger tm_notifications_guard_member_update
  before update on public.tm_notifications
  for each row execute function public.tm_guard_member_notification_update();

-- 4 ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.tm_time_logs'::regclass
      and conname = 'tm_time_logs_seconds_nonnegative'
  ) then
    alter table public.tm_time_logs
      add constraint tm_time_logs_seconds_nonnegative
      check (seconds is null or seconds >= 0);
  end if;
end;
$$;

alter policy tm_time_logs_update on public.tm_time_logs
  using (tm_is_operator()) with check (tm_is_operator());
alter policy tm_time_logs_delete on public.tm_time_logs
  using (tm_is_operator());

-- 5 ---------------------------------------------------------------------------
alter policy developers_insert_own_submissions on public.developer_code_submissions
  with check (
    developer_id in (select developers.id from public.developers where developers.user_id = auth.uid())
    and exists (
      select 1 from public.developer_tasks t
      where t.id = developer_code_submissions.task_id
        and t.developer_id = developer_code_submissions.developer_id
        and t.status not in ('completed', 'delivered', 'cancelled')
    )
    and coalesce(review_status, 'submitted') = 'submitted'
    and reviewed_by is null
    and reviewed_at is null
    and review_notes is null
  );

create unique index if not exists developer_code_submissions_one_pending_per_task
  on public.developer_code_submissions (task_id)
  where review_status = 'submitted';

-- 6 ---------------------------------------------------------------------------
create or replace function public.review_developer_submission(_submission_id uuid, _decision text, _notes text)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  s public.developer_code_submissions%rowtype;
  t public.developer_tasks%rowtype;
  next_status text;
  dev_user uuid;
begin
  if not (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'boss')) then
    raise exception 'Reviewer access required';
  end if;
  if _decision not in ('approved', 'changes_requested') or nullif(btrim(_notes), '') is null then
    raise exception 'Invalid review decision';
  end if;
  select * into s from public.developer_code_submissions
   where id = _submission_id and review_status = 'submitted' for update;
  if not found then raise exception 'Submission is not awaiting review'; end if;
  next_status := case when _decision = 'approved' then 'completed' else 'reopened' end;
  update public.developer_code_submissions
     set review_status = _decision, review_notes = btrim(_notes), reviewed_by = auth.uid(), reviewed_at = now()
   where id = _submission_id
   returning * into s;
  update public.developer_tasks
     set status = next_status,
         completed_at = case when _decision = 'approved' then now() else null end,
         updated_at = now()
   where id = s.task_id and status = 'submitted'
   returning * into t;
  if not found then raise exception 'Task is not awaiting review'; end if;
  insert into public.developer_activity_logs (developer_id, activity_type, description, metadata)
  values (s.developer_id,
          case when _decision = 'approved' then 'task_approved' else 'task_changes_requested' end,
          btrim(_notes),
          jsonb_build_object('task_id', s.task_id, 'submission_id', _submission_id, 'reviewer_id', auth.uid()));

  -- The developer hears the decision (the bell reads user_notifications).
  select d.user_id into dev_user from public.developers d where d.id = s.developer_id;
  if dev_user is not null then
    insert into public.user_notifications (user_id, type, message, event_type, action_url, dedupe_key, data)
    values (
      dev_user,
      case when _decision = 'approved' then 'success' else 'warning' end,
      case when _decision = 'approved'
           then format('Your work on "%s" was approved.', t.title)
           else format('Changes requested on "%s": %s', t.title, btrim(_notes)) end,
      case when _decision = 'approved' then 'developer.submission.approved'
           else 'developer.submission.changes_requested' end,
      '/dashboard/developer?module=code-submission',
      'developer.review:' || _submission_id::text,
      jsonb_build_object('task_id', s.task_id, 'submission_id', _submission_id, 'decision', _decision)
    );
  end if;

  return jsonb_build_object('submission', to_jsonb(s), 'task', to_jsonb(t));
end;
$function$;

-- 7 ---------------------------------------------------------------------------
create or replace function public.tm_status_from_developer(p text)
returns text
language sql
immutable
as $function$
  select case lower(coalesce(p, ''))
    when 'assigned'    then 'assigned'
    when 'accepted'    then 'accepted'
    when 'working'     then 'in_progress'
    when 'in_progress' then 'in_progress'
    when 'reopened'    then 'in_progress'
    when 'paused'      then 'on_hold'
    when 'on_hold'     then 'on_hold'
    when 'blocked'     then 'blocked'
    when 'submitted'   then 'ai_review'
    when 'review'      then 'ai_review'
    when 'testing'     then 'testing'
    when 'completed'   then 'completed'
    when 'delivered'   then 'completed'
    when 'cancelled'   then 'cancelled'
    else 'assigned'
  end;
$function$;

-- 8 ---------------------------------------------------------------------------
create or replace function public.tm_sync_from_developer_task()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- fired by the other trigger's write; the change is already applied
  if pg_trigger_depth() > 1 then return new; end if;
  if new.tm_task_id is null then return new; end if;
  -- Lets promise settlement and automations treat this write as a real
  -- status change rather than as a mirror echo.
  perform set_config('sv.tm_origin', 'developer', true);
  update public.tm_tasks t
     set status      = public.tm_status_from_developer(new.status),
         progress    = coalesce(new.progress_percent, t.progress),
         deadline    = coalesce(new.deadline, t.deadline),
         assigned_to = coalesce(public.tm_member_for_developer(new.developer_id), t.assigned_to),
         updated_at  = now()
   where t.id = new.tm_task_id
     and (t.status is distinct from public.tm_status_from_developer(new.status)
          or t.progress is distinct from coalesce(new.progress_percent, t.progress)
          or t.assigned_to is distinct from coalesce(public.tm_member_for_developer(new.developer_id), t.assigned_to));
  perform set_config('sv.tm_origin', '', true);
  return new;
end;
$function$;
