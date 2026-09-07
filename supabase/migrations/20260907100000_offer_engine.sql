-- Offer Manager, over the offer tables this project already has.
--
-- No marketplace_offers table is created. Two already exist and both are used
-- for what they were built for:
--
--   marketing_offers            the campaign - title, type, discount, code,
--                               window, status, regions. Holds 6 rows.
--   marketplace_coupons         the checkout coupon - code, kind, value,
--                               currency, minimum_subtotal, max_redemptions.
--                               Holds none yet.
--
-- Every one of those 6 rows carries is_seed = true, and their redemption and
-- revenue figures - 1,842, 214, 86 - are seed values, not measurements. That
-- flag is respected everywhere below:
--
--   * the manager counts seed and real separately and never blends them,
--   * a seed offer can never be published to the storefront,
--   * seed redemptions are never reported as campaign analytics.
--
-- Real redemptions are counted from marketplace_coupon_redemptions, which is
-- the table that actually records a customer using a code.

-- The lifecycle the screen describes. The column is free text today, so this
-- constrains it to the states the manager can actually move an offer through.
alter table public.marketing_offers
  drop constraint if exists marketing_offers_status_ck;
alter table public.marketing_offers
  add constraint marketing_offers_status_ck
  check (status in ('draft','scheduled','active','paused','expired','archived'));

-- Publishing needs somewhere to record who did it and when.
alter table public.marketing_offers add column if not exists published_at timestamptz;
alter table public.marketing_offers add column if not exists published_by uuid;
alter table public.marketing_offers add column if not exists updated_by uuid;
alter table public.marketing_offers add column if not exists updated_at timestamptz default now();
alter table public.marketing_offers add column if not exists priority integer not null default 50;
alter table public.marketing_offers add column if not exists landing_url text;

create index if not exists marketing_offers_status_idx on public.marketing_offers (status);
create index if not exists marketing_offers_window_idx on public.marketing_offers (start_date, end_date);

/* ------------------------------------------------------- what is live now */

-- An offer is live only if it is published, not seed, and inside its window
-- measured against the database clock rather than a browser's.
create or replace function public.mm_offer_is_live(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select o.status = 'active'
       and coalesce(o.is_seed, false) = false
       and (o.start_date is null or o.start_date <= current_date)
       and (o.end_date   is null or o.end_date   >= current_date)
      from public.marketing_offers o where o.id = p_id), false);
$$;

/* ------------------------------------------------------- the manager view */

