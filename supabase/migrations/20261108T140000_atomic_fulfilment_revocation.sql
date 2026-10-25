-- Revoke legacy marketplace licenses and entitlements in one database
-- transaction so neither half of access can remain active after an error.
create or replace function public.revoke_order_access(
  p_order_id uuid,
  p_reason text default 'operator revocation'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  v_now timestamptz := now();
  v_license_count integer := 0;
  v_entitlement_count integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  update public.licenses
     set status = 'revoked',
         revoked_at = v_now,
         revoked_reason = left(coalesce(nullif(trim(p_reason), ''), 'operator revocation'), 200),
         updated_at = v_now
   where order_id = p_order_id
     and status <> 'revoked';
  get diagnostics v_license_count = row_count;

  update public.entitlements
     set status = 'revoked',
         revoked_at = v_now
   where order_id = p_order_id
     and status <> 'revoked';
  get diagnostics v_entitlement_count = row_count;

  return jsonb_build_object(
    'ok', true,
    'licenses', v_license_count,
    'entitlements', v_entitlement_count
  );
end;
$function$;

revoke all on function public.revoke_order_access(uuid, text) from public, anon, authenticated;
grant execute on function public.revoke_order_access(uuid, text) to service_role;
