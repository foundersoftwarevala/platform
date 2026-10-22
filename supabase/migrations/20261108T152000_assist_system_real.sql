-- Assist Manager server-only writes, participant-scoped reads, consent proof,
-- immutable operational logs, signaling tickets, and session status auditing.

begin;

do $preflight$
begin
  if to_regclass('public.assist_sessions') is null
     or to_regclass('public.assist_session_requests') is null
     or to_regclass('public.assist_approvals') is null
     or to_regclass('public.assist_agents') is null
     or to_regclass('public.assist_end_users') is null
     or to_regclass('public.assist_audit_logs') is null
     or to_regclass('public.audit_logs') is null then
    raise exception 'Assist Manager base schema and public.audit_logs must exist before this migration';
  end if;
end;
$preflight$;

alter table public.assist_sessions
  add column if not exists consent_hash text,
  add column if not exists control_consent_at timestamptz,
  add column if not exists control_consent_by uuid,
  add column if not exists recording_url text,
  add column if not exists recording_sha256 text;

do $consent_constraint$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.assist_sessions'::regclass
      and conname = 'assist_sessions_consent_hash_format'
  ) then
    alter table public.assist_sessions
      add constraint assist_sessions_consent_hash_format
      check (consent_hash is null or consent_hash ~ '^[0-9a-f]{64}$') not valid;
  end if;

  if exists (
    select 1 from public.assist_sessions
    where status in ('active', 'paused')
      and (consent_hash is null or not consent_granted or consent_revoked_at is not null)
  ) then
    raise exception 'Resolve existing active Assist sessions without verified consent before applying this migration';
  end if;

  alter table public.assist_sessions
    validate constraint assist_sessions_consent_hash_format;
end;
$consent_constraint$;

create table if not exists public.assist_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.assist_sessions(id),
  actor_user_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists assist_logs_session_created_idx
  on public.assist_logs (session_id, created_at desc);

create table if not exists public.assist_signal_tickets (
  token_hash text primary key,
  session_id uuid not null references public.assist_sessions(id) on delete cascade,
  user_id uuid not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint assist_signal_tickets_hash_format check (token_hash ~ '^[0-9a-f]{64}$')
);

create index if not exists assist_signal_tickets_expiry_idx
  on public.assist_signal_tickets (expires_at);

create or replace function public.assist_is_session_participant(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
      from public.assist_sessions s
     where s.id = p_session_id
       and (
         s.target_user_id = auth.uid()
         or exists (
           select 1 from public.assist_agents a
            where a.id = s.agent_id and a.user_id = auth.uid()
         )
       )
  );
$function$;

create or replace function public.assist_is_manager()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
      from public.user_roles ur
     where ur.user_id = auth.uid()
       and ur.role::text in (
         'admin', 'boss', 'founder', 'super_admin', 'boss_owner',
         'support', 'sales_support_manager'
       )
  );
$function$;

revoke all on function public.assist_is_session_participant(uuid) from public, anon;
grant execute on function public.assist_is_session_participant(uuid) to authenticated, service_role;
revoke all on function public.assist_is_manager() from public, anon;
grant execute on function public.assist_is_manager() to authenticated, service_role;

create or replace function public.assist_sessions_require_consent()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if new.status in ('active', 'paused') then
    if new.consent_hash is null
       or not new.consent_granted
       or new.consent_by is distinct from new.target_user_id
       or new.consent_revoked_at is not null then
      raise exception 'An Assist session cannot become active without the target''s recorded consent'
        using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.assist_approvals a
       where a.session_id = new.id
         and a.status = 'approved'
         and a.decided_by = new.operator_user_id
         and a.expires_at >= coalesce(new.started_at, now())
    ) then
      raise exception 'An Assist session cannot become active without approval by its assigned manager'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists assist_sessions_require_consent on public.assist_sessions;
create trigger assist_sessions_require_consent
  before insert or update of status, consent_hash, consent_granted, consent_by,
    consent_revoked_at, operator_user_id, started_at
  on public.assist_sessions
  for each row execute function public.assist_sessions_require_consent();

