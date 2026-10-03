-- Write guards for the modules a developer works through: chat, promises,
-- assist sessions, Task Manager comments and time logs, and the Dev Manager's
-- escalation history.
--
-- Each hole below was proven on sv_platform (2026-10-02) in a transaction that
-- was rolled back, with real accounts. None of these changes is a business
-- decision; the open policy questions (may an owner self-fulfil a promise, may a
-- non-manager name another user as owner, who may look a user up by e-mail,
-- what managers may do with tips and fines) are left exactly as they are.
--
--  1. conversation_participants "add participants to own conversations" let any
--     signed-in user insert themselves (user_id = auth.uid()) into ANY
--     conversation: a customer joined a reseller's thread, read its messages,
--     posted, and added others. The app only ever inserts participants into a
--     conversation it has just created (chat-service createConversation,
--     ChatScreen), which the creator branch still allows.
--  2. "update own membership" allowed every column of one's own row, so a
--     member could set role_label = 'owner'. The app updates only
--     last_read_at, favorite and muted.
--  3. A promise owner could set tip_amount, tip_status, fine_*, approval_status
--     and approved_by on their own promise (bypassing pt_release_tip /
--     pt_apply_fine), and any signed-in user could INSERT a promise that was
--     already fulfilled with a released tip and an approval by someone else.
--     Status changes and deadline extensions by owners are untouched.
--  4. assist_sessions: an agent could create a session that was already active
--     with full control and the target's consent filled in, and either party
--     could rewrite consent, operator, target and access mode directly. The
--     app writes only status and timing; consent goes through the
--     assist_grant_consent / assist_revoke_consent functions, which run as
--     their owner and are not affected.
--  5. assist_session_requests could be inserted already 'approved'.
--  6. tm_comments / tm_time_logs write policies (FOR ALL) let any signed-in
--     user - member or not - write, edit and delete on pool tasks, and post as
--     another member. Members keep writing on their own and pool tasks as
--     themselves; operators keep full control.
--  7. marketing_notify (SECURITY DEFINER, no caller check, no caller in the
--     app or the database) let any signed-in user notify every admin.
--     pt_owner_scorecard returned anyone's promise totals, tips and fines; no
--     caller in the app or the database. tm_member_for_developer and
--     tm_developer_for_member were executable by anon.
--  8. Operators could DELETE escalation and internal-note history (policies
--     FOR ALL). The Dev Manager writes them with the service key, which is not
--     affected; nothing deletes them.
--  9. developers.current_task_id had no foreign key (0 dangling rows).

-- 1. Joining a conversation: only its creator or an existing member adds people.
alter policy "add participants to own conversations" on public.conversation_participants
  with check (
    is_participant(conversation_id, auth.uid())
    or exists (
      select 1 from public.conversations c
      where c.id = conversation_participants.conversation_id
        and c.created_by = auth.uid()
    )
  );

-- 2. A member changes only their own read marker, favourite and mute.
revoke update on public.conversation_participants from authenticated;
grant update (last_read_at, favorite, muted) on public.conversation_participants to authenticated;

-- 3. Promises: money, approval and ownership stay with operators, managers and
--    the promise functions.
create or replace function public.pt_guard_owner_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Functions running as their owner (pt_apply_fine, pt_release_tip, the
  -- sweeps), the service key, operators and managers are not limited here.
  if current_user not in ('authenticated', 'anon')
     or public.pt_is_operator() or public.pt_is_manager() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'pending_approval', 'pending', 'active')
       or coalesce(new.tip_amount, 0) <> 0 or coalesce(new.fine_amount, 0) <> 0
       or coalesce(new.tip_status, 'none') <> 'none' or coalesce(new.fine_status, 'none') <> 'none'
       or coalesce(new.approval_status, 'not_required') not in ('not_required', 'pending')
       or new.approved_by is not null or new.approved_at is not null
       or coalesce(new.is_locked, false) or new.locked_by is not null then
      raise exception 'A new promise starts open, unapproved and without tip or fine'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if (new.tip_amount, new.tip_status, new.fine_amount, new.fine_status, new.approval_status,
      new.approved_by, new.approved_at, new.owner_user_id, new.receiver_user_id, new.created_by)
     is distinct from
     (old.tip_amount, old.tip_status, old.fine_amount, old.fine_status, old.approval_status,
      old.approved_by, old.approved_at, old.owner_user_id, old.receiver_user_id, old.created_by) then
    raise exception 'Tips, fines, approval and ownership of a promise are set by its managers'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists promises_guard_owner_fields on public.promises;
create trigger promises_guard_owner_fields
  before insert or update on public.promises
  for each row execute function public.pt_guard_owner_fields();

