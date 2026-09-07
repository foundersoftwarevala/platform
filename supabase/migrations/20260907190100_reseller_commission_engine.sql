-- Reseller Manager, part two: how a reseller actually earns.

/* --------------------------------------------------------- rate resolution */

-- The margin for one line, and the evidence for it.
--
-- Most specific wins: a rule for this exact product, then this category, then
-- this reseller, then their plan's own profit_percent. The plan is the floor,
-- which is why no percentage is written into code anywhere — Starter,
-- Professional and Master already carry 20, 30 and 40 in the plans table.
--
-- The snapshot it returns is stored on the commission, so the reason a sale
-- paid what it paid survives any later change to the plan or the rules.
create or replace function public.reseller_rate_for(
  p_reseller uuid, p_product uuid, p_category uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_rule record; v_plan record; v_volume numeric;
begin
  select coalesce(sum(commission_amount),0) into v_volume
    from public.reseller_commissions
   where reseller_id = p_reseller and status <> 'reversed';

  select * into v_rule
    from public.reseller_commission_rules r
   where r.active
     and (r.reseller_id is null or r.reseller_id = p_reseller)
     and (r.product_id is null or r.product_id = p_product)
     and (r.category_id is null or r.category_id = p_category)
     and v_volume >= r.min_volume
   order by
     (case when r.product_id = p_product then 4
           when r.category_id = p_category then 3
           when r.reseller_id = p_reseller then 2
           else 1 end) desc,
     r.priority desc
   limit 1;

  if found then
    return jsonb_build_object(
      'source', 'rule', 'rule_id', v_rule.id,
      'rate_percent', v_rule.rate_percent, 'fixed_amount', v_rule.fixed_amount,
      'currency', v_rule.currency, 'min_volume', v_rule.min_volume,
      'scope', case when v_rule.product_id is not null then 'product'
                    when v_rule.category_id is not null then 'category'
                    when v_rule.reseller_id is not null then 'reseller'
                    else 'house' end);
  end if;

  select p.* into v_plan
    from public.resellers r
    join public.reseller_membership_plans p on p.code = r.plan_code
   where r.id = p_reseller and p.enabled;

  if found then
    return jsonb_build_object(
      'source', 'plan', 'plan_code', v_plan.code, 'plan_name', v_plan.name,
      'rate_percent', v_plan.profit_percent, 'fixed_amount', 0, 'currency', 'USD');
  end if;

  -- No rule and no plan means no basis for paying anything. Saying so is the
  -- honest answer; inventing a default rate would not be.
  return jsonb_build_object('source', 'none', 'rate_percent', null,
    'reason', 'This reseller has no commission rule and no plan, so no margin can be resolved.');
end;
$$;

/* ------------------------------------------------ commissions from a sale */

-- Record a reseller's margin on every line of a paid order.
--
-- Idempotent twice over: the idempotency key is derived from the order line and
-- the reseller, and order_item_id is unique on the table. A repeated webhook,
-- a re-run settlement or a duplicated trigger therefore changes nothing.
create or replace function public.reseller_commissions_for_order(p_order uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_att record; v_item record; v_rate jsonb; v_amount numeric;
  v_created integer := 0; v_skipped integer := 0; v_reseller_user uuid;
  v_buyer uuid; v_notes text[] := '{}';
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

  -- Self-referral. Recorded and refused rather than quietly paid: a reseller
  -- buying through their own link is the commonest abuse in section 23.
  if v_reseller_user is not null and v_reseller_user = v_buyer then
    perform public.mm_audit('reseller.self_referral_blocked', 'marketplace_order',
      p_order::text, null,
      jsonb_build_object('reseller_id', v_att.reseller_id, 'buyer_id', v_buyer),
      'The buyer owns the referring reseller account.');
    return jsonb_build_object('ok', false, 'created', 0, 'reason', 'self_referral');
  end if;

  -- A reseller who is not active does not earn.
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

    v_amount := round(
      coalesce(v_item.line_total,0) * (v_rate->>'rate_percent')::numeric / 100
      + coalesce((v_rate->>'fixed_amount')::numeric, 0), 2);

    insert into public.reseller_commissions
      (reseller_id, order_id, order_item_id, attribution_id,
       gross_amount, commission_amount, currency, status, rule_snapshot,
       idempotency_key)
    values (v_att.reseller_id, p_order, v_item.id, v_att.id,
            coalesce(v_item.line_total,0), v_amount,
            coalesce(v_item.currency,'USD'), 'pending', v_rate,
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

-- Fires when an order becomes paid, alongside the licence trigger that is
-- already there. Separate from it on purpose: a failure in one must not stop
-- the other.
create or replace function public.reseller_on_order_paid()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'paid' and coalesce(old.status,'') <> 'paid' then
    begin
      perform public.reseller_commissions_for_order(new.id);
    exception when others then
      -- Never block a payment being recorded. The failure is logged so it can
      -- be settled by hand rather than disappearing.
      perform public.mm_audit('reseller.commission_failed', 'marketplace_order',
        new.id::text, null, jsonb_build_object('error', sqlerrm), null);
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists reseller_commission_on_paid on public.marketplace_orders;
create trigger reseller_commission_on_paid
  after update on public.marketplace_orders
  for each row execute function public.reseller_on_order_paid();

/* -------------------------------------------------------------- refunds */

-- A refund takes the margin back. The commission is reversed, never deleted,
-- so the history of what happened stays readable.
create or replace function public.reseller_commissions_reverse(
  p_order uuid, p_reason text default 'refund')
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_n integer; v_paid integer;
begin
  select count(*) into v_paid from public.reseller_commissions
   where order_id = p_order and status = 'paid';

  update public.reseller_commissions
     set status = 'reversed', updated_at = now()
   where order_id = p_order and status in ('pending','available');
  get diagnostics v_n = row_count;

  if v_n > 0 or v_paid > 0 then
    perform public.mm_audit('reseller.commission_reversed', 'marketplace_order',
      p_order::text, null,
      jsonb_build_object('reversed', v_n, 'already_paid', v_paid), p_reason);
  end if;

  -- Commission already paid out cannot be clawed back automatically. It is
  -- reported so a person can decide, rather than silently adjusting a ledger.
  return jsonb_build_object('ok', true, 'reversed', v_n, 'already_paid', v_paid,
    'note', case when v_paid > 0
      then 'Some of this commission has already been paid out and needs a manual adjustment.'
      else null end);
end;
$$;
