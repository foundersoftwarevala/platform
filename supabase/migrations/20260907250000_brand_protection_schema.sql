-- Favicon & Branding Protection.
--
-- The honest starting position, established before writing any of this:
--
--   * Software Vala has exactly one canonical brand asset on disk:
--     public/favicon.png — a 64x64 PNG of 6,052 bytes, SHA-256
--     f75a3e02928c074ac3804ecf9cbc4bb35b479a38a51075aa42ad13cb6d468788 —
--     declared in __root.tsx as rel="icon".
--   * There is no favicon.ico, no apple-touch-icon, no web manifest and no PWA
--     icon set. The screen this replaces listed replacement rules pointing at
--     svala-favicon.ico and svala-apple-touch.png, neither of which exists.
--   * marketplace_products already has `favicon` and `logo` columns, and not one
--     of the 5,533 products sets either. There are no author branding overrides
--     in this database today.
--   * legal_trademark_assets is Legal Manager's trademark registry and stays the
--     legal source of truth; nothing here duplicates it.
--
-- So the registry starts with the one asset that actually exists, and a rule
-- whose canonical asset is missing is reported as unusable rather than being
-- given an invented path. Section 3 says replacements must use canonical
-- Software Vala assets; a rule that cannot name one cannot enforce.

/* -------------------------------------------------- 10/11. asset registry */

create table if not exists public.brand_assets (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  asset_type text not null check (asset_type in
    ('favicon','apple_touch_icon','manifest_icon','pwa_icon','logo','og_image','other')),
  -- A path served by this application, never an arbitrary URL. Section 33
  -- forbids allowing an arbitrary replacement source.
  public_path text check (public_path is null or public_path ~ '^/[A-Za-z0-9._/-]+$'),
  mime_type text,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  sha256 text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  version integer not null default 1,
  -- Only an approved, present asset may be used to replace anything.
  approved boolean not null default false,
  active boolean not null default false,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- An asset cannot be active unless it has been approved and its bytes are
  -- known. This is what stops a replacement pointing at nothing.
  constraint brand_asset_active_is_real check (
    not active or (approved and public_path is not null and sha256 is not null))
);

create table if not exists public.brand_asset_versions (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.brand_assets(id) on delete cascade,
  version integer not null,
  public_path text,
  sha256 text,
  size_bytes bigint,
  width integer,
  height integer,
  change_summary text,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  snapshot jsonb not null,
  constraint brand_asset_version_unique unique (asset_id, version)
);

-- The one asset that actually exists, with its real measurements.
insert into public.brand_assets
  (key, name, asset_type, public_path, mime_type, width, height, size_bytes,
   sha256, approved, active, approved_at)
values
  ('favicon_png', 'Software Vala favicon', 'favicon', '/favicon.png', 'image/png',
   64, 64, 6052,
   'f75a3e02928c074ac3804ecf9cbc4bb35b479a38a51075aa42ad13cb6d468788',
   true, true, now())
on conflict (key) do nothing;

-- Registered because the specification names them, and deliberately left
-- unapproved and inactive: the files do not exist. A rule needing one of these
-- reports as unusable rather than replacing a real asset with a broken path.
insert into public.brand_assets (key, name, asset_type, mime_type) values
  ('favicon_ico',      'Software Vala favicon (.ico)',  'favicon',           'image/x-icon'),
  ('apple_touch_icon', 'Apple touch icon',              'apple_touch_icon',  'image/png'),
  ('pwa_icon_192',     'PWA icon 192',                  'pwa_icon',          'image/png'),
  ('pwa_icon_512',     'PWA icon 512',                  'pwa_icon',          'image/png'),
  ('brand_logo',       'Software Vala logo',            'logo',              'image/svg+xml'),
  ('og_image',         'Open Graph image',              'og_image',          'image/png')
on conflict (key) do nothing;

/* ---------------------------------------------------- 3. enforcement rules */

