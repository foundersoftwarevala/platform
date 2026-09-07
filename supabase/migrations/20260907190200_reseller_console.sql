-- Reseller Manager, part three: the console's own calls.

create or replace function public.mm_reseller_operator()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.reseller_is_finance() or public.mm_is_operator();
$$;

/* ------------------------------------------------------------- registry */

create or replace function public.mm_resellers(p_query jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_search text := nullif(btrim(coalesce(p_query->>'search','')), '');
  v_status text := nullif(p_query->>'status','');
  v_plan   text := nullif(p_query->>'plan','');
  v_limit  integer := least(greatest(coalesce((p_query->>'limit')::int, 100), 1), 500);
begin
  if not public.mm_reseller_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  return jsonb_build_object(
    'ok', true,

    'total',      (select count(*) from public.resellers),
    'active',     (select count(*) from public.resellers where status='active'),
    'pending',    (select count(*) from public.resellers where status='pending'),
    'suspended',  (select count(*) from public.resellers
                    where status in ('suspended','paused','rejected','terminated')),
    'unplanned',  (select count(*) from public.resellers where plan_code is null),

    -- Tracking, through the canonical referral tables rather than a second set.
    'referral_codes', (select count(*) from public.marketplace_referral_codes
                        where reseller_id is not null),
    'clicks',     (select count(*) from public.marketplace_referral_sessions
                    where reseller_id is not null),
    'conversions',(select count(*) from public.marketplace_order_attributions
                    where reseller_id is not null),

    'sales',      (select count(*) from public.reseller_commissions where status <> 'reversed'),
    'revenue',    (select coalesce(sum(gross_amount),0) from public.reseller_commissions
                    where status <> 'reversed'),
    'commission_total', (select coalesce(sum(commission_amount),0)
                           from public.reseller_commissions where status <> 'reversed'),
    'commission_pending', (select coalesce(sum(commission_amount),0)
                             from public.reseller_commissions where status = 'pending'),
    'commission_available', (select coalesce(sum(commission_amount),0)
                               from public.reseller_commissions
                              where status = 'available' and payout_id is null),
    'commission_paid', (select coalesce(sum(commission_amount),0)
                          from public.reseller_commissions where status = 'paid'),
    'commission_reversed', (select coalesce(sum(commission_amount),0)
                              from public.reseller_commissions where status = 'reversed'),

    'payouts_total',   (select coalesce(sum(amount),0) from public.reseller_payouts),
    'payouts_paid',    (select coalesce(sum(amount),0) from public.reseller_payouts
                         where status='paid'),
    'payouts_pending', (select coalesce(sum(amount),0) from public.reseller_payouts
                         where status in ('pending','approved','processing')),

    'plans', coalesce((
      select jsonb_agg(jsonb_build_object(
               'code', p.code, 'name', p.name, 'price_usd', p.price_usd,
               'profit_percent', p.profit_percent, 'validity_days', p.validity_days,
               'enabled', p.enabled,
               'resellers', (select count(*) from public.resellers r where r.plan_code = p.code),
               'memberships', (select count(*) from public.reseller_memberships m
                                where m.plan_code = p.code))
             order by p.sort_order)
        from public.reseller_membership_plans p), '[]'::jsonb),

    -- Said plainly rather than shown as a zero that would look like an answer.
    'unavailable', jsonb_build_object(
      'plan_revenue', 'No reseller has bought a plan yet: reseller_memberships and '
                      'reseller_membership_orders are both empty, so there is no plan revenue to report.',
      'finance_tables', 'finance_commissions and finance_payouts are not used here. They hold '
                        'eighty identical rows for one invented partner and seventy payouts to a '
                        'single name that matches no reseller — seeded demo data, deliberately not '
                        'presented as reseller earnings.'),

    'resellers', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'name', r.name, 'code', r.code, 'email', r.email,
               'phone', r.phone, 'region', r.region, 'tier', r.tier,
               'status', r.status, 'kyc_status', r.kyc_status,
               'company_name', r.company_name, 'plan_code', r.plan_code,
               'user_id', r.user_id,
               'created_at', r.created_at, 'last_active_at', r.last_active_at,
               'plan', (select jsonb_build_object('name', p.name, 'profit_percent', p.profit_percent)
                          from public.reseller_membership_plans p where p.code = r.plan_code),
               'referral_codes', (select coalesce(jsonb_agg(c.code), '[]'::jsonb)
                                    from public.marketplace_referral_codes c
                                   where c.reseller_id = r.id and c.active),
               'clicks', (select count(*) from public.marketplace_referral_sessions s
                           where s.reseller_id = r.id),
               'conversions', (select count(*) from public.marketplace_order_attributions a
                                where a.reseller_id = r.id),
               'sales', (select count(*) from public.reseller_commissions c2
                          where c2.reseller_id = r.id and c2.status <> 'reversed'),
               'revenue', (select coalesce(sum(c2.gross_amount),0) from public.reseller_commissions c2
                            where c2.reseller_id = r.id and c2.status <> 'reversed'),
               'commission', (select coalesce(sum(c2.commission_amount),0)
                                from public.reseller_commissions c2
                               where c2.reseller_id = r.id and c2.status <> 'reversed'),
               'available', (select coalesce(sum(c2.commission_amount),0)
                               from public.reseller_commissions c2
                              where c2.reseller_id = r.id and c2.status = 'available'
                                and c2.payout_id is null),
               'paid_out', (select coalesce(sum(o.amount),0) from public.reseller_payouts o
                             where o.reseller_id = r.id and o.status = 'paid'))
             order by r.created_at desc)
        from (select * from public.resellers r2
               where (v_status is null or r2.status = v_status)
                 and (v_plan is null or r2.plan_code = v_plan)
                 and (v_search is null
                      or r2.name ilike '%'||v_search||'%'
                      or r2.email ilike '%'||v_search||'%'
                      or r2.code ilike '%'||v_search||'%'
                      or coalesce(r2.company_name,'') ilike '%'||v_search||'%'
                      or coalesce(r2.region,'') ilike '%'||v_search||'%')
               order by r2.created_at desc limit v_limit) r), '[]'::jsonb));
