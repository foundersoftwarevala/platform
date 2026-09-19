-- Membership activation: one entitlement row per feature.
--
-- reseller_membership_entitlements is unique on (membership_id, feature_key),
-- and activation wrote every plan feature under the same key 'feature', so a
-- plan with more than one feature failed to activate. Each feature now has its
-- own key ('feature:<text>'), and a repeated feature is written once.

create or replace function public.activate_reseller_membership(p_order_id uuid, p_actor uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order public.reseller_membership_orders%rowtype;
  v_plan public.reseller_membership_plans%rowtype;
  v_membership_id uuid;
  v_start timestamptz := now();
  v_feature text;
begin
  select * into v_order from public.reseller_membership_orders where id = p_order_id for update;
  if not found then raise exception 'membership order not found'; end if;
  if v_order.payment_status <> 'success' or v_order.status <> 'paid' then raise exception 'payment is not verified'; end if;
  if v_order.approval_status <> 'approved' then raise exception 'membership approval is required'; end if;
  if v_order.membership_id is not null then return v_order.membership_id; end if;
  select * into v_plan from public.reseller_membership_plans where id = v_order.plan_id and enabled = true;
  if not found then raise exception 'membership plan not found'; end if;

  update public.reseller_memberships
     set status = 'expired', membership_state = 'expired',
         expires_at = least(coalesce(expires_at, v_start), v_start), updated_at = v_start
   where reseller_id = v_order.reseller_id and status in ('active','renewal_due');

  insert into public.reseller_memberships (reseller_id, plan_id, plan_code, status, membership_state, starts_at, expires_at,
                                           activated_at, entitlements_snapshot, provider_payment_reference, order_id, finance_intent_id)
  values (v_order.reseller_id, v_plan.id, v_plan.code, 'active', 'active', v_start, v_start + make_interval(days => v_plan.validity_days),
          v_start, v_plan.features, v_order.provider_payment_reference, v_order.id, v_order.finance_intent_id)
  returning id into v_membership_id;

  -- What the membership entitles the reseller to, row by row.
  insert into public.reseller_membership_entitlements (membership_id, feature_key, feature_value, starts_at, expires_at)
  values (v_membership_id, 'profit_percent', to_jsonb(v_plan.profit_percent), v_start, v_start + make_interval(days => v_plan.validity_days));
  if jsonb_typeof(v_plan.features) = 'array' then
    for v_feature in select jsonb_array_elements_text(v_plan.features) loop
      insert into public.reseller_membership_entitlements (membership_id, feature_key, feature_value, starts_at, expires_at)
      values (v_membership_id, 'feature:' || v_feature, to_jsonb(v_feature), v_start, v_start + make_interval(days => v_plan.validity_days))
      on conflict (membership_id, feature_key) do nothing;
    end loop;
  end if;

  update public.resellers set plan_code = v_plan.code, updated_at = v_start where id = v_order.reseller_id;
  update public.reseller_membership_orders set membership_id = v_membership_id, updated_at = v_start where id = p_order_id;
  insert into public.reseller_membership_events (reseller_id, membership_id, order_id, event_key, event_type, payload)
  values (v_order.reseller_id, v_membership_id, p_order_id, 'membership-activated:' || p_order_id::text, 'membership.activated',
          jsonb_build_object('actor', p_actor, 'plan_code', v_plan.code))
  on conflict (event_key) do nothing;
  insert into public.reseller_notifications (reseller_id, title, type, audience, status, body)
  values (v_order.reseller_id, 'Membership activated', 'membership.activated', 'reseller', 'sent', 'Your ' || v_plan.name || ' membership is active.');
  return v_membership_id;
end;
$function$;

revoke all on function public.activate_reseller_membership(uuid, uuid) from public, anon, authenticated;
