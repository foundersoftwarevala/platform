-- Aggregate marketplace dashboard and referral reads in PostgreSQL. These
-- functions are called only by authenticated server handlers using service_role.

create or replace function public.marketplace_home_category_counts()
returns table (category_id uuid, product_count bigint)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p.category_id, count(*)
    from public.marketplace_products p
   where p.visible is true
     and p.category_id is not null
   group by p.category_id;
$$;

create or replace function public.marketplace_referral_link_analytics(
  p_code_ids uuid[],
  p_partner_kind text,
  p_partner_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  result jsonb;
begin
  if p_partner_kind not in ('affiliate', 'influencer') then
    raise exception 'unsupported referral partner kind';
  end if;

  with codes as (
    select distinct unnest(coalesce(p_code_ids, '{}'::uuid[])) as id
  ),
  sessions as (
    select s.referral_code_id as code_id,
           count(*)::bigint as visitors,
           coalesce(sum(
             case
               when s.metadata ->> 'clicks' ~ '^[0-9]+$'
                 then least((s.metadata ->> 'clicks')::numeric, 2147483647)
               else 1
             end
           ), 0)::bigint as clicks,
           count(*) filter (where s.converted_order_id is not null)::bigint as conversions
      from public.marketplace_referral_sessions s
      join codes c on c.id = s.referral_code_id
     group by s.referral_code_id
  ),
  code_commissions as (
    select a.referral_code_id as code_id,
           pc.status,
           pc.currency::text as currency,
           sum(pc.commission_amount) as amount,
           count(*)::bigint as lines
      from public.partner_commissions pc
      join public.marketplace_order_attributions a on a.id = pc.attribution_id
      join codes c on c.id = a.referral_code_id
     where pc.partner_kind::text = p_partner_kind
       and pc.partner_id = p_partner_id
     group by a.referral_code_id, pc.status, pc.currency
  ),
  partner_commissions as (
    select pc.status, pc.currency::text as currency,
           sum(pc.commission_amount) as amount, count(*)::bigint as lines
      from public.partner_commissions pc
     where pc.partner_kind::text = p_partner_kind
       and pc.partner_id = p_partner_id
     group by pc.status, pc.currency
  )
  select jsonb_build_object(
    'links', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'visitors', coalesce(s.visitors, 0),
        'clicks', coalesce(s.clicks, 0),
        'conversions', coalesce(s.conversions, 0),
        'commissions', coalesce((
          select jsonb_agg(jsonb_build_object(
            'status', cm.status,
            'currency', cm.currency,
            'amount', cm.amount,
            'lines', cm.lines
          ) order by cm.status, cm.currency)
            from code_commissions cm
           where cm.code_id = c.id
        ), '[]'::jsonb)
      ) order by c.id)
        from codes c
        left join sessions s on s.code_id = c.id
    ), '[]'::jsonb),
    'commissions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'status', status,
        'currency', currency,
        'amount', amount,
        'lines', lines
      ) order by status, currency)
        from partner_commissions
    ), '[]'::jsonb)
  )
    into result;

  return result;
end;
$$;

