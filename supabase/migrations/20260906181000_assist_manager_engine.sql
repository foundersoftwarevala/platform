-- The Assist session lifecycle, enforced where it cannot be bypassed.
--
-- The source's screens carry out each step with a direct table write: a request
-- is approved by setting a column, a session becomes active by setting another,
-- an emergency stop inserts a row into assist_emergency_stops and updates the
-- session's status. That last one matters most - section 19 requires an
-- emergency stop to revoke screen, control, chat, voice, file transfer and
-- device access immediately, and setting status = 'terminated' revokes none of
-- them. The control state stays as it was, transfers in flight stay open, and
-- the AI layer keeps its session.
--
-- These functions are the operations the screens call instead. Each one checks
-- authority, does the whole job, and writes the trail.

-- ------------------------------------------------------------------ trail --
create or replace function public.assist_audit(
  p_action text, p_session_id uuid default null, p_target text default null,
  p_old jsonb default null, p_new jsonb default null,
  p_reason text default null, p_severity text default 'info',
  p_result text default 'success')
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_id uuid; v_email text; v_role text; v_code text; v_target uuid;
begin
  select u.email into v_email from auth.users u where u.id = auth.uid();
  select ur.role::text into v_role from public.user_roles ur where ur.user_id = auth.uid() limit 1;
  select session_code, target_user_id into v_code, v_target
    from public.assist_sessions where id = p_session_id;

  insert into public.assist_audit_logs
    (session_id, session_code, actor, actor_user_id, actor_role, action,
     target, target_user_id, old_state, new_state, reason, severity, result)
  values
    (p_session_id, v_code,
     coalesce(v_email, case when auth.uid() is null then 'system' else 'account' end),
     auth.uid(), coalesce(v_role, 'system'), p_action,
     p_target, v_target, p_old, p_new, p_reason, p_severity, p_result)
  returning id into v_id;
  return v_id;
end;
$$;