create or replace function public.assist_sessions_status_audit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_before jsonb;
  v_after jsonb;
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  v_before := case when tg_op = 'UPDATE' then
    jsonb_build_object('status', old.status, 'consent_granted', old.consent_granted,
      'ended_at', old.ended_at, 'end_reason', old.end_reason)
    else null end;
  v_after := jsonb_build_object('status', new.status, 'consent_granted', new.consent_granted,
    'ended_at', new.ended_at, 'end_reason', new.end_reason);

  insert into public.audit_logs (
    actor_id, actor, action, entity_type, entity_id, severity,
    before_state, after_state, before_status, after_status, metadata
  ) values (
    v_actor, coalesce(v_actor::text, 'system'), 'assist.session.status_changed',
    'assist_sessions', new.id::text,
    case when new.status in ('terminated', 'blocked') then 'warning' else 'info' end,
    v_before, v_after, case when tg_op = 'UPDATE' then old.status else null end,
    new.status, jsonb_build_object('session_code', new.session_code)
  );

  insert into public.assist_logs (session_id, actor_user_id, action, details)
  values (new.id, v_actor, 'session.status_changed',
    jsonb_build_object('before', v_before, 'after', v_after));

  insert into public.assist_audit_logs (
    session_id, session_code, actor, actor_user_id, actor_role, action,
    target, target_user_id, old_state, new_state, reason, severity, result
  ) values (
    new.id, new.session_code, coalesce(v_actor::text, 'system'), v_actor,
    coalesce((select role::text from public.user_roles where user_id = v_actor limit 1), 'system'),
    'Session Status Changed', 'session', new.target_user_id, v_before, v_after,
    new.end_reason,
    case when new.status in ('terminated', 'blocked') then 'warning' else 'info' end,
    'success'
  );

  perform pg_notify('assist_session_status', json_build_object(
    'session_id', new.id, 'status', new.status
  )::text);
  return new;
end;
$function$;

drop trigger if exists assist_sessions_status_audit on public.assist_sessions;
create trigger assist_sessions_status_audit
  after insert or update of status on public.assist_sessions
  for each row execute function public.assist_sessions_status_audit();

create or replace function public.assist_sessions_control_notify()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if new.control_consent_at is distinct from old.control_consent_at
     or new.control_consent_by is distinct from old.control_consent_by then
    perform pg_notify('assist_session_status', json_build_object(
      'session_id', new.id,
      'status', new.status,
      'control_allowed',
        new.control_consent_at is not null
        and new.control_consent_by = new.target_user_id
    )::text);
  end if;
  return new;
end;
$function$;

drop trigger if exists assist_sessions_control_notify on public.assist_sessions;
create trigger assist_sessions_control_notify
  after update of control_consent_at, control_consent_by on public.assist_sessions
  for each row execute function public.assist_sessions_control_notify();

create or replace function public.assist_logs_append_only()
returns trigger language plpgsql set search_path = public, pg_temp as $function$
begin
  raise exception 'assist_logs is append-only' using errcode = '42501';
end;
$function$;

drop trigger if exists assist_logs_no_rewrite on public.assist_logs;
create trigger assist_logs_no_rewrite
  before update or delete on public.assist_logs
  for each row execute function public.assist_logs_append_only();

alter table public.assist_logs enable row level security;
alter table public.assist_signal_tickets enable row level security;

do $secure_assist_tables$
declare
  t text;
  assist_tables text[] := array[
    'assist_agents', 'assist_end_users', 'assist_sessions',
    'assist_session_requests', 'assist_approvals', 'assist_chat_messages',
    'assist_file_transfers', 'assist_session_windows', 'assist_ai_suggestions',
    'assist_emergency_stops', 'assist_privacy_controls', 'assist_access_modes',
    'assist_settings', 'assist_control_state', 'assist_audit_logs',
    'assist_logs', 'assist_signal_tickets'
  ];
  p record;
begin
  foreach t in array assist_tables loop
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('alter table public.%I enable row level security', t);

    for p in
      select policyname from pg_policies
       where schemaname = 'public' and tablename = t
         and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;

    execute format('drop policy if exists assist_anon_denied on public.%I', t);
    execute format(
      'create policy assist_anon_denied on public.%I as restrictive for all to anon using (false) with check (false)',
      t
    );
  end loop;
