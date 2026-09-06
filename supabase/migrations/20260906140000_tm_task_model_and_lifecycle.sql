-- Section 3's task model, and section 4's lifecycle.
--
-- The row carried no severity distinct from priority, no role to route to
-- before a person is chosen, no way to point back at the record in the module
-- that raised the work, and no currency beside its amount.
--
-- More importantly, the transition rules lived only in application code, so
-- anything holding a PostgREST token could move a task from new straight to
-- completed and skip every gate on the way. They are enforced here now, which
-- means they hold for the screens, for the reusable service, for another
-- module writing directly, and for an integration nobody has written yet.

alter table public.tm_tasks
  add column if not exists task_type          text,
  add column if not exists severity           text    not null default 'medium',
  add column if not exists source_reference   text,
  add column if not exists assigned_role      text,
  add column if not exists currency           text    not null default 'INR',
  add column if not exists project_name       text,
  add column if not exists claimed_at         timestamptz,
  add column if not exists submitted_at       timestamptz,
  add column if not exists reviewed_at        timestamptz,
  add column if not exists approved_at        timestamptz,
  add column if not exists closed_at          timestamptz,
  add column if not exists sla_policy         text,
  add column if not exists hold_reason        text,
  add column if not exists hold_until         timestamptz,
  add column if not exists acknowledged_by    uuid,
  add column if not exists billing_status     text    not null default 'not_billable',
  add column if not exists invoice_reference  text,
  add column if not exists payment_reference  text,
  add column if not exists settled_at         timestamptz,
  add column if not exists updated_by         uuid,
  add column if not exists metadata           jsonb   not null default '{}'::jsonb;

alter table public.tm_tasks drop constraint if exists tm_tasks_severity_check;
alter table public.tm_tasks add constraint tm_tasks_severity_check
  check (severity = any (array['low','medium','high','critical']));

alter table public.tm_tasks drop constraint if exists tm_tasks_billing_status_check;
alter table public.tm_tasks add constraint tm_tasks_billing_status_check
  check (billing_status = any (array['not_billable','pending','invoiced','settled','written_off']));

alter table public.tm_tasks drop constraint if exists tm_tasks_status_check;
alter table public.tm_tasks add constraint tm_tasks_status_check
  check (status = any (array[
    'new','routed','available_for_claim','claimed','assigned','accepted',
    'in_progress','on_hold','blocked','waiting_client','ai_review','testing',
    'submitted','under_review','approved','rejected',
    'completed','cancelled','failed','closed'
  ]));

create index if not exists tm_tasks_status_idx        on public.tm_tasks(status);
create index if not exists tm_tasks_priority_idx      on public.tm_tasks(priority);
create index if not exists tm_tasks_severity_idx      on public.tm_tasks(severity);
create index if not exists tm_tasks_assigned_to_idx   on public.tm_tasks(assigned_to);
create index if not exists tm_tasks_assigned_role_idx on public.tm_tasks(assigned_role);
create index if not exists tm_tasks_module_idx        on public.tm_tasks(module);
create index if not exists tm_tasks_source_ref_idx    on public.tm_tasks(source_reference);
create index if not exists tm_tasks_deadline_idx      on public.tm_tasks(deadline);
create index if not exists tm_tasks_created_at_idx    on public.tm_tasks(created_at desc);
create index if not exists tm_tasks_updated_at_idx    on public.tm_tasks(updated_at desc);
create index if not exists tm_tasks_client_idx        on public.tm_tasks(client_name);
create index if not exists tm_tasks_project_idx       on public.tm_tasks(project_name);
create index if not exists tm_tasks_billing_idx       on public.tm_tasks(billing_status);
create index if not exists tm_activity_task_idx       on public.tm_activity(task_id, created_at desc);
create index if not exists tm_escalations_task_idx    on public.tm_escalations(task_id, level);

CREATE OR REPLACE FUNCTION public.tm_pool_statuses()
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  -- Work nobody has taken on yet: raised, routed to a role, offered to the
  -- pool, or handed to somebody who has not yet accepted it.
  select array['new','routed','available_for_claim','assigned']::text[];
$function$;

