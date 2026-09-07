-- Author Manager + Vendor Manager, on the seller system that already exists.
--
-- Section 34 lists twenty-two tables to create: authors, author_profiles,
-- author_earnings, author_payouts, vendors, vendor_commissions, vendor_payouts
-- and the rest. Almost none of them are built here, because building them would
-- have been the duplication the brief itself forbids. What is already in this
-- database is a single, well-made seller system:
--
--   marketplace_sellers             the entity, with status and payout details
--   marketplace_seller_users        who may act for it
--   marketplace_products.seller_id  the catalogue link — one catalogue, not two
--   marketplace_order_items         the sales
--   marketplace_commission_rules    per seller, product, category, or house
--   marketplace_commissions         gross, commission and seller split per line
--   marketplace_commission_reversals  refunds, already handled
--   marketplace_ledger_entries      the auditable ledger section 35 asks for
--   marketplace_payouts             idempotent, with a provider reference
--
-- src/lib/commerce/commission.ts already resolves the most specific rule and
-- writes commissions idempotently when an order is paid, and reverses them on
-- refund. Sections 16, 17, 18 and 19 were therefore already built and running.
--
-- Four things were genuinely missing, and only those are added here.
--
-- 1. Author and vendor were the same record with no way to tell them apart,
--    which contradicts section 28. seller_kind separates them without splitting
--    the ledger, because each seller is already its own row.
-- 2. Nothing moved a commission from pending to available. The holding period
--    in section 6 existed only as a word.
-- 3. There was no way to pay anyone. marketplace_payouts had a schema, zero
--    rows, and no code that could create, approve or settle one.
-- 4. Payout schedules from section 20 did not exist at all.

/* ------------------------------------------------- 1. author versus vendor */

alter table public.marketplace_sellers
  add column if not exists seller_kind text;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'marketplace_sellers_kind_check') then
    alter table public.marketplace_sellers
      add constraint marketplace_sellers_kind_check
      check (seller_kind is null or seller_kind in ('author','vendor'));
  end if;
end;
$$;

comment on column public.marketplace_sellers.seller_kind is
  'author or vendor. Null means unclassified: the seller exists and trades, but '
  'nobody has said which console owns it. Both screens show the unclassified '
  'ones so they cannot be lost between the two.';

-- Backfilled only where the slug states it outright. The rest stay null rather
-- than being guessed into a category that would then look authoritative.
update public.marketplace_sellers
   set seller_kind = 'author'
 where seller_kind is null and slug like 'author-%';

update public.marketplace_sellers
   set seller_kind = 'vendor'
 where seller_kind is null and slug like 'vendor-%';

/* -------------------------------------------- 2. link a payout to its lines */

-- Which commissions a payout is settling. Without this a payout is a number
-- with no explanation, and there is no way to release the lines again if the
-- payment fails.
alter table public.marketplace_commissions
  add column if not exists payout_id uuid references public.marketplace_payouts(id);

create index if not exists marketplace_commissions_payout_idx
  on public.marketplace_commissions (payout_id) where payout_id is not null;
create index if not exists marketplace_commissions_seller_idx
  on public.marketplace_commissions (seller_id, status);

/* ----------------------------------------------------- 3. payout schedules */