end;
$secure_assist_tables$;

drop policy if exists assist_agents_read on public.assist_agents;
create policy assist_agents_read on public.assist_agents
  for select to authenticated
  using (public.assist_is_manager() or user_id = auth.uid());

drop policy if exists assist_end_users_read on public.assist_end_users;
create policy assist_end_users_read on public.assist_end_users
  for select to authenticated
  using (
    public.assist_is_manager()
    or user_id = auth.uid()
    or exists (
      select 1 from public.assist_sessions s
       where s.end_user_id = assist_end_users.id
         and public.assist_is_session_participant(s.id)
    )
  );

drop policy if exists assist_sessions_read on public.assist_sessions;
create policy assist_sessions_read on public.assist_sessions
  for select to authenticated
  using (public.assist_is_manager() or public.assist_is_session_participant(id));

drop policy if exists assist_requests_read on public.assist_session_requests;
create policy assist_requests_read on public.assist_session_requests
  for select to authenticated
  using (public.assist_is_manager() or requested_by = auth.uid() or target_user_id = auth.uid());

drop policy if exists assist_approvals_read on public.assist_approvals;
create policy assist_approvals_read on public.assist_approvals
  for select to authenticated
  using (
    public.assist_is_manager()
    or (session_id is not null and public.assist_is_session_participant(session_id))
    or exists (
      select 1 from public.assist_session_requests r
       where r.id = assist_approvals.request_id
         and (r.requested_by = auth.uid() or r.target_user_id = auth.uid())
    )
  );

drop policy if exists assist_chat_read on public.assist_chat_messages;
create policy assist_chat_read on public.assist_chat_messages
  for select to authenticated
  using (public.assist_is_manager() or public.assist_is_session_participant(session_id));

drop policy if exists assist_transfers_read on public.assist_file_transfers;
create policy assist_transfers_read on public.assist_file_transfers
  for select to authenticated
  using (public.assist_is_manager() or public.assist_is_session_participant(session_id));

drop policy if exists assist_windows_read on public.assist_session_windows;
create policy assist_windows_read on public.assist_session_windows
  for select to authenticated
  using (public.assist_is_manager() or public.assist_is_session_participant(session_id));

drop policy if exists assist_suggestions_read on public.assist_ai_suggestions;
create policy assist_suggestions_read on public.assist_ai_suggestions
  for select to authenticated
  using (public.assist_is_manager() or public.assist_is_session_participant(session_id));

drop policy if exists assist_control_read on public.assist_control_state;
create policy assist_control_read on public.assist_control_state
  for select to authenticated
  using (public.assist_is_manager() or public.assist_is_session_participant(session_id));

drop policy if exists assist_stops_read on public.assist_emergency_stops;
create policy assist_stops_read on public.assist_emergency_stops
  for select to authenticated
  using (
    public.assist_is_manager()
    or exists (
      select 1 from public.assist_sessions s
       where s.session_code = assist_emergency_stops.session_code
         and public.assist_is_session_participant(s.id)
    )
  );

drop policy if exists assist_privacy_read on public.assist_privacy_controls;
create policy assist_privacy_read on public.assist_privacy_controls
  for select to authenticated
  using (public.assist_is_manager() or public.assist_is_agent());

drop policy if exists assist_modes_read on public.assist_access_modes;
create policy assist_modes_read on public.assist_access_modes
  for select to authenticated
  using (public.assist_is_manager() or public.assist_is_agent());

drop policy if exists assist_settings_read on public.assist_settings;
create policy assist_settings_read on public.assist_settings
  for select to authenticated
  using (public.assist_is_manager() or public.assist_is_agent());

drop policy if exists assist_audit_read on public.assist_audit_logs;
create policy assist_audit_read on public.assist_audit_logs
  for select to authenticated
  using (
    public.assist_is_manager()
    or actor_user_id = auth.uid()
    or target_user_id = auth.uid()
    or (session_id is not null and public.assist_is_session_participant(session_id))
  );

