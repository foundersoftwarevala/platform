-- Keep influencer-manager RPCs and direct table access within the
-- admin/boss-only policy established by influencer_manager_access().

begin;

create or replace function public.mm_influencers(p_query jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_search text := nullif(btrim(coalesce(p_query->>'search','')), '');
  v_status text := nullif(p_query->>'status','');
  v_limit integer := least(greatest(coalesce((p_query->>'limit')::int, 50), 1), 200);
begin
  if not public.influencer_manager_access() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  return jsonb_build_object(
    'ok', true,
    'creators', (select count(*) from public.influencer_profiles),
    'by_status', coalesce((
      select jsonb_object_agg(coalesce(status,'unknown'), n)
      from (select status, count(*) n from public.influencer_profiles group by status) t
    ), '{}'::jsonb),
    'applications', (select count(*) from public.influencer_applications),
    'social_accounts', (select count(*) from public.influencer_social_accounts),
    'declared_followers', (select coalesce(sum(followers),0)
                           from public.influencer_social_accounts),
    'verified_accounts', (select count(*) from public.influencer_social_accounts
                           where verification_status = 'verified'),
    'agreements', (select count(*) from public.influencer_agreements),
    'assignments', (select count(*) from public.influencer_campaign_assignments),
    'earnings_gross', (select coalesce(sum(gross_amount),0)
                       from public.influencer_earnings),
    'earnings_net', (select coalesce(sum(net_amount),0)
                     from public.influencer_earnings),
    'payouts_total', (select coalesce(sum(amount),0) from public.influencer_payouts),
    'payouts_paid', (select coalesce(sum(amount),0) from public.influencer_payouts
                     where status = 'paid'),
    'payouts_pending', (select coalesce(sum(amount),0) from public.influencer_payouts
                        where status in ('pending','approved','processing')),
    'referral_codes', (select count(*) from public.marketplace_referral_codes
                       where influencer_profile_id is not null),
    'sessions', (select count(*) from public.marketplace_referral_sessions
                 where influencer_profile_id is not null),
    'conversions', (select count(*) from public.marketplace_order_attributions
                    where influencer_profile_id is not null),
    'unavailable', jsonb_build_object(
      'verified_reach', 'Follower and engagement figures are the creator''s own declaration from their application. No social platform API is connected, so none of them has been confirmed or refreshed since.',
      'roi', 'ROI compares attributed revenue against recorded spend. Attribution now runs at checkout, so this fills in once a referred order is paid.'
    ),
    'profiles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.full_name, 'email', p.email,
        'country', p.country, 'region', p.region, 'niche', p.niche,
        'status', p.status, 'created_at', p.created_at,
        'social_accounts', (select count(*) from public.influencer_social_accounts s
                            where s.profile_id = p.id),
        'referral_codes', (select count(*) from public.marketplace_referral_codes c
                           where c.influencer_profile_id = p.id),
        'earnings_net', (select coalesce(sum(e.net_amount),0)
                         from public.influencer_earnings e where e.profile_id = p.id),
        'payouts_paid', (select coalesce(sum(o.amount),0)
                         from public.influencer_payouts o
                         where o.profile_id = p.id and o.status='paid')
      ) order by p.created_at desc)
      from (
        select * from public.influencer_profiles p2
        where (v_status is null or p2.status = v_status)
          and (v_search is null
               or p2.full_name ilike '%'||v_search||'%'
               or coalesce(p2.email,'') ilike '%'||v_search||'%'
               or coalesce(p2.niche,'') ilike '%'||v_search||'%')
        order by p2.created_at desc
        limit v_limit
      ) p
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.mm_influencer_code_create(
  p_profile uuid, p_code text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp, extensions
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_name text;
  v_code text;
  v_bytes bytea;
  i integer;
  v_row jsonb;
begin
  if not public.influencer_manager_access() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select full_name into v_name from public.influencer_profiles where id = p_profile;
  if v_name is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_influencer');
  end if;

  if p_code is not null and btrim(p_code) <> '' then
    v_code := upper(regexp_replace(btrim(p_code), '[^A-Za-z0-9-]', '', 'g'));
    if length(v_code) < 3 then
      return jsonb_build_object('ok', false, 'reason', 'code_too_short');
    end if;
    if exists (select 1 from public.marketplace_referral_codes where upper(code) = v_code) then
      return jsonb_build_object('ok', false, 'reason', 'code_taken',
        'message', 'Another referral code already uses that word.');
    end if;
  else
    for attempt in 1..10 loop
      v_code := '';
      v_bytes := gen_random_bytes(8);
      for i in 0..7 loop
        v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % length(v_alphabet)) + 1, 1);
      end loop;
      exit when not exists (
        select 1 from public.marketplace_referral_codes where upper(code) = v_code
      );
      v_code := null;
    end loop;
    if v_code is null then
      return jsonb_build_object('ok', false, 'reason', 'could_not_generate');
    end if;
  end if;

  insert into public.marketplace_referral_codes (influencer_profile_id, code, active)
  values (p_profile, v_code, true)
  returning to_jsonb(marketplace_referral_codes) into v_row;

  perform public.mm_audit('influencer.code_created', 'influencer_profile',
                          p_profile::text, null,
                          jsonb_build_object('code', v_code, 'influencer', v_name), null);

  return jsonb_build_object('ok', true, 'code', v_code, 'row', v_row,
    'share_url', 'https://softwarevala.net/?ref=' || v_code);
end;
$$;

