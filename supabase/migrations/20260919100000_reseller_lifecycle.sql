-- Reseller lifecycle: application -> approval -> membership -> verification.
--
-- The membership lifecycle existed in the production database (orders,
-- invoices, payment intents, verification, activation) but not in this
-- repository, and the application step had no backend at all: the Apply form
-- kept applications in the browser. This migration records those functions
-- here - the repository is the source of truth - and closes the holes found
-- while testing the flow end to end:
--
--   1. Self-approval. The privilege guard on resellers ran on UPDATE only, so
--      any signed-in account could INSERT its own reseller row already
--      'active' and approved, then buy a membership. It also left plan_code,
--      user_id and code editable by the partner.
--   2. Price manipulation. Resellers could INSERT membership orders and
--      memberships directly, with any amount, instead of through
--      create_reseller_membership_order (which prices from the plan).
--   3. Deleting one's own reseller record (history, commissions) was allowed.
--   4. Verification: a second SUCCESS for the same order activated a second
--      membership; an order with no payment evidence could be marked paid; a
--      finance operator could verify their own order; the Finance Manager
--      role could not verify at all (finance_is_operator was admin/boss).
--   5. The idempotency key of a membership order was looked up across all
--      resellers.
--   6. Approval never gave the account the 'reseller' role, so an approved
--      reseller could not open the reseller dashboard; and an operator could
--      approve their own reseller account.
--
-- Applications have no fee. Membership billing starts only when an approved
-- reseller chooses a plan.

-- ---------------------------------------------------------------- columns
alter table public.resellers
  add column if not exists application jsonb,
  add column if not exists applied_at timestamptz;

-- ---------------------------------------------------------------- roles
create or replace function public.finance_is_operator()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select auth.uid() is not null
     and (public.has_role(auth.uid(), 'admin')
       or public.has_role(auth.uid(), 'boss')
       or public.has_role(auth.uid(), 'finance'));
$function$;

create or replace function public.reseller_owned_by_user(_user_id uuid, _reseller_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (select 1 from public.resellers r where r.id = _reseller_id and r.user_id = _user_id);
$function$;

-- ---------------------------------------------------------------- guard
create or replace function public.guard_partner_privileges()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  actor uuid := auth.uid();
  is_operator boolean;
begin
  if actor is null then return new; end if; -- service role and database jobs
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = actor
      and ur.role::text in ('admin','boss','founder','boss_owner','super_admin','finance')
  ) into is_operator;
  if is_operator then return new; end if;

  if tg_table_name = 'resellers' then
    if tg_op = 'INSERT' then
      -- A partner creates only their own record, and only as an application.
      if new.user_id is distinct from actor then
        raise exception 'A reseller record can only be created for your own account';
      end if;
      new.status := 'pending';
      new.tier := 'bronze';
      new.kyc_status := 'unverified';
      new.approved_at := null;
      new.approved_by := null;
      new.plan_code := null;
      return new;
    end if;
    if new.tier is distinct from old.tier or new.status is distinct from old.status
       or new.approved_at is distinct from old.approved_at or new.approved_by is distinct from old.approved_by
       or new.kyc_status is distinct from old.kyc_status or new.plan_code is distinct from old.plan_code
       or new.user_id is distinct from old.user_id or new.code is distinct from old.code then
      raise exception 'Tier, status, plan and approval are set by the Control Panel, not by the partner';
    end if;
  end if;

  if tg_table_name = 'franchises' and tg_op = 'UPDATE' then
    if new.status is distinct from old.status or new.territory is distinct from old.territory
       or new.territory_id is distinct from old.territory_id or new.commission_rate is distinct from old.commission_rate
       or new.royalty_rate is distinct from old.royalty_rate or new.pricing_variation is distinct from old.pricing_variation then
      raise exception 'Territory, status and commercial terms are set by the Control Panel, not by the franchise';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists guard_reseller_privileges on public.resellers;
