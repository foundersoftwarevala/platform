-- An influencer earns on a real, paid order.
--
-- Everything needed for this was already in the database and nothing joined it
-- up:
--
--   marketplace_referral_codes       has influencer_profile_id   0 rows have it
--   marketplace_referral_sessions    has influencer_profile_id   0 rows have it
--   marketplace_order_attributions   has influencer_profile_id   0 rows have it
--   partner_commissions              partner_kind includes 'influencer'
--   reverse_partner_commission()     is partner-kind agnostic already
--
-- So the referral chain works - it has attributed four real orders to affiliates
-- - and an influencer has simply never had a code in it, and no rule that says
-- what an influencer earns when a sale comes through their link.
--
-- This adds the two missing halves and nothing else:
--
--   1. a rate rule an operator can set, on the influencer rules table that
--      already exists, rather than a second rules table beside it;
--   2. an engine that turns a paid order into a commission row in
--      partner_commissions - the canonical ledger the platform already keeps for
--      affiliates, authors, vendors and influencers - fired by the same
--      after-update trigger pattern the reseller engine uses.
--
-- No rate is invented here. What an influencer is paid is the owner's decision,
-- so the engine records nothing and says "no rate configured" until a rule
-- exists. A commission that appeared without anyone setting a rate would be a
-- fabricated number moving real money.

-- ------------------------------------------------------------------- the rule
--
-- influencer_compensation_rules already holds what an influencer is paid per
-- click, view, conversion or engagement on a campaign. A marketplace sale is
-- the same kind of statement - a rate, a currency, an eligibility - so it goes
-- here rather than into a competing table.
--
-- Three things were in the way and each is widened, never narrowed:
--   * campaign_id was NOT NULL, so no rule could apply to the programme as a
--     whole. A marketplace sale has no marketing campaign behind it.
--   * the metric vocabulary had no term for a share of a sale.
--   * there was no way to say "this rate is for this product" or "for this
--     category", which reseller_commission_rules has had from the start.

alter table public.influencer_compensation_rules
  alter column campaign_id drop not null;

alter table public.influencer_compensation_rules
  add column if not exists product_id uuid references public.marketplace_products(id) on delete cascade,
  -- Left without a foreign key deliberately: reseller_commission_rules.category_id
  -- is the same, and the two must agree.
  add column if not exists category_id uuid,
  add column if not exists fixed_amount numeric(20,4) not null default 0,
  add column if not exists priority integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

alter table public.influencer_compensation_rules
  drop constraint if exists influencer_compensation_rules_metric_check;
alter table public.influencer_compensation_rules
  add constraint influencer_compensation_rules_metric_check
  check (metric = any (array['click','view','conversion','engagement','fixed','sale_percent']));

