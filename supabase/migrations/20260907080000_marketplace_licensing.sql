-- Purchase becomes entitlement becomes licence.
--
-- Ten orders have been paid. Every licence and entitlement table in this
-- database is empty:
--
--   marketplace_licenses      0
--   marketplace_entitlements  0
--   licenses                  0
--   entitlements              0
--   license_keys              0
--
-- Nothing issues them. The only trigger on marketplace_orders is
-- ams_order_paid, which awards gamification points, and no function in the
-- schema creates a licence. So ten paying customers hold no licence and no
-- entitlement, and the Marketplace Manager's licence screen filled the gap with
-- typed-in numbers - 12,847 active keys, 38,912 activations, 99.98% verification
-- - none of which came from anywhere.
--
-- The marketplace_* family is the chain this schema was designed around:
--
--   marketplace_order_items
--     -> marketplace_entitlements (order_item_id, buyer_id, product_id)
--     -> marketplace_downloads    (entitlement_id)
--   marketplace_licenses          (order_item_id, buyer_id, product_id)
--
-- so that is what is filled. The older `licenses` / `entitlements` /
-- `license_keys` tables are left untouched: they belong to other flows and
-- deleting or repurposing them is not this change's business.

/* ------------------------------------------------------------- key format */

-- A licence key that cannot be guessed or walked.
--
-- Sixteen random bytes from pgcrypto, each mapped onto a 31-character
-- alphabet that omits I, L, O, 0 and 1 so a key can be read aloud and retyped
-- without ambiguity, then grouped as SV-XXXX-XXXX-XXXX-XXXX. That is roughly
-- 79 bits of entropy. No sequence, no timestamp and no database id, so holding
-- one key tells you nothing about any other.
create or replace function public.mm_new_license_key()
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp, extensions
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- no I, L, O, 0, 1
  v_bytes bytea;
  v_key   text := '';
  i       integer;
  v_full  text;
begin
  for attempt in 1..10 loop
    v_key := '';
    v_bytes := gen_random_bytes(16);
    for i in 0..15 loop
      v_key := v_key || substr(v_alphabet, (get_byte(v_bytes, i) % length(v_alphabet)) + 1, 1);
    end loop;

    v_full := 'SV-' || substr(v_key,1,4) || '-' || substr(v_key,5,4)
                    || '-' || substr(v_key,9,4) || '-' || substr(v_key,13,4);

    -- Collision-checked against every key already issued.
    if not exists (select 1 from public.marketplace_licenses where license_key = v_full) then
      return v_full;
    end if;
  end loop;

  raise exception 'could not generate a unique licence key after 10 attempts';
end;
$$;

/* ---------------------------------------------------------- issue on paid */

