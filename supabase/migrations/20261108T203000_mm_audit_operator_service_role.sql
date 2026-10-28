-- Internal, already-authenticated server routes use the trusted service-role
-- key to record audit events. User JWTs remain subject to the operator gate.
begin;

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
  if auth.role() is distinct from 'service_role'
     and not public.mm_is_operator() then
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

commit;