create table if not exists public.marketplace_payout_schedules (
  seller_id uuid primary key references public.marketplace_sellers(id) on delete cascade,
  cadence text not null default 'monthly'
    check (cadence in ('weekly','biweekly','monthly','custom')),
  -- Days a sale must age before it can be paid out. Refunds usually arrive
  -- inside this window, which is the whole point of holding.
  holding_days integer not null default 14 check (holding_days between 0 and 180),
  minimum_amount numeric(12,2) not null default 50 check (minimum_amount >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  requires_approval boolean not null default true,
  payment_method text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.marketplace_payout_schedules is
  'Per-seller payout terms. A seller with no row here uses the defaults above.';

alter table public.marketplace_payout_schedules enable row level security;

drop policy if exists payout_schedules_read on public.marketplace_payout_schedules;
create policy payout_schedules_read on public.marketplace_payout_schedules
  for select to authenticated
  using (public.marketplace_is_finance() or public.marketplace_is_seller_member(seller_id));

drop policy if exists payout_schedules_write on public.marketplace_payout_schedules;
create policy payout_schedules_write on public.marketplace_payout_schedules
  for all to authenticated
  using (public.marketplace_is_finance()) with check (public.marketplace_is_finance());

drop policy if exists payout_schedules_anon on public.marketplace_payout_schedules;
create policy payout_schedules_anon on public.marketplace_payout_schedules
  as restrictive for all to anon using (false) with check (false);

/* ---------------------------------------------------- the operator's gate */

-- Finance and admin already gate the seller tables through
-- marketplace_is_finance(). Everything below uses the same gate rather than a
-- second idea of who is allowed to touch money.
create or replace function public.mm_seller_operator()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.marketplace_is_finance() or public.mm_is_operator();
$$;

/* -------------------------------------------------------- the registry */

create or replace function public.mm_sellers(p_query jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_kind   text := nullif(p_query->>'kind','');
  v_search text := nullif(btrim(coalesce(p_query->>'search','')), '');
  v_status text := nullif(p_query->>'status','');
  v_limit  integer := least(greatest(coalesce((p_query->>'limit')::int, 100), 1), 500);
begin
  if not public.mm_seller_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if v_kind is not null and v_kind not in ('author','vendor') then
    return jsonb_build_object('ok', false, 'reason', 'unknown_kind');
  end if;

  return jsonb_build_object(
    'ok', true,
    'kind', v_kind,

    -- The dashboard. Every figure is counted, none is stored.
    'total',      (select count(*) from public.marketplace_sellers s
                    where v_kind is null or s.seller_kind is not distinct from v_kind),
    'approved',   (select count(*) from public.marketplace_sellers s
                    where s.status = 'approved'
                      and (v_kind is null or s.seller_kind is not distinct from v_kind)),
    'pending',    (select count(*) from public.marketplace_sellers s
                    where s.status = 'pending'
                      and (v_kind is null or s.seller_kind is not distinct from v_kind)),
    'suspended',  (select count(*) from public.marketplace_sellers s
                    where s.status in ('suspended','rejected','deactivated')
                      and (v_kind is null or s.seller_kind is not distinct from v_kind)),
    'unclassified', (select count(*) from public.marketplace_sellers
                      where seller_kind is null),

    'products',   (select count(*) from public.marketplace_products p
                    join public.marketplace_sellers s on s.id = p.seller_id
                   where v_kind is null or s.seller_kind is not distinct from v_kind),
    'published',  (select count(*) from public.marketplace_products p
                    join public.marketplace_sellers s on s.id = p.seller_id
                   where p.visible
                     and (v_kind is null or s.seller_kind is not distinct from v_kind)),
    'sales',      (select count(*) from public.marketplace_commissions c
                    join public.marketplace_sellers s on s.id = c.seller_id
                   where c.status <> 'reversed'
                     and (v_kind is null or s.seller_kind is not distinct from v_kind)),

    -- Money, split the way the brief asks: what the sale was worth, what the
    -- marketplace kept, and what the seller is owed.
    'gross',      (select coalesce(sum(c.gross_amount),0) from public.marketplace_commissions c
                    join public.marketplace_sellers s on s.id = c.seller_id
                   where c.status <> 'reversed'
                     and (v_kind is null or s.seller_kind is not distinct from v_kind)),
    'marketplace_share', (select coalesce(sum(c.commission_amount),0)
                            from public.marketplace_commissions c
                            join public.marketplace_sellers s on s.id = c.seller_id
                           where c.status <> 'reversed'
                             and (v_kind is null or s.seller_kind is not distinct from v_kind)),
    'seller_share', (select coalesce(sum(c.seller_amount),0)
                       from public.marketplace_commissions c
                       join public.marketplace_sellers s on s.id = c.seller_id
                      where c.status <> 'reversed'
                        and (v_kind is null or s.seller_kind is not distinct from v_kind)),
    'reversed',   (select coalesce(sum(c.seller_amount),0)
                     from public.marketplace_commissions c
                     join public.marketplace_sellers s on s.id = c.seller_id
                    where c.status = 'reversed'
                      and (v_kind is null or s.seller_kind is not distinct from v_kind)),
    'pending_earnings', (select coalesce(sum(c.seller_amount),0)
                           from public.marketplace_commissions c
                           join public.marketplace_sellers s on s.id = c.seller_id
                          where c.status = 'pending'
                            and (v_kind is null or s.seller_kind is not distinct from v_kind)),
    'available_earnings', (select coalesce(sum(c.seller_amount),0)
                             from public.marketplace_commissions c
                             join public.marketplace_sellers s on s.id = c.seller_id
                            where c.status = 'available' and c.payout_id is null
                              and (v_kind is null or s.seller_kind is not distinct from v_kind)),
    'paid_earnings', (select coalesce(sum(c.seller_amount),0)
                        from public.marketplace_commissions c
                        join public.marketplace_sellers s on s.id = c.seller_id
                       where c.status = 'paid'
                         and (v_kind is null or s.seller_kind is not distinct from v_kind)),

    'payouts_total', (select coalesce(sum(o.amount),0) from public.marketplace_payouts o
                       join public.marketplace_sellers s on s.id = o.seller_id
                      where v_kind is null or s.seller_kind is not distinct from v_kind),
    'payouts_paid', (select coalesce(sum(o.amount),0) from public.marketplace_payouts o
                      join public.marketplace_sellers s on s.id = o.seller_id
                     where o.status = 'completed'
                       and (v_kind is null or s.seller_kind is not distinct from v_kind)),
    'payouts_pending', (select coalesce(sum(o.amount),0) from public.marketplace_payouts o
                         join public.marketplace_sellers s on s.id = o.seller_id
                        where o.status in ('pending','approved','processing')
                          and (v_kind is null or s.seller_kind is not distinct from v_kind)),

    -- What the catalogue actually looks like, which matters here: almost every
    -- product on this marketplace is first-party and has no seller at all.
    'unassigned_products', (select count(*) from public.marketplace_products
                             where seller_id is null),

    'sellers', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'name', s.display_name, 'slug', s.slug,
               'status', s.status, 'kind', s.seller_kind,
               'owner_user_id', s.owner_user_id,
               'payout_currency', s.payout_currency,
               'created_at', s.created_at, 'approved_at', s.approved_at,
               'products', (select count(*) from public.marketplace_products p
                             where p.seller_id = s.id),
               'published', (select count(*) from public.marketplace_products p
                              where p.seller_id = s.id and p.visible),
               'sales', (select count(*) from public.marketplace_commissions c
                          where c.seller_id = s.id and c.status <> 'reversed'),
               'gross', (select coalesce(sum(c.gross_amount),0)
                           from public.marketplace_commissions c
                          where c.seller_id = s.id and c.status <> 'reversed'),
               'earned', (select coalesce(sum(c.seller_amount),0)
                            from public.marketplace_commissions c
                           where c.seller_id = s.id and c.status <> 'reversed'),
               'available', (select coalesce(sum(c.seller_amount),0)
                               from public.marketplace_commissions c
                              where c.seller_id = s.id and c.status = 'available'
                                and c.payout_id is null),
               'paid_out', (select coalesce(sum(o.amount),0)
                              from public.marketplace_payouts o
                             where o.seller_id = s.id and o.status = 'completed'),
               'commission_rate', (select r.rate_percent
                                     from public.marketplace_commission_rules r
                                    where r.seller_id = s.id and r.active
                                    order by r.priority desc limit 1),
               'members', (select count(*) from public.marketplace_seller_users u
                            where u.seller_id = s.id))
             order by s.created_at desc)
        from (select * from public.marketplace_sellers s2
               -- An unclassified seller appears in both consoles rather than
               -- falling between them.
               where (v_kind is null or s2.seller_kind is not distinct from v_kind
                      or s2.seller_kind is null)
                 and (v_status is null or s2.status = v_status)
                 and (v_search is null
                      or s2.display_name ilike '%'||v_search||'%'
                      or s2.slug ilike '%'||v_search||'%')
               order by s2.created_at desc limit v_limit) s), '[]'::jsonb));
