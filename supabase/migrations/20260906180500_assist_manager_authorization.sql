-- Who may see and do what in Assist Manager.
--
-- The source ships thirty-seven policies and every one of them reads
-- FOR ALL TO anon, authenticated USING (true). On a remote-assistance module
-- that means an anonymous caller could list every session in the business, read
-- the chat inside them, see what files moved, raise a session request against
-- anybody, approve it, and switch off an access restriction. Two later
-- migrations add real rules - a finished session is immutable, a critical
-- privacy control cannot be turned off, a locked setting cannot be changed -
-- and those are good and are kept. They are simply written for the wrong
-- audience.
--
-- The model here is the one section 14 describes: effective permission is the
-- session's approval, and the target's consent, and the caller's role, and the
-- session's own state. No single one of them is sufficient.
--
-- Four kinds of caller:
--   an operator      - Control Panel staff, sees and runs the module
--   a support agent  - sees and runs the sessions they are the agent on
--   a target         - sees the sessions about them, and owns their consent
--   anonymous        - nothing, anywhere

create or replace function public.assist_is_operator()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin','boss','founder','super_admin','boss_owner')
  );
$$;

create or replace function public.assist_is_agent()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  -- Staff who may run an assist session, as distinct from staff who may
  -- authorise one.
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin','boss','founder','super_admin','boss_owner',
                      'support','developer','employee','sales_support_manager')
  );
$$;

-- May the caller see this session at all? Used by every child table so the
-- rule is written once.
create or replace function public.assist_can_see_session(p_session_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.assist_sessions s
    where s.id = p_session_id
      and (
        public.assist_is_operator()
        or s.operator_user_id = auth.uid()
        or s.target_user_id = auth.uid()
        or s.created_by = auth.uid()
        or exists (select 1 from public.assist_agents a
                   where a.id = s.agent_id and a.user_id = auth.uid())
        or exists (select 1 from public.assist_end_users e
                   where e.id = s.end_user_id and e.user_id = auth.uid())
      )
  );
$$;

-- Is this session actually allowed to be doing anything right now?
-- Section 14: approval and consent and state, never just one.
create or replace function public.assist_session_is_live(p_session_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.assist_sessions s
    where s.id = p_session_id
      and s.status in ('active','paused')
      and s.consent_granted
      and s.consent_revoked_at is null
      and exists (
        select 1 from public.assist_approvals a
        where a.session_id = s.id and a.status = 'approved')
  );
$$;

revoke all on function public.assist_is_operator() from public, anon;
revoke all on function public.assist_is_agent() from public, anon;
revoke all on function public.assist_can_see_session(uuid) from public, anon;
revoke all on function public.assist_session_is_live(uuid) from public, anon;
grant execute on function public.assist_is_operator() to authenticated;
grant execute on function public.assist_is_agent() to authenticated;
grant execute on function public.assist_can_see_session(uuid) to authenticated;
grant execute on function public.assist_session_is_live(uuid) to authenticated;

-- ------------------------------------------------------- grants and RLS ----
do $$
declare
  t text;
  tables text[] := array[
    'assist_agents','assist_end_users','assist_sessions','assist_session_requests',
    'assist_approvals','assist_chat_messages','assist_file_transfers',
    'assist_session_windows','assist_ai_suggestions','assist_emergency_stops',
    'assist_privacy_controls','assist_access_modes','assist_settings',
    'assist_control_state','assist_audit_logs'
  ];
begin
  foreach t in array tables
  loop
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('alter table public.%I enable row level security', t);
    -- Anonymous is refused by a restrictive policy, which no permissive policy
    -- can override however it is later written.
    execute format('drop policy if exists assist_anon_denied on public.%I', t);
    execute format($p$
      create policy assist_anon_denied on public.%I
      as restrictive for all to anon using (false) with check (false)
    $p$, t);
  end loop;
end $$;

-- ------------------------------------------------------------- directories --
-- Agents and end users are a staff directory: staff read it, operators change it.
drop policy if exists assist_agents_read on public.assist_agents;
create policy assist_agents_read on public.assist_agents
for select to authenticated
using (public.assist_is_agent() or user_id = auth.uid());
drop policy if exists assist_agents_write on public.assist_agents;
create policy assist_agents_write on public.assist_agents
for all to authenticated using (public.assist_is_operator()) with check (public.assist_is_operator());