end;
$$;

/* -------------------------------------------------------------- profile */

create or replace function public.mm_reseller_detail(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_r jsonb;
begin
  if not public.mm_reseller_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  select to_jsonb(r) into v_r from public.resellers r where r.id = p_id;
  if v_r is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_reseller');
  end if;

  return jsonb_build_object(
    'ok', true,
    'reseller', v_r,
    'plan', (select to_jsonb(p) from public.reseller_membership_plans p
              where p.code = (v_r->>'plan_code')),
    'schedule', coalesce(
      (select to_jsonb(s) from public.reseller_payout_schedules s where s.reseller_id = p_id),
      jsonb_build_object('reseller_id', p_id, 'cadence','monthly', 'holding_days',14,
                         'minimum_amount',50, 'currency','USD', 'requires_approval',true,
                         'defaulted',true)),

    'codes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'code', c.code, 'active', c.active,
               'url', 'https://softwarevala.net/?ref=' || c.code,
               'clicks', (select count(*) from public.marketplace_referral_sessions s
                           where s.referral_code_id = c.id),
               'conversions', (select count(*) from public.marketplace_order_attributions a
                                where a.referral_code_id = c.id))
             order by c.created_at desc)
        from public.marketplace_referral_codes c where c.reseller_id = p_id), '[]'::jsonb),

    'commissions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'order_id', c.order_id, 'gross', c.gross_amount,
               'commission', c.commission_amount, 'currency', c.currency,
               'status', c.status, 'payout_id', c.payout_id,
               'created_at', c.created_at,
               -- The reason this line paid what it paid, kept from the moment
               -- of the sale.
               'rate', c.rule_snapshot)
             order by c.created_at desc)
        from public.reseller_commissions c where c.reseller_id = p_id), '[]'::jsonb),

    'payouts', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', o.id, 'amount', o.amount, 'currency', o.currency,
               'status', o.status, 'method', o.payment_method,
               'provider_reference', o.provider_reference,
               'failure_reason', o.failure_reason,
               'requested_at', o.requested_at, 'approved_at', o.approved_at,
               'processed_at', o.processed_at, 'completed_at', o.completed_at,
               'lines', (select count(*) from public.reseller_commissions c
                          where c.payout_id = o.id))
             order by o.requested_at desc)
        from public.reseller_payouts o where o.reseller_id = p_id), '[]'::jsonb),

    'rules', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.priority desc)
        from public.reseller_commission_rules x where x.reseller_id = p_id), '[]'::jsonb),

    'ledger', coalesce((
      select jsonb_agg(to_jsonb(l) order by l.created_at desc)
        from public.marketplace_ledger_entries l where l.reseller_id = p_id), '[]'::jsonb),

    'memberships', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.created_at desc)
        from public.reseller_memberships m where m.reseller_id = p_id), '[]'::jsonb),

    'audit', coalesce((
      select jsonb_agg(jsonb_build_object(
               'action', a.action, 'at', a.created_at, 'actor', a.actor_id,
               'reason', a.reason, 'before', a.before_state, 'after', a.after_state)
             order by a.created_at desc)
        from public.marketplace_audit_logs a
       where a.entity_id = p_id and a.created_at > now() - interval '180 days'), '[]'::jsonb));
end;
$$;

/* ------------------------------------------------------ decisions & plan */

