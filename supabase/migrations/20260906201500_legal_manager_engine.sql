-- The Legal Manager engine: logging, versioning, and the login gate.
--
-- Section 14 is the one that has to be right. A login gate that lives in the
-- browser is decoration: the screen can be skipped, the checkbox can be ticked
-- by anything, and "scrolled to the end" is a claim the client makes about
-- itself. What makes it real is that the server decides whether somebody still
-- owes an acceptance, and that the answer changes the moment a new version is
-- published.
--
-- The rest follows from section 12: a version is published once, its text is
-- then frozen, and the previous version is superseded rather than replaced.

-- ------------------------------------------------------------------- log ---
create or replace function public.legal_log(
  p_action text, p_entity_type text default null, p_entity_id text default null,
  p_old jsonb default null, p_new jsonb default null,
  p_reason text default null, p_severity text default 'info',
  p_result text default 'success')
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_id uuid; v_email text; v_role text;
begin
  select u.email into v_email from auth.users u where u.id = auth.uid();
  select ur.role::text into v_role from public.user_roles ur where ur.user_id = auth.uid() limit 1;

  insert into public.legal_logs
    (actor, actor_user_id, actor_role, action, entity_type, entity_id,
     old_state, new_state, reason, severity, result)
  values
    (coalesce(v_email, case when auth.uid() is null then 'system' else 'account' end),
     auth.uid(), coalesce(v_role, 'system'), p_action, p_entity_type, p_entity_id,
     p_old, p_new, p_reason, p_severity, p_result)
  returning id into v_id;
  return v_id;
end;
$$;

