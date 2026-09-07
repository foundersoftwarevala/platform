-- Reseller Manager, part four: payout terms, the holding period and payment.
--
-- The shape follows the seller payout lifecycle already proven in this project.
-- That is reuse of a design, not duplication of a source of truth: a reseller
-- is a different party from a seller, earns a margin rather than a revenue
-- split, and section 32 requires the two ledgers stay separate so nobody is
-- paid twice for one event.

create or replace function public.mm_reseller_schedule_set(p_patch jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid := (p_patch->>'reseller_id')::uuid; v_before jsonb; v_after jsonb;
begin
  if not public.mm_reseller_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if v_id is null or not exists (select 1 from public.resellers where id = v_id) then
    return jsonb_build_object('ok', false, 'reason', 'unknown_reseller');
  end if;

  select to_jsonb(x) into v_before
    from public.reseller_payout_schedules x where x.reseller_id = v_id;

  insert into public.reseller_payout_schedules as s
    (reseller_id, cadence, holding_days, minimum_amount, currency,
     requires_approval, payment_method)
  values (v_id,
          coalesce(p_patch->>'cadence','monthly'),
          coalesce((p_patch->>'holding_days')::int, 14),
          coalesce((p_patch->>'minimum_amount')::numeric, 50),
          upper(coalesce(p_patch->>'currency','USD')),
          coalesce((p_patch->>'requires_approval')::boolean, true),
          nullif(p_patch->>'payment_method',''))
  on conflict (reseller_id) do update set
    cadence = coalesce(excluded.cadence, s.cadence),
    holding_days = coalesce(excluded.holding_days, s.holding_days),
    minimum_amount = coalesce(excluded.minimum_amount, s.minimum_amount),
    currency = coalesce(excluded.currency, s.currency),
    requires_approval = coalesce(excluded.requires_approval, s.requires_approval),
    payment_method = coalesce(excluded.payment_method, s.payment_method),
    updated_at = now()
  returning to_jsonb(s) into v_after;

  perform public.mm_audit('reseller.payout_schedule', 'reseller', v_id::text,
                          v_before, v_after, null);
  return jsonb_build_object('ok', true, 'schedule', v_after);
end;
$$;

/* ------------------------------------------------------- holding period */

create or replace function public.mm_reseller_earnings_release(p_id uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_n integer;
begin
  if not public.mm_reseller_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  with due as (
    select c.id from public.reseller_commissions c
      left join public.reseller_payout_schedules s on s.reseller_id = c.reseller_id
     where c.status = 'pending'
       and (p_id is null or c.reseller_id = p_id)
       and c.created_at <= now() - (coalesce(s.holding_days,14) || ' days')::interval
       -- A line whose order was refunded never becomes payable, which is the
       -- whole reason the holding period exists.
       and not exists (select 1 from public.marketplace_orders o
                        where o.id = c.order_id and o.status in ('refunded','cancelled'))
  )
  update public.reseller_commissions c set status='available', updated_at=now()
    from due where c.id = due.id;
  get diagnostics v_n = row_count;

  if v_n > 0 then
    perform public.mm_audit('reseller.earnings_released', 'reseller',
                            coalesce(p_id::text,'all'), null,
                            jsonb_build_object('released', v_n), null);
  end if;
  return jsonb_build_object('ok', true, 'released', v_n);
end;
$$;

/* ------------------------------------------------------------- payouts */

create or replace function public.mm_reseller_payout_create(
  p_id uuid, p_reason text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_ids uuid[]; v_amount numeric; v_min numeric; v_currency text; v_method text;
  v_key text; v_attempt integer; v_payout jsonb; v_user uuid;
begin
  if not public.mm_reseller_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select r.user_id into v_user from public.resellers r where r.id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_reseller');
  end if;

  select coalesce(s.minimum_amount,50), coalesce(s.currency,'USD'), s.payment_method
    into v_min, v_currency, v_method
    from public.resellers r
    left join public.reseller_payout_schedules s on s.reseller_id = r.id
   where r.id = p_id;

  select array_agg(c.id order by c.id), coalesce(sum(c.commission_amount),0)
    into v_ids, v_amount
    from public.reseller_commissions c
   where c.reseller_id = p_id and c.status = 'available' and c.payout_id is null;

  if v_ids is null or array_length(v_ids,1) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'nothing_available',
      'message', 'This reseller has no released commission waiting. Release the holding period first.');
  end if;
  if v_amount < v_min then
    return jsonb_build_object('ok', false, 'reason', 'below_minimum',
      'message', format('Available %s is under the %s minimum for this reseller.',
                        round(v_amount,2), round(v_min,2)),
      'available', v_amount, 'minimum', v_min);
  end if;

  -- The attempt count is part of the key so that a failed transfer can be
  -- retried, while re-running the same request still collides and refuses.
  select count(*) into v_attempt from public.reseller_payouts
   where reseller_id = p_id and status in ('failed','cancelled','reversed');

  v_key := 'reseller_payout:' || p_id::text || ':'
           || md5(array_to_string(v_ids, ',')) || ':' || v_attempt::text;

  if exists (select 1 from public.reseller_payouts where idempotency_key = v_key) then
    return jsonb_build_object('ok', false, 'reason', 'already_created',
      'message', 'A payout for exactly this commission already exists.');
  end if;

  insert into public.reseller_payouts
    (reseller_id, amount, currency, status, payment_method, idempotency_key)
  values (p_id, v_amount, v_currency, 'pending', v_method, v_key)
  returning to_jsonb(reseller_payouts) into v_payout;

  update public.reseller_commissions
     set payout_id = (v_payout->>'id')::uuid, updated_at = now()
   where id = any(v_ids);

  perform public.mm_audit('reseller.payout_requested', 'reseller_payout',
                          (v_payout->>'id'), null,
                          v_payout || jsonb_build_object('lines', array_length(v_ids,1)),
                          p_reason);

  if v_user is not null then
    perform public.mm_notify('reseller.payout_requested', 'A payout has been prepared',
      format('%s %s covering %s sale(s) is awaiting approval.',
             round(v_amount,2), v_currency, array_length(v_ids,1)),
      v_user, null, '/reseller-manager', 'View', 60, 'info');
  end if;

  return jsonb_build_object('ok', true, 'payout', v_payout,
                            'lines', array_length(v_ids,1));
end;
$$;

create or replace function public.mm_reseller_payout_status(
  p_payout uuid, p_to text, p_reference text default null, p_reason text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_before jsonb; v_after jsonb; v_reseller uuid; v_user uuid; v_allowed boolean;
begin
  if not public.mm_reseller_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if p_to not in ('pending','approved','processing','paid','failed','reversed','cancelled') then
    return jsonb_build_object('ok', false, 'reason', 'unknown_status');
  end if;

  select to_jsonb(o), o.reseller_id into v_before, v_reseller
    from public.reseller_payouts o where o.id = p_payout;
  if v_before is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_payout');
  end if;

  -- Reversing a paid payout is a real event, so it is allowed; reopening one to
  -- any other state is not, because the commission would be payable twice.
  if (v_before->>'status') = 'paid' and p_to <> 'reversed' then
    return jsonb_build_object('ok', false, 'reason', 'already_paid',
      'message', 'This payout is settled. It can only be reversed, not reopened.');
  end if;

  v_allowed := case (v_before->>'status')
    when 'pending'    then p_to in ('approved','cancelled','failed')
    when 'approved'   then p_to in ('processing','cancelled','failed')
    when 'processing' then p_to in ('paid','failed')
    when 'failed'     then p_to in ('pending','cancelled')
    when 'cancelled'  then p_to in ('pending')
    when 'paid'       then p_to = 'reversed'
    else false end;
  if not v_allowed then
    return jsonb_build_object('ok', false, 'reason', 'invalid_transition',
      'message', format('A %s payout cannot become %s.', v_before->>'status', p_to));
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

  update public.reseller_payouts
     set status = p_to,
         provider_reference = coalesce(nullif(btrim(p_reference),''), provider_reference),
         failure_reason = case when p_to in ('failed','reversed') then p_reason
                               else failure_reason end,
         approved_at   = case when p_to='approved'   then now() else approved_at end,
         processed_at  = case when p_to='processing' then now() else processed_at end,
         completed_at  = case when p_to='paid'       then now() else completed_at end,
         updated_at = now()
   where id = p_payout returning to_jsonb(reseller_payouts) into v_after;

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
    -- Money that went out and came back. The lines return to available and the
    -- ledger carries the counter-entry rather than the original being edited.
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
$$;