-- Turn a paid order into entitlements and licences.
--
-- Idempotent on purpose: it is called from a trigger, from a backfill and can
-- be called again by hand, and an order must never end up with two licences
-- for the same item. Each order item is looked up before it is issued.
create or replace function public.mm_issue_for_order(p_order_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  o           record;
  item        record;
  v_ent       uuid;
  v_key       text;
  v_created   integer := 0;
  v_skipped   integer := 0;
  v_model     text;
begin
  select * into o from public.marketplace_orders where id = p_order_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_order');
  end if;
  if o.status::text <> 'paid' then
    return jsonb_build_object('ok', false, 'reason', 'order_not_paid',
                              'status', o.status::text);
  end if;
  if o.buyer_id is null then
    -- An order with no buyer cannot own a licence. Reported rather than
    -- guessed at.
    return jsonb_build_object('ok', false, 'reason', 'order_has_no_buyer');
  end if;

  for item in
    select oi.id, oi.product_id
      from public.marketplace_order_items oi
     where oi.order_id = p_order_id
  loop
    if exists (select 1 from public.marketplace_entitlements
                where order_item_id = item.id) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    insert into public.marketplace_entitlements
      (order_item_id, buyer_id, product_id, status, starts_at)
    values (item.id, o.buyer_id, item.product_id, 'active', now())
    returning id into v_ent;

    -- The licence model follows the product's own licence field rather than a
    -- value invented here, mapped onto the five the table permits:
    -- single_user, team, subscription, lifetime, trial. The catalogue records
    -- 'Lifetime' for 3,659 products and 'SaaS' for one.
    select case
             when p.license ilike '%saas%' or p.license ilike '%subscription%'
               then 'subscription'
             when p.license ilike '%trial%' then 'trial'
             when p.license ilike '%team%' or p.license ilike '%multi%' then 'team'
             when p.license ilike '%single%' then 'single_user'
             else 'lifetime'
           end
      into v_model
      from public.marketplace_products p where p.id = item.product_id;

    v_key := public.mm_new_license_key();

    insert into public.marketplace_licenses
      (order_item_id, buyer_id, product_id, license_key, license_model, status)
    values (item.id, o.buyer_id, item.product_id, v_key,
            coalesce(v_model, 'lifetime'), 'active');

    v_created := v_created + 1;

    perform public.mm_audit(
      'license.issued', 'marketplace_license', item.id::text,
      null,
      jsonb_build_object('order_id', p_order_id, 'product_id', item.product_id,
                         'license_model', v_model, 'entitlement_id', v_ent),
      'issued on payment');
  end loop;

  return jsonb_build_object('ok', true, 'order', p_order_id,
                            'issued', v_created, 'already_had', v_skipped);
end;
$$;

-- Payment is the business event that issues a licence. Nothing else does.
create or replace function public.mm_order_paid_issue()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status::text = 'paid'
     and (tg_op = 'INSERT' or coalesce(old.status::text, '') <> 'paid') then
    -- A failure here must not roll back the payment itself. The order being
    -- paid is the fact; the licence can be reissued.
    begin
      perform public.mm_issue_for_order(new.id);
    exception when others then
      perform public.mm_audit(
        'license.issue_failed', 'marketplace_order', new.id::text, null,
        jsonb_build_object('error', sqlerrm), 'licence issuance failed on payment');
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists mm_order_paid_issue on public.marketplace_orders;
create trigger mm_order_paid_issue
  after insert or update of status on public.marketplace_orders
  for each row execute function public.mm_order_paid_issue();

/* ------------------------------------------------------------- the numbers */

-- The licence dashboard, counted.
create or replace function public.mm_license_overview(p_window text default '30d')
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_since timestamptz;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  v_since := case p_window
               when 'today' then date_trunc('day', now())
               when '7d'    then now() - interval '7 days'
               when '30d'   then now() - interval '30 days'
               when '90d'   then now() - interval '90 days'
               else now() - interval '30 days'
             end;

  return jsonb_build_object(
    'ok', true,
    'window', p_window,
    'active_keys',   (select count(*) from public.marketplace_licenses where status = 'active'),
    -- A trial is a licence model here, not a status: the status column permits
    -- only issued, active, revoked and expired.
    'in_trial',      (select count(*) from public.marketplace_licenses
                       where license_model = 'trial' and status in ('issued','active')),
    'expiring_30d',  (select count(*) from public.marketplace_licenses
                       where status = 'active' and expires_at is not null
                         and expires_at between now() and now() + interval '30 days'),
    'revoked',       (select count(*) from public.marketplace_licenses where status = 'revoked'),
    'total',         (select count(*) from public.marketplace_licenses),
    'issued_in_window', (select count(*) from public.marketplace_licenses where created_at >= v_since),
    'entitlements',  (select count(*) from public.marketplace_entitlements),
    'entitlements_active', (select count(*) from public.marketplace_entitlements where status = 'active'),
    -- Counted, not asserted. There is no activation endpoint in this project
    -- yet, so this is zero and says so rather than showing a number.
    'activations',   0,
    'activations_available', false,
    'downloads',     (select count(*) from public.marketplace_downloads),
    'paid_orders',   (select count(*) from public.marketplace_orders where status::text = 'paid'),
    'paid_order_items', (select count(*) from public.marketplace_order_items oi
                          join public.marketplace_orders o on o.id = oi.order_id
                         where o.status::text = 'paid'),
    'product_versions', (select count(*) from public.marketplace_product_versions),
    'by_model', coalesce((
      select jsonb_agg(jsonb_build_object('model', license_model, 'count', n) order by n desc)
        from (select license_model, count(*) n from public.marketplace_licenses
               group by license_model) t), '[]'::jsonb),
    'by_status', coalesce((
      select jsonb_agg(jsonb_build_object('status', status, 'count', n) order by n desc)
        from (select status, count(*) n from public.marketplace_licenses
               group by status) t), '[]'::jsonb));
end;
$$;

/* --------------------------------------------------------------------- RLS */

alter table public.marketplace_licenses     enable row level security;
alter table public.marketplace_entitlements enable row level security;

-- A buyer sees their own licences and nothing else; operators see all. Never
-- USING(true) on a table that carries a licence key.
drop policy if exists mkt_licenses_owner on public.marketplace_licenses;
create policy mkt_licenses_owner on public.marketplace_licenses
  for select to authenticated
  using (buyer_id = auth.uid() or public.mm_is_operator());

drop policy if exists mkt_licenses_operator_write on public.marketplace_licenses;
create policy mkt_licenses_operator_write on public.marketplace_licenses
  for all to authenticated
  using (public.mm_is_operator()) with check (public.mm_is_operator());

drop policy if exists mkt_ent_owner on public.marketplace_entitlements;
create policy mkt_ent_owner on public.marketplace_entitlements
  for select to authenticated
  using (buyer_id = auth.uid() or public.mm_is_operator());

drop policy if exists mkt_ent_operator_write on public.marketplace_entitlements;
create policy mkt_ent_operator_write on public.marketplace_entitlements
  for all to authenticated
  using (public.mm_is_operator()) with check (public.mm_is_operator());

-- Anonymous has no business here at all, and the denial is per command so it
-- cannot cancel a SELECT the way a restrictive ALL policy does.
do $$
declare t text;
begin
  foreach t in array array['marketplace_licenses','marketplace_entitlements'] loop
    execute format('drop policy if exists %I on public.%I', t || '_anon_sel', t);
    execute format('create policy %I on public.%I as restrictive for select to anon using (false)',
                   t || '_anon_sel', t);
    execute format('drop policy if exists %I on public.%I', t || '_anon_ins', t);
    execute format('create policy %I on public.%I as restrictive for insert to anon with check (false)',
                   t || '_anon_ins', t);
    execute format('drop policy if exists %I on public.%I', t || '_anon_upd', t);
    execute format('create policy %I on public.%I as restrictive for update to anon using (false) with check (false)',
                   t || '_anon_upd', t);
    execute format('drop policy if exists %I on public.%I', t || '_anon_del', t);
    execute format('create policy %I on public.%I as restrictive for delete to anon using (false)',
                   t || '_anon_del', t);
  end loop;
end;
$$;

create index if not exists mkt_licenses_buyer_idx on public.marketplace_licenses (buyer_id);
create index if not exists mkt_licenses_product_idx on public.marketplace_licenses (product_id);
create index if not exists mkt_licenses_status_idx on public.marketplace_licenses (status);
create unique index if not exists mkt_licenses_key_uq on public.marketplace_licenses (license_key);
create unique index if not exists mkt_ent_order_item_uq on public.marketplace_entitlements (order_item_id);