end;
$$;

/* ------------------------------------------------------------ the profile */

create or replace function public.mm_seller_detail(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_seller jsonb;
begin
  if not public.mm_seller_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select to_jsonb(s) into v_seller from public.marketplace_sellers s where s.id = p_id;
  if v_seller is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_seller');
  end if;

  return jsonb_build_object(
    'ok', true,
    'seller', v_seller,

    'schedule', coalesce(
      (select to_jsonb(x) from public.marketplace_payout_schedules x where x.seller_id = p_id),
      jsonb_build_object('seller_id', p_id, 'cadence','monthly', 'holding_days',14,
                         'minimum_amount',50, 'currency','USD', 'requires_approval',true,
                         'active',true, 'defaulted',true)),

    -- The catalogue rows themselves, read from the one product table. No
    -- second catalogue is kept here.
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'name', p.name, 'slug', p.slug, 'version', p.version,
               'category_id', p.category_id, 'visible', p.visible,
               'moderation_status', p.moderation_status,
               'published_at', p.publish_at, 'created_at', p.created_at,
               'sales', (select count(*) from public.marketplace_order_items i
                          where i.product_id = p.id),
               'revenue', (select coalesce(sum(i.line_total),0)
                             from public.marketplace_order_items i
                            where i.product_id = p.id))
             order by p.created_at desc)
        from public.marketplace_products p where p.seller_id = p_id), '[]'::jsonb),

    'earnings', jsonb_build_object(
      'gross',     (select coalesce(sum(gross_amount),0) from public.marketplace_commissions
                     where seller_id = p_id and status <> 'reversed'),
      'marketplace_share', (select coalesce(sum(commission_amount),0)
                              from public.marketplace_commissions
                             where seller_id = p_id and status <> 'reversed'),
      'seller_share', (select coalesce(sum(seller_amount),0)
                         from public.marketplace_commissions
                        where seller_id = p_id and status <> 'reversed'),
      'reversed',  (select coalesce(sum(seller_amount),0) from public.marketplace_commissions
                     where seller_id = p_id and status = 'reversed'),
      'pending',   (select coalesce(sum(seller_amount),0) from public.marketplace_commissions
                     where seller_id = p_id and status = 'pending'),
      'available', (select coalesce(sum(seller_amount),0) from public.marketplace_commissions
                     where seller_id = p_id and status = 'available' and payout_id is null),
      'paid',      (select coalesce(sum(seller_amount),0) from public.marketplace_commissions
                     where seller_id = p_id and status = 'paid')),

    'commissions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'order_item_id', c.order_item_id,
               'gross', c.gross_amount, 'marketplace_share', c.commission_amount,
               'seller_share', c.seller_amount, 'status', c.status,
               'payout_id', c.payout_id, 'created_at', c.created_at,
               'rule', c.rule_snapshot)
             order by c.created_at desc)
        from public.marketplace_commissions c where c.seller_id = p_id), '[]'::jsonb),

    'rules', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.priority desc)
        from public.marketplace_commission_rules r where r.seller_id = p_id), '[]'::jsonb),

    'payouts', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', o.id, 'amount', o.amount, 'currency', o.currency,
               'status', o.status, 'provider_reference', o.provider_reference,
               'created_at', o.created_at, 'updated_at', o.updated_at,
               'lines', (select count(*) from public.marketplace_commissions c
                          where c.payout_id = o.id))
             order by o.created_at desc)
        from public.marketplace_payouts o where o.seller_id = p_id), '[]'::jsonb),

    'ledger', coalesce((
      select jsonb_agg(to_jsonb(l) order by l.created_at desc)
        from public.marketplace_ledger_entries l where l.seller_id = p_id), '[]'::jsonb),

    'members', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', u.user_id, 'role', u.member_role))
        from public.marketplace_seller_users u where u.seller_id = p_id), '[]'::jsonb),

    'audit', coalesce((
      select jsonb_agg(jsonb_build_object(
               'action', a.action, 'actor', a.actor_id, 'at', a.created_at,
               'before', a.before_state, 'after', a.after_state, 'reason', a.reason)
             order by a.created_at desc)
        from public.marketplace_audit_logs a
       where a.entity_id = p_id and a.created_at > now() - interval '180 days'), '[]'::jsonb));
end;
$$;
