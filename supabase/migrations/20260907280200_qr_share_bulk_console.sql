-- Auto Product URL & Sharing, part three: QR, sharing, bulk, analytics.

/* ------------------------------------------------------------- 13/14. QR */

-- Register a QR for a product.
--
-- The image itself is rendered server-side by the qrcode library, which is
-- already a dependency of this project. This records what it encodes and how it
-- is drawn, and gives the QR its own code so a scan can be told apart from a
-- click on the same short link.
create or replace function public.mm_qr_create(p_product uuid, p_short_link uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp, extensions
as $$
declare
  v_s record; v_alphabet constant text :=
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  v_code text; v_bytes bytea; i integer; v_target text; v_row jsonb;
  v_link_id uuid; v_link_code text;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;
  select * into v_s from public.product_url_settings where id;

  -- A QR must encode something that resolves. If there is no canonical URL yet
  -- there is nothing to point at, and inventing one would produce a QR that
  -- goes nowhere.
  if not exists (select 1 from public.product_urls
                  where product_id = p_product and is_canonical and status='active') then
    return jsonb_build_object('ok', false, 'reason','no_canonical_url',
      'message','Generate the canonical URL first. A QR that encodes nothing is worse than no QR.');
  end if;

  -- Tracked with its own variable: reading a field off a record that was never
  -- assigned raises "record is not assigned yet" rather than returning null.
  if p_short_link is not null then
    select id, code into v_link_id, v_link_code from public.product_short_links
     where id = p_short_link and status='active';
  end if;
  if v_link_id is null then
    select id, code into v_link_id, v_link_code from public.product_short_links
     where product_id = p_product and status='active' order by created_at limit 1;
  end if;

  -- Prefer the short link, so a scan is attributable; fall back to canonical.
  v_target := case when v_link_id is not null then public.mm_short_link_url(v_link_code)
                   else v_s.site_url || (select path from public.product_urls
                                          where product_id=p_product and is_canonical and status='active') end;

  for attempt in 1..12 loop
    v_code := '';
    v_bytes := gen_random_bytes(8);
    for i in 0..7 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % length(v_alphabet)) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.product_qr_codes where qr_code = v_code);
    v_code := null;
  end loop;
  if v_code is null then
    return jsonb_build_object('ok', false, 'reason','could_not_generate');
  end if;

  -- One active QR per product; a new one supersedes the old.
  update public.product_qr_codes set active=false where product_id = p_product and active;

  insert into public.product_qr_codes
    (product_id, short_link_id, qr_code, target_url, foreground, background,
     size, error_correction, quiet_zone,
     version, created_by)
  values (p_product, v_link_id, v_code, v_target,
          v_s.qr_foreground, v_s.qr_background, v_s.qr_size,
          v_s.qr_error_correction, v_s.qr_quiet_zone,
          coalesce((select max(version)+1 from public.product_qr_codes where product_id=p_product), 1),
          auth.uid())
  returning to_jsonb(product_qr_codes) into v_row;

  perform public.mm_audit('url.qr_created','product_qr', (v_row->>'id'), null, v_row, null);

  return jsonb_build_object('ok', true, 'qr', v_row, 'target', v_target);
end;
$$;

