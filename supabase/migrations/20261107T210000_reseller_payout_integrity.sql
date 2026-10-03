-- Reseller money paths: one commission is paid once, and only once.
--
-- H2  mm_reseller_payout_status let a failed or cancelled payout be reopened
--     to pending. Failing/cancelling already released its commission lines
--     back to the queue, so the reopened payout carried its full amount with
--     no lines: it could still be marked paid (writing a ledger payout), and
--     the released lines were then paid again in the next payout. A failed or
--     cancelled payout is now final; the retry is a new payout, which
--     mm_reseller_payout_create already supports (its idempotency key counts
--     failed attempts). Paid is also refused unless the payout's lines add up
--     to its amount.
-- H3  Neither function locked anything, and the status update did not check
--     the status it had read: two concurrent "paid" calls each wrote a ledger
--     payout, and two concurrent creates could take the same lines. The payout
--     row (status) and the reseller row (create) are now locked, the status
--     update only moves from the status it read, lines are attached only while
--     still unattached, and the ledger holds one entry per payout and kind.
-- D2  reseller_commission_rules has a plan_code column that reseller_rate_for
--     never compared, so a rule written for one plan applied to every
--     reseller. A plan-scoped rule now applies only to resellers on that plan.
-- D3  A paid order could be set to cancelled (the Manager's Orders wall did
--     it): the money taken, the licence active, the commission standing. A
--     paid order ends by refund. Only an unpaid order can be cancelled.

begin;

