-- CRM tasks are read by CRM staff and by the person a task belongs to.
--
-- The policy "read crm_tasks" allowed every signed-in account to read every
-- task (USING true). A reseller's own token read all seven tasks in the table,
-- none of them theirs, straight from /rest/v1/crm_tasks (reproduced by
-- scripts/ops/reseller-api-security-verify.mjs). Its sister tables already
-- say who may read: crm_customers and team_members use is_crm_staff().
--
-- The read now allows CRM staff, as on those tables, and the task's owner.
-- A task's owner_id is a team_members row; the reseller dashboard finds a
-- reseller's row by their email (lib/reseller-dashboard.functions.ts,
-- ownerIdFor), so ownership is matched the same way here - against the
-- caller's confirmed email in auth.users, never a claim the caller could set.
-- team_members is itself readable only by staff, so the match runs in a
-- SECURITY DEFINER function that answers one yes/no for one task.
--
-- Writing is unchanged: support staff only ("staff write crm_tasks"). A
-- reseller's follow-ups are written by the server, which sets the owner.
-- Anonymous access stays denied by the restrictive anon_write_denied policy.

begin;

create or replace function public.crm_task_owned_by_caller(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_owner is not null and exists (
    select 1
      from public.team_members tm
      join auth.users u on lower(u.email) = lower(tm.email)
     where tm.id = p_owner
       and u.id = auth.uid()
       and u.email_confirmed_at is not null
  );
$$;

revoke all on function public.crm_task_owned_by_caller(uuid) from public, anon;
grant execute on function public.crm_task_owned_by_caller(uuid) to authenticated, service_role;

alter policy "read crm_tasks" on public.crm_tasks
  using (public.is_crm_staff(auth.uid()) or public.crm_task_owned_by_caller(owner_id));

commit;