-- Record a scan. Separate from a click so the two are never conflated.
create or replace function public.mm_qr_scan(
  p_qr_code text, p_country text default null, p_device text default null,
  p_browser text default null, p_visitor_hash text default null,
  p_campaign text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_q record; v_s record;
begin
  select * into v_q from public.product_qr_codes where qr_code = p_qr_code and active;
  if not found then
    return jsonb_build_object('ok', false, 'status', 404, 'reason','unknown_qr');
  end if;
  select * into v_s from public.product_url_settings where id;

  begin
    insert into public.product_qr_events
      (qr_id, product_id, campaign, country, device_type, browser, visitor_hash, purge_after)
    values (v_q.id, v_q.product_id, p_campaign, p_country, p_device, p_browser,
            p_visitor_hash, now() + (v_s.analytics_retention_days || ' days')::interval);
    update public.product_qr_codes
       set scan_count = scan_count + 1, last_scan_at = now() where id = v_q.id;
  exception when others then
    null;
  end;

  return jsonb_build_object('ok', true, 'status', 302, 'destination', v_q.target_url);
end;
$$;

/* ------------------------------------------------------- 20/31. sharing */

-- The share snippets for a product, built from real values only.
create or replace function public.mm_product_share(p_product uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_p record; v_s record; v_url text; v_short text; v_qr record; v_enc text;
begin
  select * into v_p from public.marketplace_products where id = p_product;
  if not found then return jsonb_build_object('ok', false, 'reason','unknown_product'); end if;
  select * into v_s from public.product_url_settings where id;

  select v_s.site_url || path into v_url from public.product_urls
   where product_id = p_product and is_canonical and status='active';
  if v_url is null then
    return jsonb_build_object('ok', false, 'reason','no_canonical_url',
      'message','This product has no canonical URL yet, so there is nothing to share.');
  end if;

  select public.mm_short_link_url(code) into v_short from public.product_short_links
   where product_id = p_product and status='active' order by created_at limit 1;

  select * into v_qr from public.product_qr_codes where product_id=p_product and active;

  v_enc := replace(replace(coalesce(v_short, v_url), ':', '%3A'), '/', '%2F');

  return jsonb_build_object(
    'ok', true,
    'canonical_url', v_url,
    'short_url', v_short,
    'qr_code', v_qr.qr_code,
    'qr_target', v_qr.target_url,
    -- Text built from the product's own name and description. Nothing invented.
    'share_text', format('%s — %s', v_p.name,
      left(coalesce(nullif(btrim(v_p.description),''), 'on the Software Vala marketplace'), 120)),
    'whatsapp', 'https://wa.me/?text=' ||
      replace(replace(v_p.name || ' ' || coalesce(v_short, v_url), ' ', '%20'), ':', '%3A'),
    'facebook', 'https://www.facebook.com/sharer/sharer.php?u=' || v_enc,
    'x', 'https://twitter.com/intent/tweet?url=' || v_enc ||
         '&text=' || replace(v_p.name, ' ', '%20'),
    'linkedin', 'https://www.linkedin.com/sharing/share-offsite/?url=' || v_enc,
    'email', 'mailto:?subject=' || replace(v_p.name, ' ', '%20') ||
             '&body=' || replace(coalesce(v_short, v_url), ':', '%3A'));
end;
$$;

create or replace function public.mm_share_record(
  p_product uuid, p_channel text, p_kind text default 'canonical')
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if p_channel not in ('copy','native','whatsapp','facebook','x','linkedin','email','qr_download') then
    return jsonb_build_object('ok', false, 'reason','unknown_channel');
  end if;
  insert into public.product_share_events (product_id, channel, url_kind, actor_id)
  values (p_product, p_channel, p_kind, auth.uid());
  return jsonb_build_object('ok', true);
end;
$$;

/* --------------------------------------------------- 21/22. bulk jobs */

-- Generate URLs across the catalogue in batches.
--
-- Section 41 forbids doing thousands synchronously in a browser, so this takes
-- a batch at a time and reports exactly what happened to each. The caller loops
-- until `remaining` reaches zero.
create or replace function public.mm_url_bulk(
  p_scope text default 'published', p_batch integer default 200,
  p_job uuid default null, p_ids uuid[] default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_job uuid := p_job; v_r record; v_res jsonb;
  v_done integer := 0; v_ok integer := 0; v_fail integer := 0;
  v_skip integer := 0; v_conf integer := 0; v_total integer; v_remaining integer;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;
  if p_scope not in ('all','selected','category','published','unpublished') then
    return jsonb_build_object('ok', false, 'reason','unknown_scope');
  end if;

  if v_job is null then
    select count(*) into v_total from public.marketplace_products p
     where p.deleted_at is null
       and case p_scope
             when 'published' then p.visible
             when 'unpublished' then not p.visible
             when 'selected' then p.id = any(coalesce(p_ids, '{}'::uuid[]))
             else true end;

    insert into public.product_url_jobs (scope, operation, status, total, actor_id)
    values (p_scope, 'generate', 'running', v_total, auth.uid())
    returning id into v_job;
  end if;

  for v_r in
    select p.id from public.marketplace_products p
     where p.deleted_at is null
       and case p_scope
             when 'published' then p.visible
             when 'unpublished' then not p.visible
             when 'selected' then p.id = any(coalesce(p_ids, '{}'::uuid[]))
             else true end
       -- Only what has not been done yet, so the job is resumable and a retry
       -- cannot double-process anything.
       and not exists (select 1 from public.product_urls u
                        where u.product_id = p.id and u.is_canonical and u.status='active')
     order by p.updated_at desc
     limit greatest(least(p_batch, 1000), 1)
  loop
    v_done := v_done + 1;
    v_res := public.mm_url_generate(v_r.id, 'Bulk generation', v_job);
    if (v_res->>'ok')::boolean then
      v_ok := v_ok + 1;
      if coalesce((v_res->>'collision_handled')::boolean, false) then v_conf := v_conf + 1; end if;
    elsif v_res->>'reason' = 'no_route' then
      v_fail := v_fail + 1;
    else
      v_skip := v_skip + 1;
    end if;
  end loop;

  update public.product_url_jobs
     set processed = processed + v_done, succeeded = succeeded + v_ok,
         failed = failed + v_fail, skipped = skipped + v_skip,
         conflicts = conflicts + v_conf
   where id = v_job;

  select total - processed into v_remaining from public.product_url_jobs where id = v_job;

  if v_done = 0 or v_remaining <= 0 then
    update public.product_url_jobs
       set status = case when failed > 0 then 'partial' else 'succeeded' end,
           finished_at = now()
     where id = v_job;
  end if;

  return jsonb_build_object('ok', true, 'job_id', v_job,
    'batch_processed', v_done, 'succeeded', v_ok, 'failed', v_fail,
    'skipped', v_skip, 'conflicts', v_conf,
    'remaining', greatest(coalesce(v_remaining,0), 0),
    'done', v_done = 0);
end;
$$;

/* ---------------------------------------------------- 32. the console */

create or replace function public.mm_product_urls(p_query jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_search text := nullif(btrim(coalesce(p_query->>'search','')),'');
  v_limit integer := least(greatest(coalesce((p_query->>'limit')::int,50),1),200);
  v_offset integer := greatest(coalesce((p_query->>'offset')::int,0),0);
  v_s record;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;
  select * into v_s from public.product_url_settings where id;

  return jsonb_build_object(
    'ok', true,
    'settings', to_jsonb(v_s),

    -- 47. Where short links actually live, stated rather than assumed.
    'short_domain', jsonb_build_object(
      'configured', v_s.short_link_domain is not null and v_s.short_link_domain_verified,
      'state', case when v_s.short_link_domain is null then 'REQUIRES_CONFIGURATION'
                    when not v_s.short_link_domain_verified then 'REQUIRES_CONFIGURATION'
                    else 'CONNECTED' end,
      'serving_from', case when v_s.short_link_domain is not null and v_s.short_link_domain_verified
                           then v_s.short_link_domain else v_s.site_url || '/s/' end,
      'note', case when v_s.short_link_domain is null or not v_s.short_link_domain_verified
        then 'No vanity short domain is configured, so short links are served from /s/ on the main site. They resolve and record clicks today; a vanity host would only shorten them further.'
        else null end),

    'routes', coalesce((select jsonb_agg(jsonb_build_object(
                 'prefix', prefix, 'note', note, 'verified_at', verified_at))
                 from public.product_url_route_prefixes), '[]'::jsonb),

    -- Counted, never asserted.
    'counts', jsonb_build_object(
      'products', (select count(*) from public.marketplace_products where deleted_at is null),
      'with_canonical', (select count(distinct product_id) from public.product_urls
                          where is_canonical and status='active'),
      'redirects', (select count(*) from public.product_urls where status='redirect'),
      'short_links', (select count(*) from public.product_short_links where status='active'),
      'qr_codes', (select count(*) from public.product_qr_codes where active)),

    'analytics', jsonb_build_object(
      'clicks_total', (select count(*) from public.product_short_link_events),
      'clicks_today', (select count(*) from public.product_short_link_events
                        where created_at >= date_trunc('day', now())),
      'unique_visitors', (select count(distinct visitor_hash) from public.product_short_link_events
                           where visitor_hash is not null),
      'scans_total', (select count(*) from public.product_qr_events),
      'scans_today', (select count(*) from public.product_qr_events
                       where created_at >= date_trunc('day', now())),
      'shares', (select count(*) from public.product_share_events),
      'top_products', coalesce((select jsonb_agg(jsonb_build_object(
                        'product', (select name from public.marketplace_products where id=t.product_id),
                        'clicks', t.n) order by t.n desc)
                        from (select product_id, count(*) n
                                from public.product_short_link_events
                               group by product_id order by n desc limit 10) t), '[]'::jsonb),
      'top_campaigns', coalesce((select jsonb_object_agg(c, n) from (
                        select coalesce(utm_campaign,'(none)') c, count(*) n
                          from public.product_short_link_events
                         group by 1 order by 2 desc limit 10) t), '{}'::jsonb),
      'top_referrers', coalesce((select jsonb_object_agg(r, n) from (
                        select coalesce(nullif(referrer,''),'(direct)') r, count(*) n
                          from public.product_short_link_events
                         group by 1 order by 2 desc limit 10) t), '{}'::jsonb),
      'devices', coalesce((select jsonb_object_agg(d, n) from (
                        select coalesce(device_type,'unknown') d, count(*) n
                          from public.product_short_link_events group by 1) t), '{}'::jsonb),
      'countries', coalesce((select jsonb_object_agg(c, n) from (
                        select coalesce(country,'unknown') c, count(*) n
                          from public.product_short_link_events
                         group by 1 order by 2 desc limit 12) t), '{}'::jsonb)),

    'last_job', (select to_jsonb(j) from (select * from public.product_url_jobs
                   order by started_at desc limit 1) j),

    'total', (select count(*) from public.marketplace_products p where p.deleted_at is null
               and (v_search is null or p.name ilike '%'||v_search||'%' or p.slug ilike '%'||v_search||'%')),

    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
               'product_id', p.id, 'product', p.name, 'visible', p.visible,
               'moderation_status', p.moderation_status,
               'canonical', (select v_s.site_url || u.path from public.product_urls u
                              where u.product_id=p.id and u.is_canonical and u.status='active'),
               'canonical_path', (select u.path from public.product_urls u
                                   where u.product_id=p.id and u.is_canonical and u.status='active'),
               'redirects', (select count(*) from public.product_urls u
                              where u.product_id=p.id and u.status='redirect'),
               'short_code', (select l.code from public.product_short_links l
                               where l.product_id=p.id and l.status='active' order by l.created_at limit 1),
               'short_url', (select public.mm_short_link_url(l.code) from public.product_short_links l
                              where l.product_id=p.id and l.status='active' order by l.created_at limit 1),
               'clicks', (select coalesce(sum(l.click_count),0) from public.product_short_links l
                           where l.product_id=p.id),
               'qr_code', (select q.qr_code from public.product_qr_codes q
                            where q.product_id=p.id and q.active),
               'scans', (select coalesce(q.scan_count,0) from public.product_qr_codes q
                          where q.product_id=p.id and q.active))
             order by p.updated_at desc)
        from (select * from public.marketplace_products p2
               where p2.deleted_at is null
                 and (v_search is null or p2.name ilike '%'||v_search||'%'
                      or p2.slug ilike '%'||v_search||'%')
               order by p2.updated_at desc limit v_limit offset v_offset) p), '[]'::jsonb));
