-- Demo Domain Manager.
--
-- What was established before writing any of this, by calling the APIs rather
-- than reading configuration:
--
--   * Cloudflare does NOT authenticate. CLOUDFLARE_ZONE_ID and
--     CLOUDFLARE_ACCOUNT_ID are the right shape (32-char hex), but
--     CLOUDFLARE_API_TOKEN is also 32-char hex — that is the shape of an ID,
--     not a token; a real Cloudflare API token is about forty characters and is
--     not plain hex. Both the Bearer and the legacy key form return
--     "Invalid request headers". So DNS is REQUIRES CONFIGURATION, and this
--     module says so rather than reporting domains it cannot create.
--   * There is no deployment provider of any kind. server_deployments is empty
--     and nothing in this project can start a container or a runtime.
--   * Server Manager exists and is the infrastructure source of truth:
--     server_instances(1), server_regions(6), server_plans(7). Nothing here
--     creates a second server inventory.
--   * product_demo_urls holds thirteen live demos, and every one of them is a
--     lovable.app address — third-party hosting, not Software Vala
--     infrastructure. They are surfaced as external rather than presented as
--     provisioned demos, which is what they are not.
--
-- So: everything that can be real without a provider is real — slug generation
-- and collision handling, hostname uniqueness, the lifecycle with genuine
-- failure states, the moderation, branding and security gates, expiry from
-- actual timestamps, health from the monitor that already runs. Every provider
-- call reports NOT_CONFIGURED, and a demo can never reach LIVE without one.

/* --------------------------------------------------------- 3. the demos */

create table if not exists public.demo_domains (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  -- The immutable identity of this demo, kept even if the hostname changes.
  demo_ref text not null unique,
  slug text not null,
  hostname text not null,
  environment text not null default 'demo'
    check (environment in ('demo','sandbox','staging')),
  pattern text not null default 'isolated'
    check (pattern in ('isolated','shared')),

  status text not null default 'draft' check (status in
    ('draft','provisioning','dns_pending','ssl_pending','deploying',
     'health_check','live','resetting','disabled','expired','failed')),
  failure_reason text,

  dns_status text not null default 'dns_pending'
    check (dns_status in ('dns_pending','dns_propagating','dns_ready','dns_failed')),
  dns_record_id text,
  ssl_status text not null default 'pending'
    check (ssl_status in ('pending','provisioning','active','expiring','failed','revoked')),
  ssl_expires_at timestamptz,
  ssl_issuer text,

  -- Server Manager stays the infrastructure source of truth; this references it.
  server_instance_id uuid references public.server_instances(id) on delete set null,
  deployment_id uuid references public.server_deployments(id) on delete set null,
  deployment_version text,

  -- 9. Never a plaintext password.
  password_hash text,
  password_set_at timestamptz,
  password_protected boolean not null default true,
  -- 10. A demo is not indexed unless somebody deliberately allows it.
  allow_indexing boolean not null default false,

  branding_policy_version integer,
  branding_verified_at timestamptz,
  security_cleared_at timestamptz,

  published_at timestamptz,
  expires_at timestamptz,
  grace_until timestamptz,
  last_health_at timestamptz,
  health text not null default 'unknown'
    check (health in ('healthy','degraded','down','unknown')),

  -- An external demo is one somebody else hosts. It is tracked, never claimed
  -- as provisioned by this system.
  external boolean not null default false,
  external_url text,

  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 1. Two products can never hold the same active hostname.
  constraint demo_hostname_unique_when_active
    exclude (hostname with =) where (status not in ('disabled','expired','failed')),
  -- A live demo must have come through DNS, SSL and a deployment.
  constraint demo_live_is_real check (
    status <> 'live' or (dns_status = 'dns_ready' and ssl_status = 'active'
                         and deployment_id is not null))
);
create index if not exists demo_domains_product_idx on public.demo_domains (product_id);
create index if not exists demo_domains_status_idx on public.demo_domains (status);
create index if not exists demo_domains_expiry_idx on public.demo_domains (expires_at)
  where status in ('live','disabled');

comment on constraint demo_live_is_real on public.demo_domains is
  'A demo cannot be recorded as live without DNS ready, SSL active and a real '
  'deployment. This is what stops LIVE being shown for something that never '
  'answered — section 4 of the brief, enforced by the database.';

/* ---------------------------------------------------------- 28. the jobs */