create or replace function public.mm_reseller_status(
  p_id uuid, p_to text, p_reason text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_before jsonb; v_after jsonb; v_user uuid;
begin
  if not public.mm_reseller_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if p_to not in ('pending','active','paused','suspended','rejected','terminated') then
    return jsonb_build_object('ok', false, 'reason', 'unknown_status');
  end if;

  select to_jsonb(r), r.user_id into v_before, v_user
    from public.resellers r where r.id = p_id;
  if v_before is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_reseller');
  end if;

  if p_to in ('suspended','rejected','terminated')
     and coalesce(btrim(p_reason),'') = '' then
    return jsonb_build_object('ok', false, 'reason', 'reason_required',
      'message', 'Say why. This stops the reseller earning and is recorded permanently.');
  end if;

  update public.resellers
     set status = p_to,
         approved_at = case when p_to='active' then coalesce(approved_at, now()) else approved_at end,
         approved_by = case when p_to='active' then coalesce(approved_by, auth.uid()) else approved_by end,
         updated_at = now()
   where id = p_id returning to_jsonb(resellers) into v_after;

  -- Their referral links stop attributing when they are not active, so a
  -- suspended reseller cannot keep earning from traffic already in flight.
  if p_to in ('paused','suspended','rejected','terminated') then
    update public.marketplace_referral_codes
       set active = false, updated_at = now()
     where reseller_id = p_id and active;
  elsif p_to = 'active' then
    update public.marketplace_referral_codes
       set active = true, updated_at = now()
     where reseller_id = p_id and not active;
  end if;

  perform public.mm_audit('reseller.' || p_to, 'reseller', p_id::text,
                          v_before, v_after, p_reason);

  if v_user is not null then
    perform public.mm_notify('reseller.' || p_to,
      case p_to when 'active' then 'Your reseller account is approved'
                when 'rejected' then 'Your reseller application was not accepted'
                when 'suspended' then 'Your reseller account is suspended'
                when 'paused' then 'Your reseller account is paused'
                when 'terminated' then 'Your reseller account is closed'
                else 'Your reseller account status changed' end,
      coalesce(p_reason,''), v_user, null, '/reseller-manager', 'Open', 5,
      case p_to when 'active' then 'success'
                when 'rejected' then 'warning'
                when 'paused' then 'warning' else 'danger' end);
  end if;

  return jsonb_build_object('ok', true, 'reseller', v_after);
end;
$$;

create or replace function public.mm_reseller_plan(
  p_id uuid, p_plan text, p_reason text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_before jsonb; v_after jsonb;
begin
  if not public.mm_reseller_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if p_plan is not null and not exists (
    select 1 from public.reseller_membership_plans where code = p_plan and enabled) then
    return jsonb_build_object('ok', false, 'reason', 'unknown_plan',
      'message', 'That is not an enabled reseller plan.');
  end if;

  select to_jsonb(r) into v_before from public.resellers r where r.id = p_id;
  if v_before is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_reseller');
  end if;

  update public.resellers set plan_code = p_plan, updated_at = now()
   where id = p_id returning to_jsonb(resellers) into v_after;

  perform public.mm_audit('reseller.plan', 'reseller', p_id::text,
                          v_before, v_after, p_reason);
  return jsonb_build_object('ok', true, 'reseller', v_after,
    'note', 'This sets the margin for future sales. Commission already earned keeps '
            'the rate recorded on it at the time.');
end;
$$;

/* -------------------------------------------------------- referral codes */

create or replace function public.mm_reseller_code_create(
  p_id uuid, p_code text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp, extensions
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_name text; v_status text; v_code text; v_bytes bytea; i integer; v_row jsonb;
begin
  if not public.mm_reseller_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select name, status into v_name, v_status from public.resellers where id = p_id;
  if v_name is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_reseller');
  end if;
  if v_status <> 'active' then
    return jsonb_build_object('ok', false, 'reason', 'not_active',
      'message', 'Only an active reseller can be given a working referral link.');
  end if;

  if p_code is not null and btrim(p_code) <> '' then
    v_code := upper(regexp_replace(btrim(p_code), '[^A-Za-z0-9-]', '', 'g'));
    if length(v_code) < 3 then
      return jsonb_build_object('ok', false, 'reason', 'code_too_short');
    end if;
    if exists (select 1 from public.marketplace_referral_codes where upper(code) = v_code) then
      return jsonb_build_object('ok', false, 'reason', 'code_taken',
        'message', 'Another referral code already uses that word.');
    end if;
  else
    for attempt in 1..10 loop
      v_code := '';
      v_bytes := gen_random_bytes(8);
      for i in 0..7 loop
        v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % length(v_alphabet)) + 1, 1);
      end loop;
      exit when not exists (
        select 1 from public.marketplace_referral_codes where upper(code) = v_code);
      v_code := null;
    end loop;
    if v_code is null then
      return jsonb_build_object('ok', false, 'reason', 'could_not_generate');
    end if;
  end if;

  insert into public.marketplace_referral_codes (reseller_id, code, active)
  values (p_id, v_code, true)
  returning to_jsonb(marketplace_referral_codes) into v_row;

  perform public.mm_audit('reseller.code_created', 'reseller', p_id::text, null,
                          jsonb_build_object('code', v_code), null);

  return jsonb_build_object('ok', true, 'code', v_code, 'row', v_row,
    'share_url', 'https://softwarevala.net/?ref=' || v_code);
end;
$$;