create or replace function public.mm_influencer_status(
  p_profile uuid, p_to text, p_reason text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_before jsonb;
  v_after jsonb;
begin
  if not public.influencer_manager_access() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if p_to not in ('pending','active','suspended','inactive') then
    return jsonb_build_object('ok', false, 'reason', 'unknown_status');
  end if;

  select to_jsonb(p) into v_before
  from public.influencer_profiles p where p.id = p_profile;
  if v_before is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_influencer');
  end if;

  update public.influencer_profiles
  set status = p_to, updated_at = now()
  where id = p_profile
  returning to_jsonb(influencer_profiles) into v_after;

  if p_to in ('suspended','inactive') then
    update public.marketplace_referral_codes
    set active = false, updated_at = now()
    where influencer_profile_id = p_profile and active;
  elsif p_to = 'active' then
    update public.marketplace_referral_codes
    set active = true, updated_at = now()
    where influencer_profile_id = p_profile and not active;
  end if;

  perform public.mm_audit('influencer.' || p_to, 'influencer_profile',
                          p_profile::text, v_before, v_after, p_reason);

  if (v_after->>'user_id') is not null then
    perform public.mm_notify(
      'influencer.' || p_to,
      case p_to when 'active' then 'Your creator account is approved'
                when 'suspended' then 'Your creator account is suspended'
                when 'inactive' then 'Your creator account is now inactive'
                else 'Your creator account status changed' end,
      coalesce(p_reason, ''),
      (v_after->>'user_id')::uuid, null, '/influencer-manager', 'Open',
      5,
      case p_to when 'active' then 'success'
                when 'suspended' then 'danger'
                when 'inactive' then 'warning' else 'info' end
    );
  end if;

  return jsonb_build_object('ok', true, 'influencer', v_after);
end;
$$;

revoke all on function public.mm_influencers(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.mm_influencer_code_create(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.mm_influencer_status(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.mm_influencers(jsonb) to authenticated;
grant execute on function public.mm_influencer_code_create(uuid, text) to authenticated;
grant execute on function public.mm_influencer_status(uuid, text, text) to authenticated;

drop policy if exists influencer_profiles_own on public.influencer_profiles;
create policy influencer_profiles_own on public.influencer_profiles
  for select to authenticated
  using (user_id = auth.uid() or public.influencer_manager_access());

drop policy if exists influencer_profiles_operator on public.influencer_profiles;
create policy influencer_profiles_operator on public.influencer_profiles
  for all to authenticated
  using (public.influencer_manager_access())
  with check (public.influencer_manager_access());

drop policy if exists influencer_earnings_own on public.influencer_earnings;
create policy influencer_earnings_own on public.influencer_earnings
  for select to authenticated
  using (
    public.influencer_manager_access()
    or exists (
      select 1 from public.influencer_profiles p
      where p.id = influencer_earnings.profile_id and p.user_id = auth.uid()
    )
  );

drop policy if exists influencer_payouts_own on public.influencer_payouts;
create policy influencer_payouts_own on public.influencer_payouts
  for select to authenticated
  using (
    public.influencer_manager_access()
    or exists (
      select 1 from public.influencer_profiles p
      where p.id = influencer_payouts.profile_id and p.user_id = auth.uid()
    )
  );

-- Keep direct PostgREST updates from bypassing influencer payout controls.
revoke update on public.partner_payouts from public, anon, authenticated;
revoke update (
  id, partner_kind, partner_id, amount, currency, status, payment_method,
  provider, provider_reference, failure_reason, period_start, period_end,
  idempotency_key, requested_at, approved_at, approved_by, processed_at,
  completed_at, created_at, updated_at
) on public.partner_payouts from public, anon, authenticated;
grant update (
  status, payment_method, provider, provider_reference, failure_reason
) on public.partner_payouts to authenticated;

drop policy if exists "the platform decides a payout" on public.partner_payouts;
create policy "the platform decides a payout" on public.partner_payouts
  for update to authenticated
  using (
    (partner_kind = 'influencer' and public.influencer_manager_access())
    or (partner_kind <> 'influencer' and public.is_platform_operator())
  )
  with check (
    (partner_kind = 'influencer' and public.influencer_manager_access())
    or (partner_kind <> 'influencer' and public.is_platform_operator())
  );

create or replace function public.guard_influencer_payout_transition()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_allowed boolean;
begin
  if old.partner_kind <> 'influencer' and new.partner_kind <> 'influencer' then
    return new;
  end if;

  if new.partner_kind is distinct from old.partner_kind
    or new.partner_id is distinct from old.partner_id then
    raise exception 'An influencer payout cannot be reassigned'
      using errcode = '23514';
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  v_allowed := case old.status
    when 'requested' then new.status in ('approved', 'cancelled')
    when 'approved' then new.status in ('processing', 'failed', 'cancelled')
    when 'processing' then new.status in ('completed', 'failed')
    else false
  end;

  if not coalesce(v_allowed, false) then
    raise exception 'Invalid influencer payout transition: % -> %', old.status, new.status
      using errcode = '23514';
  end if;

  if new.status = 'approved' then
    new.approved_at := coalesce(new.approved_at, now());
    new.approved_by := coalesce(new.approved_by, auth.uid());
  elsif new.status = 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists partner_payouts_influencer_transition on public.partner_payouts;
create trigger partner_payouts_influencer_transition
  before update on public.partner_payouts
  for each row execute function public.guard_influencer_payout_transition();
revoke all on function public.guard_influencer_payout_transition()
  from public, anon, authenticated, service_role;

revoke all on function public.influencer_manager_access() from public, anon;
grant execute on function public.influencer_manager_access() to authenticated, service_role;

commit;
