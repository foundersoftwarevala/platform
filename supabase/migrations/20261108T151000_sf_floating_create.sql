-- Add floating storefront elements through the same operator-only,
-- audited draft workflow used by the storefront chrome manager.
create or replace function public.sf_floating_create(
  p_key text,
  p_element_type text,
  p_name text,
  p_label text,
  p_position text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_priority integer;
  v_after jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  if p_key is null or p_key !~ '^[a-z0-9][a-z0-9_-]{0,79}$'
     or p_element_type is null
     or p_element_type not in ('ai_chat', 'support', 'request_demo', 'actions', 'link')
     or nullif(btrim(p_name), '') is null or length(p_name) > 160
     or nullif(btrim(p_label), '') is null or length(p_label) > 80
     or p_position is null
     or p_position not in ('bottom-right', 'bottom-left', 'top-right', 'top-left') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_config');
  end if;

  select slot.priority
    into v_priority
    from generate_series(1, 100) as slot(priority)
   where not exists (
     select 1
       from public.storefront_floating_elements f
      where f.position = p_position
        and f.priority = slot.priority
   )
   order by slot.priority
   limit 1;

  if v_priority is null then
    return jsonb_build_object('ok', false, 'reason', 'no_priority_available');
  end if;

  insert into public.storefront_floating_elements as f (
    key, element_type, name, label, position, priority, enabled,
    action_type, created_by, updated_by
  )
  values (
    p_key, p_element_type, btrim(p_name), btrim(p_label), p_position,
    v_priority, false, 'none', auth.uid(), auth.uid()
  )
  returning to_jsonb(f.*) into v_after;

  perform public.mm_audit(
    'floating.create', 'storefront_floating', p_key, null, v_after, null
  );

  return jsonb_build_object('ok', true, 'element', v_after);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'duplicate_key_or_priority');
end;
$$;

revoke all on function public.sf_floating_create(text, text, text, text, text) from public, anon;
grant execute on function public.sf_floating_create(text, text, text, text, text) to authenticated;
