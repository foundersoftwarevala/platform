-- A QR that pointed at itself.
--
-- The influencer QR stores the scan route in target_url, because that is what
-- the image must encode: /api/qr/{code}.png renders from target_url, and a scan
-- only gets counted if the thing scanned comes back through the server.
--
-- product_qr_register_scan() then returned that same target_url as the place to
-- send the scanner - which is the scan route again. Anybody scanning one would
-- have been redirected to the route they had just come from, forever. Nobody
-- has scanned one yet, because the route itself was never written; this is
-- fixed before the first QR is printed rather than after.
--
-- The destination is not stored twice. It is derived from what the row already
-- holds - the product it is for and the referral code it carries - so the two
-- can never drift apart, and an influencer's code changing does not leave a
-- printed QR pointing at the old one.

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
  v_destination text;
begin
  select qc.id, qc.product_id, qc.target_url, qc.influencer_profile_id,
         p.slug as product_slug,
         rc.code as referral_code
    into q
    from public.product_qr_codes qc
    left join public.marketplace_products p on p.id = qc.product_id
    left join public.marketplace_referral_codes rc
           on rc.id = qc.referral_code_id and rc.active
   where qc.qr_code = p_code and qc.active
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

  -- Where the scanner goes. Built from the row, never from target_url, which
  -- is the scan route itself.
  v_destination := case
    when q.product_slug is null then '/marketplace'
    when q.referral_code is null then '/marketplace/product/' || q.product_slug
    else '/marketplace/product/' || q.product_slug || '?ref=' || q.referral_code
  end;

  return jsonb_build_object(
    'ok', true,
    'destination', v_destination,
    'qr_id', q.id,
    'product_id', q.product_id,
    'product_slug', q.product_slug,
    'referral_code', q.referral_code,
    'influencer_profile_id', q.influencer_profile_id);
end;
$$;

revoke all on function public.product_qr_register_scan(text, text, text, text, text, text) from public;
grant execute on function public.product_qr_register_scan(text, text, text, text, text, text) to service_role;

comment on function public.product_qr_register_scan is
  'Records one scan and returns where to send the scanner, derived from the QR''s product and referral code. Counter and event move together, so a burst of scans cannot lose a count.';
