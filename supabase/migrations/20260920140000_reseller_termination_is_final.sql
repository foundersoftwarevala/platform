-- A terminated reseller stays terminated.
--
-- mm_reseller_status accepted any transition, and the Reseller Manager showed
-- "Approve" on every reseller that was not active, so one click turned a
-- terminated reseller back into an active one - role, referral links and all.
-- Operators (admin/boss/finance) could also do it with a direct table update,
-- because the privilege guard lets them through.
--
-- Now:
--   * TERMINATED is final. No status change out of it, by any path: the
--     approval function refuses it, and a trigger refuses a direct UPDATE from
--     anyone. The record's identity and history fields (code, application,
--     approval, plan, tier) are frozen too, so an old application cannot be
--     re-used. The only change allowed is the user link being cleared when the
--     account itself is deleted (ON DELETE SET NULL).
--   * A terminated person who wants to return applies again. That creates a new
--     reseller record with a new application number, in 'pending', which goes
--     through the normal approval. The new application records which earlier
--     record it follows. Nothing of the old record is changed or deleted: its
--     application, audit history, termination reason, memberships and orders
--     all stay where they are.
--   * One live (non-terminated) reseller record per account, instead of one
--     record per account for ever.
--   * Lookups by account resolve to the live record, never a terminated one.

/* ------------------------------------------------ one live record per user */

drop index if exists public.idx_resellers_user_id_unique;
create unique index if not exists resellers_one_live_record_per_user
  on public.resellers (user_id)
  where user_id is not null and status <> 'terminated';

/* ------------------------------------------------------ terminated is final */

create or replace function public.reseller_terminated_is_final()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if old.status = 'terminated' then
    if new.status is distinct from old.status then
      raise exception 'Reseller % is terminated. Termination is final: the person must submit a new application.', old.code
        using errcode = 'P0001';
    end if;
    if new.code is distinct from old.code
       or new.application is distinct from old.application
       or new.applied_at is distinct from old.applied_at
       or new.approved_at is distinct from old.approved_at
       or new.approved_by is distinct from old.approved_by
       or new.plan_code is distinct from old.plan_code
       or new.tier is distinct from old.tier
       or (new.user_id is distinct from old.user_id and new.user_id is not null) then
      raise exception 'Reseller % is terminated; its record is kept as history and cannot be changed.', old.code
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists reseller_terminated_is_final on public.resellers;
create trigger reseller_terminated_is_final
  before update on public.resellers
  for each row execute function public.reseller_terminated_is_final();

/* --------------------------------------------------- the approval function */

