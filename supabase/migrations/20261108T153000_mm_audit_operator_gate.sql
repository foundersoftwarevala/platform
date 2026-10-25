-- Restrict direct audit writes to trusted server-side callers. Existing
-- SECURITY DEFINER business functions continue to invoke mm_audit as owner;
-- authenticated operator callers use the explicitly gated wrapper below.

begin;

revoke all on function public.mm_audit(text, text, text, jsonb, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.mm_audit(text, text, text, jsonb, jsonb, text)
  to service_role;

create or replace function public.mm_audit_operator(
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.mm_is_operator() then
    raise exception 'not permitted to write Marketplace Manager audit events'
      using errcode = '42501';
  end if;

  return public.mm_audit(
    p_action,
    p_entity_type,
    p_entity_id,
    p_before,
    p_after,
    p_reason
  );
end;
$$;

revoke all on function public.mm_audit_operator(text, text, text, jsonb, jsonb, text)
  from public, anon;
grant execute on function public.mm_audit_operator(text, text, text, jsonb, jsonb, text)
  to authenticated, service_role;

-- These two functions are SECURITY INVOKER and already authorize admin
-- callers themselves. Route their audit writes through the gated definer
-- wrapper so removing direct authenticated access to mm_audit does not break
-- homepage layout changes.
do $$
declare
  v_function oid;
  v_signature text;
  v_definition text;
begin
  foreach v_signature in array array[
    'public.mm_section_set_enabled(text, boolean)',
    'public.mm_sections_reorder(jsonb)'
  ]
  loop
    v_function := to_regprocedure(v_signature)::oid;
    if v_function is null then
      continue;
    end if;

    v_definition := pg_get_functiondef(v_function);
    if position('public.mm_audit(' in v_definition) > 0 then
      execute replace(v_definition, 'public.mm_audit(', 'public.mm_audit_operator(');
    end if;
  end loop;
end;
$$;

commit;
