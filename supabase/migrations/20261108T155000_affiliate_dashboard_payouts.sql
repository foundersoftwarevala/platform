-- The affiliate application, referral, commission, and payout records already
-- live in the platform's canonical partner tables. This migration adds the
-- affiliate's bounded dashboard read and an atomic request against approved
-- commission rows; it deliberately creates no parallel ledger.

create index if not exists affiliate_partner_commissions_dashboard_idx
  on public.partner_commissions (partner_id, currency, status, earned_at desc)
  where partner_kind = 'affiliate';

create index if not exists affiliate_partner_payouts_dashboard_idx
  on public.partner_payouts (partner_id, currency, requested_at desc)
  where partner_kind = 'affiliate';

create or replace function public.affiliate_dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_partner public.marketplace_affiliate_partners%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in to view affiliate data';
  end if;

  select * into v_partner
    from public.marketplace_affiliate_partners
   where user_id = auth.uid()
   limit 1;

  if not found then
    raise exception 'Affiliate account not found';
  end if;

  return jsonb_build_object(
    'partner', jsonb_build_object(
      'id', v_partner.id,
      'display_name', v_partner.display_name,
      'status', v_partner.status,
      'created_at', v_partner.created_at
    ),
    'attributionWindowDays', 60,
    'links', coalesce((
      select jsonb_agg(to_jsonb(link_data) order by link_data.created_at desc)
        from (
          select c.id, c.code, c.active, c.created_at,
                 count(s.id)::integer as visitors,
                 coalesce(sum(
                   case
                     when coalesce(s.metadata ->> 'clicks', '') ~ '^[0-9]+$'
                       then (s.metadata ->> 'clicks')::integer
                     else 1
                   end
                 ), 0)::integer as clicks,
                 count(s.id) filter (where s.converted_order_id is not null)::integer as conversions
            from public.marketplace_referral_codes c
            left join public.marketplace_referral_sessions s
              on s.referral_code_id = c.id
           where c.affiliate_partner_id = v_partner.id
           group by c.id
           order by c.created_at desc
           limit 200
        ) link_data
    ), '[]'::jsonb),
    'earnings', coalesce((
      select jsonb_agg(to_jsonb(currency_data) order by currency_data.currency)
        from (
          select c.currency,
                 coalesce(sum(c.commission_amount) filter (where c.status in ('pending','approved','paid')), 0) as earned,
                 coalesce(sum(c.commission_amount) filter (where c.status = 'pending'), 0) as pending,
                 coalesce(sum(c.commission_amount) filter (
                   where c.status = 'approved' and c.payout_id is null
                 ), 0) as available,
                 coalesce(sum(c.commission_amount) filter (where c.status = 'paid'), 0) as paid
            from public.partner_commissions c
           where c.partner_kind = 'affiliate' and c.partner_id = v_partner.id
           group by c.currency
        ) currency_data
    ), '[]'::jsonb),
    'commissions', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.earned_at desc)
        from (
          select id, order_id, gross_amount, commission_amount, currency, status, earned_at
            from public.partner_commissions
           where partner_kind = 'affiliate' and partner_id = v_partner.id
           order by earned_at desc
           limit 100
        ) c
    ), '[]'::jsonb),
    'payouts', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.requested_at desc)
        from (
          select id, amount, currency, status, requested_at, completed_at
            from public.partner_payouts
           where partner_kind = 'affiliate' and partner_id = v_partner.id
           order by requested_at desc
           limit 100
        ) p
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.affiliate_dashboard_summary() from public, anon;
grant execute on function public.affiliate_dashboard_summary() to authenticated;

create or replace function public.request_affiliate_payout(
  p_amount numeric,
  p_currency text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_partner public.marketplace_affiliate_partners%rowtype;
  v_available numeric(20,4);
  v_currency text := upper(btrim(coalesce(p_currency, '')));
  v_payout public.partner_payouts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in to request a payout';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 4) then
    raise exception 'Enter a positive payout amount with at most four decimal places';
  end if;
  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'A valid payout currency is required';
  end if;

  select * into v_partner
    from public.marketplace_affiliate_partners
   where user_id = auth.uid()
   for update;

  if not found or v_partner.status <> 'approved' then
    raise exception 'Only an approved affiliate can request a payout';
  end if;

  select coalesce(sum(commission_amount), 0)
    into v_available
    from public.partner_commissions
   where partner_kind = 'affiliate'
     and partner_id = v_partner.id
     and currency = v_currency
     and status = 'approved'
     and payout_id is null;

  if v_available <= 0 then
    raise exception 'There are no approved commissions available in %', v_currency;
  end if;
  if p_amount <> v_available then
    raise exception 'Request the full available balance of % %', v_currency, v_available;
  end if;

  insert into public.partner_payouts (
    partner_kind, partner_id, amount, currency, status, idempotency_key
  ) values (
    'affiliate', v_partner.id, v_available, v_currency, 'requested',
    'affiliate-payout:' || v_partner.id::text || ':' || gen_random_uuid()::text
  )
  returning * into v_payout;

  update public.partner_commissions
     set payout_id = v_payout.id
   where partner_kind = 'affiliate'
     and partner_id = v_partner.id
     and currency = v_currency
     and status = 'approved'
     and payout_id is null;

  return jsonb_build_object(
    'id', v_payout.id,
    'amount', v_payout.amount,
    'currency', v_payout.currency,
    'status', v_payout.status,
    'requested_at', v_payout.requested_at
  );
end;
$$;

revoke all on function public.request_affiliate_payout(numeric, text) from public, anon;
grant execute on function public.request_affiliate_payout(numeric, text) to authenticated;

-- Affiliate payout requests must pass through the owner-checked RPC above.
-- Keep the established partner self-service insert rule for other partner types.
drop policy if exists "a partner may request a payout" on public.partner_payouts;
create policy "a partner may request a non-affiliate payout"
  on public.partner_payouts
  for insert to authenticated
  with check (
    partner_kind <> 'affiliate'
    and status = 'requested'
    and public.owns_partner(partner_kind, partner_id)
  );

create or replace function public.settle_affiliate_payout_commissions()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.partner_kind <> 'affiliate' or new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'completed' then
    update public.partner_commissions
       set status = 'paid'
     where partner_kind = 'affiliate'
       and partner_id = new.partner_id
       and payout_id = new.id
       and status = 'approved';
  elsif new.status in ('failed', 'cancelled') then
    update public.partner_commissions
       set payout_id = null
     where partner_kind = 'affiliate'
       and partner_id = new.partner_id
       and payout_id = new.id
       and status = 'approved';
  end if;

  return new;
end;
$$;

revoke all on function public.settle_affiliate_payout_commissions() from public, anon, authenticated;
drop trigger if exists settle_affiliate_payout_commissions on public.partner_payouts;
create trigger settle_affiliate_payout_commissions
  after update of status on public.partner_payouts
  for each row execute function public.settle_affiliate_payout_commissions();

notify pgrst, 'reload schema';
