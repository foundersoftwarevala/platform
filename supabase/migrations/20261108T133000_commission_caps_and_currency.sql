-- Keep reseller and influencer commissions within the paid line amount and
-- reject commission rules denominated in a different currency than the sale.

create or replace function public.reseller_commissions_for_order(p_order uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_att record; v_item record; v_rate jsonb; v_amount numeric; v_gross numeric;
  v_created integer := 0; v_skipped integer := 0; v_reseller_user uuid;
  v_buyer uuid; v_notes text[] := '{}';
  v_line_currency text; v_rule_currency text;
begin
  select a.*, r.user_id as reseller_user
    into v_att
    from public.marketplace_order_attributions a
    join public.resellers r on r.id = a.reseller_id
   where a.order_id = p_order and a.reseller_id is not null
   limit 1;

  if not found then
    return jsonb_build_object('ok', true, 'created', 0,
      'reason', 'no reseller attribution on this order');
  end if;

  select buyer_id into v_buyer from public.marketplace_orders where id = p_order;
  v_reseller_user := v_att.reseller_user;

  if v_reseller_user is not null and v_reseller_user = v_buyer then
    perform public.mm_audit('reseller.self_referral_blocked', 'marketplace_order',
      p_order::text, null,
      jsonb_build_object('reseller_id', v_att.reseller_id, 'buyer_id', v_buyer),
      'The buyer owns the referring reseller account.');
    return jsonb_build_object('ok', false, 'created', 0, 'reason', 'self_referral');
  end if;

  if not exists (select 1 from public.resellers
                  where id = v_att.reseller_id and status = 'active') then
    return jsonb_build_object('ok', false, 'created', 0, 'reason', 'reseller_not_active');
  end if;

  for v_item in
    select i.id, i.product_id, i.line_total, i.currency, p.category_id
      from public.marketplace_order_items i
      left join public.marketplace_products p on p.id = i.product_id
     where i.order_id = p_order
  loop
    if exists (select 1 from public.reseller_commissions
                where order_item_id = v_item.id) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_rate := public.reseller_rate_for(v_att.reseller_id, v_item.product_id, v_item.category_id);
    if (v_rate->>'rate_percent') is null then
      v_skipped := v_skipped + 1;
      v_notes := v_notes || (v_rate->>'reason');
      continue;
    end if;

    v_line_currency := upper(nullif(btrim(v_item.currency), ''));
    v_rule_currency := upper(nullif(btrim(v_rate->>'currency'), ''));
    if v_line_currency is null or v_rule_currency is null
       or v_line_currency <> v_rule_currency then
      v_skipped := v_skipped + 1;
      v_notes := v_notes || format(
        'currency_mismatch: reseller rule %s, order line %s',
        coalesce(v_rule_currency, 'missing'), coalesce(v_line_currency, 'missing'));
      continue;
    end if;

    v_gross := greatest(coalesce(v_item.line_total, 0), 0);
    v_amount := greatest(0, least(v_gross, round(
      v_gross * (v_rate->>'rate_percent')::numeric / 100
      + coalesce((v_rate->>'fixed_amount')::numeric, 0), 2)));

    insert into public.reseller_commissions
      (reseller_id, order_id, order_item_id, attribution_id,
       gross_amount, commission_amount, currency, status, rule_snapshot,
       idempotency_key)
    values (v_att.reseller_id, p_order, v_item.id, v_att.id,
            v_gross, v_amount, v_line_currency, 'pending', v_rate,
            'reseller_commission:' || v_item.id::text || ':' || v_att.reseller_id::text)
    on conflict do nothing;

    if found then v_created := v_created + 1; else v_skipped := v_skipped + 1; end if;
  end loop;

  if v_created > 0 then
    perform public.mm_audit('reseller.commission_recorded', 'reseller',
      v_att.reseller_id::text, null,
      jsonb_build_object('order_id', p_order, 'lines', v_created), null);

    if v_reseller_user is not null then
      perform public.mm_notify('reseller.commission',
        'You earned commission on a sale',
        format('%s line(s) from a new order have been credited to you, and enter the holding period now.', v_created),
        v_reseller_user, null, '/reseller-manager', 'View', 5, 'success');
    end if;
  end if;

  return jsonb_build_object('ok', true, 'created', v_created, 'skipped', v_skipped,
    'reseller_id', v_att.reseller_id,
    'notes', to_jsonb(v_notes));
end;
$$;

create or replace function public.influencer_commissions_for_order(p_order uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_att record; v_item record; v_rate jsonb; v_amount numeric; v_gross numeric;
  v_created integer := 0; v_skipped integer := 0;
  v_user uuid; v_buyer uuid; v_notes text[] := '{}';
  v_key text; v_line_currency text; v_rule_currency text;
begin
  select a.*, p.user_id as influencer_user, p.status as influencer_status
    into v_att
    from public.marketplace_order_attributions a
    join public.influencer_profiles p on p.id = a.influencer_profile_id
   where a.order_id = p_order and a.influencer_profile_id is not null
   limit 1;

  if not found then
    return jsonb_build_object('ok', true, 'created', 0,
      'reason', 'no influencer attribution on this order');
  end if;

  select buyer_id into v_buyer from public.marketplace_orders where id = p_order;
  v_user := v_att.influencer_user;

  if v_user is not null and v_user = v_buyer then
    perform public.mm_audit('influencer.self_referral_blocked', 'marketplace_order',
      p_order::text, null,
      jsonb_build_object('influencer_profile_id', v_att.influencer_profile_id, 'buyer_id', v_buyer),
      'The buyer owns the referring influencer account.');
    return jsonb_build_object('ok', false, 'created', 0, 'reason', 'self_referral');
  end if;

  if v_att.influencer_status <> 'active' then
    return jsonb_build_object('ok', false, 'created', 0, 'reason', 'influencer_not_active');
  end if;

  for v_item in
    select i.id, i.product_id, i.line_total, i.currency, pr.category_id
      from public.marketplace_order_items i
      left join public.marketplace_products pr on pr.id = i.product_id
     where i.order_id = p_order
  loop
    v_key := 'influencer_commission:' || v_item.id::text || ':' || v_att.influencer_profile_id::text;

    if exists (select 1 from public.partner_commissions
                where partner_kind = 'influencer'
                  and partner_id = v_att.influencer_profile_id
                  and idempotency_key = v_key) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_rate := public.influencer_rate_for(
      v_item.product_id, v_item.category_id, v_att.influencer_profile_id);
    if (v_rate->>'rate_percent') is null then
      v_skipped := v_skipped + 1;
      v_notes := v_notes || (v_rate->>'reason');
      continue;
    end if;

    v_line_currency := upper(nullif(btrim(v_item.currency), ''));
    v_rule_currency := upper(nullif(btrim(v_rate->>'currency'), ''));
    if v_line_currency is null or v_rule_currency is null
       or v_line_currency <> v_rule_currency then
      v_skipped := v_skipped + 1;
      v_notes := v_notes || format(
        'currency_mismatch: influencer rule %s, order line %s',
        coalesce(v_rule_currency, 'missing'), coalesce(v_line_currency, 'missing'));
      continue;
    end if;

    v_gross := greatest(coalesce(v_item.line_total, 0), 0);
    v_amount := greatest(0, least(v_gross, round(
      v_gross * (v_rate->>'rate_percent')::numeric / 100
      + coalesce((v_rate->>'fixed_amount')::numeric, 0), 2)));

    insert into public.partner_commissions
      (partner_kind, partner_id, order_id, order_item_id, attribution_id,
       gross_amount, commission_amount, currency, rule_snapshot, status, idempotency_key)
    values ('influencer', v_att.influencer_profile_id, p_order, v_item.id, v_att.id,
            v_gross, v_amount, v_line_currency, v_rate, 'pending', v_key)
    on conflict do nothing;

    if found then v_created := v_created + 1; else v_skipped := v_skipped + 1; end if;
  end loop;

  if v_created > 0 then
    perform public.mm_audit('influencer.commission_recorded', 'influencer',
      v_att.influencer_profile_id::text, null,
      jsonb_build_object('order_id', p_order, 'lines', v_created), null);

    if v_user is not null then
      perform public.mm_notify('influencer.commission',
        'You earned commission on a sale',
        format('%s line(s) from a new order have been credited to you, and enter the holding period now.', v_created),
        v_user, null, '/dashboard/influencer', 'View', 5, 'success');
    end if;
  end if;

  return jsonb_build_object('ok', true, 'created', v_created, 'skipped', v_skipped,
    'influencer_profile_id', v_att.influencer_profile_id,
    'notes', to_jsonb(v_notes));
end;
$$;

revoke all on function public.reseller_commissions_for_order(uuid) from public;
grant execute on function public.reseller_commissions_for_order(uuid) to service_role;
revoke all on function public.influencer_commissions_for_order(uuid) from public;
grant execute on function public.influencer_commissions_for_order(uuid) to service_role;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.reseller_commissions'::regclass
       and conname = 'reseller_commissions_not_over_gross'
  ) then
    alter table public.reseller_commissions
      add constraint reseller_commissions_not_over_gross
      check (commission_amount <= gross_amount) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.partner_commissions'::regclass
       and conname = 'partner_commissions_influencer_not_over_gross'
  ) then
    alter table public.partner_commissions
      add constraint partner_commissions_influencer_not_over_gross
      check (partner_kind <> 'influencer' or commission_amount <= gross_amount) not valid;
  end if;
end;
$$;

-- Validation intentionally fails rather than rewriting historical ledger
-- amounts if either table already contains an over-gross commission.
alter table public.reseller_commissions
  validate constraint reseller_commissions_not_over_gross;
alter table public.partner_commissions
  validate constraint partner_commissions_influencer_not_over_gross;

comment on constraint reseller_commissions_not_over_gross on public.reseller_commissions is
  'Commission amount cannot exceed the gross sale amount.';
comment on constraint partner_commissions_influencer_not_over_gross on public.partner_commissions is
  'Influencer commission amount cannot exceed the gross sale amount.';