drop policy if exists assist_logs_read on public.assist_logs;
create policy assist_logs_read on public.assist_logs
  for select to authenticated
  using (public.assist_is_manager() or public.assist_is_session_participant(session_id));

drop policy if exists assist_signal_tickets_read on public.assist_signal_tickets;
create policy assist_signal_tickets_read on public.assist_signal_tickets
  for select to authenticated using (false);

-- The server's direct PostgreSQL connection assumes service_role inside its
-- transaction. These grants do not restore browser access.
do $service_grants$
declare
  t text;
  assist_tables text[] := array[
    'assist_agents', 'assist_end_users', 'assist_sessions',
    'assist_session_requests', 'assist_approvals', 'assist_chat_messages',
    'assist_file_transfers', 'assist_session_windows', 'assist_ai_suggestions',
    'assist_emergency_stops', 'assist_privacy_controls', 'assist_access_modes',
    'assist_settings', 'assist_control_state', 'assist_audit_logs',
    'assist_logs', 'assist_signal_tickets'
  ];
begin
  foreach t in array assist_tables loop
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end;
$service_grants$;

-- Old SECURITY DEFINER entry points exposed writes directly through PostgREST.
-- The application now calls its authenticated server functions instead.
revoke all on function public.assist_audit(text, uuid, text, jsonb, jsonb, text, text, text)
  from public, anon, authenticated;
revoke all on function public.assist_grant_consent(uuid) from public, anon, authenticated;
revoke all on function public.assist_revoke_consent(uuid, text) from public, anon, authenticated;
revoke all on function public.assist_decide_approval(uuid, text, text) from public, anon, authenticated;
revoke all on function public.assist_start_session(uuid) from public, anon, authenticated;
revoke all on function public.assist_emergency_stop(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.assist_request_from(text, uuid, uuid, text, text, integer, text)
  from public, anon, authenticated;
revoke all on function public.assist_status_for(text, uuid) from public, anon, authenticated;

grant execute on function public.assist_audit(text, uuid, text, jsonb, jsonb, text, text, text)
  to service_role;
grant execute on function public.assist_grant_consent(uuid) to service_role;
grant execute on function public.assist_revoke_consent(uuid, text) to service_role;
grant execute on function public.assist_decide_approval(uuid, text, text) to service_role;
grant execute on function public.assist_start_session(uuid) to service_role;
grant execute on function public.assist_emergency_stop(uuid, text, boolean) to service_role;
grant execute on function public.assist_request_from(text, uuid, uuid, text, text, integer, text)
  to service_role;
grant execute on function public.assist_status_for(text, uuid) to service_role;

do $verify$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'assist_agents', 'assist_end_users', 'assist_sessions',
    'assist_session_requests', 'assist_approvals', 'assist_chat_messages',
    'assist_file_transfers', 'assist_session_windows', 'assist_ai_suggestions',
    'assist_emergency_stops', 'assist_privacy_controls', 'assist_access_modes',
    'assist_settings', 'assist_control_state', 'assist_audit_logs',
    'assist_logs', 'assist_signal_tickets'
  ] loop
    if has_table_privilege('anon', format('public.%I', t), 'SELECT')
       or has_table_privilege('anon', format('public.%I', t), 'INSERT')
       or has_table_privilege('anon', format('public.%I', t), 'UPDATE')
       or has_table_privilege('anon', format('public.%I', t), 'DELETE') then
      raise exception 'anon retains a direct table grant on public.%', t;
    end if;
    if has_table_privilege('authenticated', format('public.%I', t), 'INSERT')
       or has_table_privilege('authenticated', format('public.%I', t), 'UPDATE')
       or has_table_privilege('authenticated', format('public.%I', t), 'DELETE') then
      raise exception 'authenticated retains a direct write grant on public.%', t;
    end if;
    for p in
      select policyname from pg_policies
       where schemaname = 'public' and tablename = t
         and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
         and roles::text like '%authenticated%'
    loop
      raise exception 'Authenticated write policy % remains on public.%', p.policyname, t;
    end loop;
  end loop;
end;
$verify$;

commit;