-- ------------------------------------------------------------- the target --
-- Section 22B: consent belongs to the person whose device it is. Nobody can
-- grant it on their behalf, including an operator.
create or replace function public.assist_grant_consent(p_session_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare s public.assist_sessions%rowtype;
begin
  select * into s from public.assist_sessions where id = p_session_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_such_session'); end if;

  if s.target_user_id is null or s.target_user_id <> auth.uid() then
    return jsonb_build_object('ok', false, 'reason', 'only_the_target_may_consent');
  end if;
  if s.status not in ('pending', 'active', 'paused') then
    return jsonb_build_object('ok', false, 'reason', 'session_is_closed');
  end if;

  update public.assist_sessions
     set consent_granted = true, consent_at = now(), consent_by = auth.uid(),
         consent_revoked_at = null
   where id = p_session_id;

  perform public.assist_audit('Consent Granted', p_session_id, 'session',
    jsonb_build_object('consent', false), jsonb_build_object('consent', true));
  return jsonb_build_object('ok', true);
end;
$$;

-- Revoking is the same right, exercised the other way, and it stops the session
-- rather than merely flagging it.
create or replace function public.assist_revoke_consent(p_session_id uuid, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare s public.assist_sessions%rowtype;
begin
  select * into s from public.assist_sessions where id = p_session_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_such_session'); end if;
  if s.target_user_id is null or s.target_user_id <> auth.uid() then
    return jsonb_build_object('ok', false, 'reason', 'only_the_target_may_revoke');
  end if;

  update public.assist_sessions
     set consent_granted = false, consent_revoked_at = now(),
         status = case when status in ('pending','active','paused') then 'terminated' else status end,
         ended_at = coalesce(ended_at, now()),
         end_reason = coalesce(p_reason, 'consent withdrawn by the target')
   where id = p_session_id;

  update public.assist_control_state
     set control_mode = 'view', cursor_control = false, keyboard_control = false,
         is_paused = true, voice_active = false
   where session_id = p_session_id;

  perform public.assist_audit('Consent Revoked', p_session_id, 'session',
    jsonb_build_object('consent', true), jsonb_build_object('consent', false),
    p_reason, 'warning');
  return jsonb_build_object('ok', true);
end;
$$;

-- ------------------------------------------------------------- the decision --
create or replace function public.assist_decide_approval(
  p_approval_id uuid, p_decision text, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare a public.assist_approvals%rowtype;
begin
  if p_decision not in ('approved', 'rejected') then
    return jsonb_build_object('ok', false, 'reason', 'unknown_decision');
  end if;
  if not public.assist_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select * into a from public.assist_approvals where id = p_approval_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_such_approval'); end if;
  if a.status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'already_decided');
  end if;

  -- Section 10: an expired request is not approvable. It is marked expired
  -- rather than silently accepted late.
  if a.expires_at < now() then
    update public.assist_approvals set status = 'expired', decided_at = now() where id = p_approval_id;
    perform public.assist_audit('Approval Expired', a.session_id, 'approval',
      jsonb_build_object('status', 'pending'), jsonb_build_object('status', 'expired'),
      'the approval window closed before a decision was made', 'warning');
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  update public.assist_approvals
     set status = p_decision, decided_at = now(), decided_by = auth.uid(),
         decision_note = p_note
   where id = p_approval_id;

  if p_decision = 'rejected' and a.session_id is not null then
    update public.assist_sessions
       set status = 'blocked', ended_at = now(),
           end_reason = coalesce(p_note, 'approval refused')
     where id = a.session_id and status in ('pending','active','paused');
  end if;

  perform public.assist_audit(
    case when p_decision = 'approved' then 'Approval Granted' else 'Approval Refused' end,
    a.session_id, 'approval',
    jsonb_build_object('status', 'pending'), jsonb_build_object('status', p_decision),
    p_note, case when p_decision = 'approved' then 'info' else 'warning' end);

  return jsonb_build_object('ok', true, 'decision', p_decision);
end;
$$;

-- ---------------------------------------------------------------- starting --
-- Section 14: a session becomes live only when the approval and the consent are
-- both real. This is the one door, so neither can be skipped.
create or replace function public.assist_start_session(p_session_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare s public.assist_sessions%rowtype; v_approved boolean;
begin
  select * into s from public.assist_sessions where id = p_session_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_such_session'); end if;

  if not (public.assist_is_operator() or s.operator_user_id = auth.uid()) then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if s.status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'session_is_not_pending');
  end if;
  if not s.consent_granted or s.consent_revoked_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'the target has not consented');
  end if;

  select exists (select 1 from public.assist_approvals
                 where session_id = p_session_id and status = 'approved')
    into v_approved;
  if not v_approved then
    return jsonb_build_object('ok', false, 'reason', 'no approval has been granted');
  end if;

  update public.assist_sessions
     set status = 'active', started_at = coalesce(started_at, now())
   where id = p_session_id;

  insert into public.assist_control_state (session_id, control_mode)
  values (p_session_id, 'view')
  on conflict (session_id) do nothing;

  perform public.assist_audit('Session Started', p_session_id, 'session',
    jsonb_build_object('status', 'pending'), jsonb_build_object('status', 'active'));

  return jsonb_build_object('ok', true, 'session_code', s.session_code);
end;
$$;

-- ---------------------------------------------------------------- stopping --
-- Section 19: stopping a session has to revoke everything, not set a status.
create or replace function public.assist_emergency_stop(
  p_session_id uuid, p_reason text, p_all boolean default false)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_codes text[];
  v_count integer := 0;
  v_stop  text;
  r       record;
begin
  -- Anybody inside the session may stop it, and any operator may stop any of
  -- them. Making this harder than it needs to be is how a stop fails to happen.
  if not (public.assist_is_operator()
          or (p_session_id is not null and public.assist_can_see_session(p_session_id))) then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if p_all and not public.assist_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'stopping every session needs an operator');
  end if;

  for r in
    select id, session_code from public.assist_sessions
    where status in ('pending','active','paused')
      and (p_all or id = p_session_id)
  loop
    -- The session itself.
    update public.assist_sessions
       set status = 'terminated', ended_at = now(), end_reason = p_reason,
           permissions = array[]::text[],
           restrictions = array['Emergency stop - all access revoked'],
           consent_granted = false, consent_revoked_at = now()
     where id = r.id;

    -- Screen, cursor, keyboard and voice.
    update public.assist_control_state
       set control_mode = 'freeze', cursor_control = false, keyboard_control = false,
           is_paused = true, voice_active = false, microphone_enabled = false,
           speaker_enabled = false
     where session_id = r.id;

    -- Anything still moving is stopped rather than left in flight.
    update public.assist_file_transfers
       set status = 'failed', deleted_at = now()
     where session_id = r.id and status in ('pending','in_progress');

    -- The AI layer loses the session with everyone else.
    update public.assist_ai_suggestions
       set status = 'dismissed', acted_at = now()
     where session_id = r.id and status = 'open';

    -- Device access: no window remains shared.
    update public.assist_session_windows set is_visible = false where session_id = r.id;

    -- Any approval still open cannot later be used to revive it.
    update public.assist_approvals
       set status = 'expired', decided_at = now(),
           decision_note = coalesce(decision_note, 'emergency stop')
     where session_id = r.id and status = 'pending';

    v_codes := v_codes || r.session_code;
    v_count := v_count + 1;

    perform public.assist_audit('Emergency Stop', r.id, 'session',
      jsonb_build_object('status', 'live'),
      jsonb_build_object('status', 'terminated', 'access', 'revoked'),
      p_reason, 'critical');
  end loop;

  if v_count = 0 then
    return jsonb_build_object('ok', true, 'sessions_stopped', 0,
                              'note', 'nothing was running');
  end if;

  v_stop := 'STOP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.assist_emergency_stops
    (stop_code, session_code, reason, stopped_by, stopped_by_user_id, stop_type, sessions_affected)
  values (v_stop, array_to_string(v_codes, ', '), p_reason,
          coalesce((select email from auth.users where id = auth.uid()), 'system'),
          auth.uid(),
          case when p_all then 'force_all' else 'force_single' end, v_count);

  return jsonb_build_object('ok', true, 'stop_code', v_stop,
                            'sessions_stopped', v_count, 'sessions', v_codes);