create or replace function public.marketplace_seller_metrics_summary(
  p_seller_id uuid,
  p_start_day timestamptz,
  p_start_month timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with products as (
    select count(*) filter (where p.visible is true)::bigint as published,
           count(*) filter (where p.moderation_status in ('draft', 'changes_requested', 'rejected'))::bigint as drafts,
           count(*) filter (where p.moderation_status in ('submitted', 'under_review'))::bigint as in_review,
           coalesce(sum(p.downloads), 0)::bigint as downloads
      from public.marketplace_products p
     where p.seller_id = p_seller_id
  ),
  seller_orders as (
    select distinct o.id, o.status, o.buyer_id, o.created_at
      from public.marketplace_order_items i
      join public.marketplace_orders o on o.id = i.order_id
     where i.seller_id = p_seller_id
  ),
  buyer_orders as (
    select buyer_id, count(*) as order_count
      from seller_orders
     where status = 'paid' and buyer_id is not null
     group by buyer_id
  ),
  commissions as (
    select c.id, c.order_item_id, c.gross_amount, c.seller_amount,
           c.status, c.created_at,
           coalesce(nullif(upper(trim(i.currency)), ''),
                    nullif(upper(trim(c.rule_snapshot ->> 'currency')), ''),
                    'UNKNOWN') as currency
      from public.marketplace_commissions c
      left join public.marketplace_order_items i on i.id = c.order_item_id
     where c.seller_id = p_seller_id
  ),
  revenue as (
    select currency,
           sum(gross_amount) filter (where status <> 'reversed') as total,
           sum(gross_amount) filter (where status <> 'reversed' and created_at >= p_start_day) as today,
           sum(gross_amount) filter (where status <> 'reversed' and created_at >= p_start_month) as month,
           sum(seller_amount) filter (where status <> 'reversed') as commission
      from commissions
     group by currency
  ),
  recent as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id,
      'order_item_id', c.order_item_id,
      'gross_amount', c.gross_amount,
      'seller_amount', c.seller_amount,
      'status', c.status,
      'created_at', c.created_at,
      'currency', c.currency
    ) order by c.created_at desc, c.id desc), '[]'::jsonb) as rows
      from (
        select * from commissions order by created_at desc, id desc limit 50
      ) c
  )
  select jsonb_build_object(
    'products', (select to_jsonb(products) from products),
    'orders', jsonb_build_object(
      'today', (select count(*) from seller_orders where created_at >= p_start_day),
      'pending', (select count(*) from seller_orders where status = 'pending_payment'),
      'completed', (select count(*) from seller_orders where status = 'paid'),
      'cancelled', (select count(*) from seller_orders where status in ('cancelled', 'payment_failed')),
      'sales', (select count(*) from commissions where status <> 'reversed'),
      'returns', (select count(*) from commissions where status = 'reversed'),
      'customers', (select count(*) from buyer_orders),
      'repeat_customers', (select count(*) from buyer_orders where order_count > 1)
    ),
    'revenue_by_currency', coalesce((
      select jsonb_agg(jsonb_build_object('currency', currency, 'amount', total) order by currency)
        from revenue
    ), '[]'::jsonb),
    'revenue_today_by_currency', coalesce((
      select jsonb_agg(jsonb_build_object('currency', currency, 'amount', today) order by currency)
        from revenue where today is not null
    ), '[]'::jsonb),
    'revenue_month_by_currency', coalesce((
      select jsonb_agg(jsonb_build_object('currency', currency, 'amount', month) order by currency)
        from revenue where month is not null
    ), '[]'::jsonb),
    'commissions_by_currency', coalesce((
      select jsonb_agg(jsonb_build_object('currency', currency, 'amount', commission) order by currency)
        from revenue
    ), '[]'::jsonb),
    'recent_activities', (select rows from recent)
  );
$$;

