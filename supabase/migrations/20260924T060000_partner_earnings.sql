-- What a partner earned, and what was paid to them.
--
-- Resellers have had this since the beginning: reseller_commissions and
-- reseller_payouts, with an idempotency key, a snapshot of the rule that
-- produced the figure, and a status that walks from requested to completed.
-- Affiliates, authors and vendors had none of it - no click was recorded, no
-- commission was calculated and no payout could be raised - so every one of
-- those screens showed a dash where money should be.
--
-- This is the same model, once, for all of them, rather than three more copies
-- of it. It follows the conventions the reseller tables already set:
--
--   * money as numeric(20,4) with an ISO 4217 currency beside it, never a
--     float and never a bare number whose currency has to be guessed;
--   * an idempotency key on anything that moves money, so a retried request
--     cannot pay twice;
--   * a snapshot of the rule that produced each figure, so a commission can be
--     explained months later even after the rule has changed;
--   * timestamps for each step of a payout, not one status column pretending
--     to carry a history;
--   * nothing is ever deleted. A commission that should not have been earned
--     is reversed by a second row that cancels it, and both stay.

-- ---------------------------------------------------------------- the partner
--
-- A partner is an affiliate, an author, a vendor or an influencer. Each already
-- has its own table; this names which one a row belongs to rather than adding a
-- fifth register of people.
do $$ begin
  create type public.partner_kind as enum ('affiliate', 'author', 'vendor', 'influencer');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------- what a link brought
--
-- A click is the first half of an affiliate's case for being paid; without it
-- a conversion cannot be attributed to anybody. The visitor is recorded as a
-- one-way hash and the row carries its own purge date, so this is a record of
-- traffic rather than a file on a person.
create table if not exists public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.marketplace_affiliate_partners(id) on delete cascade,
  referral_code text,
  product_id uuid references public.marketplace_products(id) on delete set null,
  landing_path text,
  referrer_host text,
  country char(2),
  device_type text,
  -- Never the address itself, and never anything that identifies a person.
  visitor_hash text,
  session_id text,
  -- Set when this click is later credited with an order.
  converted_order_id uuid references public.marketplace_orders(id) on delete set null,
  converted_at timestamptz,
  purge_after timestamptz not null default (now() + interval '400 days'),
  created_at timestamptz not null default now(),
  constraint affiliate_clicks_country_is_iso check (country is null or country ~ '^[A-Z]{2}$')
);
create index if not exists affiliate_clicks_partner_idx
  on public.affiliate_clicks(partner_id, created_at desc);
create index if not exists affiliate_clicks_conversion_idx
  on public.affiliate_clicks(converted_order_id) where converted_order_id is not null;
create index if not exists affiliate_clicks_purge_idx on public.affiliate_clicks(purge_after);