create trigger guard_reseller_privileges
  before insert or update on public.resellers
  for each row execute function public.guard_partner_privileges();

-- ---------------------------------------------------------------- policies
drop policy if exists reseller_membership_orders_pending_insert on public.reseller_membership_orders;
drop policy if exists reseller_memberships_pending_insert on public.reseller_memberships;
alter policy resellers_admin on public.resellers
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'boss'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'boss'));
alter policy resellers_delete_own on public.resellers
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'boss'));

-- ---------------------------------------------------------------- application
create or replace function public.submit_reseller_application(p_application jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_existing public.resellers%rowtype;
  v_row public.resellers%rowtype;
  v_number text;
  v_missing text[] := array[]::text[];
  f text;
begin
  if v_user is null then raise exception 'Sign in to apply'; end if;

  -- One application per account: a second submit answers with the first.
  select * into v_existing from public.resellers where user_id = v_user;
  if found then
    return jsonb_build_object('ok', true, 'duplicate', true, 'id', v_existing.id,
      'application_number', v_existing.code, 'status', v_existing.status);
  end if;

  foreach f in array array['fullName','email','phone','country','companyName','businessType'] loop
    if coalesce(btrim(p_application->>f), '') = '' then v_missing := v_missing || f; end if;
  end loop;
  if array_length(v_missing, 1) > 0 then
    raise exception 'Missing required fields: %', array_to_string(v_missing, ', ');
  end if;
  if coalesce((p_application->>'agreementAccepted')::boolean, false) is not true then
    raise exception 'The reseller agreement must be accepted';
  end if;

  loop
    v_number := 'RSA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    exit when not exists (select 1 from public.resellers where code = v_number);
  end loop;

  insert into public.resellers (name, code, email, phone, region, company_name, status, tier,
                                user_id, application, applied_at)
  values (btrim(p_application->>'fullName'), v_number, lower(btrim(p_application->>'email')),
          btrim(p_application->>'phone'), nullif(btrim(p_application->>'country'), ''),
          btrim(p_application->>'companyName'), 'pending', 'bronze',
          v_user, p_application - 'agreementAccepted' || jsonb_build_object('agreement_accepted_at', now()),
          now())
  returning * into v_row;

  return jsonb_build_object('ok', true, 'duplicate', false, 'id', v_row.id,
    'application_number', v_row.code, 'status', v_row.status);
end;
$function$;

revoke all on function public.submit_reseller_application(jsonb) from public, anon;
grant execute on function public.submit_reseller_application(jsonb) to authenticated;

-- ---------------------------------------------------------------- approval
create or replace function public.mm_reseller_status(p_id uuid, p_to text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_before jsonb; v_after jsonb; v_user uuid;
begin
  if not public.mm_reseller_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if p_to not in ('pending','active','paused','suspended','rejected','terminated') then
    return jsonb_build_object('ok', false, 'reason', 'unknown_status');
  end if;

  select to_jsonb(r), r.user_id into v_before, v_user from public.resellers r where r.id = p_id;
  if v_before is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_reseller');
  end if;
  -- Nobody decides on their own reseller account.
  if v_user is not null and v_user = auth.uid() then
    return jsonb_build_object('ok', false, 'reason', 'self_action',
      'message', 'You cannot change the status of your own reseller account.');
  end if;

  if p_to in ('suspended','rejected','terminated') and coalesce(btrim(p_reason),'') = '' then
    return jsonb_build_object('ok', false, 'reason', 'reason_required',
      'message', 'Say why. This stops the reseller earning and is recorded permanently.');
  end if;

  update public.resellers
     set status = p_to,
         approved_at = case when p_to='active' then coalesce(approved_at, now()) else approved_at end,
         approved_by = case when p_to='active' then coalesce(approved_by, auth.uid()) else approved_by end,
         updated_at = now()
   where id = p_id returning to_jsonb(resellers) into v_after;

  -- The account behind the reseller gets (or loses) the reseller role, which
  -- is what opens the reseller dashboard.
  if v_user is not null then
    if p_to = 'active' then
      insert into public.user_roles (user_id, role) values (v_user, 'reseller')
      on conflict do nothing;
    elsif p_to in ('rejected','terminated') then
      delete from public.user_roles where user_id = v_user and role = 'reseller';
    end if;
  end if;

  if p_to in ('paused','suspended','rejected','terminated') then
    update public.marketplace_referral_codes set active = false, updated_at = now()
     where reseller_id = p_id and active;
  elsif p_to = 'active' then
    update public.marketplace_referral_codes set active = true, updated_at = now()
     where reseller_id = p_id and not active;
  end if;

  perform public.mm_audit('reseller.' || p_to, 'reseller', p_id::text, v_before, v_after, p_reason);

  if v_user is not null then
    perform public.mm_notify('reseller.' || p_to,
      case p_to when 'active' then 'Your reseller account is approved'
                when 'rejected' then 'Your reseller application was not accepted'
                when 'suspended' then 'Your reseller account is suspended'
                when 'paused' then 'Your reseller account is paused'
                when 'terminated' then 'Your reseller account is closed'
                else 'Your reseller account status changed' end,
      coalesce(p_reason,''), v_user, null, '/dashboard/reseller', 'Open', 5,
      case p_to when 'active' then 'success'
                when 'rejected' then 'warning'
                when 'paused' then 'warning' else 'danger' end);
  end if;

  return jsonb_build_object('ok', true, 'reseller', v_after);
end;
$function$;

-- ---------------------------------------------------------------- orders
create or replace function public.create_reseller_membership_order(p_plan_code text, p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_reseller public.resellers%rowtype;
  v_plan public.reseller_membership_plans%rowtype;
  v_order public.reseller_membership_orders%rowtype;
  v_invoice public.finance_invoices%rowtype;
  v_intent public.finance_payment_intents%rowtype;
  v_rail public.finance_payment_rails%rowtype;
  v_key text := trim(p_idempotency_key);
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if nullif(v_key, '') is null then raise exception 'Idempotency key required'; end if;
  select * into v_reseller from public.resellers where user_id = v_user and status = 'active' for update;
  if not found then raise exception 'Active reseller account required'; end if;
  -- The price comes from the plan, never from the caller.
  select * into v_plan from public.reseller_membership_plans where code = lower(trim(p_plan_code)) and enabled for share;
  if not found then raise exception 'Invalid membership plan'; end if;
  -- A retried request returns the same order, and only this reseller's.
  select * into v_order from public.reseller_membership_orders
   where idempotency_key = v_key and reseller_id = v_reseller.id;
  if found then
    return jsonb_build_object('order', to_jsonb(v_order),
      'invoice', (select to_jsonb(i) from public.finance_invoices i where i.id = v_order.finance_invoice_id),
      'payment_intent', (select to_jsonb(pi) from public.finance_payment_intents pi where pi.id = v_order.finance_intent_id),
      'duplicate', true);
  end if;
  if exists (select 1 from public.reseller_membership_orders where idempotency_key = v_key) then
    raise exception 'Idempotency key already used';
  end if;
  select * into v_rail from public.finance_payment_rails where code = 'bank_transfer' limit 1;
  if not found then raise exception 'Allowed payment rails are not configured'; end if;
  insert into public.finance_invoices (invoice_no, doc_type, client_name, client_type, subtotal, tax_amount, total, status, auto_generated, issue_date, due_date, line_items)
  values ('RMI-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)), 'reseller_membership', v_reseller.name, 'reseller', v_plan.price_usd, 0, v_plan.price_usd, 'issued', true, current_date, current_date,
          jsonb_build_array(jsonb_build_object('plan_code', v_plan.code, 'description', v_plan.name, 'quantity', 1, 'unit_amount', v_plan.price_usd)))
  returning * into v_invoice;
  insert into public.finance_invoice_items (invoice_id, description, quantity, unit_amount, tax_amount, discount_amount)
  values (v_invoice.id, v_plan.name || ' annual reseller membership', 1, v_plan.price_usd, 0, 0);
  insert into public.reseller_membership_orders (order_number, reseller_id, plan_id, amount_usd, currency, status, idempotency_key, approval_status, finance_invoice_id, payment_status, proof_metadata)
  values ('RMO-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)), v_reseller.id, v_plan.id, v_plan.price_usd, 'USD', 'pending', v_key, 'pending', v_invoice.id, 'pending', '{}'::jsonb)
  returning * into v_order;
  insert into public.finance_payment_intents (invoice_id, rail_id, idempotency_key, amount, currency, status, client_reference)
  values (v_invoice.id, v_rail.id, 'membership-' || v_key, v_plan.price_usd, 'USD', 'pending', v_order.order_number)
  returning * into v_intent;
  update public.reseller_membership_orders set finance_intent_id = v_intent.id where id = v_order.id returning * into v_order;
  insert into public.reseller_membership_events (reseller_id, order_id, event_key, event_type, payload)
  values (v_reseller.id, v_order.id, 'order-created:' || v_order.id::text, 'order.created', jsonb_build_object('plan_code', v_plan.code, 'amount_usd', v_plan.price_usd));
  insert into public.reseller_notifications (title, type, audience, status, body, reseller_id)
  values ('Membership order created', 'order.created', 'reseller', 'sent', 'Your membership invoice is ready for payment.', v_reseller.id);
  return jsonb_build_object('order', to_jsonb(v_order), 'invoice', to_jsonb(v_invoice), 'payment_intent', to_jsonb(v_intent), 'duplicate', false);
end;
$function$;

create or replace function public.submit_reseller_membership_payment(p_order_id uuid, p_rail_code text, p_reference text, p_proof text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_order public.reseller_membership_orders%rowtype;
  v_rail public.finance_payment_rails%rowtype;
  v_intent public.finance_payment_intents%rowtype;
begin
  select o.* into v_order from public.reseller_membership_orders o
    join public.resellers r on r.id = o.reseller_id
   where o.id = p_order_id and r.user_id = v_user for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status not in ('pending','processing') then
    raise exception 'This order is % and cannot take a payment', v_order.status;
  end if;
  select * into v_rail from public.finance_payment_rails where code = lower(trim(p_rail_code)) and enabled;
  if not found then raise exception 'Payment rail is not configured'; end if;
  if nullif(trim(p_reference), '') is null then raise exception 'Payment reference required'; end if;
  select * into v_intent from public.finance_payment_intents where id = v_order.finance_intent_id for update;
  update public.finance_payment_intents set rail_id = v_rail.id, client_reference = trim(p_reference), status = 'pending', updated_at = now()
   where id = v_intent.id returning * into v_intent;
  update public.reseller_membership_orders
     set proof_reference = trim(p_reference), proof_metadata = jsonb_build_object('proof', nullif(trim(p_proof), '')),
         status = 'processing', payment_status = 'pending', updated_at = now()
   where id = v_order.id returning * into v_order;
  insert into public.reseller_membership_events (reseller_id, order_id, event_key, event_type, payload)
  values (v_order.reseller_id, v_order.id, 'payment-submitted:' || v_order.id::text || ':' || md5(trim(p_reference)), 'payment.pending',
          jsonb_build_object('rail', v_rail.code, 'reference', trim(p_reference)))
  on conflict (event_key) do nothing;
  return jsonb_build_object('order', to_jsonb(v_order), 'payment_intent', to_jsonb(v_intent));
end;
$function$;

-- ---------------------------------------------------------------- verification
create or replace function public.verify_reseller_membership_payment(p_order_id uuid, p_status text, p_provider_reference text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_actor uuid := auth.uid();
  v_status text := upper(trim(p_status));
  v_order public.reseller_membership_orders%rowtype;
  v_owner uuid;
  v_membership_id uuid;
begin
  if v_actor is null or not public.finance_is_operator() then raise exception 'Finance authorization required'; end if;
  if v_status not in ('SUCCESS','FAILED','CANCELLED','EXPIRED','REFUNDED') then raise exception 'Invalid payment status'; end if;
  select * into v_order from public.reseller_membership_orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  select r.user_id into v_owner from public.resellers r where r.id = v_order.reseller_id;
  if v_owner = v_actor then raise exception 'You cannot verify a payment for your own reseller account'; end if;

  -- Already verified: the same answer again, never a second activation.
  if v_order.status = 'paid' then
    if v_status = 'SUCCESS' then
      return jsonb_build_object('order', to_jsonb(v_order), 'membership_id', v_order.membership_id, 'duplicate', true);
    end if;
    raise exception 'This order is already paid';
  end if;
  if v_order.status in ('failed','cancelled','expired','refunded') then
    raise exception 'This order is closed (%)', v_order.status;
  end if;
  -- A payment is verified against the evidence the reseller submitted.
  if v_status = 'SUCCESS' and (v_order.status <> 'processing' or nullif(trim(v_order.proof_reference), '') is null) then
    raise exception 'No payment has been submitted for this order';
  end if;

  update public.finance_payment_intents
     set status = lower(v_status), provider_reference = nullif(trim(p_provider_reference), ''), updated_at = now()
   where id = v_order.finance_intent_id;
  update public.reseller_membership_orders
     set status = case when v_status = 'SUCCESS' then 'paid' else lower(v_status) end,
         payment_status = lower(v_status),
         provider_payment_reference = nullif(trim(p_provider_reference), ''),
         approval_status = case when v_status = 'SUCCESS' then 'approved' else approval_status end,
         updated_at = now()
   where id = v_order.id returning * into v_order;
  update public.finance_invoices
     set status = case when v_status = 'SUCCESS' then 'paid' else lower(v_status) end,
         paid_at = case when v_status = 'SUCCESS' then now() else paid_at end
   where id = v_order.finance_invoice_id;

  if v_status = 'SUCCESS' then
    v_membership_id := public.activate_reseller_membership(v_order.id, v_actor);
    insert into public.reseller_membership_events (reseller_id, membership_id, order_id, event_key, event_type, payload)
    values (v_order.reseller_id, v_membership_id, v_order.id, 'payment-success:' || v_order.id::text, 'payment.verified',
            jsonb_build_object('actor', v_actor, 'reference', p_provider_reference))
    on conflict (event_key) do nothing;
  else
    insert into public.reseller_membership_events (reseller_id, order_id, event_key, event_type, payload)
    values (v_order.reseller_id, v_order.id, 'payment-' || lower(v_status) || ':' || v_order.id::text, 'payment.' || lower(v_status),
            jsonb_build_object('actor', v_actor))
    on conflict (event_key) do nothing;
  end if;
  return jsonb_build_object('order', to_jsonb(v_order), 'membership_id', v_membership_id, 'duplicate', false);
end;
$function$;

-- ---------------------------------------------------------------- activation
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
      values (v_membership_id, 'feature', to_jsonb(v_feature), v_start, v_start + make_interval(days => v_plan.validity_days));
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
revoke all on function public.create_reseller_membership_order(text, text) from public, anon;
grant execute on function public.create_reseller_membership_order(text, text) to authenticated;
revoke all on function public.submit_reseller_membership_payment(uuid, text, text, text) from public, anon;
grant execute on function public.submit_reseller_membership_payment(uuid, text, text, text) to authenticated;
revoke all on function public.verify_reseller_membership_payment(uuid, text, text) from public, anon;
grant execute on function public.verify_reseller_membership_payment(uuid, text, text) to authenticated;
