-- Section 16: an audit log that cannot be quietly rewritten.
--
-- The table carried one policy covering ALL commands, so whoever could write a
-- row could also edit or delete one. And status changes were audited only when
-- they came through the task service - a direct write left no trace at all.
-- Audit that depends on the caller being polite is not audit.

CREATE OR REPLACE FUNCTION public.tm_activity_is_append_only()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  raise exception 'the task audit log is append-only; % is not permitted', tg_op
    using errcode = 'insufficient_privilege';
end;
$function$;

CREATE OR REPLACE FUNCTION public.tm_audit_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_member uuid;
  v_actor  text;
  v_role   text;
begin
  if new.status is not distinct from old.status then
    return null;
  end if;

  select m.id, m.full_name, m.role into v_member, v_actor, v_role
  from public.tm_members m
  where m.user_id = auth.uid();

  insert into public.tm_activity (task_id, actor_id, actor_name, actor_role,
                                  action, action_type, from_value, to_value, details)
  values (new.id, v_member,
          coalesce(v_actor, case when auth.uid() is null then 'system' else 'account' end),
          coalesce(v_role, 'system'),
          format('Status %s to %s', old.status, new.status),
          'status', old.status, new.status,
          case when new.blocked_reason is distinct from old.blocked_reason
               then new.blocked_reason end);
  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.tm_audit_assignment_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_member uuid;
  v_from   text;
  v_to     text;
begin
  if new.assigned_to is not distinct from old.assigned_to then
    return null;
  end if;

  select id into v_member from public.tm_members where user_id = auth.uid();
  select full_name into v_from from public.tm_members where id = old.assigned_to;
  select full_name into v_to   from public.tm_members where id = new.assigned_to;

  insert into public.tm_activity (task_id, actor_id, actor_name, actor_role,
                                  action, action_type, from_value, to_value)
  values (new.id, v_member, 'Task Manager', 'system',
          case when old.assigned_to is null then 'Task assigned' else 'Task reassigned' end,
          'assignment', coalesce(v_from, 'unassigned'), coalesce(v_to, 'unassigned'));
  return null;
end;
$function$;

drop trigger if exists tm_activity_no_rewrite on public.tm_activity;
CREATE TRIGGER tm_activity_no_rewrite BEFORE DELETE OR UPDATE ON public.tm_activity FOR EACH ROW EXECUTE FUNCTION tm_activity_is_append_only();

drop trigger if exists tm_tasks_audit_assignment on public.tm_tasks;
CREATE TRIGGER tm_tasks_audit_assignment AFTER UPDATE OF assigned_to ON public.tm_tasks FOR EACH ROW EXECUTE FUNCTION tm_audit_assignment_change();

drop trigger if exists tm_tasks_audit_status on public.tm_tasks;
CREATE TRIGGER tm_tasks_audit_status AFTER UPDATE OF status ON public.tm_tasks FOR EACH ROW EXECUTE FUNCTION tm_audit_status_change();

drop policy if exists tm_activity_anon_denied on public.tm_activity;
create policy tm_activity_anon_denied on public.tm_activity
for all
to anon
using (false)
with check (false);

drop policy if exists tm_activity_insert on public.tm_activity;
create policy tm_activity_insert on public.tm_activity
for insert
to authenticated
with check ((tm_is_operator() OR (EXISTS ( SELECT 1
   FROM tm_tasks t
  WHERE ((t.id = tm_activity.task_id) AND ((t.assigned_to = tm_my_member_id()) OR ((t.assigned_to IS NULL) AND (t.status = ANY (ARRAY['new'::text, 'routed'::text, 'available_for_claim'::text, 'assigned'::text])))))))));

drop policy if exists tm_activity_read on public.tm_activity;
create policy tm_activity_read on public.tm_activity
for select
to authenticated
using ((tm_is_operator() OR (EXISTS ( SELECT 1
   FROM tm_tasks t
  WHERE ((t.id = tm_activity.task_id) AND ((t.assigned_to = tm_my_member_id()) OR ((t.assigned_to IS NULL) AND (t.status = ANY (tm_pool_statuses()))))))) OR ((task_id IS NULL) AND tm_is_operator())));
