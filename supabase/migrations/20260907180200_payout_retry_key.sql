-- The idempotency key needs to stop an accidental double-creation without
-- stopping a legitimate retry.
--
-- Keying purely on the set of commission lines did the first and broke the
-- second: when a transfer failed, its lines were released correctly, but the
-- next attempt hashed to the same key and was refused forever, leaving the
-- seller unpayable. The attempt number is now part of the key, counted from
-- how many payouts for this seller have already failed or been cancelled.
-- Re-running the same request still collides; retrying after a failure does not.
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
  v_key text; v_payout jsonb; v_owner uuid; v_attempt integer;
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

  select count(*) into v_attempt from public.marketplace_payouts
   where seller_id = p_seller and status in ('failed','cancelled');

  v_key := 'payout:' || p_seller::text || ':' || md5(array_to_string(v_ids, ','))
           || ':' || v_attempt::text;

  if exists (select 1 from public.marketplace_payouts where idempotency_key = v_key) then
    return jsonb_build_object('ok', false, 'reason', 'already_created',
      'message', 'A payout for exactly these earnings already exists.');
  end if;

  insert into public.marketplace_payouts
    (seller_id, amount, currency, status, idempotency_key)
  values (p_seller, v_amount, coalesce(v_currency,'USD'), 'pending', v_key)
  returning to_jsonb(marketplace_payouts) into v_payout;

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