create or replace function public.mm_offers(p_query jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text := nullif(p_query->>'status','');
  v_search text := nullif(btrim(coalesce(p_query->>'search','')), '');
  v_limit  integer := least(greatest(coalesce((p_query->>'limit')::int, 50), 1), 200);
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  return jsonb_build_object(
    'ok', true,
    -- Seed and real are counted apart, always.
    'total',      (select count(*) from public.marketing_offers),
    'seed',       (select count(*) from public.marketing_offers where coalesce(is_seed,false)),
    'real',       (select count(*) from public.marketing_offers where not coalesce(is_seed,false)),
    'live_now',   (select count(*) from public.marketing_offers o where public.mm_offer_is_live(o.id)),
    'by_status', coalesce((
      select jsonb_agg(jsonb_build_object('status', status, 'count', n) order by n desc)
        from (select status, count(*) n from public.marketing_offers group by status) t), '[]'::jsonb),
    -- Real redemptions, counted from the table that records them. The
    -- redemptions column on marketing_offers is a seed value and is reported
    -- separately, never as a measurement.
    'real_redemptions', (select count(*) from public.marketplace_coupon_redemptions),
    'coupons',          (select count(*) from public.marketplace_coupons),
    'offers', coalesce((
      select jsonb_agg(to_jsonb(o) || jsonb_build_object(
               'live_now', public.mm_offer_is_live(o.id),
               'is_seed', coalesce(o.is_seed, false))
             order by o.created_at desc)
        from (select * from public.marketing_offers o2
               where (v_status is null or o2.status = v_status)
                 and (v_search is null or o2.title ilike '%'||v_search||'%'
                      or coalesce(o2.code,'') ilike '%'||v_search||'%')
               order by created_at desc limit v_limit) o), '[]'::jsonb));
end;
$$;

/* ----------------------------------------------------------- the writes */

create or replace function public.mm_offer_save(p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid := nullif(p_patch->>'id','')::uuid; v_before jsonb; v_after jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  if v_id is not null then
    select to_jsonb(o) into v_before from public.marketing_offers o where o.id = v_id;
    if v_before is null then
      return jsonb_build_object('ok', false, 'reason', 'unknown_offer');
    end if;
  end if;

  if v_id is null then
    insert into public.marketing_offers
      (title, festival, offer_type, discount_percent, code, start_date, end_date,
       status, regions, is_seed, priority, landing_url, updated_by, updated_at)
    values (
      coalesce(nullif(btrim(p_patch->>'title'),''), 'Untitled offer'),
      nullif(p_patch->>'festival',''),
      coalesce(nullif(p_patch->>'offer_type',''), 'discount'),
      nullif(p_patch->>'discount_percent','')::numeric,
      nullif(upper(btrim(coalesce(p_patch->>'code',''))), ''),
      -- start_date is NOT NULL; an offer created without one starts today.
      coalesce(nullif(p_patch->>'start_date','')::date, current_date),
      -- end_date is NOT NULL. An offer created without one runs 30 days;
      -- a promotion that never expires is the wrong default.
      coalesce(nullif(p_patch->>'end_date','')::date, current_date + 30),
      -- A new offer is always a draft. Creating one must not put a promotion
      -- in front of customers before anybody has looked at it.
      'draft',
      -- regions is text[] and NOT NULL, so a JSON array in the patch becomes
      -- one and anything else becomes an empty array: targeted nowhere in
      -- particular rather than unknown.
      case when jsonb_typeof(p_patch->'regions') = 'array'
           then array(select jsonb_array_elements_text(p_patch->'regions'))
           else '{}'::text[] end,
      -- Anything created here is real, never seed.
      false,
      coalesce((p_patch->>'priority')::int, 50),
      nullif(p_patch->>'landing_url',''),
      auth.uid(), now())
    returning to_jsonb(marketing_offers) into v_after;
  else
    update public.marketing_offers o set
      title            = coalesce(nullif(btrim(p_patch->>'title'),''), o.title),
      festival         = case when p_patch ? 'festival' then nullif(p_patch->>'festival','') else o.festival end,
      offer_type       = coalesce(nullif(p_patch->>'offer_type',''), o.offer_type),
      discount_percent = coalesce(nullif(p_patch->>'discount_percent','')::numeric, o.discount_percent),
      code             = case when p_patch ? 'code'
                              then nullif(upper(btrim(p_patch->>'code')),'') else o.code end,
      start_date       = case when p_patch ? 'start_date' then nullif(p_patch->>'start_date','')::date else o.start_date end,
      end_date         = case when p_patch ? 'end_date' then nullif(p_patch->>'end_date','')::date else o.end_date end,
      regions          = case when jsonb_typeof(p_patch->'regions') = 'array'
                              then array(select jsonb_array_elements_text(p_patch->'regions'))
                              else o.regions end,
      priority         = coalesce((p_patch->>'priority')::int, o.priority),
      landing_url      = case when p_patch ? 'landing_url' then nullif(p_patch->>'landing_url','') else o.landing_url end,
      updated_by = auth.uid(), updated_at = now()
    where o.id = v_id
    returning to_jsonb(o) into v_after;
  end if;

  perform public.mm_audit(
    case when v_id is null then 'offer.created' else 'offer.updated' end,
    'marketplace_offer', coalesce(v_id::text, v_after->>'id'), v_before, v_after, null);

  return jsonb_build_object('ok', true, 'offer', v_after);
end;
$$;

-- The lifecycle, with the transitions the screen offers and the validation
-- publishing needs.
create or replace function public.mm_offer_transition(p_id uuid, p_to text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare o record; v_before jsonb; v_after jsonb; v_problems text[] := '{}';
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if p_to not in ('draft','scheduled','active','paused','expired','archived') then
    return jsonb_build_object('ok', false, 'reason', 'unknown_status');
  end if;

  select * into o from public.marketing_offers where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_offer');
  end if;
  v_before := to_jsonb(o);

  -- Going live is the transition that reaches customers, so it is the one
  -- that gets validated.
  if p_to = 'active' then
    if coalesce(o.is_seed, false) then
      v_problems := v_problems || 'This is seed data and cannot be shown to customers.'::text;
    end if;
    if coalesce(btrim(o.title), '') = '' then
      v_problems := v_problems || 'The offer needs a title.'::text;
    end if;
    if o.discount_percent is null or o.discount_percent <= 0 then
      v_problems := v_problems || 'The discount must be greater than zero.'::text;
    end if;
    if o.discount_percent > 100 then
      v_problems := v_problems || 'A percentage discount cannot exceed 100.'::text;
    end if;
    if o.end_date is not null and o.end_date < current_date then
      v_problems := v_problems || 'The offer window has already closed.'::text;
    end if;
    -- Two live offers sharing a code would make the code ambiguous at checkout.
    if o.code is not null and exists (
      select 1 from public.marketing_offers x
       where x.id <> o.id and x.code = o.code and x.status = 'active')
    then
      v_problems := v_problems || 'Another live offer already uses that code.'::text;
    end if;

    if array_length(v_problems, 1) > 0 then
      return jsonb_build_object('ok', false, 'reason', 'validation_failed',
                                'problems', to_jsonb(v_problems));
    end if;
  end if;

  update public.marketing_offers set
    status = p_to,
    published_at = case when p_to = 'active' then coalesce(published_at, now()) else published_at end,
    published_by = case when p_to = 'active' then auth.uid() else published_by end,
    updated_by = auth.uid(), updated_at = now()
  where id = p_id
  returning to_jsonb(marketing_offers) into v_after;

  perform public.mm_audit('offer.' || p_to, 'marketplace_offer', p_id::text,
                          v_before, v_after, p_reason);

  return jsonb_build_object('ok', true, 'offer', v_after,
                            'live_now', public.mm_offer_is_live(p_id));
end;
$$;

/* -------------------------------------------------------- the storefront */

-- What the public banner shows. Seed offers can never appear here, and the
-- window is judged against the database clock.
create or replace function public.sf_active_offers()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'title', o.title,
           'badge', case when o.discount_percent is not null
                         then o.discount_percent::int::text || '% OFF' else null end,
           'code', o.code,
           'href', o.landing_url,
           'ends_at', o.end_date)
         order by o.priority, o.end_date nulls last), '[]'::jsonb)
    from public.marketing_offers o
   where o.status = 'active'
     and coalesce(o.is_seed, false) = false
     and (o.start_date is null or o.start_date <= current_date)
     and (o.end_date   is null or o.end_date   >= current_date);
