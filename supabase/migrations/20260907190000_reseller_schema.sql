-- Reseller Manager, on the reseller system and the attribution engine that
-- already exist.
--
-- What was already here, and is reused rather than rebuilt:
--
--   resellers                     the entity, with its own referral code column
--   reseller_membership_plans     Starter 20%, Professional 30%, Master 40% —
--                                 real commercial terms, so no rate is invented
--   reseller_memberships/_orders  the plan purchase flow, with idempotency keys
--   marketplace_referral_codes    the canonical attribution engine, already
--   marketplace_referral_sessions carrying affiliates and influencers
--   marketplace_order_attributions
--   marketplace_orders/_items     the canonical order and catalogue
--   marketplace_ledger_entries    the ledger section 17 asks for
--
-- Section 37 lists sixteen tables to create. Most are not created, because the
-- rows already exist elsewhere. Three are, and each is a genuinely distinct
-- financial relationship rather than a second copy of one:
--
--   reseller_commission_rules  a reseller's margin is not a seller's split, and
--   reseller_commissions       putting them in marketplace_commissions would
--                              collide on its unique order_item_id and conflate
--                              the two, which section 32 explicitly forbids
--   reseller_payouts           paid to a different party than a seller payout
--
-- One thing is emphatically NOT used as a source here. finance_commissions
-- holds eighty identical rows for a single invented partner, and finance_payouts
-- holds seventy payouts to one "Orbit Software Hub" totalling over sixteen
-- million with fabricated UTR references, matching no reseller in this database.
-- That is seeded demo data. It is left untouched and read by nothing below.

/* ---------------------------------------- 1. resellers join the attribution */

-- Resellers could not be tracked at all: the canonical referral tables carried
-- an affiliate and an influencer column and nothing for a reseller.
alter table public.marketplace_referral_codes
  add column if not exists reseller_id uuid references public.resellers(id);
alter table public.marketplace_referral_sessions
  add column if not exists reseller_id uuid references public.resellers(id);
alter table public.marketplace_order_attributions
  add column if not exists reseller_id uuid references public.resellers(id);

create index if not exists referral_codes_reseller_idx
  on public.marketplace_referral_codes (reseller_id) where reseller_id is not null;
create index if not exists referral_sessions_reseller_idx
  on public.marketplace_referral_sessions (reseller_id) where reseller_id is not null;
create index if not exists order_attributions_reseller_idx
  on public.marketplace_order_attributions (reseller_id) where reseller_id is not null;

-- The ledger gains the same column, so one ledger covers every party rather
-- than a second ledger appearing per role.
alter table public.marketplace_ledger_entries
  add column if not exists reseller_id uuid references public.resellers(id);

-- A status vocabulary. The column was free text, so the six states the brief
-- names are made explicit; every existing row is 'active' and passes.
do $$
begin
  if not exists (select 1 from pg_constraint where conname='resellers_status_check') then
    alter table public.resellers add constraint resellers_status_check
      check (status in ('pending','active','paused','suspended','rejected','terminated'));
  end if;
end;
$$;

alter table public.resellers add column if not exists plan_code text;
alter table public.resellers add column if not exists last_active_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='resellers_plan_check') then
    alter table public.resellers add constraint resellers_plan_check
      check (plan_code is null or plan_code in
             ('starter_reseller','professional_reseller','master_reseller'));
  end if;
end;
$$;

comment on column public.resellers.plan_code is
  'Which reseller_membership_plans row sets this reseller''s margin. Null means '
  'no plan, and no margin can be resolved until one is assigned.';

/* ------------------------------------------------- 2. the commission rules */