-- --------------------------------------------------------------- versions ---
-- Publishing is the moment the text becomes binding, so it is one operation:
-- freeze the body, stamp who did it, supersede whatever came before, and
-- record it.
create or replace function public.legal_publish_version(
  p_version_id uuid, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v public.legal_agreement_versions%rowtype;
  a public.legal_agreements%rowtype;
  v_hash text;
begin
  if not public.legal_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select * into v from public.legal_agreement_versions where id = p_version_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_such_version'); end if;
  if v.status = 'published' then
    return jsonb_build_object('ok', false, 'reason', 'already_published');
  end if;
  -- Section 7 and 28: an AI draft is a draft. It is approved by a person before
  -- it can be published, and the approver is not optional.
  if v.approved_by is null then
    return jsonb_build_object('ok', false, 'reason', 'a version must be approved before it is published');
  end if;

  select * into a from public.legal_agreements where id = v.agreement_id;
  v_hash := encode(extensions.digest(v.body, 'sha256'), 'hex');

  -- Everything published before this is superseded, never deleted: an
  -- acceptance recorded against it still has to resolve.
  update public.legal_agreement_versions
     set status = 'superseded', superseded_at = now()
   where agreement_id = v.agreement_id and status = 'published' and id <> p_version_id;

  update public.legal_agreement_versions
     set status = 'published', published_by = auth.uid(), published_at = now(),
         body_sha256 = v_hash, reason = coalesce(p_reason, reason)
   where id = p_version_id;

  update public.legal_agreements
     set status = 'published', current_version_id = p_version_id
   where id = v.agreement_id;

  perform public.legal_log('Agreement Version Published', 'legal_agreement_version',
    p_version_id::text,
    jsonb_build_object('status', v.status),
    jsonb_build_object('status', 'published', 'version', v.version, 'sha256', v_hash),
    p_reason, 'warning');

  return jsonb_build_object('ok', true, 'version', v.version, 'sha256', v_hash,
                            'agreement', a.ref_code);
end;
$$;

-- --------------------------------------------------------- the login gate ---
-- What does this person still owe? Answered from the database, so the browser
-- cannot decide it has nothing outstanding.
create or replace function public.legal_pending_acceptances(p_user_id uuid default null)
returns table (
  agreement_id uuid,
  agreement_ref text,
  agreement_name text,
  version_id uuid,
  version text,
  body text,
  body_sha256 text,
  reason text
)
language sql stable security definer set search_path = public, pg_temp
as $$
  with me as (select coalesce(p_user_id, auth.uid()) as uid),
  my_roles as (
    select ur.role::text as role from public.user_roles ur, me where ur.user_id = me.uid
  )
  select a.id, a.ref_code, a.name, v.id, v.version, v.body, v.body_sha256,
         case
           when exists (
             select 1 from public.legal_acceptances acc, me
             where acc.agreement_id = a.id and acc.user_id = me.uid and acc.decision = 'accepted')
           then 're_accept_required'
           else 'never_accepted'
         end
  from public.legal_agreements a
  join public.legal_agreement_versions v
    on v.id = a.current_version_id and v.status = 'published'
  , me
  where a.gate_on_login
    and a.requires_acceptance
    and a.status = 'published'
    -- Either it applies to everyone, or to a role this person holds.
    and (a.applies_to_role is null
         or a.applies_to_role in (select role from my_roles))
    -- And they have not accepted this exact version.
    and not exists (
      select 1 from public.legal_acceptances acc
      where acc.version_id = v.id and acc.user_id = me.uid and acc.decision = 'accepted')
  order by a.ref_code;
$$;

-- Recording a decision. The person records their own; nobody records it for
-- them, and it cannot be edited afterwards.
create or replace function public.legal_record_acceptance(
  p_version_id uuid, p_decision text default 'accepted',
  p_scrolled_to_end boolean default false,
  p_ip text default null, p_user_agent text default null,
  p_session_reference text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v public.legal_agreement_versions%rowtype;
  a public.legal_agreements%rowtype;
  v_email text; v_role text; v_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'sign_in_required');
  end if;
  if p_decision not in ('accepted', 'rejected') then
    return jsonb_build_object('ok', false, 'reason', 'unknown_decision');
  end if;

  select * into v from public.legal_agreement_versions where id = p_version_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_such_version'); end if;
  -- Only a published version can be accepted. Accepting a draft would bind
  -- somebody to text that is still being edited.
  if v.status <> 'published' then
    return jsonb_build_object('ok', false, 'reason', 'that version is not published');
  end if;

  -- Section 14: the server will not accept a claim of acceptance that skipped
  -- the review it required.
  if p_decision = 'accepted' and not p_scrolled_to_end then
    return jsonb_build_object('ok', false, 'reason', 'the agreement must be read to the end before it can be accepted');
  end if;

  select * into a from public.legal_agreements where id = v.agreement_id;
  select u.email into v_email from auth.users u where u.id = auth.uid();
  select ur.role::text into v_role from public.user_roles ur where ur.user_id = auth.uid() limit 1;

  insert into public.legal_acceptances
    (agreement_id, version_id, version_label, body_sha256, user_id, user_email,
     user_role, decision, method, ip_address, user_agent, session_reference,
     scrolled_to_end)
  values
    (v.agreement_id, p_version_id, v.version, v.body_sha256, auth.uid(), v_email,
     v_role, p_decision, 'login_gate', p_ip, p_user_agent, p_session_reference,
     p_scrolled_to_end)
  on conflict (version_id, user_id, decision) do nothing
  returning id into v_id;

  perform public.legal_log(
    case when p_decision = 'accepted' then 'Agreement Accepted' else 'Agreement Rejected' end,
    'legal_agreement_version', p_version_id::text, null,
    jsonb_build_object('decision', p_decision, 'version', v.version,
                       'agreement', a.ref_code),
    null, case when p_decision = 'rejected' then 'warning' else 'info' end);

  return jsonb_build_object('ok', true, 'decision', p_decision,
                            'acceptance_id', v_id, 'agreement', a.ref_code);
end;
$$;

-- Is this person cleared to proceed? One question, one answer, decided here.
create or replace function public.legal_gate_status(p_user_id uuid default null)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'user_id', coalesce(p_user_id, auth.uid()),
    'blocked', exists (select 1 from public.legal_pending_acceptances(p_user_id)),
    'pending', coalesce((
      select jsonb_agg(jsonb_build_object(
        'agreement_id', agreement_id, 'ref', agreement_ref, 'name', agreement_name,
        'version_id', version_id, 'version', version, 'reason', reason))
      from public.legal_pending_acceptances(p_user_id)), '[]'::jsonb)
  );
$$;

revoke all on function public.legal_log(text, text, text, jsonb, jsonb, text, text, text) from public, anon;
revoke all on function public.legal_publish_version(uuid, text) from public, anon;
revoke all on function public.legal_pending_acceptances(uuid) from public, anon;
revoke all on function public.legal_record_acceptance(uuid, text, boolean, text, text, text) from public, anon;
revoke all on function public.legal_gate_status(uuid) from public, anon;
grant execute on function public.legal_log(text, text, text, jsonb, jsonb, text, text, text) to authenticated;
grant execute on function public.legal_publish_version(uuid, text) to authenticated;
grant execute on function public.legal_pending_acceptances(uuid) to authenticated;
grant execute on function public.legal_record_acceptance(uuid, text, boolean, text, text, text) to authenticated;
grant execute on function public.legal_gate_status(uuid) to authenticated;