-- ---------------------------------------------------------------- D3
create or replace function public.marketplace_order_status_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if new.status = 'pending_payment' and old.status <> 'cancelled' then
    raise exception 'order % cannot go back from % to pending_payment', old.id, old.status
      using errcode = 'check_violation';
  end if;
  if old.status = 'refunded'
     or (old.status = 'cancelled' and new.status <> 'pending_payment') then
    raise exception 'order % is %; it can only be reinstated to pending_payment', old.id, old.status
      using errcode = 'check_violation';
  end if;
  if new.status = 'paid' and old.status not in ('pending_payment', 'disputed') then
    raise exception 'order % cannot become paid from %', old.id, old.status
      using errcode = 'check_violation';
  end if;
  if new.status = 'cancelled' and old.status <> 'pending_payment' then
    raise exception 'order % is %; a paid order is ended by a refund, not cancelled', old.id, old.status
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------- D2
create or replace function public.reseller_rate_for(p_reseller uuid, p_product uuid, p_category uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_rule record; v_plan record; v_volume numeric; v_plan_code text;
begin
  select coalesce(sum(commission_amount),0) into v_volume
    from public.reseller_commissions
   where reseller_id = p_reseller and status <> 'reversed';
  select r.plan_code into v_plan_code from public.resellers r where r.id = p_reseller;
  select * into v_rule
    from public.reseller_commission_rules r
   where r.active
     and (r.reseller_id is null or r.reseller_id = p_reseller)
     and (r.product_id is null or r.product_id = p_product)
     and (r.category_id is null or r.category_id = p_category)
     -- A rule written for a plan applies only to resellers on that plan.
     and (r.plan_code is null or r.plan_code = v_plan_code)
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
                    when v_rule.plan_code is not null then 'plan'
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
$function$;

-- ---------------------------------------------------------------- H3: create
do $$
declare def text; changed text;
begin
  def := pg_get_functiondef('public.mm_reseller_payout_create(uuid,text)'::regprocedure);
  if position('for update' in def) = 0 then
    -- Serialise payout creation per reseller.
    changed := regexp_replace(def,
      'select r\.user_id into v_user from public\.resellers r where r\.id = p_id;',
      'select r.user_id into v_user from public.resellers r where r.id = p_id for update;');
    -- Attach only lines that are still unattached and available.
    changed := regexp_replace(changed,
      'update public\.reseller_commissions\s+set payout_id = \(v_payout->>''id''\)::uuid, updated_at = now\(\)\s+where id = any\(v_ids\);',
      E'update public.reseller_commissions\n      set payout_id = (v_payout->>''id'')::uuid, updated_at = now()\n    where id = any(v_ids) and payout_id is null and status = ''available'';\n   if not found then\n     raise exception ''the commission lines were taken by another payout'';\n   end if;');
    if changed = def or position('payout_id is null and status' in changed) = 0 then
      raise exception 'mm_reseller_payout_create no longer has the expected shape';
    end if;
    execute changed;
  end if;
end $$;

-- ---------------------------------------------------------------- H2/H3: status
create or replace function public.mm_reseller_payout_status(
  p_payout uuid, p_to text, p_reference text default null, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_before jsonb; v_after jsonb; v_reseller uuid; v_user uuid; v_allowed boolean;
        v_lines numeric;
begin
  if not public.mm_reseller_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if p_to not in ('pending','approved','processing','paid','failed','reversed','cancelled') then
    return jsonb_build_object('ok', false, 'reason', 'unknown_status');
  end if;
  -- Locked, so two operators acting on one payout act one after the other.
  select to_jsonb(o), o.reseller_id into v_before, v_reseller
    from public.reseller_payouts o where o.id = p_payout for update;
  if v_before is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_payout');
  end if;
  if (v_before->>'status') = 'paid' and p_to <> 'reversed' then
    return jsonb_build_object('ok', false, 'reason', 'already_paid',
      'message', 'This payout is settled. It can only be reversed, not reopened.');
  end if;
  -- Failed and cancelled are final: failing or cancelling released the
  -- commission lines back to the queue, so reopening the payout would pay
  -- them twice. A retry is a new payout over the released lines.
  v_allowed := case (v_before->>'status')
    when 'pending'    then p_to in ('approved','cancelled','failed')
    when 'approved'   then p_to in ('processing','cancelled','failed')
    when 'processing' then p_to in ('paid','failed')
    when 'paid'       then p_to = 'reversed'
    else false end;
  if not v_allowed then
    return jsonb_build_object('ok', false, 'reason', 'invalid_transition',
      'message', case when (v_before->>'status') in ('failed','cancelled')
                   then format('A %s payout is closed. Create a new payout for the released commission.', v_before->>'status')
                   else format('A %s payout cannot become %s.', v_before->>'status', p_to) end);
  end if;
  -- Nothing is recorded as paid on somebody's say-so.
  if p_to = 'paid' and coalesce(btrim(p_reference),'') = '' then
    return jsonb_build_object('ok', false, 'reason', 'reference_required',
      'message', 'A payout is only paid once the provider has paid it. Enter the '
                 'bank or provider transaction reference.');
  end if;
  if p_to in ('failed','reversed') and coalesce(btrim(p_reason),'') = '' then
    return jsonb_build_object('ok', false, 'reason', 'reason_required',
      'message', 'Record why this payout failed or was reversed.');
  end if;
  -- The money sent must be the money owed on the lines it carries.
  if p_to = 'paid' then
    select coalesce(sum(c.commission_amount), 0) into v_lines
      from public.reseller_commissions c where c.payout_id = p_payout;
    if round(v_lines, 2) <> round((v_before->>'amount')::numeric, 2) then
      return jsonb_build_object('ok', false, 'reason', 'lines_mismatch',
        'message', format('This payout is for %s but its commission lines add up to %s.',
                          v_before->>'amount', round(v_lines, 2)));
    end if;
  end if;
  update public.reseller_payouts
     set status = p_to,
         provider_reference = coalesce(nullif(btrim(p_reference),''), provider_reference),
         failure_reason = case when p_to in ('failed','reversed') then p_reason
                               else failure_reason end,
         approved_at   = case when p_to='approved'   then now() else approved_at end,
         processed_at  = case when p_to='processing' then now() else processed_at end,
         completed_at  = case when p_to='paid'       then now() else completed_at end,
         updated_at = now()
   where id = p_payout and status = v_before->>'status'
   returning to_jsonb(reseller_payouts) into v_after;
  if v_after is null then
    return jsonb_build_object('ok', false, 'reason', 'changed_meanwhile',
      'message', 'This payout changed while you were acting on it. Reload and try again.');
  end if;
  if p_to = 'paid' then
    update public.reseller_commissions
       set status='paid', updated_at=now() where payout_id = p_payout;
    insert into public.marketplace_ledger_entries
      (reseller_id, entry_type, amount, currency, immutable_metadata)
    values (v_reseller, 'payout', (v_after->>'amount')::numeric, v_after->>'currency',
            jsonb_build_object(
              'payout_id', p_payout,
              'idempotency_key', v_after->>'idempotency_key',
              'provider_reference', v_after->>'provider_reference',
              'commission_ids', (select coalesce(jsonb_agg(c.id),'[]'::jsonb)
                                   from public.reseller_commissions c
                                  where c.payout_id = p_payout),
              'settled_at', now(),
              'audit_reference', 'reseller.payout_paid'));
  elsif p_to in ('failed','cancelled') then
    -- The commission goes back in the queue rather than being lost.
    update public.reseller_commissions
       set payout_id = null, updated_at = now() where payout_id = p_payout;
  elsif p_to = 'reversed' then
    update public.reseller_commissions
       set status='available', payout_id=null, updated_at=now() where payout_id = p_payout;
    insert into public.marketplace_ledger_entries
      (reseller_id, entry_type, amount, currency, immutable_metadata)
    values (v_reseller, 'adjustment', -1 * (v_after->>'amount')::numeric,
            v_after->>'currency',
            jsonb_build_object('payout_id', p_payout, 'reason', p_reason,
                               'reverses', v_after->>'idempotency_key',
                               'audit_reference', 'reseller.payout_reversed'));
  end if;
  perform public.mm_audit('reseller.payout_' || p_to, 'reseller_payout',
                          p_payout::text, v_before, v_after, p_reason);
  select user_id into v_user from public.resellers where id = v_reseller;
  if v_user is not null and p_to in ('approved','paid','failed','reversed') then
    perform public.mm_notify('reseller.payout_' || p_to,
      case p_to when 'paid' then 'Your payout has been sent'
                when 'approved' then 'Your payout is approved'
                when 'reversed' then 'A payout has been reversed'
                else 'Your payout could not be sent' end,
      case p_to when 'paid'
        then format('%s %s, reference %s.', round((v_after->>'amount')::numeric,2),
                    v_after->>'currency', coalesce(v_after->>'provider_reference','—'))
        else coalesce(p_reason, 'Your commission is back in the queue.') end,
      v_user, null, '/reseller-manager', 'View', 5,
      case p_to when 'paid' then 'success' when 'approved' then 'info' else 'danger' end);
  end if;
  return jsonb_build_object('ok', true, 'payout', v_after);
end;
$function$;

-- One ledger entry per payout and kind (payout, its reversal adjustment).
create unique index if not exists marketplace_ledger_entries_payout_once
  on public.marketplace_ledger_entries ((immutable_metadata ->> 'payout_id'), entry_type)
  where immutable_metadata ? 'payout_id';

commit;
