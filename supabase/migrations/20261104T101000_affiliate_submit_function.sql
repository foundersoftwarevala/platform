-- An affiliate application, submitted the way every other role's is.
--
-- Resellers, sellers, franchises and influencers each apply through a database
-- function that knows who is applying (auth.uid()), refuses a second open
-- application, checks the required fields, keeps what was submitted, and
-- records and announces it. Affiliates were the exception: the API inserted a
-- row with the service key, kept only a display name, and wrote no audit entry
-- and no notice. This is that same step as a function, so the affiliate form
-- has the same guarantees as the others.

create or replace function public.submit_affiliate_application(p_display_name text, p_application jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_row public.marketplace_affiliate_partners%rowtype;
  v_name text := left(nullif(btrim(coalesce(p_display_name, '')), ''), 120);
  v_missing text[];
  v_number text;
begin
  if v_user is null then raise exception 'Sign in to apply'; end if;
  if coalesce((p_application ->> 'agreementAccepted')::boolean, false) is not true then
    raise exception 'The affiliate agreement must be accepted';
  end if;

  -- One affiliate account per person (user_id is unique): a second application
  -- is the first one, whatever its state.
  select * into v_row from public.marketplace_affiliate_partners where user_id = v_user;
  if found then
    return jsonb_build_object(
      'application_number', 'AFF-' || upper(substr(replace(v_row.id::text, '-', ''), 1, 10)),
      'status', v_row.status, 'duplicate', true, 'id', v_row.id);
  end if;

  if v_name is null or length(v_name) < 2 then raise exception 'A display name is required'; end if;
  v_missing := public.role_application_missing(p_application, array['fullName', 'email', 'phone', 'country']);
  if array_length(v_missing, 1) > 0 then
    raise exception 'Missing required fields: %', array_to_string(v_missing, ', ');
  end if;

  insert into public.marketplace_affiliate_partners (user_id, display_name, status, application, applied_at)
  values (v_user, v_name, 'pending',
          (p_application - 'agreementAccepted') || jsonb_build_object('agreement_accepted_at', now()),
          now())
  returning * into v_row;

  v_number := 'AFF-' || upper(substr(replace(v_row.id::text, '-', ''), 1, 10));
  perform public.mm_audit('affiliate.application_submitted', 'marketplace_affiliate_partner', v_row.id::text, null,
                          jsonb_build_object('application_number', v_number), null);
  perform public.mm_notify('affiliate.application_submitted', 'Application received',
    format('Your affiliate application %s is pending review.', v_number),
    v_user, null, null, null, 0, 'info');
  return jsonb_build_object('application_number', v_number, 'status', v_row.status, 'duplicate', false, 'id', v_row.id);
end;
$function$;

revoke all on function public.submit_affiliate_application(text, jsonb) from public;
grant execute on function public.submit_affiliate_application(text, jsonb) to authenticated, service_role;
