-- An influencer's QR code for a product.
--
-- The platform already has one QR register - product_qr_codes, with
-- product_qr_events beside it for scans, and /api/qr/{code}.png rendering the
-- image server-side from target_url. It was operator-only and product-scoped: a
-- QR pointing at a product's canonical URL, with no owner.
--
-- An influencer's QR is the same object with two more facts attached: whose it
-- is, and which referral code it carries. So it goes in the same register rather
-- than a second one, and the image route renders it with no change at all.
--
-- One QR per influencer per product, enforced by a unique index. That is what
-- makes attribution deterministic: a scan resolves to exactly one influencer and
-- one product, and a second request for the same pair returns the QR that
-- already exists instead of minting a rival.

alter table public.product_qr_codes
  add column if not exists influencer_profile_id uuid references public.influencer_profiles(id) on delete cascade,
  add column if not exists referral_code_id uuid references public.marketplace_referral_codes(id) on delete set null;

create unique index if not exists product_qr_codes_influencer_product_once
  on public.product_qr_codes(influencer_profile_id, product_id)
  where influencer_profile_id is not null;

create index if not exists product_qr_codes_influencer_idx
  on public.product_qr_codes(influencer_profile_id, created_at desc)
  where influencer_profile_id is not null;

comment on column public.product_qr_codes.influencer_profile_id is
  'The influencer this QR belongs to. Null for the operator-generated product QRs this table was built for.';

-- ------------------------------------------------------------------ the scan
--
-- Recording a scan needs two things done together: an event row, and the
-- counter on the QR moved forward. PostgREST cannot express
-- `scan_count = scan_count + 1`, so a scan through the API alone would either
-- lose the count or race with another scan. This does both in one statement and
-- returns where the scanner should be sent.
--
-- What is stored is traffic, not a person: a coarse country, a device class, a
-- browser family and a one-way hash, with the row's own purge date, exactly as
-- product_qr_events was designed for.
create or replace function public.product_qr_register_scan(
  p_code text,
  p_country text default null,
  p_device text default null,
  p_browser text default null,
  p_visitor_hash text default null,
  p_campaign text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  q record;
begin
  select id, product_id, target_url, influencer_profile_id
    into q
    from public.product_qr_codes
   where qr_code = p_code and active
   limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_or_inactive_code');
  end if;

  insert into public.product_qr_events
    (qr_id, product_id, campaign, country, device_type, browser, visitor_hash)
  values (q.id, q.product_id, p_campaign,
          nullif(upper(left(coalesce(p_country, ''), 2)), ''),
          nullif(left(coalesce(p_device, ''), 24), ''),
          nullif(left(coalesce(p_browser, ''), 40), ''),
          nullif(left(coalesce(p_visitor_hash, ''), 64), ''));

  update public.product_qr_codes
     set scan_count = coalesce(scan_count, 0) + 1,
         last_scan_at = now()
   where id = q.id;

  return jsonb_build_object(
    'ok', true,
    'target_url', q.target_url,
    'qr_id', q.id,
    'product_id', q.product_id,
    'influencer_profile_id', q.influencer_profile_id);
end;
$$;

revoke all on function public.product_qr_register_scan(text, text, text, text, text, text) from public;
grant execute on function public.product_qr_register_scan(text, text, text, text, text, text) to service_role;

comment on function public.product_qr_register_scan is
  'Records one scan of a QR and returns where to send the scanner. Counter and event move together, so a burst of scans cannot lose a count.';

-- -------------------------------------------------- what an influencer's QRs did
--
-- Counted in SQL, per QR, so the portal never adds up event rows in the browser.
create or replace function public.influencer_qr_performance()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '28000';
  end if;

  select id into v_profile from public.influencer_profiles
   where user_id = auth.uid() order by created_at limit 1;
  if v_profile is null then
    return jsonb_build_object('qr_codes', '[]'::jsonb);
  end if;

  return jsonb_build_object('qr_codes', coalesce((
    select jsonb_agg(jsonb_build_object(
             'qr_code', q.qr_code,
             'product_id', q.product_id,
             'product_name', p.name,
             'product_slug', p.slug,
             'target_url', q.target_url,
             'active', q.active,
             'scans', coalesce(q.scan_count, 0),
             'last_scan_at', q.last_scan_at,
             'image_png', '/api/qr/' || q.qr_code || '.png',
             'image_svg', '/api/qr/' || q.qr_code || '.svg',
             'created_at', q.created_at)
           order by q.created_at desc)
      from public.product_qr_codes q
      left join public.marketplace_products p on p.id = q.product_id
     where q.influencer_profile_id = v_profile), '[]'::jsonb));
end;
$$;

revoke all on function public.influencer_qr_performance() from public;
grant execute on function public.influencer_qr_performance() to authenticated;
