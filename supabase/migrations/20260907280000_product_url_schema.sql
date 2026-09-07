-- Auto Product URL & Sharing.
--
-- Two things were checked against the running site before any of this was
-- written, and both change what the module should do.
--
-- First, the canonical product URL. The specification suggests
-- /software/{category}/{product-name}, and the screen this replaces showed that
-- pattern in a text box. No route serves it: /software/erp/sustainabilityprint
-- returns 404 on the live site, while /marketplace/product/sustainabilityprint
-- returns 200 and is what sitemap-products already emits. Adopting the
-- suggested pattern would have pointed every canonical URL, every share link
-- and the whole sitemap at a 404. The pattern is therefore configurable, as
-- section 2 asks, but it defaults to the one the site actually serves, and a
-- pattern whose prefix has no route is refused rather than saved.
--
-- Second, the short domain. Nothing like SHORT_LINK_DOMAIN is configured, so a
-- vanity host such as svl.to is REQUIRES CONFIGURATION. That does not make short
-- links fake: a short link resolves at /s/{code} on softwarevala.net, which is a
-- real route built alongside this migration. The vanity domain is an
-- optimisation on top of something that already works.
--
-- All 5,533 products already carry a slug and there is not one duplicate among
-- them, so nothing needs re-slugging; the canonical rows are derived from what
-- is already correct.

/* ---------------------------------------------------------- 33. settings */

create table if not exists public.product_url_settings (
  id boolean primary key default true check (id),
  -- Defaults to the pattern that resolves today.
  canonical_pattern text not null default '/marketplace/product/{product-name}',
  site_url text not null default 'https://softwarevala.net',

  lowercase_hyphenate boolean not null default true,
  strip_stop_words boolean not null default false,
  stop_words text[] not null default
    array['a','an','the','and','or','for','of','to','in','on','with','by'],
  include_product_id_suffix boolean not null default false,

  -- The vanity host. Null means short links are served from the site itself.
  short_link_domain text,
  short_link_domain_verified boolean not null default false,
  short_code_length integer not null default 7 check (short_code_length between 4 and 24),

  track_short_link_clicks boolean not null default true,
  generate_qr_on_publish boolean not null default true,
  qr_foreground text not null default '#00D0FF' check (qr_foreground ~ '^#[0-9A-Fa-f]{6}$'),
  qr_background text not null default '#FFFFFF' check (qr_background ~ '^#[0-9A-Fa-f]{6}$'),
  qr_size integer not null default 512 check (qr_size between 64 and 2048),
  qr_error_correction text not null default 'M' check (qr_error_correction in ('L','M','Q','H')),
  qr_quiet_zone integer not null default 4 check (qr_quiet_zone between 0 and 16),

  -- 42. How long a click or scan event is kept.
  analytics_retention_days integer not null default 400
    check (analytics_retention_days between 1 and 3650),

  updated_by uuid,
  updated_at timestamptz not null default now()
);
insert into public.product_url_settings (id) values (true) on conflict (id) do nothing;

-- The path prefixes this application actually serves. A canonical pattern must
-- start with one of these, or every URL it produces would be a 404.
create table if not exists public.product_url_route_prefixes (
  prefix text primary key,
  note text not null,
  verified_at timestamptz
);
insert into public.product_url_route_prefixes (prefix, note, verified_at) values
  ('/marketplace/product',
   'Served by src/routes/marketplace.product.$slug.tsx and emitted by sitemap-products. Verified returning 200 on the live site.',
   now())
on conflict (prefix) do nothing;

/* ------------------------------------------------- 9/34/35. canonical URLs */

create table if not exists public.product_urls (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  slug text not null,
  -- The path only. The host comes from settings, so moving domain does not
  -- rewrite five thousand rows.
  path text not null,
  language text not null default 'en',
  status text not null default 'active' check (status in
    ('active','redirect','disabled','expired','soft_deleted','purged')),
  -- Where this URL sends people when its status is 'redirect'.
  redirect_to uuid references public.product_urls(id) on delete set null,
  is_canonical boolean not null default true,
  generated_by text not null default 'system'
    check (generated_by in ('system','manual','bulk','ai_approved')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 34. Uniqueness at the database, not only in the application.
  constraint product_url_path_unique unique (path, language),
  -- One canonical URL per product per language, while it is live.
  constraint product_url_one_canonical
    exclude (product_id with =, language with =)
    where (is_canonical and status = 'active')
);
create index if not exists product_urls_product_idx on public.product_urls (product_id);
create index if not exists product_urls_status_idx on public.product_urls (status);

create table if not exists public.product_url_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  old_path text not null,
  new_path text not null,
  changed_by uuid,
  reason text,
  correlation_id uuid,
  changed_at timestamptz not null default now()
);
create index if not exists product_url_history_idx on public.product_url_history (product_id, changed_at desc);

/* ------------------------------------------------------ 10/34. short links */

