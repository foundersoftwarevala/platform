-- Keep operator-assigned reseller plans visible to the reseller dashboard.
-- Also assign manager-created CRM customers to the selected reseller's team
-- member row, which is the owner_id relation used by that dashboard.
create index if not exists crm_customers_owner_id_idx
  on public.crm_customers (owner_id)
  where owner_id is not null;

create index if not exists team_members_normalized_email_idx
  on public.team_members (lower(btrim(email)));

create or replace function public.reseller_manager_customer_owner_id(p_reseller_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text;
  v_name text;
  v_owner_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'not permitted' using errcode = '42501';
  end if;

  select nullif(lower(btrim(r.email)), ''),
         coalesce(nullif(btrim(r.name), ''), nullif(btrim(r.company_name), ''), r.email)
    into v_email, v_name
    from public.resellers r
   where r.id = p_reseller_id
     and r.status <> 'terminated'
   for share;

  if v_email is null then
    return null;
  end if;

  -- Serialize first-time owner provisioning for the same reseller email.
  perform pg_advisory_xact_lock(hashtextextended(v_email, 0));

  select tm.id
    into v_owner_id
    from public.team_members tm
   where lower(btrim(tm.email)) = v_email
   order by tm.created_at, tm.id
   limit 1;

  if v_owner_id is not null then
    return v_owner_id;
  end if;

  insert into public.team_members (full_name, email, department, role_title, status)
  values (v_name, v_email, 'Channel', 'Reseller', 'active')
  returning id into v_owner_id;

  return v_owner_id;
end;
$$;

revoke all on function public.reseller_manager_customer_owner_id(uuid) from public, anon, authenticated;
grant execute on function public.reseller_manager_customer_owner_id(uuid) to service_role;

create or replace function public.mm_reseller_plan(
  p_id uuid, p_plan text, p_reason text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_plan public.reseller_membership_plans%rowtype;
  v_membership_id uuid;
  v_now timestamptz := clock_timestamp();
  v_expires_at timestamptz;
  v_feature text;
begin
  if not public.mm_reseller_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  if p_plan is not null then
    select * into v_plan
      from public.reseller_membership_plans
     where code = p_plan
       and enabled
     for share;
    if not found then
      return jsonb_build_object(
        'ok', false,
        'reason', 'unknown_plan',
        'message', 'That is not an enabled reseller plan.'
      );
    end if;
  end if;

  perform 1 from public.resellers where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_reseller');
  end if;
  select to_jsonb(r) into v_before from public.resellers r where r.id = p_id;

  update public.reseller_membership_entitlements e
     set expires_at = least(e.expires_at, v_now)
    from public.reseller_memberships m
   where e.membership_id = m.id
     and m.reseller_id = p_id
     and m.status in ('pending', 'active', 'renewal_due');

  update public.reseller_memberships
     set status = 'expired',
         membership_state = 'expired',
         expires_at = least(coalesce(expires_at, v_now), v_now),
         updated_at = v_now
   where reseller_id = p_id
     and status in ('pending', 'active', 'renewal_due');

  if p_plan is not null then
    v_expires_at := v_now + make_interval(days => v_plan.validity_days);

    insert into public.reseller_memberships (
      reseller_id, plan_id, plan_code, status, membership_state,
      starts_at, expires_at, activated_at, entitlements_snapshot
    )
    values (
      p_id, v_plan.id, v_plan.code, 'active', 'active',
      v_now, v_expires_at, v_now, v_plan.features
    )
    returning id into v_membership_id;

    insert into public.reseller_membership_entitlements (
      membership_id, feature_key, feature_value, starts_at, expires_at
    )
    values (
      v_membership_id, 'profit_percent', to_jsonb(v_plan.profit_percent), v_now, v_expires_at
    );

    if jsonb_typeof(v_plan.features) = 'array' then
      for v_feature in select jsonb_array_elements_text(v_plan.features) loop
        insert into public.reseller_membership_entitlements (
          membership_id, feature_key, feature_value, starts_at, expires_at
        )
        values (
          v_membership_id, 'feature:' || v_feature, to_jsonb(v_feature), v_now, v_expires_at
        )
        on conflict (membership_id, feature_key) do nothing;
      end loop;
    end if;
  end if;

  update public.resellers
     set plan_code = p_plan,
         updated_at = v_now
   where id = p_id
  returning to_jsonb(resellers) into v_after;

  perform public.mm_audit('reseller.plan', 'reseller', p_id::text,
                          v_before, v_after, p_reason);

  return jsonb_build_object(
    'ok', true,
    'reseller', v_after,
    'note', 'This sets the margin for future sales. Commission already earned keeps '
            'the rate recorded on it at the time.'
  );
end;
$$;