CREATE OR REPLACE FUNCTION public.tm_allowed_transitions(p_from text)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select case p_from
    when 'new'                 then array['routed','available_for_claim','assigned','claimed','accepted','cancelled']
    when 'routed'              then array['available_for_claim','assigned','claimed','accepted','cancelled']
    when 'available_for_claim' then array['claimed','assigned','accepted','routed','cancelled']
    when 'claimed'             then array['accepted','in_progress','available_for_claim','cancelled']
    when 'assigned'            then array['accepted','in_progress','claimed','new','cancelled']
    when 'accepted'            then array['in_progress','on_hold','blocked','completed','cancelled']
    when 'in_progress'         then array['on_hold','blocked','waiting_client','ai_review','testing','submitted','completed','failed','cancelled']
    when 'on_hold'             then array['in_progress','accepted','blocked','cancelled']
    when 'blocked'             then array['in_progress','on_hold','failed','cancelled']
    when 'waiting_client'      then array['in_progress','on_hold','cancelled']
    when 'ai_review'           then array['in_progress','testing','submitted','rejected','completed']
    when 'testing'             then array['in_progress','submitted','rejected','failed','completed']
    when 'submitted'           then array['under_review','approved','rejected','in_progress']
    when 'under_review'        then array['approved','rejected','in_progress','testing']
    when 'approved'            then array['completed','closed']
    -- Rejection is a round trip, not an ending: the work goes back and returns.
    when 'rejected'            then array['in_progress','submitted','closed','cancelled']
    when 'completed'           then array['approved','closed']
    when 'failed'              then array['in_progress','closed','cancelled']
    when 'cancelled'           then array['closed']
    when 'closed'              then array[]::text[]
    else array[]::text[]
  end;
$function$;

CREATE OR REPLACE FUNCTION public.tm_enforce_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- A change arriving from another trigger is the Developer Manager bridge
  -- mapping its own vocabulary across. That mapping is constrained at its own
  -- end; re-checking it here would only fight it.
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if not (new.status = any (public.tm_allowed_transitions(old.status))) then
    raise exception
      'invalid task transition: % cannot become % (allowed: %)',
      old.status, new.status, array_to_string(public.tm_allowed_transitions(old.status), ', ')
      using errcode = 'check_violation';
  end if;

  -- Stamp the moments the lifecycle cares about, so they cannot be forgotten
  -- by whichever caller happened to make the change.
  if new.status = 'claimed'      and new.claimed_at   is null then new.claimed_at   := now(); end if;
  if new.status = 'in_progress'  and new.started_at   is null then new.started_at   := now(); end if;
  if new.status = 'submitted'    and new.submitted_at is null then new.submitted_at := now(); end if;
  if new.status = 'under_review' and new.reviewed_at  is null then new.reviewed_at  := now(); end if;
  if new.status = 'approved'     and new.approved_at  is null then new.approved_at  := now(); end if;
  if new.status = 'completed'    and new.completed_at is null then new.completed_at := now(); end if;
  if new.status = 'closed'       and new.closed_at    is null then new.closed_at    := now(); end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.tm_claim_task(p_task_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_member  uuid;
  v_claimed public.tm_tasks%rowtype;
  v_current uuid;
begin
  v_member := public.tm_my_member_id();
  if v_member is null then
    return jsonb_build_object('ok', false, 'reason', 'not_a_member');
  end if;

  -- The whole race is decided by this one statement. Postgres locks the row
  -- while it evaluates the WHERE clause, so of two simultaneous callers exactly
  -- one can still see assigned_to IS NULL. The loser updates nothing.
  update public.tm_tasks
     set assigned_to  = v_member,
         status       = 'accepted',
         accepted_at  = now(),
         claimed_at   = coalesce(claimed_at, now()),
         buzzer_active = false,
         buzzer_acknowledged_at = now(),
         acknowledged_by = v_member,
         updated_at   = now()
   where id = p_task_id
     and assigned_to is null
     and status = any (public.tm_pool_statuses())
  returning * into v_claimed;

  if not found then
    select assigned_to into v_current from public.tm_tasks where id = p_task_id;
    return jsonb_build_object(
      'ok', false,
      'reason', case when v_current is null then 'not_claimable' else 'already_claimed' end,
      'claimed_by', v_current
    );
  end if;

  insert into public.tm_activity (task_id, actor_name, actor_role, action, action_type,
                                  from_value, to_value, details)
  values (p_task_id,
          coalesce((select full_name from public.tm_members where id = v_member), 'member'),
          'member', 'Task claimed', 'claim', 'unassigned', v_member::text,
          'Claimed through tm_claim_task');

  return jsonb_build_object('ok', true, 'task_id', p_task_id, 'member_id', v_member);
end;
$function$;

drop trigger if exists tm_tasks_enforce_transition on public.tm_tasks;
CREATE TRIGGER tm_tasks_enforce_transition BEFORE UPDATE ON public.tm_tasks FOR EACH ROW EXECUTE FUNCTION tm_enforce_transition();