create table if not exists public.brand_enforcement_rules (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  -- What is being protected: a column on the product, or a surface.
  target text not null check (target in
    ('product_favicon','product_logo','product_og_image','demo_favicon','manifest_icon')),
  canonical_asset_key text references public.brand_assets(key),
  action text not null default 'replace' check (action in ('replace','block','flag','monitor')),
  enabled boolean not null default true,
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.brand_enforcement_rules
  (key, label, target, canonical_asset_key, action, severity, notes)
values
  ('product_favicon', 'Product favicon must be the Software Vala favicon',
   'product_favicon', 'favicon_png', 'replace', 'high',
   'A product listing on a Software Vala surface uses the Software Vala favicon.'),
  ('product_logo', 'Author logo must not override Software Vala branding on the listing',
   'product_logo', 'brand_logo', 'flag', 'medium',
   'Flagged rather than replaced: the canonical logo asset does not exist yet, so nothing can be substituted.'),
  ('product_og_image', 'Open Graph branding on controlled surfaces',
   'product_og_image', 'og_image', 'monitor', 'low',
   'Monitoring only until an approved Open Graph asset exists.'),
  ('demo_favicon', 'Controlled demo favicon',
   'demo_favicon', 'favicon_png', 'flag', 'medium',
   'A demo is a third-party application on another origin. Its favicon is detected and reported; it is never rewritten from here.'),
  ('manifest_icon', 'Manifest and PWA icons',
   'manifest_icon', 'pwa_icon_192', 'monitor', 'low',
   'This application ships no web manifest, so there is nothing to enforce yet.')
on conflict (key) do nothing;

/* ------------------------------------------------------ 8/25. the policy */

create table if not exists public.brand_protection_settings (
  id boolean primary key default true check (id),
  -- ENFORCE replaces, MONITOR records without changing anything, DISABLED does
  -- neither. Disabling is restricted to an admin or the boss.
  policy_state text not null default 'monitor'
    check (policy_state in ('enforce','monitor','disabled')),
  block_third_party_favicons boolean not null default true,
  block_third_party_manifest boolean not null default true,
  block_external_logo_overrides boolean not null default true,
  replace_on_upload boolean not null default true,
  allow_whitelist_exceptions boolean not null default true,
  -- Section 5. Downloadable package content is never touched.
  protect_package_contents boolean not null default false,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
insert into public.brand_protection_settings (id) values (true) on conflict (id) do nothing;

comment on column public.brand_protection_settings.protect_package_contents is
  'Deliberately false and not exposed as a toggle in the console. Section 5 '
  'requires that a downloadable software package keeps its own branding, so '
  'enforcement never rewrites package contents — only marketplace surfaces.';

/* ------------------------------------------------- 9. whitelist exceptions */

create table if not exists public.brand_whitelist_exceptions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.marketplace_products(id) on delete cascade,
  seller_id uuid references public.marketplace_sellers(id) on delete set null,
  rule_key text references public.brand_enforcement_rules(key),
  asset_reference text,
  reason text not null,
  created_by uuid not null,
  -- An exception is not in force until somebody with authority approves it.
  approved_by uuid,
  approved_at timestamptz,
  expires_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending','active','expired','revoked')),
  revoked_by uuid,
  revoked_reason text,
  created_at timestamptz not null default now(),
  constraint whitelist_active_needs_approval check (
    status <> 'active' or approved_by is not null)
);
create index if not exists brand_whitelist_lookup
  on public.brand_whitelist_exceptions (product_id, rule_key) where status = 'active';

/* --------------------------------------------- 18. violations and history */

create table if not exists public.brand_violation_cases (
  id uuid primary key default gen_random_uuid(),
  case_no text not null unique,
  product_id uuid references public.marketplace_products(id) on delete cascade,
  seller_id uuid references public.marketplace_sellers(id) on delete set null,
  rule_key text references public.brand_enforcement_rules(key),
  surface text not null,
  asset_reference text,
  -- 14. How an external branding reference is classified.
  classification text not null default 'unknown'
    check (classification in ('approved','whitelisted','unknown','blocked')),
  severity text not null default 'medium'
    check (severity in ('low','medium','high','critical')),
  status text not null default 'open'
    check (status in ('open','replaced','blocked','whitelisted','escalated','resolved','failed')),
  evidence jsonb not null default '[]'::jsonb,
  detection_source text not null default 'static'
    check (detection_source in ('static','vision','human')),
  legal_reference text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists brand_cases_open_idx on public.brand_violation_cases (status)
  where status in ('open','escalated','failed');

-- 24. Immutable for ordinary users: no update or delete policy exists below.
create table if not exists public.brand_replacement_history (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.brand_violation_cases(id) on delete set null,
  product_id uuid references public.marketplace_products(id) on delete cascade,
  rule_key text,
  surface text not null,
  original_reference text,
  original_sha256 text,
  replacement_asset_key text references public.brand_assets(key),
  replacement_reference text,
  replacement_sha256 text,
  actor_id uuid,
  actor_kind text not null default 'system' check (actor_kind in ('system','human')),
  reason text,
  -- Whether the replacement was read back and confirmed. Section 23: a failed
  -- replacement must not be reported as success.
  verified boolean not null default false,
  verification_detail text,
  created_at timestamptz not null default now()
);

create table if not exists public.brand_protection_events (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.marketplace_products(id) on delete set null,
  case_id uuid references public.brand_violation_cases(id) on delete set null,
  event text not null,
  actor_id uuid,
  actor_role text,
  previous_state text,
  new_state text,
  reason text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists brand_events_idx on public.brand_protection_events (created_at desc);

-- The enforcement run itself, so "Enforce Now" has a real record.
create table if not exists public.brand_enforcement_runs (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'all',
  policy_state text not null,
  scanned integer not null default 0,
  compliant integer not null default 0,
  replaced integer not null default 0,
  blocked integer not null default 0,
  flagged integer not null default 0,
  whitelisted integer not null default 0,
  failed integer not null default 0,
  started_by uuid,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  detail jsonb not null default '{}'::jsonb
);

/* ------------------------------------------------------------------- RLS */

do $$
declare t text;
begin
  foreach t in array array['brand_assets','brand_asset_versions','brand_enforcement_rules',
                           'brand_protection_settings','brand_whitelist_exceptions',
                           'brand_violation_cases','brand_replacement_history',
                           'brand_protection_events','brand_enforcement_runs'] loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', t||'_operator', t);
    execute format($f$create policy %I on public.%I for all to authenticated
                      using (public.mm_is_operator()) with check (public.mm_is_operator())$f$,
                   t||'_operator', t);

    execute format('drop policy if exists %I on public.%I', t||'_anon', t);
    execute format($f$create policy %I on public.%I as restrictive for all to anon
                      using (false) with check (false)$f$, t||'_anon', t);
  end loop;
end;
$$;

-- 27. An author or vendor sees the cases raised against their own products and
-- the exceptions they asked for, and nothing of anybody else's.
drop policy if exists brand_cases_own on public.brand_violation_cases;
create policy brand_cases_own on public.brand_violation_cases
  for select to authenticated
  using (public.mm_is_operator()
         or public.marketplace_is_seller_member(seller_id));

drop policy if exists brand_whitelist_own on public.brand_whitelist_exceptions;
create policy brand_whitelist_own on public.brand_whitelist_exceptions
  for select to authenticated
  using (public.mm_is_operator()
         or created_by = auth.uid()
         or public.marketplace_is_seller_member(seller_id));

-- A seller may ask for an exception. Only an operator can approve one, which is
-- enforced by the check constraint above and by the RPC.
drop policy if exists brand_whitelist_request on public.brand_whitelist_exceptions;
create policy brand_whitelist_request on public.brand_whitelist_exceptions
  for insert to authenticated
  with check (created_by = auth.uid() and status = 'pending' and approved_by is null);

-- Replacement history and events are evidence. Nobody rewrites either.
do $$
declare t text;
begin
  foreach t in array array['brand_replacement_history','brand_protection_events'] loop
    execute format('drop policy if exists %I on public.%I', t||'_no_update', t);
    execute format($f$create policy %I on public.%I as restrictive for update to public
                      using (false) with check (false)$f$, t||'_no_update', t);
    execute format('drop policy if exists %I on public.%I', t||'_no_delete', t);
    execute format($f$create policy %I on public.%I as restrictive for delete to public
                      using (false)$f$, t||'_no_delete', t);
  end loop;
end;
$$;