$$;

revoke all on function public.sf_active_offers() from public;
grant execute on function public.sf_active_offers() to anon, authenticated, service_role;

/* --------------------------------------------------------------- RLS */

alter table public.marketing_offers enable row level security;

drop policy if exists marketing_offers_operator on public.marketing_offers;
create policy marketing_offers_operator on public.marketing_offers
  for all to authenticated
  using (public.mm_is_operator()) with check (public.mm_is_operator());

-- The public reads offers through sf_active_offers(), which filters seed and
-- window itself, so the table needs no anonymous read at all.
drop policy if exists marketing_offers_anon_sel on public.marketing_offers;
create policy marketing_offers_anon_sel on public.marketing_offers
  as restrictive for select to anon using (false);
drop policy if exists marketing_offers_anon_ins on public.marketing_offers;
create policy marketing_offers_anon_ins on public.marketing_offers
  as restrictive for insert to anon with check (false);
drop policy if exists marketing_offers_anon_upd on public.marketing_offers;
create policy marketing_offers_anon_upd on public.marketing_offers
  as restrictive for update to anon using (false) with check (false);
drop policy if exists marketing_offers_anon_del on public.marketing_offers;
create policy marketing_offers_anon_del on public.marketing_offers
  as restrictive for delete to anon using (false);