drop policy if exists assist_end_users_read on public.assist_end_users;
create policy assist_end_users_read on public.assist_end_users
for select to authenticated
using (public.assist_is_agent() or user_id = auth.uid());
drop policy if exists assist_end_users_write on public.assist_end_users;
create policy assist_end_users_write on public.assist_end_users
for all to authenticated using (public.assist_is_operator()) with check (public.assist_is_operator());

-- ---------------------------------------------------------------- sessions --
drop policy if exists assist_sessions_read on public.assist_sessions;
create policy assist_sessions_read on public.assist_sessions
for select to authenticated
using (
  public.assist_is_operator()
  or operator_user_id = auth.uid()
  or target_user_id = auth.uid()
  or created_by = auth.uid()
);

drop policy if exists assist_sessions_insert on public.assist_sessions;
create policy assist_sessions_insert on public.assist_sessions
for insert to authenticated
with check (public.assist_is_agent() and created_by = auth.uid());

-- The source's rule, kept: a finished session is history and cannot be edited.
-- The audience is what changes - the target may act on their own session, and
-- everybody else needs a role.
drop policy if exists assist_sessions_update on public.assist_sessions;
create policy assist_sessions_update on public.assist_sessions
for update to authenticated
using (
  status in ('pending','active','paused')
  and (
    public.assist_is_operator()
    or operator_user_id = auth.uid()
    or target_user_id = auth.uid()
  )
)
with check (status in ('pending','active','paused','completed','terminated','blocked'));

-- ------------------------------------------------------ requests, approvals --
drop policy if exists assist_requests_read on public.assist_session_requests;
create policy assist_requests_read on public.assist_session_requests
for select to authenticated
using (public.assist_is_operator() or requested_by = auth.uid() or target_user_id = auth.uid());

drop policy if exists assist_requests_insert on public.assist_session_requests;
create policy assist_requests_insert on public.assist_session_requests
for insert to authenticated
with check (public.assist_is_agent() and requested_by = auth.uid());

-- The source's rule, kept: only a pending request can be reviewed, and a
-- decision is final. Reviewing it now needs authority.
drop policy if exists assist_requests_update on public.assist_session_requests;
create policy assist_requests_update on public.assist_session_requests
for update to authenticated
using (status = 'pending' and public.assist_is_operator())
with check (status in ('approved','rejected','expired'));

drop policy if exists assist_approvals_read on public.assist_approvals;
create policy assist_approvals_read on public.assist_approvals
for select to authenticated
using (public.assist_is_operator() or public.assist_can_see_session(session_id));

drop policy if exists assist_approvals_insert on public.assist_approvals;
create policy assist_approvals_insert on public.assist_approvals
for insert to authenticated with check (public.assist_is_agent());

-- The source's rule, kept: only a pending approval can be decided.
drop policy if exists assist_approvals_update on public.assist_approvals;
create policy assist_approvals_update on public.assist_approvals
for update to authenticated
using (status = 'pending' and public.assist_is_operator())
with check (status in ('approved','rejected','expired'));

-- ------------------------------------------------------ session components --
-- Everything inside a session is visible to the people in that session, and to
-- nobody else. Writing to it additionally requires the session to be live -
-- approved, consented and not finished.
drop policy if exists assist_chat_read on public.assist_chat_messages;
create policy assist_chat_read on public.assist_chat_messages
for select to authenticated using (public.assist_can_see_session(session_id));
drop policy if exists assist_chat_insert on public.assist_chat_messages;
create policy assist_chat_insert on public.assist_chat_messages
for insert to authenticated
with check (public.assist_can_see_session(session_id) and public.assist_session_is_live(session_id));

drop policy if exists assist_transfers_read on public.assist_file_transfers;
create policy assist_transfers_read on public.assist_file_transfers
for select to authenticated using (public.assist_can_see_session(session_id));
drop policy if exists assist_transfers_insert on public.assist_file_transfers;
create policy assist_transfers_insert on public.assist_file_transfers
for insert to authenticated
with check (public.assist_can_see_session(session_id) and public.assist_session_is_live(session_id));
-- The source's rule, kept: a finished transfer is locked.
drop policy if exists assist_transfers_update on public.assist_file_transfers;
create policy assist_transfers_update on public.assist_file_transfers
for update to authenticated
using (status in ('pending','in_progress') and public.assist_can_see_session(session_id))
with check (status in ('pending','in_progress','completed','failed'));