create or replace function public.marketplace_author_earnings_summary(p_seller_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with commissions as (
    select c.id, c.order_item_id, c.gross_amount, c.commission_amount,
           c.seller_amount, c.status, c.created_at,
           coalesce(nullif(upper(trim(c.rule_snapshot ->> 'currency')), ''), 'UNKNOWN') as currency
      from public.marketplace_commissions c
     where c.seller_id = p_seller_id
  ),
  payouts as (
    select p.id, p.amount, p.currency, p.status, p.created_at, p.provider_reference
      from public.marketplace_payouts p
     where p.seller_id = p_seller_id
  ),
  currencies as (
    select currency from commissions
    union
    select upper(trim(currency)) from payouts
  ),
  commission_totals as (
    select cur.currency,
           coalesce(sum(c.gross_amount) filter (where c.status <> 'reversed'), 0) as gross,
           coalesce(sum(c.commission_amount) filter (where c.status <> 'reversed'), 0) as platform_fee,
           coalesce(sum(c.seller_amount) filter (where c.status <> 'reversed'), 0) as earned,
           coalesce(sum(c.seller_amount) filter (where c.status = 'pending'), 0) as pending,
           coalesce(sum(c.seller_amount) filter (where c.status in ('approved', 'payable')), 0) as approved,
           coalesce(sum(c.seller_amount) filter (where c.status = 'reversed'), 0) as reversed
      from currencies cur
      left join commissions c on c.currency = cur.currency
     group by cur.currency
  ),
  payout_totals as (
    select upper(trim(currency)) as currency,
           coalesce(sum(amount) filter (where status in ('paid', 'completed')), 0) as paid_out,
           coalesce(sum(amount) filter (where status in ('pending', 'processing')), 0) as pending_payout
      from payouts
     group by upper(trim(currency))
  ),
  totals as (
    select c.*, coalesce(p.paid_out, 0) as paid_out,
           coalesce(p.pending_payout, 0) as pending_payout
      from commission_totals c
      left join payout_totals p using (currency)
  ),
  recent_commissions as (
    select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at desc, c.id desc), '[]'::jsonb) as rows
      from (select * from commissions order by created_at desc, id desc limit 50) c
  ),
  recent_payouts as (
    select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at desc, p.id desc), '[]'::jsonb) as rows
      from (select * from payouts order by created_at desc, id desc limit 50) p
  ),
  activities as (
    select coalesce(jsonb_agg(entry order by created_at desc, id desc), '[]'::jsonb) as rows
      from (
        select c.id, c.created_at,
               jsonb_build_object('type', 'commission', 'id', c.id, 'created_at', c.created_at,
                 'status', c.status, 'currency', c.currency, 'amount', c.seller_amount,
                 'order_item_id', c.order_item_id) as entry
          from commissions c
        union all
        select p.id, p.created_at,
               jsonb_build_object('type', 'payout', 'id', p.id, 'created_at', p.created_at,
                 'status', p.status, 'currency', p.currency, 'amount', p.amount,
                 'provider_reference', p.provider_reference) as entry
          from payouts p
        order by created_at desc, id desc
        limit 50
      ) combined
  )
  select jsonb_build_object(
    'product_count', (select count(*) from public.marketplace_products where seller_id = p_seller_id),
    'sales', (select count(*) from commissions where status <> 'reversed'),
    'refunded', (select count(*) from commissions where status = 'reversed'),
    'totals_by_currency', coalesce((
      select jsonb_agg(jsonb_build_object(
        'currency', currency,
        'gross', gross,
        'platformFee', platform_fee,
        'earned', earned,
        'pending', pending,
        'approved', approved,
        'reversed', reversed,
        'paidOut', paid_out,
        'pendingPayout', pending_payout,
        'available', earned - paid_out - pending_payout
      ) order by currency) from totals
    ), '[]'::jsonb),
    'commissions', (select rows from recent_commissions),
    'payouts', (select rows from recent_payouts),
    'activities', (select rows from activities)
  );
$$;

revoke all on function public.marketplace_home_category_counts() from public, anon, authenticated;
revoke all on function public.marketplace_referral_link_analytics(uuid[], text, uuid) from public, anon, authenticated;
revoke all on function public.marketplace_seller_metrics_summary(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.marketplace_author_earnings_summary(uuid) from public, anon, authenticated;
grant execute on function public.marketplace_home_category_counts() to service_role;
grant execute on function public.marketplace_referral_link_analytics(uuid[], text, uuid) to service_role;
grant execute on function public.marketplace_seller_metrics_summary(uuid, timestamptz, timestamptz) to service_role;
grant execute on function public.marketplace_author_earnings_summary(uuid) to service_role;

notify pgrst, 'reload schema';