-- --------------------------------------------------------------- what is owed
create table if not exists public.partner_commissions (
  id uuid primary key default gen_random_uuid(),
  partner_kind public.partner_kind not null,
  partner_id uuid not null,

  order_id uuid references public.marketplace_orders(id) on delete set null,
  order_item_id uuid references public.marketplace_order_items(id) on delete set null,
  attribution_id uuid references public.marketplace_order_attributions(id) on delete set null,
  click_id uuid references public.affiliate_clicks(id) on delete set null,

  -- The sale this was taken from, and the share of it.
  gross_amount numeric(20,4) not null default 0,
  commission_amount numeric(20,4) not null default 0,
  currency char(3) not null default 'INR',

  -- Why this figure and not another. Kept as it was at the time.
  rule_snapshot jsonb,

  status text not null default 'pending',
  -- The row that cancels this one, where one exists.
  reversed_by uuid references public.partner_commissions(id) on delete set null,
  reversal_reason text,

  payout_id uuid,
  idempotency_key text,
  earned_at timestamptz not null default now(),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint partner_commissions_currency_is_iso check (currency ~ '^[A-Z]{3}$'),
  constraint partner_commissions_known_status
    check (status in ('pending', 'approved', 'paid', 'reversed', 'rejected'))
);
-- One commission per partner per order item, however many times it is retried.
create unique index if not exists partner_commissions_once
  on public.partner_commissions(partner_kind, partner_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists partner_commissions_partner_idx
  on public.partner_commissions(partner_kind, partner_id, earned_at desc);
create index if not exists partner_commissions_status_idx
  on public.partner_commissions(status, earned_at desc);
create index if not exists partner_commissions_order_idx on public.partner_commissions(order_id);

-- -------------------------------------------------------------- what was paid
create table if not exists public.partner_payouts (
  id uuid primary key default gen_random_uuid(),
  partner_kind public.partner_kind not null,
  partner_id uuid not null,

  amount numeric(20,4) not null,
  currency char(3) not null default 'INR',

  status text not null default 'requested',
  payment_method text,
  provider text,
  provider_reference text,
  failure_reason text,

  -- The window this payout settles, so a statement can be reproduced.
  period_start date,
  period_end date,

  idempotency_key text,
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  processed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint partner_payouts_currency_is_iso check (currency ~ '^[A-Z]{3}$'),
  constraint partner_payouts_amount_is_positive check (amount > 0),
  constraint partner_payouts_known_status
    check (status in ('requested', 'approved', 'processing', 'completed', 'failed', 'cancelled'))
);
create unique index if not exists partner_payouts_once
  on public.partner_payouts(partner_kind, partner_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists partner_payouts_partner_idx
  on public.partner_payouts(partner_kind, partner_id, requested_at desc);
create index if not exists partner_payouts_status_idx
  on public.partner_payouts(status, requested_at desc);

do $$ begin
  alter table public.partner_commissions
    add constraint partner_commissions_payout_fk
    foreign key (payout_id) references public.partner_payouts(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------------ keep time
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists partner_commissions_touch on public.partner_commissions;
create trigger partner_commissions_touch before update on public.partner_commissions
  for each row execute function public.touch_updated_at();
drop trigger if exists partner_payouts_touch on public.partner_payouts;
create trigger partner_payouts_touch before update on public.partner_payouts
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------- money is never unmade here
--
-- A commission that should not have been earned is reversed by a second row.
-- Deleting the first would leave a payout referring to nothing and a statement
-- that no longer adds up.
create or replace function public.block_earnings_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  raise exception 'Earnings records are kept. Reverse the commission or cancel the payout instead of deleting it.';
end;
$$;
drop trigger if exists partner_commissions_no_delete on public.partner_commissions;
create trigger partner_commissions_no_delete before delete on public.partner_commissions
  for each row execute function public.block_earnings_delete();
drop trigger if exists partner_payouts_no_delete on public.partner_payouts;
create trigger partner_payouts_no_delete before delete on public.partner_payouts
  for each row execute function public.block_earnings_delete();

-- ------------------------------------------------------------------ who sees
grant select on public.affiliate_clicks to authenticated;
grant insert on public.affiliate_clicks to authenticated, anon;
grant all on public.affiliate_clicks to service_role;
grant select on public.partner_commissions to authenticated;
grant all on public.partner_commissions to service_role;
grant select, insert, update on public.partner_payouts to authenticated;
grant all on public.partner_payouts to service_role;

alter table public.affiliate_clicks enable row level security;
alter table public.partner_commissions enable row level security;
alter table public.partner_payouts enable row level security;

/** True when this account runs the platform. */
create or replace function public.is_platform_operator()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
     where user_id = auth.uid()
       and role in ('boss','boss_owner','founder','admin','super_admin','finance')
  )
$$;
revoke all on function public.is_platform_operator() from public, anon;
grant execute on function public.is_platform_operator() to authenticated;

/** True when this account is the partner the row belongs to. */
create or replace function public.owns_partner(_kind public.partner_kind, _partner_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case _kind
    when 'affiliate' then exists (
      select 1 from public.marketplace_affiliate_partners p
       where p.id = _partner_id and p.user_id = auth.uid())
    when 'influencer' then exists (
      select 1 from public.influencer_profiles p
       where p.id = _partner_id and p.user_id = auth.uid())
    else exists (
      select 1 from public.marketplace_sellers s
       where s.id = _partner_id and s.owner_user_id = auth.uid())
  end
$$;
revoke all on function public.owns_partner(public.partner_kind, uuid) from public, anon;
grant execute on function public.owns_partner(public.partner_kind, uuid) to authenticated;

do $$ begin
  create policy "a partner sees their own clicks" on public.affiliate_clicks
    for select to authenticated
    using (public.is_platform_operator() or public.owns_partner('affiliate', partner_id));
exception when duplicate_object then null; end $$;
do $$ begin
  -- A click is recorded as a visitor arrives, before anyone has signed in.
  create policy "a click may be recorded" on public.affiliate_clicks
    for insert to anon, authenticated with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "a partner sees what they earned" on public.partner_commissions
    for select to authenticated
    using (public.is_platform_operator() or public.owns_partner(partner_kind, partner_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "a partner sees their payouts" on public.partner_payouts
    for select to authenticated
    using (public.is_platform_operator() or public.owns_partner(partner_kind, partner_id));
exception when duplicate_object then null; end $$;
do $$ begin
  -- A partner may ask to be paid; only the platform may approve or settle.
  create policy "a partner may request a payout" on public.partner_payouts
    for insert to authenticated
    with check (status = 'requested' and public.owns_partner(partner_kind, partner_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "the platform decides a payout" on public.partner_payouts
    for update to authenticated
    using (public.is_platform_operator()) with check (public.is_platform_operator());
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------- what it adds up to
create or replace function public.partner_earnings_summary(
  _kind public.partner_kind,
  _partner_id uuid
)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'currency', coalesce((
      select currency from public.partner_commissions
       where partner_kind = _kind and partner_id = _partner_id
       order by earned_at desc limit 1
    ), 'INR'),
    'earned', coalesce((
      select sum(commission_amount) from public.partner_commissions
       where partner_kind = _kind and partner_id = _partner_id and status <> 'reversed'
    ), 0),
    'approved', coalesce((
      select sum(commission_amount) from public.partner_commissions
       where partner_kind = _kind and partner_id = _partner_id and status = 'approved'
    ), 0),
    'paid', coalesce((
      select sum(commission_amount) from public.partner_commissions
       where partner_kind = _kind and partner_id = _partner_id and status = 'paid'
    ), 0),
    'awaiting_payout', coalesce((
      select sum(commission_amount) from public.partner_commissions
       where partner_kind = _kind and partner_id = _partner_id and status = 'approved' and payout_id is null
    ), 0),
    'payouts_completed', coalesce((
      select sum(amount) from public.partner_payouts
       where partner_kind = _kind and partner_id = _partner_id and status = 'completed'
    ), 0),
    'payouts_in_flight', coalesce((
      select sum(amount) from public.partner_payouts
       where partner_kind = _kind and partner_id = _partner_id
         and status in ('requested','approved','processing')
    ), 0)
  )
  where public.is_platform_operator() or public.owns_partner(_kind, _partner_id)
$$;
revoke all on function public.partner_earnings_summary(public.partner_kind, uuid) from public, anon;
grant execute on function public.partner_earnings_summary(public.partner_kind, uuid) to authenticated;

/**
 * Reverse a commission.
 *
 * Writes the cancelling row and marks the original, so the pair explains
 * itself. Nothing is removed, and a commission already paid out cannot be
 * reversed this way - that is a refund, which belongs to the order.
 */
create or replace function public.reverse_partner_commission(_id uuid, _reason text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  original public.partner_commissions%rowtype;
  cancelling uuid;
begin
  if not public.is_platform_operator() then
    raise exception 'only the platform may reverse a commission';
  end if;
  select * into original from public.partner_commissions where id = _id;
  if original.id is null then
    raise exception 'no such commission';
  end if;
  if original.status = 'reversed' then
    return json_build_object('reversed', false, 'reason', 'already reversed');
  end if;
  if original.status = 'paid' then
    raise exception 'this commission has been paid; refund the order instead';
  end if;

  insert into public.partner_commissions (
    partner_kind, partner_id, order_id, order_item_id, attribution_id, click_id,
    gross_amount, commission_amount, currency, rule_snapshot, status, reversal_reason
  ) values (
    original.partner_kind, original.partner_id, original.order_id, original.order_item_id,
    original.attribution_id, original.click_id,
    -original.gross_amount, -original.commission_amount, original.currency,
    original.rule_snapshot, 'reversed', _reason
  ) returning id into cancelling;

  update public.partner_commissions
     set status = 'reversed', reversed_by = cancelling, reversal_reason = _reason
   where id = _id;

  return json_build_object('reversed', true, 'cancelling_row', cancelling);
end;
$$;
revoke all on function public.reverse_partner_commission(uuid, text) from public, anon;
grant execute on function public.reverse_partner_commission(uuid, text) to authenticated;

notify pgrst, 'reload schema';
