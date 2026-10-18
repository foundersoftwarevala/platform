-- AMS: an event for a role the person does not hold is refused.
--
-- A hook names the role an event belongs to (a vendor's sale, a reseller's
-- referral). ams_resolve_role() honours that only if the person holds it; when
-- they did not, ingest fell back to another role they hold, so a sale credited
-- to someone as a reseller could be counted as their developer activity. Such
-- an event now belongs to no role and is not recorded.

begin;

create or replace function public.ams_ingest_event(
  p_user_id uuid, p_event_key text, p_entity_type text DEFAULT NULL::text,
  p_entity_id text DEFAULT NULL::text, p_value numeric DEFAULT 1,
  p_occurred_at timestamp with time zone DEFAULT now(), p_source text DEFAULT 'system'::text,
  p_payload jsonb DEFAULT '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role text;
  v_key  text;
  v_id   uuid;
begin
  if p_user_id is null or coalesce(p_event_key,'') = '' then
    return jsonb_build_object('ok', false, 'reason', 'user_and_event_required');
  end if;

  -- The AMS role this event belongs to, from the person's own roles.
  v_role := public.ams_resolve_role(p_user_id, nullif(p_payload->>'ams_role', ''));
  -- An event that names the capacity the person acted in belongs to that role
  -- or to none: it is never re-filed under another role the person holds.
  if nullif(p_payload->>'ams_role', '') is not null and v_role is distinct from p_payload->>'ams_role' then
    return jsonb_build_object('ok', false, 'reason', 'role_not_held');
  end if;
  if v_role is null then
    -- Not an error: the person holds no role AMS covers yet.
    return jsonb_build_object('ok', false, 'reason', 'no_ams_role');
  end if;

  -- Derived from the occurrence itself, so the same real thing reported twice
  -- lands once. This is what makes re-imports and retried triggers safe.
  v_key := coalesce(p_entity_type,'-') || ':' || coalesce(p_entity_id,'-')
           || ':' || p_event_key || ':' || p_user_id::text;

  insert into public.ams_activity_events
    (user_id, role, event_key, entity_type, entity_id, value,
     occurred_at, source, dedupe_key, payload)
  values
    (p_user_id, v_role, p_event_key, p_entity_type, p_entity_id, coalesce(p_value,1),
     coalesce(p_occurred_at, now()), coalesce(p_source,'system'), v_key,
     coalesce(p_payload,'{}'::jsonb))
  on conflict (dedupe_key) do nothing
  returning id into v_id;

  if v_id is null then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  -- Evaluate now, so recognition follows the activity. A failure here never
  -- undoes the business event that caused it: the event stays unprocessed and
  -- ams_sweep() or ams_recompute() picks it up. A replay defers evaluation and
  -- evaluates each person once at the end.
  if coalesce(current_setting('ams.defer_eval', true), '') <> 'on' then
    begin
      perform public.ams_evaluate_user(p_user_id);
    exception when others then
      raise warning 'AMS evaluation deferred for %: %', p_user_id, sqlerrm;
    end;
  end if;

  return jsonb_build_object('ok', true, 'duplicate', false, 'event_id', v_id, 'role', v_role);
end $function$;


commit;

notify pgrst, 'reload schema';
