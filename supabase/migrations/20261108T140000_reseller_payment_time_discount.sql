-- Reseller membership discounts are for referred customers, and are evaluated
-- when a payment starts. No customer CRM or lead records are created here.

-- Do not grant a reseller discount on product/cart quotes or when merely
-- creating an unpaid order. The payment route applies referral pricing below.
create or replace function public.reseller_pricing_for(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'eligible', false,
    'percent', 0,
    'reason', 'discount_only_at_payment'
  );
$$;

create or replace function public.reseller_discount_for_payment(
  p_reseller_id uuid,
  p_buyer_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_reseller public.resellers%rowtype;
  v_membership record;
  v_now timestamptz := statement_timestamp();
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  if p_reseller_id is null or p_buyer_id is null then
    return jsonb_build_object('eligible', false, 'percent', 0, 'reseller_id', null,
                              'reason', 'no_reseller_referral');
  end if;

  select * into v_reseller
    from public.resellers
   where id = p_reseller_id;
  if not found or v_reseller.status <> 'active' or v_reseller.approved_at is null then
    return jsonb_build_object('eligible', false, 'percent', 0, 'reseller_id', p_reseller_id,
                              'reason', 'reseller_not_active');
  end if;
  if v_reseller.user_id = p_buyer_id then
    return jsonb_build_object('eligible', false, 'percent', 0, 'reseller_id', p_reseller_id,
                              'reason', 'self_referral');
  end if;

  select m.id, m.starts_at, m.expires_at, p.code, p.name, p.profit_percent
    into v_membership
    from public.reseller_memberships m
    join public.reseller_membership_plans p on p.id = m.plan_id
   where m.reseller_id = p_reseller_id
     and m.status = 'active'
     and m.starts_at is not null
     and m.starts_at <= v_now
     and m.expires_at is not null
     and m.expires_at > v_now
   order by m.starts_at desc, m.activated_at desc nulls last
   limit 1;
  if not found or coalesce(v_membership.profit_percent, 0) <= 0 then
    return jsonb_build_object('eligible', false, 'percent', 0, 'reseller_id', p_reseller_id,
                              'reason', 'no_active_membership');
  end if;

  return jsonb_build_object(
    'eligible', true,
    'percent', v_membership.profit_percent,
    'reseller_id', p_reseller_id,
    'membership_id', v_membership.id,
    'plan_code', v_membership.code,
    'plan_name', v_membership.name,
    'starts_at', v_membership.starts_at,
    'expires_at', v_membership.expires_at,
    'reason', 'active_membership'
  );
end;
$$;

revoke all on function public.reseller_discount_for_payment(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reseller_discount_for_payment(uuid, uuid) to service_role;

create or replace function public.marketplace_apply_reseller_discount(
  p_order_id uuid,
  p_buyer_id uuid,
  p_reseller_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.marketplace_orders%rowtype;
  v_pricing jsonb;
  v_percent numeric := 0;
  v_discount numeric(20,2) := 0;
  v_now timestamptz := clock_timestamp();
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'not permitted' using errcode = '42501';
  end if;

  select * into v_order
    from public.marketplace_orders
   where id = p_order_id
   for update;
  if not found or v_order.buyer_id is distinct from p_buyer_id then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if v_order.status <> 'pending_payment' then
    raise exception 'order is not awaiting payment' using errcode = '23514';
  end if;

  v_pricing := public.reseller_discount_for_payment(p_reseller_id, p_buyer_id);
  v_percent := case when (v_pricing->>'eligible')::boolean
                    then (v_pricing->>'percent')::numeric else 0 end;
  v_discount := round(v_order.subtotal * v_percent / 100, 2);
  v_pricing := v_pricing || jsonb_build_object(
    'list_subtotal', v_order.subtotal,
    'discount_total', v_discount,
    'applied_at', v_now
  );

  update public.marketplace_orders
     set discount_total = v_discount,
         total = greatest(v_order.subtotal - v_discount, 0),
         metadata = (coalesce(v_order.metadata, '{}'::jsonb) - 'pricing')
                    || jsonb_build_object('pricing', v_pricing),
         updated_at = v_now
   where id = p_order_id
  returning * into v_order;

  return jsonb_build_object(
    'order_id', v_order.id,
    'subtotal', v_order.subtotal,
    'discount_total', v_order.discount_total,
    'total', v_order.total,
    'pricing', v_pricing,
    'updated_at', v_order.updated_at
  );
end;
$$;

revoke all on function public.marketplace_apply_reseller_discount(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.marketplace_apply_reseller_discount(uuid, uuid, uuid) to service_role;

create or replace function public.mm_reseller_plan_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := statement_timestamp();
begin
  if not public.mm_reseller_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  return jsonb_build_object(
    'ok', true,
    'resellers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'reseller_id', r.id,
        'reseller_name', coalesce(nullif(r.name, ''), nullif(r.company_name, ''), r.email),
        'plan_name', p.name,
        'starts_at', m.starts_at,
        'expires_at', m.expires_at,
        'discount_percent', case
          when r.status = 'active' and r.approved_at is not null
           and m.status = 'active'
           and m.starts_at is not null and m.starts_at <= v_now
           and m.expires_at is not null and m.expires_at > v_now
          then p.profit_percent else 0 end
      ) order by r.created_at desc)
      from public.resellers r
      left join lateral (
        select m0.*
          from public.reseller_memberships m0
         where m0.reseller_id = r.id
           and m0.status in ('active', 'expired', 'renewal_due')
         order by m0.starts_at desc nulls last, m0.activated_at desc nulls last
         limit 1
      ) m on true
      left join public.reseller_membership_plans p on p.id = m.plan_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.mm_reseller_plan_status() from public, anon, authenticated;
grant execute on function public.mm_reseller_plan_status() to authenticated;

NOTIFY pgrst, 'reload schema';
