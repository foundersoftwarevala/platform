-- Author / Vendor Manager, part two: the decisions and the money.

/* ------------------------------------------------------ verification flow */

-- Approve, reject, suspend or reactivate a seller.
--
-- The table's own constraint allows pending, approved, rejected, suspended and
-- deactivated. The brief's vocabulary maps onto it — verified and active are
-- both 'approved', terminated is 'deactivated' — and the constraint is left
-- alone rather than widened to carry two names for one state.
create or replace function public.mm_seller_status(
  p_id uuid, p_to text, p_reason text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_before jsonb; v_after jsonb; v_owner uuid;
begin
  if not public.mm_seller_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if p_to not in ('pending','approved','rejected','suspended','deactivated') then
    return jsonb_build_object('ok', false, 'reason', 'unknown_status');
  end if;

  select to_jsonb(s), s.owner_user_id into v_before, v_owner
    from public.marketplace_sellers s where s.id = p_id;
  if v_before is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_seller');
  end if;

  -- A rejection or suspension needs a stated reason. This is a decision that
  -- stops someone earning, and the audit trail should say why.
  if p_to in ('rejected','suspended','deactivated')
     and coalesce(btrim(p_reason),'') = '' then
    return jsonb_build_object('ok', false, 'reason', 'reason_required',
      'message', 'Say why. This decision stops the seller earning and is recorded.');
  end if;

  update public.marketplace_sellers
     set status = p_to,
         approved_at = case when p_to = 'approved' then coalesce(approved_at, now())
                            else approved_at end,
         approved_by = case when p_to = 'approved' then coalesce(approved_by, auth.uid())
                            else approved_by end,
         updated_at = now()
   where id = p_id
  returning to_jsonb(marketplace_sellers) into v_after;

  -- A seller who is no longer approved should not keep their products on the
  -- storefront. Their rows are hidden, never deleted, so reinstating them is
  -- one status change away.
  if p_to in ('rejected','suspended','deactivated') then
    update public.marketplace_products
       set visible = false, updated_at = now()
     where seller_id = p_id and visible;
  end if;

  perform public.mm_audit('seller.' || p_to, 'marketplace_seller', p_id::text,
                          v_before, v_after, p_reason);

  if v_owner is not null then
    perform public.mm_notify(
      'seller.' || p_to,
      case p_to
        when 'approved' then 'Your seller account is approved'
        when 'rejected' then 'Your seller application was not accepted'
        when 'suspended' then 'Your seller account is suspended'
        when 'deactivated' then 'Your seller account is closed'
        else 'Your seller account status changed' end,
      coalesce(p_reason, ''),
      v_owner, null, '/vendor-manager', 'Open', 5,
      case p_to when 'approved' then 'success'
                when 'rejected' then 'warning'
                when 'suspended' then 'danger'
                when 'deactivated' then 'danger' else 'info' end);
  end if;

  return jsonb_build_object('ok', true, 'seller', v_after);
end;
$$;

-- Say whether a seller is an author or a vendor.
create or replace function public.mm_seller_kind(p_id uuid, p_kind text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_before jsonb; v_after jsonb;
begin
  if not public.mm_seller_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if p_kind is not null and p_kind not in ('author','vendor') then
    return jsonb_build_object('ok', false, 'reason', 'unknown_kind');
  end if;

  select to_jsonb(s) into v_before from public.marketplace_sellers s where s.id = p_id;
  if v_before is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_seller');
  end if;

  update public.marketplace_sellers set seller_kind = p_kind, updated_at = now()
   where id = p_id returning to_jsonb(marketplace_sellers) into v_after;

  perform public.mm_audit('seller.kind', 'marketplace_seller', p_id::text,
                          v_before, v_after, null);
  return jsonb_build_object('ok', true, 'seller', v_after);
end;
$$;

/* ------------------------------------------------------ commission tiers */

-- Set a seller's commission rate, in the rules table the engine already reads.
--
-- No rate is written into code anywhere here: the rule carries the number, and
-- src/lib/commerce/commission.ts resolves the most specific active rule at the
-- moment a sale settles. A rule change therefore affects future sales only,
-- and the rate that applied to a past sale stays frozen in that commission's
-- rule_snapshot.
create or replace function public.mm_seller_commission_set(
  p_seller uuid, p_rate numeric, p_fixed numeric default 0,
  p_currency text default 'USD', p_reason text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_before jsonb; v_after jsonb;
begin
  if not public.mm_seller_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if p_rate is null or p_rate < 0 or p_rate > 100 then
    return jsonb_build_object('ok', false, 'reason', 'rate_out_of_range',
      'message', 'The marketplace share must be between 0 and 100 percent.');
  end if;
  if not exists (select 1 from public.marketplace_sellers where id = p_seller) then
    return jsonb_build_object('ok', false, 'reason', 'unknown_seller');
  end if;

  select to_jsonb(r) into v_before
    from public.marketplace_commission_rules r
   where r.seller_id = p_seller and r.product_id is null and r.category_id is null
   order by r.priority desc limit 1;

  if v_before is null then
    insert into public.marketplace_commission_rules
      (seller_id, rate_percent, fixed_amount, currency, active, priority)
    values (p_seller, p_rate, coalesce(p_fixed,0), upper(p_currency), true, 10)
    returning to_jsonb(marketplace_commission_rules) into v_after;
  else
    update public.marketplace_commission_rules
       set rate_percent = p_rate, fixed_amount = coalesce(p_fixed,0),
           currency = upper(p_currency), active = true
     where id = (v_before->>'id')::uuid
    returning to_jsonb(marketplace_commission_rules) into v_after;
  end if;

  perform public.mm_audit('seller.commission_rate', 'marketplace_seller',
                          p_seller::text, v_before, v_after, p_reason);
  return jsonb_build_object('ok', true, 'rule', v_after);
end;
$$;

create or replace function public.mm_seller_schedule_set(p_patch jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_seller uuid := (p_patch->>'seller_id')::uuid; v_before jsonb; v_after jsonb;
begin
  if not public.mm_seller_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if v_seller is null or not exists (select 1 from public.marketplace_sellers where id = v_seller) then
    return jsonb_build_object('ok', false, 'reason', 'unknown_seller');
  end if;

  select to_jsonb(x) into v_before
    from public.marketplace_payout_schedules x where x.seller_id = v_seller;

  insert into public.marketplace_payout_schedules as s
    (seller_id, cadence, holding_days, minimum_amount, currency,
     requires_approval, payment_method, active)
  values (
    v_seller,
    coalesce(p_patch->>'cadence','monthly'),
    coalesce((p_patch->>'holding_days')::int, 14),
    coalesce((p_patch->>'minimum_amount')::numeric, 50),
    upper(coalesce(p_patch->>'currency','USD')),
    coalesce((p_patch->>'requires_approval')::boolean, true),
    nullif(p_patch->>'payment_method',''),
    coalesce((p_patch->>'active')::boolean, true))
  on conflict (seller_id) do update set
    cadence = coalesce(excluded.cadence, s.cadence),
    holding_days = coalesce(excluded.holding_days, s.holding_days),
    minimum_amount = coalesce(excluded.minimum_amount, s.minimum_amount),
    currency = coalesce(excluded.currency, s.currency),
    requires_approval = coalesce(excluded.requires_approval, s.requires_approval),
    payment_method = coalesce(excluded.payment_method, s.payment_method),
    active = coalesce(excluded.active, s.active),
    updated_at = now()
  returning to_jsonb(s) into v_after;

  perform public.mm_audit('seller.payout_schedule', 'marketplace_seller',
                          v_seller::text, v_before, v_after, null);
  return jsonb_build_object('ok', true, 'schedule', v_after);
end;
$$;

/* ------------------------------------------------------- holding period */

-- Move commissions past their holding period from pending to available.
--
-- This is the step section 6 calls "Earnings → Holding Period → Eligible", and
-- nothing performed it before: every commission in this database has sat at
-- 'pending' since it was written, so nothing was ever payable.
--
-- The clock runs from when the commission was recorded, which is the moment the
-- order was paid. A reversed commission never becomes available, which is what
-- the holding period is for.
create or replace function public.mm_seller_earnings_release(p_seller uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_released integer;
begin
  if not public.mm_seller_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  with due as (
    select c.id
      from public.marketplace_commissions c
      left join public.marketplace_payout_schedules s on s.seller_id = c.seller_id
     where c.status = 'pending'
       and c.seller_id is not null
       and (p_seller is null or c.seller_id = p_seller)
       and c.created_at <= now() - (coalesce(s.holding_days, 14) || ' days')::interval
       -- A line whose order was later refunded is not eligible, even if the
       -- reversal has not yet flipped this row.
       and not exists (select 1 from public.marketplace_commission_reversals r
                        where r.commission_id = c.id)
  )
  update public.marketplace_commissions c
     set status = 'available'
    from due where c.id = due.id;
  get diagnostics v_released = row_count;

  if v_released > 0 then
    perform public.mm_audit('seller.earnings_released', 'marketplace_seller',
                            coalesce(p_seller::text, 'all'), null,
                            jsonb_build_object('released', v_released), null);
  end if;

  return jsonb_build_object('ok', true, 'released', v_released);
end;
$$;

/* ------------------------------------------------------------- payouts */

-- Create a payout for everything a seller currently has available.
--
-- Idempotent by construction: the key is a digest of the exact set of
-- commission lines being settled, so running this twice for the same lines
-- collides on the unique key and refuses instead of paying twice. The lines are
-- claimed by the payout but stay 'available' until money actually moves.
create or replace function public.mm_seller_payout_create(
  p_seller uuid, p_reason text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_ids uuid[]; v_amount numeric; v_currency text; v_min numeric;
  v_key text; v_payout jsonb; v_owner uuid;
begin
  if not public.mm_seller_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select s.owner_user_id, s.payout_currency into v_owner, v_currency
    from public.marketplace_sellers s where s.id = p_seller;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_seller');
  end if;

  select coalesce(sch.minimum_amount, 50) into v_min
    from public.marketplace_sellers s
    left join public.marketplace_payout_schedules sch on sch.seller_id = s.id
   where s.id = p_seller;

  select array_agg(c.id order by c.id), coalesce(sum(c.seller_amount),0)
    into v_ids, v_amount
    from public.marketplace_commissions c
   where c.seller_id = p_seller and c.status = 'available' and c.payout_id is null;

  if v_ids is null or array_length(v_ids,1) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'nothing_available',
      'message', 'This seller has no released earnings waiting. Release the holding period first.');
  end if;
  if v_amount < v_min then
    return jsonb_build_object('ok', false, 'reason', 'below_minimum',
      'message', format('Available %s is under the %s minimum for this seller.',
                        round(v_amount,2), round(v_min,2)),
      'available', v_amount, 'minimum', v_min);
  end if;

  v_key := 'payout:' || p_seller::text || ':' || md5(array_to_string(v_ids, ','));

  if exists (select 1 from public.marketplace_payouts where idempotency_key = v_key) then
    return jsonb_build_object('ok', false, 'reason', 'already_created',
      'message', 'A payout for exactly these earnings already exists.');
  end if;

  insert into public.marketplace_payouts
    (seller_id, amount, currency, status, idempotency_key)
  values (p_seller, v_amount, coalesce(v_currency,'USD'), 'pending', v_key)
  returning to_jsonb(marketplace_payouts) into v_payout;

  -- Claim the lines so a second payout cannot pay them again. They are not
  -- marked paid: nothing is paid until the provider says so.
  update public.marketplace_commissions
     set payout_id = (v_payout->>'id')::uuid
   where id = any(v_ids);

  perform public.mm_audit('seller.payout_created', 'marketplace_payout',
                          (v_payout->>'id'), null,
                          v_payout || jsonb_build_object('lines', array_length(v_ids,1)),
                          p_reason);

  if v_owner is not null then
    perform public.mm_notify('payout.created', 'A payout has been prepared',
      format('%s %s covering %s sale(s) is awaiting approval.',
             round(v_amount,2), coalesce(v_currency,'USD'), array_length(v_ids,1)),
      v_owner, null, '/vendor-manager', 'View', 60, 'info');
  end if;

  return jsonb_build_object('ok', true, 'payout', v_payout,
                            'lines', array_length(v_ids,1));
end;
$$;

-- Move a payout along its lifecycle.
--
-- The one rule that matters: a payout can only be completed with a reference
-- from whoever actually sent the money. Section 21 says payment status must
-- come from the provider, and without a reference there is nothing to check a
-- claim of payment against.
create or replace function public.mm_seller_payout_status(
  p_id uuid, p_to text, p_reference text default null, p_reason text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_before jsonb; v_after jsonb; v_owner uuid; v_seller uuid; v_allowed boolean;
begin
  if not public.mm_seller_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if p_to not in ('pending','approved','processing','completed','failed','cancelled') then
    return jsonb_build_object('ok', false, 'reason', 'unknown_status');
  end if;

  select to_jsonb(o), o.seller_id into v_before, v_seller
    from public.marketplace_payouts o where o.id = p_id;
  if v_before is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_payout');
  end if;

  -- A settled payout is final. Reopening one would let the same earnings be
  -- paid a second time.
  if (v_before->>'status') = 'completed' then
    return jsonb_build_object('ok', false, 'reason', 'already_completed',
      'message', 'This payout is already settled and cannot be changed.');
  end if;

  v_allowed := case (v_before->>'status')
    when 'pending'    then p_to in ('approved','cancelled','failed')
    when 'approved'   then p_to in ('processing','cancelled','failed')
    when 'processing' then p_to in ('completed','failed')
    when 'failed'     then p_to in ('pending','cancelled')
    when 'cancelled'  then p_to in ('pending')
    else false end;
  if not v_allowed then
    return jsonb_build_object('ok', false, 'reason', 'invalid_transition',
      'message', format('A %s payout cannot become %s.', v_before->>'status', p_to));
  end if;

  if p_to = 'completed' and coalesce(btrim(p_reference),'') = '' then
    return jsonb_build_object('ok', false, 'reason', 'reference_required',
      'message', 'A payout is only paid once the provider has paid it. Enter the '
                 'bank or provider reference for the transfer.');
  end if;

  update public.marketplace_payouts
     set status = p_to,
         provider_reference = coalesce(nullif(btrim(p_reference),''), provider_reference),
         updated_at = now()
   where id = p_id returning to_jsonb(marketplace_payouts) into v_after;

  if p_to = 'completed' then
    -- Now, and only now, the earnings are paid.
    update public.marketplace_commissions set status = 'paid' where payout_id = p_id;

    -- And the ledger records the money leaving. This is the auditable entry
    -- section 35 asks for, carrying its own idempotency key and reference.
    insert into public.marketplace_ledger_entries
      (seller_id, entry_type, amount, currency, immutable_metadata)
    values (v_seller, 'payout', (v_after->>'amount')::numeric,
            v_after->>'currency',
            jsonb_build_object(
              'payout_id', p_id,
              'idempotency_key', v_after->>'idempotency_key',
              'provider_reference', v_after->>'provider_reference',
              'settled_at', now(),
              'lines', (select count(*) from public.marketplace_commissions
                         where payout_id = p_id),
              'audit_reference', 'seller.payout_completed'));

  elsif p_to in ('failed','cancelled') then
    -- Release the lines so they can be paid on the next run. Nothing is lost.
    update public.marketplace_commissions set payout_id = null where payout_id = p_id;
  end if;

  perform public.mm_audit('seller.payout_' || p_to, 'marketplace_payout',
                          p_id::text, v_before, v_after, p_reason);

  select owner_user_id into v_owner from public.marketplace_sellers where id = v_seller;
  if v_owner is not null and p_to in ('completed','failed') then
    perform public.mm_notify(
      'payout.' || p_to,
      case p_to when 'completed' then 'Your payout has been sent'
                else 'Your payout could not be sent' end,
      case p_to when 'completed'
        then format('%s %s, reference %s.', round((v_after->>'amount')::numeric,2),
                    v_after->>'currency', coalesce(v_after->>'provider_reference','—'))
        else coalesce(p_reason, 'The transfer failed. Your earnings are back in the queue.') end,
      v_owner, null, '/vendor-manager', 'View', 5,
      case p_to when 'completed' then 'success' else 'danger' end);
  end if;

  return jsonb_build_object('ok', true, 'payout', v_after);
end;
$$;