drop policy if exists assist_windows_read on public.assist_session_windows;
create policy assist_windows_read on public.assist_session_windows
for select to authenticated using (public.assist_can_see_session(session_id));
drop policy if exists assist_windows_write on public.assist_session_windows;
create policy assist_windows_write on public.assist_session_windows
for all to authenticated
using (public.assist_can_see_session(session_id) and public.assist_is_agent())
with check (public.assist_can_see_session(session_id) and public.assist_is_agent());

drop policy if exists assist_suggestions_read on public.assist_ai_suggestions;
create policy assist_suggestions_read on public.assist_ai_suggestions
for select to authenticated using (public.assist_can_see_session(session_id));
drop policy if exists assist_suggestions_write on public.assist_ai_suggestions;
create policy assist_suggestions_write on public.assist_ai_suggestions
for all to authenticated
using (public.assist_can_see_session(session_id) and public.assist_is_agent())
with check (public.assist_can_see_session(session_id) and public.assist_is_agent());

drop policy if exists assist_control_read on public.assist_control_state;
create policy assist_control_read on public.assist_control_state
for select to authenticated using (public.assist_can_see_session(session_id));
-- Taking control needs the session to be live, not merely visible.
drop policy if exists assist_control_write on public.assist_control_state;
create policy assist_control_write on public.assist_control_state
for all to authenticated
using (public.assist_can_see_session(session_id) and public.assist_session_is_live(session_id))
with check (public.assist_can_see_session(session_id) and public.assist_session_is_live(session_id));

-- ------------------------------------------------------------- emergencies --
-- Anybody in a session may stop it. That is the point of an emergency stop, and
-- it is the one place where making the rule stricter would be the wrong call.
drop policy if exists assist_stops_read on public.assist_emergency_stops;
create policy assist_stops_read on public.assist_emergency_stops
for select to authenticated using (public.assist_is_agent() or stopped_by_user_id = auth.uid());
drop policy if exists assist_stops_insert on public.assist_emergency_stops;
create policy assist_stops_insert on public.assist_emergency_stops
for insert to authenticated with check (true);

-- ------------------------------------------------------------- the policies --
-- Privacy controls, access modes and settings are read by anyone who needs to
-- understand the rules, and changed only by an operator.
drop policy if exists assist_privacy_read on public.assist_privacy_controls;
create policy assist_privacy_read on public.assist_privacy_controls
for select to authenticated using (true);
-- The source's rule, kept and hardened: a critical control can never be turned
-- off, by anybody, and only an operator may touch the rest.
drop policy if exists assist_privacy_update on public.assist_privacy_controls;
create policy assist_privacy_update on public.assist_privacy_controls
for update to authenticated
using (is_critical = false and public.assist_is_operator())
with check (is_critical = false);

drop policy if exists assist_modes_read on public.assist_access_modes;
create policy assist_modes_read on public.assist_access_modes
for select to authenticated using (true);
drop policy if exists assist_modes_update on public.assist_access_modes;
create policy assist_modes_update on public.assist_access_modes
for update to authenticated
using (public.assist_is_operator()) with check (public.assist_is_operator());

drop policy if exists assist_settings_read on public.assist_settings;
create policy assist_settings_read on public.assist_settings
for select to authenticated using (true);
-- The source's rule, kept: a locked setting cannot be changed.
drop policy if exists assist_settings_update on public.assist_settings;
create policy assist_settings_update on public.assist_settings
for update to authenticated
using (is_locked = false and public.assist_is_operator())
with check (is_locked = false);

-- ---------------------------------------------------------------- the trail --
drop policy if exists assist_audit_read on public.assist_audit_logs;
create policy assist_audit_read on public.assist_audit_logs
for select to authenticated
using (public.assist_is_operator() or actor_user_id = auth.uid() or target_user_id = auth.uid());
drop policy if exists assist_audit_insert on public.assist_audit_logs;
create policy assist_audit_insert on public.assist_audit_logs
for insert to authenticated with check (true);

-- Section 17: session history is read-only. No update or delete policy exists,
-- and this holds even for a role that bypasses policies.
create or replace function public.assist_audit_is_append_only()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'the assist audit log is append-only; % is not permitted', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists assist_audit_no_rewrite on public.assist_audit_logs;
create trigger assist_audit_no_rewrite
before update or delete on public.assist_audit_logs
for each row execute function public.assist_audit_is_append_only();

drop trigger if exists assist_audit_no_rewrite on public.assist_audit_logs;
CREATE TRIGGER assist_audit_no_rewrite BEFORE DELETE OR UPDATE ON public.assist_audit_logs FOR EACH ROW EXECUTE FUNCTION assist_audit_is_append_only();
