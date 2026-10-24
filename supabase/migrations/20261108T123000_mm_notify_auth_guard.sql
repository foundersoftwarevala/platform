-- Keep notification creation internal while enforcing the caller contract
-- even when the function is reached through a SECURITY DEFINER function.
create or replace function public.mm_notify(
  p_event text,
  p_title text,
  p_message text,
  p_user uuid default null::uuid,
  p_role_target text[] default null::text[],
  p_action_url text default null::text,
  p_action_label text default null::text,
  p_dedupe_minutes integer default 60,
  p_severity text default 'info'::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_id uuid;
  v_targets uuid[];
  v_target uuid;
  v_sent integer := 0;
  v_skipped integer := 0;
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Notification creation requires an authenticated or system caller'
      using errcode = '42501';
  end if;

  if coalesce(btrim(p_title), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'title_required');
  end if;
  if p_user is null and p_role_target is null then
    return jsonb_build_object('ok', false, 'reason', 'no_recipient');
  end if;

  if p_user is not null then
    v_targets := array[p_user];
  else
    select coalesce(array_agg(distinct ur.user_id), '{}')
      into v_targets
      from public.user_roles ur
     where ur.role::text = any(p_role_target);
  end if;

  if coalesce(array_length(v_targets, 1), 0) = 0 then
    return jsonb_build_object('ok', true, 'delivered', 0,
                              'reason', 'no_recipient_holds_that_role');
  end if;

  foreach v_target in array v_targets loop
    perform pg_advisory_xact_lock(hashtextextended('mm_notify:' || v_target::text || ':' || p_event, 0));
    if exists (
      select 1 from public.user_notifications n
       where n.event_type = p_event
         and n.user_id = v_target
         and n.created_at > now() - make_interval(mins => greatest(p_dedupe_minutes, 0))
         and not coalesce(n.is_dismissed, false))
    then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    insert into public.user_notifications
      (user_id, type, message, event_type, action_label, action_url,
       is_buzzer, is_read, is_dismissed, role_target)
    values (v_target,
            case when p_severity in ('info','success','warning','danger','priority')
                 then p_severity else 'info' end,
            case when coalesce(btrim(p_message), '') = '' then p_title
                 else p_title || ' - ' || p_message end,
            p_event, p_action_label, p_action_url,
            p_event in ('demo.offline', 'seo.page_broken', 'license.issue_failed'),
            false, false, p_role_target)
    returning id into v_id;
    v_sent := v_sent + 1;
  end loop;

  return jsonb_build_object('ok', true, 'delivered', v_sent,
                            'deduplicated', v_skipped > 0 and v_sent = 0,
                            'suppressed', v_skipped, 'id', v_id);
end;
$function$;

revoke all on function public.mm_notify(text, text, text, uuid, text[], text, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.mm_notify(text, text, text, uuid, text[], text, text, integer, text)
  to service_role;