create or replace function public.mm_reseller_status(p_id uuid, p_to text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_before jsonb; v_after jsonb; v_user uuid; v_status text;
begin
  if not public.mm_reseller_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if p_to not in ('pending','active','paused','suspended','rejected','terminated') then
    return jsonb_build_object('ok', false, 'reason', 'unknown_status');
  end if;

  select to_jsonb(r), r.user_id, r.status into v_before, v_user, v_status from public.resellers r where r.id = p_id;
  if v_before is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_reseller');
  end if;
  -- Terminated is final. Returning means a new application, approved afresh.
  if v_status = 'terminated' then
    return jsonb_build_object('ok', false, 'reason', 'terminated_final',
      'message', 'This reseller is terminated. Termination is final; the person must submit a new application, which is approved on its own.');
  end if;
  -- Nobody decides on their own reseller account.
  if v_user is not null and v_user = auth.uid() then
    return jsonb_build_object('ok', false, 'reason', 'self_action',
      'message', 'You cannot change the status of your own reseller account.');
  end if;

  if p_to in ('suspended','rejected','terminated') and coalesce(btrim(p_reason),'') = '' then
    return jsonb_build_object('ok', false, 'reason', 'reason_required',
      'message', 'Say why. This stops the reseller earning and is recorded permanently.');
  end if;

  update public.resellers
     set status = p_to,
         approved_at = case when p_to='active' then coalesce(approved_at, now()) else approved_at end,
         approved_by = case when p_to='active' then coalesce(approved_by, auth.uid()) else approved_by end,
         updated_at = now()
   where id = p_id returning to_jsonb(resellers) into v_after;

  -- The account behind the reseller gets (or loses) the reseller role, which
  -- is what opens the reseller dashboard.
  if v_user is not null then
    if p_to = 'active' then
      insert into public.user_roles (user_id, role) values (v_user, 'reseller')
      on conflict do nothing;
    elsif p_to in ('rejected','terminated') then
      delete from public.user_roles where user_id = v_user and role = 'reseller';
    end if;
  end if;

  if p_to in ('paused','suspended','rejected','terminated') then
    update public.marketplace_referral_codes set active = false, updated_at = now()
     where reseller_id = p_id and active;
  elsif p_to = 'active' then
    update public.marketplace_referral_codes set active = true, updated_at = now()
     where reseller_id = p_id and not active;
  end if;

  perform public.mm_audit('reseller.' || p_to, 'reseller', p_id::text, v_before, v_after, p_reason);

  if v_user is not null then
    perform public.mm_notify('reseller.' || p_to,
      case p_to when 'active' then 'Your reseller account is approved'
                when 'rejected' then 'Your reseller application was not accepted'
                when 'suspended' then 'Your reseller account is suspended'
                when 'paused' then 'Your reseller account is paused'
                when 'terminated' then 'Your reseller account is closed'
                else 'Your reseller account status changed' end,
      coalesce(p_reason,''), v_user, null, '/dashboard/reseller', 'Open', 5,
      case p_to when 'active' then 'success'
                when 'rejected' then 'warning'
                when 'paused' then 'warning' else 'danger' end);
  end if;

  return jsonb_build_object('ok', true, 'reseller', v_after);
end;
$function$;

/* ------------------------------------------------------------ re-applying */

create or replace function public.submit_reseller_application(p_application jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_existing public.resellers%rowtype;
  v_previous public.resellers%rowtype;
  v_row public.resellers%rowtype;
  v_number text;
  v_missing text[] := array[]::text[];
  f text;
begin
  if v_user is null then raise exception 'Sign in to apply'; end if;

  -- One live application per account: a second submit answers with it.
  select * into v_existing from public.resellers
   where user_id = v_user and status <> 'terminated'
   order by created_at desc limit 1;
  if found then
    return jsonb_build_object('ok', true, 'duplicate', true, 'id', v_existing.id,
      'application_number', v_existing.code, 'status', v_existing.status);
  end if;

  foreach f in array array['fullName','email','phone','country','companyName','businessType'] loop
    if coalesce(btrim(p_application->>f), '') = '' then v_missing := v_missing || f; end if;
  end loop;
  if array_length(v_missing, 1) > 0 then
    raise exception 'Missing required fields: %', array_to_string(v_missing, ', ');
  end if;
  if coalesce((p_application->>'agreementAccepted')::boolean, false) is not true then
    raise exception 'The reseller agreement must be accepted';
  end if;

  -- A person whose earlier reseller record was terminated applies afresh: a new
  -- record and number, linked to the old one, which is left exactly as it is.
  select * into v_previous from public.resellers
   where user_id = v_user and status = 'terminated'
   order by created_at desc limit 1;

  loop
    v_number := 'RSA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    exit when not exists (select 1 from public.resellers where code = v_number);
  end loop;

  insert into public.resellers (name, code, email, phone, region, company_name, status, tier,
                                user_id, application, applied_at)
  values (btrim(p_application->>'fullName'), v_number, lower(btrim(p_application->>'email')),
          btrim(p_application->>'phone'), nullif(btrim(p_application->>'country'), ''),
          btrim(p_application->>'companyName'), 'pending', 'bronze',
          v_user,
          (p_application - 'agreementAccepted' - 'previous_reseller_id' - 'previous_application_number')
            || jsonb_build_object('agreement_accepted_at', now())
            || case when v_previous.id is null then '{}'::jsonb
                    else jsonb_build_object('previous_reseller_id', v_previous.id,
                                            'previous_application_number', v_previous.code) end,
          now())
  returning * into v_row;

  if v_previous.id is not null then
    perform public.mm_audit('reseller.reapplied', 'reseller', v_row.id::text,
      jsonb_build_object('previous_reseller_id', v_previous.id, 'previous_application_number', v_previous.code,
                         'previous_status', v_previous.status),
      jsonb_build_object('application_number', v_row.code, 'status', v_row.status), null);
  end if;

  return jsonb_build_object('ok', true, 'duplicate', false, 'id', v_row.id,
    'application_number', v_row.code, 'status', v_row.status,
    'previous_application_number', v_previous.code);
end;
$function$;

revoke all on function public.submit_reseller_application(jsonb) from public, anon;
grant execute on function public.submit_reseller_application(jsonb) to authenticated;

/* ----------------------------------------- lookups resolve the live record */

create or replace function public.reseller_pricing_for(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_reseller public.resellers%rowtype;
  v_membership record;
begin
  if p_user is null then
    return jsonb_build_object('eligible', false, 'percent', 0, 'reason', 'not_signed_in');
  end if;
  select * into v_reseller from public.resellers
   where user_id = p_user and status <> 'terminated'
   order by created_at desc limit 1;
  if not found then
    return jsonb_build_object('eligible', false, 'percent', 0, 'reason', 'not_a_reseller');
  end if;
  if v_reseller.status <> 'active' or v_reseller.approved_at is null then
    return jsonb_build_object('eligible', false, 'percent', 0, 'reseller_id', v_reseller.id,
                              'reason', 'reseller_not_active');
  end if;
  select m.id, m.expires_at, p.code, p.name, p.profit_percent
    into v_membership
    from public.reseller_memberships m
    join public.reseller_membership_plans p on p.id = m.plan_id
   where m.reseller_id = v_reseller.id
     and m.status = 'active'
     and (m.expires_at is null or m.expires_at > now())
   order by p.profit_percent desc, m.activated_at desc nulls last
   limit 1;
  if not found or coalesce(v_membership.profit_percent, 0) <= 0 then
    return jsonb_build_object('eligible', false, 'percent', 0, 'reseller_id', v_reseller.id,
                              'reason', 'no_active_membership');
  end if;
  return jsonb_build_object('eligible', true, 'percent', v_membership.profit_percent,
    'reseller_id', v_reseller.id, 'membership_id', v_membership.id,
    'plan_code', v_membership.code, 'plan_name', v_membership.name,
    'expires_at', v_membership.expires_at, 'reason', 'active_membership');
end;
$function$;

revoke all on function public.reseller_pricing_for(uuid) from public, anon, authenticated;