create table if not exists public.demo_provision_jobs (
  id uuid primary key default gen_random_uuid(),
  demo_id uuid not null references public.demo_domains(id) on delete cascade,
  operation text not null check (operation in
    ('provision','dns_verify','ssl_provision','deploy','reset','regenerate',
     'enable','disable','health_check','destroy')),
  status text not null default 'queued'
    check (status in ('queued','running','succeeded','failed','blocked','cancelled')),
  attempt integer not null default 1 check (attempt >= 1),
  -- 29. The same request twice must not create two pieces of infrastructure.
  idempotency_key text not null unique,
  correlation_id uuid not null default gen_random_uuid(),
  provider text,
  error_category text,
  error_detail text,
  latency_ms integer,
  actor_id uuid,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists demo_jobs_demo_idx on public.demo_provision_jobs (demo_id, created_at desc);
create index if not exists demo_jobs_open_idx on public.demo_provision_jobs (status)
  where status in ('queued','running');

/* ------------------------------------------------ dns, ssl, deployments */

create table if not exists public.demo_dns_records (
  id uuid primary key default gen_random_uuid(),
  demo_id uuid not null references public.demo_domains(id) on delete cascade,
  provider text not null default 'cloudflare',
  provider_record_id text,
  record_type text not null default 'CNAME',
  name text not null,
  content text not null,
  proxied boolean not null default true,
  state text not null default 'pending'
    check (state in ('pending','created','verified','conflict','failed','deleted')),
  last_error text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.demo_ssl_certificates (
  id uuid primary key default gen_random_uuid(),
  demo_id uuid references public.demo_domains(id) on delete cascade,
  -- A wildcard covers every isolated demo subdomain, so it is not tied to one.
  wildcard boolean not null default false,
  hostname text not null,
  provider text,
  issuer text,
  state text not null default 'pending'
    check (state in ('pending','provisioning','active','expiring','failed','revoked')),
  auto_renew boolean not null default true,
  issued_at timestamptz,
  expires_at timestamptz,
  last_renewal_at timestamptz,
  next_renewal_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.demo_deployments (
  id uuid primary key default gen_random_uuid(),
  demo_id uuid not null references public.demo_domains(id) on delete cascade,
  server_instance_id uuid references public.server_instances(id) on delete set null,
  region text,
  version text,
  state text not null default 'pending'
    check (state in ('pending','deploying','deployed','failed','reset','destroyed')),
  provider text,
  provider_reference text,
  failure_reason text,
  deployed_at timestamptz,
  created_at timestamptz not null default now()
);

/* ------------------------------------------------------- 15/16. expiry */

create table if not exists public.demo_expiry_events (
  id uuid primary key default gen_random_uuid(),
  demo_id uuid not null references public.demo_domains(id) on delete cascade,
  kind text not null check (kind in ('reminder','expired','grace_started','renewed','disabled')),
  days_out integer,
  notified boolean not null default false,
  created_at timestamptz not null default now(),
  -- One reminder per threshold per demo, so a nightly run does not spam.
  constraint demo_expiry_once unique (demo_id, kind, days_out)
);

/* ------------------------------------------------------------- 17. QR */

create table if not exists public.demo_qr_codes (
  id uuid primary key default gen_random_uuid(),
  demo_id uuid not null references public.demo_domains(id) on delete cascade,
  target_url text not null,
  version integer not null default 1,
  active boolean not null default true,
  -- Scan analytics are not implemented; these stay null rather than showing a
  -- zero that would read as "nobody scanned it".
  scan_count integer,
  last_scan_at timestamptz,
  created_at timestamptz not null default now()
);

comment on column public.demo_qr_codes.scan_count is
  'Null on purpose. No scan tracking exists, and section 17 forbids claiming '
  'analytics that are not implemented. A zero here would be a claim.';

/* ------------------------------------------- 10/11. access and settings */

create table if not exists public.demo_access_settings (
  id boolean primary key default true check (id),
  base_domain text not null default 'demo.softwarevala.net',
  default_pattern text not null default 'isolated'
    check (default_pattern in ('isolated','shared')),
  auto_provision_on_publish boolean not null default false,
  password_protect_by_default boolean not null default true,
  block_search_indexing boolean not null default true,
  default_ttl_days integer not null default 90 check (default_ttl_days between 1 and 3650),
  grace_days integer not null default 14 check (grace_days between 0 and 180),
  reminder_days integer[] not null default array[30,14,7,3,1],
  updated_by uuid,
  updated_at timestamptz not null default now()
);
insert into public.demo_access_settings (id) values (true) on conflict (id) do nothing;

-- Names that must never become a demo hostname.
create table if not exists public.demo_reserved_slugs (
  slug text primary key,
  reason text not null
);
insert into public.demo_reserved_slugs (slug, reason) values
  ('www','reserved hostname'), ('api','reserved hostname'),
  ('admin','reserved hostname'), ('app','reserved hostname'),
  ('mail','reserved hostname'), ('demo','the base domain itself'),
  ('staging','environment name'), ('test','environment name'),
  ('cdn','reserved hostname'), ('static','reserved hostname'),
  ('assets','reserved hostname'), ('dashboard','reserved hostname'),
  ('control-panel','reserved hostname'), ('marketplace','reserved hostname'),
  ('softwarevala','the brand itself')
on conflict (slug) do nothing;

/* ------------------------------------------------------- 34. the events */

-- Append-only. No update or delete policy exists for anyone.
create table if not exists public.demo_domain_events (
  id uuid primary key default gen_random_uuid(),
  demo_id uuid references public.demo_domains(id) on delete cascade,
  job_id uuid references public.demo_provision_jobs(id) on delete set null,
  product_id uuid references public.marketplace_products(id) on delete set null,
  event text not null,
  actor_id uuid,
  actor_role text,
  previous_state text,
  new_state text,
  reason text,
  correlation_id uuid,
  provider text,
  latency_ms integer,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists demo_events_idx on public.demo_domain_events (demo_id, created_at desc);

/* ------------------------------------------------------- 25/26/27. providers */

create table if not exists public.demo_provider_configs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  kind text not null check (kind in ('dns','ssl','deployment')),
  enabled boolean not null default false,
  credential_env text,
  endpoint text,
  -- Only a successful live call sets this. Configuration alone never does.
  verified boolean not null default false,
  verified_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.demo_provider_configs (slug, label, kind, credential_env, endpoint, last_error)
values
  ('cloudflare_dns','Cloudflare DNS','dns','CLOUDFLARE_API_TOKEN',
   'https://api.cloudflare.com/client/v4',
   'The credential does not authenticate. CLOUDFLARE_API_TOKEN holds a 32-character hex value, which is the shape of a Cloudflare ID rather than an API token; a real token is about forty characters and is not plain hex. Both the Bearer and legacy key forms return "Invalid request headers".'),
  ('cloudflare_ssl','Cloudflare wildcard SSL','ssl','CLOUDFLARE_API_TOKEN',
   'https://api.cloudflare.com/client/v4',
   'Depends on the same credential as DNS, which does not authenticate.'),
  ('deployment_runtime','Demo deployment runtime','deployment', null, null,
   'No deployment provider exists in this project. server_deployments is empty and nothing here can start a container or a runtime.')
on conflict (slug) do nothing;

/* ------------------------------------------------------------------- RLS */

do $$
declare t text;
begin
  foreach t in array array['demo_domains','demo_provision_jobs','demo_dns_records',
                           'demo_ssl_certificates','demo_deployments','demo_expiry_events',
                           'demo_qr_codes','demo_access_settings','demo_reserved_slugs',
                           'demo_domain_events','demo_provider_configs'] loop
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

-- 31. An author or vendor sees the demos for their own products, and nothing of
-- anybody else's. They never see the password hash — the RPC controls what is
-- returned, and this policy controls which rows exist for them at all.
drop policy if exists demo_domains_own on public.demo_domains;
create policy demo_domains_own on public.demo_domains
  for select to authenticated
  using (public.mm_is_operator()
         or exists (select 1 from public.marketplace_products p
                     where p.id = demo_domains.product_id
                       and public.marketplace_is_seller_member(p.seller_id)));

drop policy if exists demo_qr_own on public.demo_qr_codes;
create policy demo_qr_own on public.demo_qr_codes
  for select to authenticated
  using (public.mm_is_operator()
         or exists (select 1 from public.demo_domains d
                     join public.marketplace_products p on p.id = d.product_id
                    where d.id = demo_qr_codes.demo_id
                      and public.marketplace_is_seller_member(p.seller_id)));

-- Events are the record of what happened to infrastructure. Nobody rewrites one.
drop policy if exists demo_events_no_update on public.demo_domain_events;
create policy demo_events_no_update on public.demo_domain_events
  as restrictive for update to public using (false) with check (false);
drop policy if exists demo_events_no_delete on public.demo_domain_events;
create policy demo_events_no_delete on public.demo_domain_events
  as restrictive for delete to public using (false);