create table if not exists public.reseller_commission_rules (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid references public.resellers(id) on delete cascade,
  product_id uuid references public.marketplace_products(id) on delete cascade,
  category_id uuid,
  plan_code text check (plan_code is null or plan_code in
    ('starter_reseller','professional_reseller','master_reseller')),
  rate_percent numeric(6,4) not null check (rate_percent >= 0 and rate_percent <= 100),
  fixed_amount numeric(12,2) not null default 0 check (fixed_amount >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  -- A volume floor makes the volume-based model in section 8 expressible: the
  -- rule only applies once the reseller has sold at least this much.
  min_volume numeric(12,2) not null default 0 check (min_volume >= 0),
  active boolean not null default true,
  priority integer not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.reseller_commission_rules is
  'Overrides on top of the plan margin. With no rule, a reseller earns the '
  'profit_percent of their reseller_membership_plans row, so no rate is ever '
  'written into code.';

create index if not exists reseller_rules_lookup_idx
  on public.reseller_commission_rules (reseller_id, product_id, category_id) where active;

/* --------------------------------------------------- 3. the commissions */

create table if not exists public.reseller_commissions (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references public.resellers(id) on delete restrict,
  order_id uuid not null references public.marketplace_orders(id) on delete restrict,
  order_item_id uuid not null references public.marketplace_order_items(id) on delete restrict,
  attribution_id uuid references public.marketplace_order_attributions(id),
  gross_amount numeric(12,2) not null check (gross_amount >= 0),
  commission_amount numeric(12,2) not null check (commission_amount >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending'
    check (status in ('pending','available','paid','reversed')),
  -- What the rate was at the moment of the sale. A later change to the plan or
  -- a rule never rewrites what was already earned.
  rule_snapshot jsonb not null default '{}'::jsonb,
  payout_id uuid,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One order line pays one reseller once. This single constraint is what makes
  -- a repeated webhook or a re-run settlement harmless.
  constraint reseller_commissions_line_once unique (order_item_id),
  constraint reseller_commissions_idem unique (idempotency_key)
);

create index if not exists reseller_commissions_reseller_idx
  on public.reseller_commissions (reseller_id, status);
create index if not exists reseller_commissions_payout_idx
  on public.reseller_commissions (payout_id) where payout_id is not null;

/* ------------------------------------------------------- 4. the payouts */

create table if not exists public.reseller_payout_schedules (
  reseller_id uuid primary key references public.resellers(id) on delete cascade,
  cadence text not null default 'monthly'
    check (cadence in ('weekly','biweekly','monthly','custom')),
  holding_days integer not null default 14 check (holding_days between 0 and 180),
  minimum_amount numeric(12,2) not null default 50 check (minimum_amount >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  requires_approval boolean not null default true,
  payment_method text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reseller_payouts (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references public.resellers(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending'
    check (status in ('pending','approved','processing','paid','failed','reversed','cancelled')),
  payment_method text,
  provider_reference text,
  failure_reason text,
  idempotency_key text not null unique,
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  processed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reseller_payouts_reseller_idx
  on public.reseller_payouts (reseller_id, status);

alter table public.reseller_commissions add constraint reseller_commissions_payout_fk
  foreign key (payout_id) references public.reseller_payouts(id);

/* ------------------------------------------------------------- 5. RLS */

-- A reseller sees their own money and nobody else's. Finance and the boss see
-- all of it. Nothing here is USING(true).
alter table public.reseller_commissions enable row level security;
alter table public.reseller_commission_rules enable row level security;
alter table public.reseller_payouts enable row level security;
alter table public.reseller_payout_schedules enable row level security;

create or replace function public.reseller_is_finance()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'boss')
      or public.has_role(auth.uid(),'super_admin') or public.has_role(auth.uid(),'finance');
$$;

do $$
declare t text;
begin
  foreach t in array array['reseller_commissions','reseller_commission_rules',
                           'reseller_payouts','reseller_payout_schedules'] loop
    execute format('drop policy if exists %I on public.%I', t||'_own_read', t);
    execute format($f$create policy %I on public.%I for select to authenticated
                      using (public.reseller_is_finance()
                             or public.reseller_owned_by_user(auth.uid(), reseller_id))$f$,
                   t||'_own_read', t);

    execute format('drop policy if exists %I on public.%I', t||'_finance_write', t);
    execute format($f$create policy %I on public.%I for all to authenticated
                      using (public.reseller_is_finance())
                      with check (public.reseller_is_finance())$f$,
                   t||'_finance_write', t);

    execute format('drop policy if exists %I on public.%I', t||'_anon', t);
    execute format($f$create policy %I on public.%I as restrictive for all to anon
                      using (false) with check (false)$f$, t||'_anon', t);
  end loop;
end;
$$;