-- The existing UNIQUE (campaign_id, platform, metric) stops counting once
-- campaign_id is null, because in SQL null is never equal to null - so without
-- this a programme-wide rule could be entered twice and the engine would have
-- to choose between them.
create unique index if not exists influencer_comp_rules_programme_key
  on public.influencer_compensation_rules (
    platform, metric,
    coalesce(product_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where campaign_id is null;

comment on column public.influencer_compensation_rules.priority is
  'Higher wins where two rules could both apply. Specificity decides first: a product rule beats a category rule, which beats a programme-wide rule.';

-- --------------------------------------------------------------- the rate for
--
-- The rate that applies to one line of one order, and if none applies, the
-- reason - so a commission that was not created can be explained rather than
-- silently missing. Mirrors reseller_rate_for(), which does this for resellers.
create or replace function public.influencer_rate_for(
  p_product uuid,
  p_category uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
begin
  select c.* into r
    from (
      select rr.id, rr.rate, rr.fixed_amount, rr.currency, rr.priority, rr.eligibility,
             case
               when rr.product_id is not null and rr.product_id = p_product then 3
               when rr.category_id is not null and rr.category_id = p_category then 2
               when rr.product_id is null and rr.category_id is null then 1
               else 0
             end as specificity
        from public.influencer_compensation_rules rr
       where rr.active
         and rr.metric = 'sale_percent'
         and rr.campaign_id is null
    ) c
   where c.specificity > 0
   order by c.specificity desc, c.priority desc
   limit 1;

  if not found then
    return jsonb_build_object(
      'rate_percent', null,
      'reason', 'no influencer sale_percent rule is configured, so nothing was credited');
  end if;

  return jsonb_build_object(
    'rule_id', r.id,
    'rate_percent', r.rate,
    'fixed_amount', r.fixed_amount,
    'currency', r.currency,
    'eligibility', r.eligibility,
    'matched', case r.specificity when 3 then 'product' when 2 then 'category' else 'programme' end);
end;
$$;

revoke all on function public.influencer_rate_for(uuid, uuid) from public;
grant execute on function public.influencer_rate_for(uuid, uuid) to authenticated, service_role;

-- ------------------------------------------------------------------ the engine
--
-- One paid order in, commission rows out, in partner_commissions. Written to
-- follow reseller_commissions_for_order() line for line, because the two should
-- behave the same way and a reader who knows one should recognise the other:
--
--   * a per-line idempotency key, so a retried settlement or a duplicate
--     webhook cannot pay twice;
--   * the rule kept as a snapshot, so the figure can be explained months later
--     after the rule has changed;
--   * self-referral refused and recorded, not quietly paid;
--   * an influencer who is not active does not earn;
--   * the reason recorded whenever nothing was created.
create or replace function public.influencer_commissions_for_order(p_order uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_att record; v_item record; v_rate jsonb; v_amount numeric;
  v_created integer := 0; v_skipped integer := 0;
  v_user uuid; v_buyer uuid; v_notes text[] := '{}';
  v_key text;
begin
  select a.*, p.user_id as influencer_user, p.status as influencer_status
    into v_att
    from public.marketplace_order_attributions a
    join public.influencer_profiles p on p.id = a.influencer_profile_id
   where a.order_id = p_order and a.influencer_profile_id is not null
   limit 1;

  if not found then
    return jsonb_build_object('ok', true, 'created', 0,
      'reason', 'no influencer attribution on this order');
  end if;

  select buyer_id into v_buyer from public.marketplace_orders where id = p_order;
  v_user := v_att.influencer_user;

  -- An influencer buying through their own link.
  if v_user is not null and v_user = v_buyer then
    perform public.mm_audit('influencer.self_referral_blocked', 'marketplace_order',
      p_order::text, null,
      jsonb_build_object('influencer_profile_id', v_att.influencer_profile_id, 'buyer_id', v_buyer),
      'The buyer owns the referring influencer account.');
    return jsonb_build_object('ok', false, 'created', 0, 'reason', 'self_referral');
  end if;

  if v_att.influencer_status <> 'active' then
    return jsonb_build_object('ok', false, 'created', 0, 'reason', 'influencer_not_active');
  end if;

  for v_item in
    select i.id, i.product_id, i.line_total, i.currency, pr.category_id
      from public.marketplace_order_items i
      left join public.marketplace_products pr on pr.id = i.product_id
     where i.order_id = p_order
  loop
    v_key := 'influencer_commission:' || v_item.id::text || ':' || v_att.influencer_profile_id::text;

    -- Scoped the way the unique index is scoped: partner_commissions_once is
    -- on (partner_kind, partner_id, idempotency_key).
    if exists (select 1 from public.partner_commissions
                where partner_kind = 'influencer'
                  and partner_id = v_att.influencer_profile_id
                  and idempotency_key = v_key) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_rate := public.influencer_rate_for(v_item.product_id, v_item.category_id);
    if (v_rate->>'rate_percent') is null then
      v_skipped := v_skipped + 1;
      v_notes := v_notes || (v_rate->>'reason');
      continue;
    end if;

    v_amount := round(
      coalesce(v_item.line_total, 0) * (v_rate->>'rate_percent')::numeric / 100
      + coalesce((v_rate->>'fixed_amount')::numeric, 0), 2);

    insert into public.partner_commissions
      (partner_kind, partner_id, order_id, order_item_id, attribution_id,
       gross_amount, commission_amount, currency, rule_snapshot, status, idempotency_key)
    values ('influencer', v_att.influencer_profile_id, p_order, v_item.id, v_att.id,
            coalesce(v_item.line_total, 0), v_amount,
            upper(coalesce(nullif(v_item.currency, ''), v_rate->>'currency', 'INR')),
            v_rate, 'pending', v_key)
    -- No conflict target: partner_commissions_once is a partial index, which
    -- cannot be inferred by ON CONFLICT, and a bare DO NOTHING covers it.
    on conflict do nothing;

    if found then v_created := v_created + 1; else v_skipped := v_skipped + 1; end if;
  end loop;

  if v_created > 0 then
    perform public.mm_audit('influencer.commission_recorded', 'influencer',
      v_att.influencer_profile_id::text, null,
      jsonb_build_object('order_id', p_order, 'lines', v_created), null);

    if v_user is not null then
      perform public.mm_notify('influencer.commission',
        'You earned commission on a sale',
        format('%s line(s) from a new order have been credited to you, and enter the holding period now.', v_created),
        v_user, null, '/dashboard/influencer', 'View', 5, 'success');
    end if;
  end if;

  return jsonb_build_object('ok', true, 'created', v_created, 'skipped', v_skipped,
    'influencer_profile_id', v_att.influencer_profile_id,
    'notes', to_jsonb(v_notes));
end;
$$;

revoke all on function public.influencer_commissions_for_order(uuid) from public;
grant execute on function public.influencer_commissions_for_order(uuid) to service_role;

-- --------------------------------------------------------------- when it fires
--
-- On the order becoming paid, and only then: not when a payment is started, and
-- not when a browser reaches a success page. Its own trigger beside the reseller
-- one, so a failure in either cannot stop the other or block the payment being
-- recorded.
create or replace function public.influencer_on_order_paid()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'paid' and coalesce(old.status, '') <> 'paid' then
    begin
      perform public.influencer_commissions_for_order(new.id);
    exception when others then
      perform public.mm_audit('influencer.commission_failed', 'marketplace_order',
        new.id::text, null, jsonb_build_object('error', sqlerrm), null);
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists influencer_commission_on_paid on public.marketplace_orders;
create trigger influencer_commission_on_paid
  after update on public.marketplace_orders
  for each row execute function public.influencer_on_order_paid();

-- ------------------------------------------------------------ lead attribution
--
-- A lead that arrived through an influencer's link could not be told from any
-- other lead: the leads table carries utm fields and a referrer, but nothing
-- that names the partner who sent the person. This is the same additive shape
-- the orders side already uses.
alter table public.leads
  add column if not exists influencer_profile_id uuid references public.influencer_profiles(id) on delete set null,
  add column if not exists referral_code_id uuid references public.marketplace_referral_codes(id) on delete set null;

create index if not exists leads_influencer_idx
  on public.leads(influencer_profile_id, created_at desc)
  where influencer_profile_id is not null;

comment on column public.leads.influencer_profile_id is
  'The influencer whose referral link brought this lead in. Resolved on the server from the visitor''s referral session, never from anything the browser claims.';
