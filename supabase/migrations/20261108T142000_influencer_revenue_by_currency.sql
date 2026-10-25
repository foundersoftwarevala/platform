create or replace function public.influencer_self_revenue_by_currency()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_id uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '28000';
  end if;

  select id into v_profile_id
    from public.influencer_profiles
   where user_id = auth.uid()
   order by created_at
   limit 1;

  if v_profile_id is null then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object('currency', totals.currency, 'amount', totals.amount)
      order by totals.currency
    )
      from (
        select revenue.currency, sum(revenue.amount)::numeric as amount
          from (
            select currency, net_amount as amount
              from public.influencer_earnings
             where profile_id = v_profile_id and status <> 'reversed'
            union all
            select currency, commission_amount as amount
              from public.partner_commissions
             where partner_kind = 'influencer' and partner_id = v_profile_id
          ) revenue
         group by revenue.currency
      ) totals
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.influencer_self_revenue_by_currency() from public, anon;
grant execute on function public.influencer_self_revenue_by_currency() to authenticated;