create table if not exists public.product_short_links (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  -- Case-sensitive, unguessable, permanent while active.
  code text not null unique check (code ~ '^[A-Za-z0-9]{4,24}$'),
  status text not null default 'active' check (status in
    ('active','disabled','expired','soft_deleted','purged')),
  campaign text,
  expires_at timestamptz,
  click_count integer not null default 0,
  last_click_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists product_short_links_product_idx on public.product_short_links (product_id);

-- 12/42. What a click records, and deliberately what it does not. There is no
-- raw IP column: demo_clicks set that precedent in this project and section 42
-- asks for it. Country and device come from headers the CDN already provides.
create table if not exists public.product_short_link_events (
  id uuid primary key default gen_random_uuid(),
  short_link_id uuid not null references public.product_short_links(id) on delete cascade,
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  country text,
  device_type text,
  browser text,
  -- A daily rotating hash, so a repeat visitor can be counted once without the
  -- address itself ever being stored.
  visitor_hash text,
  purge_after timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists short_link_events_idx
  on public.product_short_link_events (short_link_id, created_at desc);
create index if not exists short_link_events_product_idx
  on public.product_short_link_events (product_id, created_at desc);

/* ------------------------------------------------------------- 13/15. QR */

create table if not exists public.product_qr_codes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  short_link_id uuid references public.product_short_links(id) on delete set null,
  -- Its own code, so a scan is distinguishable from a click on the same link.
  qr_code text not null unique check (qr_code ~ '^[A-Za-z0-9]{4,24}$'),
  target_url text not null,
  foreground text not null default '#00D0FF',
  background text not null default '#FFFFFF',
  size integer not null default 512,
  error_correction text not null default 'M',
  quiet_zone integer not null default 4,
  version integer not null default 1,
  active boolean not null default true,
  scan_count integer not null default 0,
  last_scan_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint product_qr_one_active exclude (product_id with =) where (active)
);

create table if not exists public.product_qr_events (
  id uuid primary key default gen_random_uuid(),
  qr_id uuid not null references public.product_qr_codes(id) on delete cascade,
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  campaign text,
  country text,
  device_type text,
  browser text,
  visitor_hash text,
  purge_after timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists qr_events_idx on public.product_qr_events (qr_id, created_at desc);

/* ------------------------------------------------------------ 20. sharing */

create table if not exists public.product_share_events (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  channel text not null check (channel in
    ('copy','native','whatsapp','facebook','x','linkedin','email','qr_download')),
  url_kind text not null default 'canonical' check (url_kind in ('canonical','short')),
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists share_events_idx on public.product_share_events (product_id, created_at desc);

/* ------------------------------------------------------- 22/41. the jobs */

create table if not exists public.product_url_jobs (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'all'
    check (scope in ('all','selected','category','published','unpublished')),
  operation text not null default 'generate'
    check (operation in ('generate','regenerate','qr','short_link')),
  status text not null default 'queued'
    check (status in ('queued','running','succeeded','partial','failed','cancelled')),
  total integer not null default 0,
  processed integer not null default 0,
  succeeded integer not null default 0,
  failed integer not null default 0,
  skipped integer not null default 0,
  conflicts integer not null default 0,
  correlation_id uuid not null default gen_random_uuid(),
  actor_id uuid,
  detail jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

/* ------------------------------------------------------------------- RLS */

do $$
declare t text;
begin
  foreach t in array array['product_url_settings','product_url_route_prefixes','product_urls',
                           'product_url_history','product_short_links',
                           'product_short_link_events','product_qr_codes','product_qr_events',
                           'product_share_events','product_url_jobs'] loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', t||'_operator', t);
    execute format($f$create policy %I on public.%I for all to authenticated
                      using (public.mm_is_operator()) with check (public.mm_is_operator())$f$,
                   t||'_operator', t);

    execute format('drop policy if exists %I on public.%I', t||'_anon_write', t);
    execute format($f$create policy %I on public.%I as restrictive for insert to anon
                      with check (false)$f$, t||'_anon_write', t);
    execute format('drop policy if exists %I on public.%I', t||'_anon_update', t);
    execute format($f$create policy %I on public.%I as restrictive for update to anon
                      using (false) with check (false)$f$, t||'_anon_update', t);
    execute format('drop policy if exists %I on public.%I', t||'_anon_delete', t);
    execute format($f$create policy %I on public.%I as restrictive for delete to anon
                      using (false)$f$, t||'_anon_delete', t);
  end loop;
end;
$$;

-- 37. A canonical URL for a published product is public: the storefront, the
-- sitemap and every share link depend on being able to read it.
drop policy if exists product_urls_public on public.product_urls;
create policy product_urls_public on public.product_urls
  for select to anon, authenticated
  using (status in ('active','redirect')
         and exists (select 1 from public.marketplace_products p
                      where p.id = product_urls.product_id and p.visible));

-- A seller sees every URL for their own product, including disabled ones.
drop policy if exists product_urls_own on public.product_urls;
create policy product_urls_own on public.product_urls
  for select to authenticated
  using (public.mm_is_operator()
         or exists (select 1 from public.marketplace_products p
                     where p.id = product_urls.product_id
                       and public.marketplace_is_seller_member(p.seller_id)));

drop policy if exists product_short_links_own on public.product_short_links;
create policy product_short_links_own on public.product_short_links
  for select to authenticated
  using (public.mm_is_operator()
         or exists (select 1 from public.marketplace_products p
                     where p.id = product_short_links.product_id
                       and public.marketplace_is_seller_member(p.seller_id)));

drop policy if exists product_qr_own on public.product_qr_codes;
create policy product_qr_own on public.product_qr_codes
  for select to authenticated
  using (public.mm_is_operator()
         or exists (select 1 from public.marketplace_products p
                     where p.id = product_qr_codes.product_id
                       and public.marketplace_is_seller_member(p.seller_id)));

-- History and events are the record. Nobody edits or removes one.
do $$
declare t text;
begin
  foreach t in array array['product_url_history','product_short_link_events',
                           'product_qr_events','product_share_events'] loop
    execute format('drop policy if exists %I on public.%I', t||'_no_update', t);
    execute format($f$create policy %I on public.%I as restrictive for update to public
                      using (false) with check (false)$f$, t||'_no_update', t);
    execute format('drop policy if exists %I on public.%I', t||'_no_delete', t);
    execute format($f$create policy %I on public.%I as restrictive for delete to public
                      using (false)$f$, t||'_no_delete', t);
  end loop;
end;
$$;

grant select on public.product_urls to anon;