end;
$$;

create or replace function public.mm_url_settings_set(p_patch jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_before jsonb; v_after jsonb; v_pattern text; v_prefix text;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;

  -- 2. A pattern whose prefix nothing serves is refused, because every URL it
  -- produced would be a 404.
  v_pattern := nullif(p_patch->>'canonical_pattern','');
  if v_pattern is not null then
    select prefix into v_prefix from public.product_url_route_prefixes
     where v_pattern like prefix || '/%' order by length(prefix) desc limit 1;
    if v_prefix is null then
      return jsonb_build_object('ok', false, 'reason','no_route',
        'message', format('Nothing serves %s. Add a route for that path before making it the canonical pattern, or every product URL would be a 404.', v_pattern),
        'served_prefixes', (select jsonb_agg(prefix) from public.product_url_route_prefixes));
    end if;
  end if;

  select to_jsonb(s) into v_before from public.product_url_settings s where s.id;

  update public.product_url_settings set
    canonical_pattern = coalesce(v_pattern, canonical_pattern),
    lowercase_hyphenate = coalesce((p_patch->>'lowercase_hyphenate')::boolean, lowercase_hyphenate),
    strip_stop_words = coalesce((p_patch->>'strip_stop_words')::boolean, strip_stop_words),
    include_product_id_suffix = coalesce((p_patch->>'include_product_id_suffix')::boolean, include_product_id_suffix),
    short_link_domain = case when p_patch ? 'short_link_domain'
                             then nullif(p_patch->>'short_link_domain','') else short_link_domain end,
    track_short_link_clicks = coalesce((p_patch->>'track_short_link_clicks')::boolean, track_short_link_clicks),
    generate_qr_on_publish = coalesce((p_patch->>'generate_qr_on_publish')::boolean, generate_qr_on_publish),
    qr_foreground = coalesce(nullif(p_patch->>'qr_foreground',''), qr_foreground),
    qr_background = coalesce(nullif(p_patch->>'qr_background',''), qr_background),
    qr_size = coalesce((p_patch->>'qr_size')::int, qr_size),
    qr_error_correction = coalesce(nullif(p_patch->>'qr_error_correction',''), qr_error_correction),
    analytics_retention_days = coalesce((p_patch->>'analytics_retention_days')::int, analytics_retention_days),
    -- Changing the vanity domain always un-verifies it: a new host has not been
    -- proven to resolve.
    short_link_domain_verified = case when p_patch ? 'short_link_domain' then false
                                      else short_link_domain_verified end,
    updated_by = auth.uid(), updated_at = now()
  where id returning to_jsonb(product_url_settings) into v_after;

  perform public.mm_audit('url.settings_changed','product_url_settings','settings',
                          v_before, v_after, nullif(p_patch->>'reason',''));
  return jsonb_build_object('ok', true, 'settings', v_after);
end;
$$;
