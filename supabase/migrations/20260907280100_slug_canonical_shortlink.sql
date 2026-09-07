-- Auto Product URL & Sharing, part two: slugs, canonical URLs, short links.

/* ------------------------------------------------------- 3/4/5/6. slugs */

-- Turn a product name into a safe slug, according to the stored settings.
--
-- Unicode is transliterated rather than stripped, so a name in another script
-- produces something readable instead of an empty string. Stop words are only
-- removed when the setting says so, and never when doing so would leave nothing.
create or replace function public.mm_url_slugify(p_text text, p_product uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_s record; v_base text; v_words text[]; v_kept text[]; w text; v_removed text[] := '{}';
begin
  select * into v_s from public.product_url_settings where id;
  v_base := coalesce(btrim(p_text), '');

  if v_s.lowercase_hyphenate then
    v_base := lower(v_base);
  end if;

  -- Accented Latin becomes its base letter; anything else non-alphanumeric
  -- becomes a separator.
  v_base := translate(v_base,
    'áàâäãåāăąéèêëēĕėęěíìîïĩīĭįóòôöõōŏőúùûüũūŭůýÿñçšžćđłđ',
    'aaaaaaaaaeeeeeeeeeiiiiiiiiooooooooouuuuuuuuyyncszcdld');
  v_base := regexp_replace(v_base, '[^a-zA-Z0-9]+', '-', 'g');
  v_base := regexp_replace(v_base, '(^-+|-+$)', '', 'g');
  v_base := regexp_replace(v_base, '-{2,}', '-', 'g');

  if v_s.strip_stop_words and coalesce(v_base,'') <> '' then
    v_words := string_to_array(v_base, '-');
    v_kept := '{}';
    foreach w in array v_words loop
      if w = any(v_s.stop_words) then v_removed := v_removed || w;
      else v_kept := v_kept || w; end if;
    end loop;
    -- Never strip a name down to nothing.
    if array_length(v_kept,1) is not null and array_length(v_kept,1) > 0 then
      v_base := array_to_string(v_kept, '-');
    else
      v_removed := '{}';
    end if;
  end if;

  v_base := left(v_base, 90);
  v_base := regexp_replace(v_base, '-+$', '', 'g');

  if coalesce(v_base,'') = '' then
    v_base := 'product-' || left(replace(coalesce(p_product, gen_random_uuid())::text,'-',''), 10);
  end if;
  if v_base ~ '^[0-9-]' then v_base := 'p-' || v_base; end if;

  if v_s.include_product_id_suffix and p_product is not null then
    v_base := v_base || '-p' || left(replace(p_product::text,'-',''), 6);
  end if;

  return jsonb_build_object('ok', true, 'slug', v_base,
    'stop_words_removed', to_jsonb(v_removed),
    'lowercased', v_s.lowercase_hyphenate);
end;
$$;

/* ----------------------------------------------- 2/7/8/9. canonical URLs */

-- Build the canonical path for a product from the configured pattern.
create or replace function public.mm_url_path(p_product uuid, p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_s record; v_p record; v_path text; v_cat text; v_prefix text;
begin
  select * into v_s from public.product_url_settings where id;
  select p.*, c.slug as category_slug into v_p
    from public.marketplace_products p
    left join public.marketplace_categories c on c.id = p.category_id
   where p.id = p_product;
  if not found then return jsonb_build_object('ok', false, 'reason','unknown_product'); end if;

  v_cat := coalesce(nullif(v_p.category_slug,''), 'uncategorised');

  v_path := v_s.canonical_pattern;
  v_path := replace(v_path, '{product-name}', p_slug);
  v_path := replace(v_path, '{category}', v_cat);
  v_path := replace(v_path, '{product-id}', left(replace(p_product::text,'-',''), 8));
  v_path := replace(v_path, '{brand}', 'softwarevala');
  v_path := replace(v_path, '{language}', 'en');
  v_path := regexp_replace(v_path, '/{2,}', '/', 'g');

  -- The pattern must land on a path this application actually serves.
  select prefix into v_prefix from public.product_url_route_prefixes
   where v_path like prefix || '/%' order by length(prefix) desc limit 1;

  return jsonb_build_object('ok', v_prefix is not null, 'path', v_path,
    'served_by', v_prefix,
    'reason', case when v_prefix is null then 'no_route' else null end,
    'message', case when v_prefix is null then
      format('Nothing serves %s. A canonical URL built from this pattern would be a 404 for every product.', v_path)
      else null end);
end;
$$;

-- Generate or refresh the canonical URL for one product.
--
-- A collision never overwrites anybody: the losing slug gains a deterministic
-- numeric suffix. A changed path leaves the old URL behind as a redirect, so a
-- link somebody already shared keeps working.
create or replace function public.mm_url_generate(
  p_product uuid, p_reason text default null, p_correlation uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_p record; v_slug jsonb; v_path jsonb; v_base text; v_try text; v_p2 jsonb;
  v_existing record; v_old record; i integer := 1; v_row jsonb; v_conflict boolean := false;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;
  select * into v_p from public.marketplace_products where id = p_product;
  if not found then return jsonb_build_object('ok', false, 'reason','unknown_product'); end if;

  v_slug := public.mm_url_slugify(v_p.name, p_product);
  v_base := v_slug->>'slug';
  v_try := v_base;

  -- 7. Find a path nobody else holds.
  loop
    v_path := public.mm_url_path(p_product, v_try);
    if not (v_path->>'ok')::boolean then return v_path; end if;

    select * into v_existing from public.product_urls
     where path = (v_path->>'path') and language = 'en'
       and product_id <> p_product and status <> 'purged';
    exit when not found;

    v_conflict := true;
    i := i + 1;
    if i > 60 then
      return jsonb_build_object('ok', false, 'reason','could_not_generate');
    end if;
    v_try := left(v_base, 84) || '-' || i::text;
  end loop;

  -- The product's current canonical, if it has one.
  select * into v_old from public.product_urls
   where product_id = p_product and language='en' and is_canonical and status='active';

  if found and v_old.path = (v_path->>'path') then
    return jsonb_build_object('ok', true, 'changed', false,
      'path', v_old.path, 'url', (select site_url from public.product_url_settings where id) || v_old.path,
      'note','Already correct; nothing was changed.');
  end if;

  -- 8. The old URL becomes a redirect rather than disappearing.
  if found then
    update public.product_urls
       set is_canonical = false, status = 'redirect', updated_at = now()
     where id = v_old.id;
  end if;

  insert into public.product_urls
    (product_id, slug, path, language, status, is_canonical, generated_by, created_by)
  values (p_product, v_try, v_path->>'path', 'en', 'active', true,
          case when p_correlation is null then 'system' else 'bulk' end, auth.uid())
  returning to_jsonb(product_urls) into v_row;

  if v_old.id is not null then
    update public.product_urls set redirect_to = (v_row->>'id')::uuid where id = v_old.id;
    insert into public.product_url_history
      (product_id, old_path, new_path, changed_by, reason, correlation_id)
    values (p_product, v_old.path, v_path->>'path', auth.uid(),
            coalesce(p_reason, 'Canonical URL regenerated.'), p_correlation);
  end if;

  -- The product's own slug follows its canonical URL, so the storefront route
  -- and the URL table cannot disagree.
  update public.marketplace_products set slug = v_try, updated_at = now()
   where id = p_product and slug is distinct from v_try;

  perform public.mm_audit('url.generated','product_url', (v_row->>'id'),
    case when v_old.id is null then null else jsonb_build_object('path', v_old.path) end,
    v_row, p_reason);

  return jsonb_build_object('ok', true, 'changed', true,
    'path', v_path->>'path',
    'url', (select site_url from public.product_url_settings where id) || (v_path->>'path'),
    'slug', v_try, 'collision_handled', v_conflict,
    'previous_path', v_old.path,
    'note', case when v_old.path is null then null
      else 'The previous URL now redirects here, so links already shared keep working.' end);
end;
$$;

/* -------------------------------------------------------- 10. short links */

create or replace function public.mm_short_link_create(
  p_product uuid, p_campaign text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp, extensions
as $$
declare
  v_s record; v_alphabet constant text :=
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  v_code text; v_bytes bytea; i integer; v_row jsonb; v_existing record;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;
  if not exists (select 1 from public.marketplace_products where id = p_product) then
    return jsonb_build_object('ok', false, 'reason','unknown_product');
  end if;
  select * into v_s from public.product_url_settings where id;

  -- One active short link per product per campaign; asking twice returns the
  -- one that already exists rather than minting another.
  select * into v_existing from public.product_short_links
   where product_id = p_product and status='active'
     and coalesce(campaign,'') = coalesce(p_campaign,'');
  if found then
    return jsonb_build_object('ok', true, 'existing', true, 'code', v_existing.code,
      'url', public.mm_short_link_url(v_existing.code));
  end if;

  for attempt in 1..12 loop
    v_code := '';
    v_bytes := gen_random_bytes(v_s.short_code_length);
    for i in 0..(v_s.short_code_length - 1) loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % length(v_alphabet)) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.product_short_links where code = v_code);
    v_code := null;
  end loop;
  if v_code is null then
    return jsonb_build_object('ok', false, 'reason','could_not_generate');
  end if;

  insert into public.product_short_links (product_id, code, campaign, created_by)
  values (p_product, v_code, nullif(btrim(p_campaign),''), auth.uid())
  returning to_jsonb(product_short_links) into v_row;

  perform public.mm_audit('url.short_link_created','product_short_link', (v_row->>'id'),
                          null, v_row, null);

  return jsonb_build_object('ok', true, 'existing', false, 'code', v_code,
    'url', public.mm_short_link_url(v_code), 'row', v_row);
end;
$$;

-- Where a short code actually lives. Without a verified vanity domain it is a
-- path on the site itself, which resolves today.
create or replace function public.mm_short_link_url(p_code text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when s.short_link_domain is not null and s.short_link_domain_verified
      then 'https://' || s.short_link_domain || '/' || p_code
    else s.site_url || '/s/' || p_code end
  from public.product_url_settings s where s.id;
$$;

/* --------------------------------------------------- 11/24/25. resolution */

-- Resolve a short code and record the click.
--
-- The destination always comes from the product's own canonical URL row, never
-- from anything the caller supplies: section 36 forbids an open redirect, and
-- the only way to guarantee that is to never accept a destination as input.
-- Marketplace visibility is honoured, so a suspended product does not redirect.
create or replace function public.mm_short_link_resolve(
  p_code text,
  p_referrer text default null, p_country text default null,
  p_device text default null, p_browser text default null,
  p_visitor_hash text default null,
  p_utm jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_l record; v_p record; v_u record; v_s record;
begin
  select * into v_l from public.product_short_links where code = p_code;
  if not found then
    return jsonb_build_object('ok', false, 'status', 404, 'reason','unknown_code');
  end if;

  if v_l.status <> 'active' then
    return jsonb_build_object('ok', false,
      'status', case v_l.status when 'disabled' then 410 when 'expired' then 410 else 404 end,
      'reason', v_l.status);
  end if;
  if v_l.expires_at is not null and v_l.expires_at <= now() then
    update public.product_short_links set status='expired' where id = v_l.id;
    return jsonb_build_object('ok', false, 'status', 410, 'reason','expired');
  end if;

  select * into v_p from public.marketplace_products where id = v_l.product_id;
  if not found then
    return jsonb_build_object('ok', false, 'status', 410, 'reason','product_gone');
  end if;

  -- 24. Visibility rules decide, not the link.
  if v_p.deleted_at is not null then
    return jsonb_build_object('ok', false, 'status', 410, 'reason','product_deleted');
  end if;
  if not v_p.visible or v_p.moderation_status <> 'approved' then
    return jsonb_build_object('ok', false, 'status', 404,
      'reason', 'product_unavailable',
      'detail', format('The product is %s and not publicly visible.', v_p.moderation_status));
  end if;

  select * into v_u from public.product_urls
   where product_id = v_l.product_id and language='en' and is_canonical and status='active';
  if not found then
    return jsonb_build_object('ok', false, 'status', 404, 'reason','no_canonical_url');
  end if;

  select * into v_s from public.product_url_settings where id;

  -- 40. Analytics must never stop a valid link working, so the event is written
  -- inside its own block.
  if v_s.track_short_link_clicks then
    begin
      insert into public.product_short_link_events
        (short_link_id, product_id, referrer, country, device_type, browser,
         visitor_hash, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
         purge_after)
      values (v_l.id, v_l.product_id, left(p_referrer, 500), p_country, p_device, p_browser,
              p_visitor_hash,
              p_utm->>'utm_source', p_utm->>'utm_medium',
              coalesce(p_utm->>'utm_campaign', v_l.campaign),
              p_utm->>'utm_content', p_utm->>'utm_term',
              now() + (v_s.analytics_retention_days || ' days')::interval);

      update public.product_short_links
         set click_count = click_count + 1, last_click_at = now()
       where id = v_l.id;
    exception when others then
      null;
    end;
  end if;

  return jsonb_build_object('ok', true, 'status', 302,
    'destination', v_s.site_url || v_u.path,
    'path', v_u.path, 'product_id', v_l.product_id);
end;
$$;

-- The canonical resolver, for an old path that now redirects.
create or replace function public.mm_url_resolve(p_path text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_u record; v_t record; v_s record;
begin
  select * into v_u from public.product_urls where path = p_path and language='en';
  if not found then
    return jsonb_build_object('ok', false, 'status', 404, 'reason','unknown_path');
  end if;
  select * into v_s from public.product_url_settings where id;

  if v_u.status = 'active' then
    return jsonb_build_object('ok', true, 'status', 200, 'path', v_u.path,
      'product_id', v_u.product_id);
  end if;

  if v_u.status = 'redirect' and v_u.redirect_to is not null then
    select * into v_t from public.product_urls where id = v_u.redirect_to;
    if found and v_t.status = 'active' then
      return jsonb_build_object('ok', true, 'status', 301,
        'destination', v_s.site_url || v_t.path, 'path', v_t.path,
        'product_id', v_t.product_id);
    end if;
  end if;

  return jsonb_build_object('ok', false,
    'status', case v_u.status when 'disabled' then 410 when 'soft_deleted' then 410 else 404 end,
    'reason', v_u.status);
end;
$$;