-- 4. Assist sessions start pending and without consent; identity, access and
--    consent change only through the assist functions or an assist operator.
alter policy assist_sessions_insert on public.assist_sessions
  with check (
    assist_is_agent()
    and created_by = auth.uid()
    and status = 'pending'
    and not coalesce(consent_granted, false)
    and consent_by is null
    and consent_at is null
  );

create or replace function public.assist_guard_session_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.assist_is_operator() then
    return new;
  end if;
  if (new.consent_granted, new.consent_at, new.consent_by, new.consent_revoked_at,
      new.operator_user_id, new.target_user_id, new.end_user_id, new.agent_id, new.created_by,
      new.access_mode, new.permissions, new.risk_level)
     is distinct from
     (old.consent_granted, old.consent_at, old.consent_by, old.consent_revoked_at,
      old.operator_user_id, old.target_user_id, old.end_user_id, old.agent_id, old.created_by,
      old.access_mode, old.permissions, old.risk_level) then
    raise exception 'Consent, participants and access of an assist session change only through the assist workflow'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists assist_sessions_guard_fields on public.assist_sessions;
create trigger assist_sessions_guard_fields
  before update on public.assist_sessions
  for each row execute function public.assist_guard_session_fields();

-- 5. An assist request is raised pending; reviewers decide it.
alter policy assist_requests_insert on public.assist_session_requests
  with check (
    assist_is_agent()
    and requested_by = auth.uid()
    and coalesce(status, 'pending') = 'pending'
    and reviewed_by is null
    and reviewed_at is null
  );

-- 6. Task Manager comments and time logs: members write as themselves.
drop policy if exists tm_comments_write on public.tm_comments;
create policy tm_comments_insert on public.tm_comments
  for insert to authenticated
  with check (
    tm_is_operator()
    or (
      tm_my_member_id() is not null
      and (author_id is null or author_id = tm_my_member_id())
      and not coalesce(is_system, false)
      and exists (
        select 1 from public.tm_tasks t
        where t.id = tm_comments.task_id
          and (t.assigned_to = tm_my_member_id()
               or (t.assigned_to is null and t.status = any (tm_pool_statuses())))
      )
    )
  );
create policy tm_comments_update on public.tm_comments
  for update to authenticated
  using (tm_is_operator() or (author_id is not null and author_id = tm_my_member_id()))
  with check (tm_is_operator() or (author_id is not null and author_id = tm_my_member_id()));
create policy tm_comments_delete on public.tm_comments
  for delete to authenticated
  using (tm_is_operator() or (author_id is not null and author_id = tm_my_member_id()));

drop policy if exists tm_time_logs_write on public.tm_time_logs;
create policy tm_time_logs_insert on public.tm_time_logs
  for insert to authenticated
  with check (
    tm_is_operator()
    or (
      tm_my_member_id() is not null
      and member_id = tm_my_member_id()
      and exists (
        select 1 from public.tm_tasks t
        where t.id = tm_time_logs.task_id
          and (t.assigned_to = tm_my_member_id()
               or (t.assigned_to is null and t.status = any (tm_pool_statuses())))
      )
    )
  );
create policy tm_time_logs_update on public.tm_time_logs
  for update to authenticated
  using (tm_is_operator() or member_id = tm_my_member_id())
  with check (tm_is_operator() or member_id = tm_my_member_id());
create policy tm_time_logs_delete on public.tm_time_logs
  for delete to authenticated
  using (tm_is_operator() or member_id = tm_my_member_id());

-- 7. Functions that check nothing about their caller.
revoke execute on function public.marketing_notify(text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.pt_owner_scorecard(uuid) from public, anon, authenticated;
revoke execute on function public.tm_member_for_developer(uuid) from public, anon;
revoke execute on function public.tm_developer_for_member(uuid) from public, anon;

-- 8. Escalation and internal-note history is kept: read, write, never delete.
drop policy if exists dte_manager_all on public.developer_task_escalations;
create policy dte_manager_read on public.developer_task_escalations
  for select to authenticated using (dev_manager_is_operator());
create policy dte_manager_insert on public.developer_task_escalations
  for insert to authenticated with check (dev_manager_is_operator());
create policy dte_manager_update on public.developer_task_escalations
  for update to authenticated using (dev_manager_is_operator()) with check (dev_manager_is_operator());

drop policy if exists dtin_manager_all on public.developer_task_internal_notes;
create policy dtin_manager_read on public.developer_task_internal_notes
  for select to authenticated using (dev_manager_is_operator());
create policy dtin_manager_insert on public.developer_task_internal_notes
  for insert to authenticated with check (dev_manager_is_operator());
create policy dtin_manager_update on public.developer_task_internal_notes
  for update to authenticated using (dev_manager_is_operator()) with check (dev_manager_is_operator());

-- 9. A developer's current task is a real task.
alter table public.developers
  add constraint developers_current_task_fk
  foreign key (current_task_id) references public.developer_tasks (id) on delete set null;