end;
$$;

-- Section 12: privacy returns to maximum protection when a session ends, rather
-- than staying wherever the last session left it.
create or replace function public.assist_reset_privacy_after_session()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.status in ('completed','terminated','blocked')
     and old.status not in ('completed','terminated','blocked') then
    update public.assist_privacy_controls set enabled = true where enabled = false;
    update public.assist_control_state
       set control_mode = 'view', cursor_control = false, keyboard_control = false,
           voice_active = false
     where session_id = new.id;
  end if;
  return null;
end;
$$;

drop trigger if exists assist_sessions_reset_privacy on public.assist_sessions;
create trigger assist_sessions_reset_privacy
after update of status on public.assist_sessions
for each row execute function public.assist_reset_privacy_after_session();

revoke all on function public.assist_audit(text, uuid, text, jsonb, jsonb, text, text, text) from public, anon;
revoke all on function public.assist_grant_consent(uuid) from public, anon;
revoke all on function public.assist_revoke_consent(uuid, text) from public, anon;
revoke all on function public.assist_decide_approval(uuid, text, text) from public, anon;
revoke all on function public.assist_start_session(uuid) from public, anon;
revoke all on function public.assist_emergency_stop(uuid, text, boolean) from public, anon;
grant execute on function public.assist_audit(text, uuid, text, jsonb, jsonb, text, text, text) to authenticated;
grant execute on function public.assist_grant_consent(uuid) to authenticated;
grant execute on function public.assist_revoke_consent(uuid, text) to authenticated;
grant execute on function public.assist_decide_approval(uuid, text, text) to authenticated;
grant execute on function public.assist_start_session(uuid) to authenticated;
grant execute on function public.assist_emergency_stop(uuid, text, boolean) to authenticated;

drop trigger if exists assist_sessions_reset_privacy on public.assist_sessions;
CREATE TRIGGER assist_sessions_reset_privacy AFTER UPDATE OF status ON public.assist_sessions FOR EACH ROW EXECUTE FUNCTION assist_reset_privacy_after_session();
