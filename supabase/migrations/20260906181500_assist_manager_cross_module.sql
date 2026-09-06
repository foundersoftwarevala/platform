-- Section 22 and 24: Assist references the platform rather than copying it.
--
-- A session already carries support_ticket_id, task_id and promise_id, so the
-- identifiers are shared and each domain record stays its own. What was missing
-- is the way in: a support agent, a developer or a task should be able to raise
-- an assist request from where they already are, and the resulting session has
-- to be findable from that side afterwards.
--
-- Two rules hold throughout. Raising a request never starts a session - that
-- still needs an approval and the target's consent, both of which live in
-- assist_start_session. And nothing here marks a task complete or fulfils a
-- promise: section 22D and 22G both say assist activity is evidence, not
-- completion.

-- Raise an assist request against a real person, from a real place.
create or replace function public.assist_request_from(
  p_source_module text, p_source_id uuid, p_target_user_id uuid,
  p_purpose text, p_scope text default 'view_only',
  p_duration_minutes integer default 30, p_priority text default 'normal')
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_code    text;
  v_request uuid;
  v_end_user uuid;
  v_email   text;
begin
  if not public.assist_is_agent() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if p_source_module not in ('support', 'task_manager', 'developer_manager',
                             'promise_tracker', 'reseller', 'franchise', 'control_panel') then
    return jsonb_build_object('ok', false, 'reason', 'unknown_source_module');
  end if;
  if p_target_user_id is null then
    -- Section 22B: there is no such thing as an assist session without somebody
    -- whose device it is.
    return jsonb_build_object('ok', false, 'reason', 'a target account is required');
  end if;

  -- Reuse the directory row for this person rather than making another.
  select id into v_end_user from public.assist_end_users where user_id = p_target_user_id limit 1;
  if v_end_user is null then
    select email into v_email from auth.users where id = p_target_user_id;
    insert into public.assist_end_users (user_code, role, user_id)
    values ('USR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
            'client', p_target_user_id)
    returning id into v_end_user;
  end if;

  v_code := 'REQ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.assist_session_requests
    (request_code, end_user_id, assist_type, purpose, requested_scope,
     requested_duration_minutes, priority, status, requested_by, target_user_id,
     support_ticket_id, task_id)
  values
    (v_code, v_end_user, p_source_module, p_purpose, p_scope,
     p_duration_minutes, p_priority, 'pending', auth.uid(), p_target_user_id,
     case when p_source_module = 'support' then p_source_id end,
     case when p_source_module in ('task_manager', 'developer_manager') then p_source_id end)
  returning id into v_request;

  perform public.assist_audit('Assist Requested', null, p_source_module,
    null, jsonb_build_object('request_code', v_code, 'source_id', p_source_id),
    p_purpose);

  -- Section 22I: the platform's own notification table, never a second one.
  insert into public.notifications (user_id, title, body, kind, data)
  select u.id,
         'Assist requested - ' || v_code,
         coalesce(p_purpose, 'A remote assistance session has been requested.'),
         'assist_request',
         jsonb_build_object('module', 'assist_manager', 'request_code', v_code,
                            'source_module', p_source_module)
  from auth.users u
  where u.id = p_target_user_id
     or exists (select 1 from public.user_roles ur
                where ur.user_id = u.id
                  and ur.role in ('admin','boss','founder','super_admin','boss_owner'));

  return jsonb_build_object('ok', true, 'request_code', v_code, 'request_id', v_request);
end;
$$;

-- What has Assist done about a given record? Answers from the session table, so
-- neither side keeps a copy of the other's state.
create or replace function public.assist_status_for(p_module text, p_record_id uuid)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  with sessions as (
    select s.* from public.assist_sessions s
    where (p_module = 'support'         and s.support_ticket_id = p_record_id)
       or (p_module = 'task_manager'    and s.task_id = p_record_id)
       or (p_module = 'promise_tracker' and s.promise_id = p_record_id)
  ),
  requests as (
    select r.* from public.assist_session_requests r
    where (p_module = 'support'      and r.support_ticket_id = p_record_id)
       or (p_module = 'task_manager' and r.task_id = p_record_id)
  )
  select jsonb_build_object(
    'module', p_module,
    'record_id', p_record_id,
    -- The vocabulary section 22F asks the Task Manager to show.
    'assist_status', case
      when exists (select 1 from sessions where status in ('active','paused')) then 'assist_active'
      when exists (select 1 from sessions where status = 'terminated')          then 'assist_terminated'
      when exists (select 1 from sessions where status = 'completed')           then 'assist_completed'
      when exists (select 1 from sessions where status = 'pending')             then 'assist_pending'
      when exists (select 1 from requests where status = 'pending')             then 'assist_requested'
      else 'no_assist' end,
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'session_id', id, 'session_code', session_code, 'status', status,
        'access_mode', access_mode, 'started_at', started_at, 'ended_at', ended_at,
        'end_reason', end_reason))
      from sessions), '[]'::jsonb),
    'open_requests', (select count(*) from requests where status = 'pending')
  );
$$;

revoke all on function public.assist_request_from(text, uuid, uuid, text, text, integer, text) from public, anon;
revoke all on function public.assist_status_for(text, uuid) from public, anon;
grant execute on function public.assist_request_from(text, uuid, uuid, text, text, integer, text) to authenticated;
grant execute on function public.assist_status_for(text, uuid) to authenticated;
