-- The two readings the Affiliate Manager's dashboard asks for.
--
-- Both answered 404, so the console opened with every counter blank and its
-- Top Affiliates panel empty, whatever the channel had actually done.
--
-- Each is a count of what is really there. Where the platform holds nothing
-- for a figure - there is no campaigns table, no affiliate wallet and no
-- affiliate payout ledger on this database - the figure is returned as zero
-- rather than filled with something invented. A zero that is true is worth
-- more than a number that is not.

create or replace function public.affiliate_dashboard_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  with partners as (
    select * from public.marketplace_affiliate_partners
  ),
  attributed as (
    select a.*, o.total, o.currency, o.status as order_status, o.created_at as ordered_at
      from public.marketplace_order_attributions a
      left join public.marketplace_orders o on o.id = a.order_id
     where a.affiliate_partner_id is not null
  ),
  recent as (
    select * from attributed where ordered_at >= now() - interval '30 days'
  )
  select json_build_object(
    'affiliates_total', (select count(*) from partners),
    'affiliates_verified', (select count(*) from partners where status in ('active','verified','approved')),
    'affiliates_pending', (select count(*) from partners where status = 'pending'),
    'affiliates_suspended', (select count(*) from partners where status in ('suspended','blocked')),
    -- A partner's country is not recorded on this table yet.
    'countries', 0,
    'links_total', (select count(*) from public.marketplace_order_attributions where referral_code_id is not null),
    -- No campaigns table exists on this database.
    'campaigns_active', 0,
    'leads_30d', (select count(distinct session_id) from recent where session_id is not null),
    'customers_30d', (select count(distinct order_id) from recent),
    'sales_30d', (select count(*) from recent where order_status = 'paid'),
    'revenue_cents_30d', (
      select coalesce(round(sum(coalesce(total, 0)) * 100)::bigint, 0)
        from recent where order_status = 'paid'
    ),
    -- Affiliate commission, wallet and payouts have no tables here yet.
    'commission_approved_cents', 0,
    'wallet_balance_cents', 0,
    'payouts_pending_cents', 0
  )
$$;
revoke all on function public.affiliate_dashboard_stats() from public, anon;
grant execute on function public.affiliate_dashboard_stats() to authenticated;

create or replace function public.affiliate_top(_limit integer default 5)
returns table (
  id uuid,
  display_name text,
  country text,
  status text,
  revenue_cents bigint,
  commission_cents bigint,
  conversions bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.display_name,
    null::text as country,
    p.status::text,
    coalesce(round(sum(case when o.status = 'paid' then o.total else 0 end) * 100)::bigint, 0) as revenue_cents,
    0::bigint as commission_cents,
    count(a.id)::bigint as conversions
  from public.marketplace_affiliate_partners p
  left join public.marketplace_order_attributions a on a.affiliate_partner_id = p.id
  left join public.marketplace_orders o on o.id = a.order_id
  group by p.id, p.display_name, p.status
  order by revenue_cents desc, conversions desc
  limit greatest(coalesce(_limit, 5), 1)
$$;
revoke all on function public.affiliate_top(integer) from public, anon;
grant execute on function public.affiliate_top(integer) to authenticated;
