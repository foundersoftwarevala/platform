-- Demo Sandbox Controls.
--
-- This extends the Demo Domain Manager rather than standing beside it: every
-- sandbox belongs to a demo_domains row, which belongs to a marketplace product.
--
-- The honest position carries over from the demo domain work, and section 4 is
-- explicit that it must not be glossed over — "never claim isolation if it has
-- not been technically implemented":
--
--   * There is no deployment runtime, so no sandbox container, schema or tenant
--     is ever created. Isolation is therefore NOT IMPLEMENTED, and this module
--     reports that plainly rather than describing a sandbox that does not exist.
--   * A real database reset, an uploads reset and an infrastructure cleanup all
--     need that runtime. They are recorded as blocked jobs, never as successes.
--
-- What is real without a runtime is built and tested here: the sandbox record
-- and its lifecycle, activity and last-hit tracking, the expiry engine with its
-- warning thresholds, credential generation and rotation with only hashes
-- stored, the job engine with locks and idempotency, the baseline record, and a
-- cleanup that removes what it may while preserving audit, product, legal and
-- deployment history.
--
-- One existing table is deliberately not used for secrets: demo_login_credentials
-- has a plaintext `password` column. It holds no rows, and nothing here writes
-- one.

/* ------------------------------------------------------- 3. the registry */

create table if not exists public.demo_sandboxes (
  id uuid primary key default gen_random_uuid(),
  sandbox_ref text not null unique,
  demo_id uuid not null references public.demo_domains(id) on delete cascade,
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  server_instance_id uuid references public.server_instances(id) on delete set null,
  deployment_id uuid references public.server_deployments(id) on delete set null,

  status text not null default 'provisioning' check (status in
    ('provisioning','active','resetting','disabled','expiring','expired',
     'cleanup_pending','cleaned','failed')),
  failure_reason text,

  -- Section 4. Recorded as a fact, not an aspiration. Nothing sets this to a
  -- real strategy until a runtime actually provides one.
  isolation_strategy text not null default 'none'
    check (isolation_strategy in ('none','schema','database','container','tenant')),
  isolation_verified_at timestamptz,

  -- 23. The known clean state a reset restores.
  baseline_version text,
  baseline_snapshot_id uuid,

  last_activity_at timestamptz,
  last_reset_at timestamptz,
  next_reset_at timestamptz,
  expires_at timestamptz,
  cleanup_after timestamptz,
  cleanup_status text not null default 'none'
    check (cleanup_status in ('none','pending','running','done','failed')),
  health text not null default 'unknown'
    check (health in ('healthy','degraded','down','unknown')),
  last_health_at timestamptz,

  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One sandbox per demo while it is alive.
  constraint sandbox_one_per_demo exclude (demo_id with =)
    where (status not in ('cleaned','failed')),
  -- A sandbox cannot be active while it claims isolation it has not verified.
  constraint sandbox_isolation_is_honest check (
    isolation_strategy = 'none' or isolation_verified_at is not null)
);
create index if not exists demo_sandboxes_demo_idx on public.demo_sandboxes (demo_id);
create index if not exists demo_sandboxes_status_idx on public.demo_sandboxes (status);
create index if not exists demo_sandboxes_expiry_idx on public.demo_sandboxes (expires_at)
  where status in ('active','expiring');

comment on constraint sandbox_isolation_is_honest on public.demo_sandboxes is
  'Section 4: isolation may not be claimed unless it has been implemented and '
  'verified. A strategy other than none requires a verification timestamp.';

/* ------------------------------------------------------- 8/9/10/11. policy */

create table if not exists public.demo_sandbox_settings (
  id boolean primary key default true check (id),
  -- 5. How often a sandbox resets itself.
  auto_reset_hours integer not null default 6 check (auto_reset_hours between 1 and 720),
  -- 6. How long after the last real hit a sandbox expires.
  expire_after_idle_hours integer not null default 24
    check (expire_after_idle_hours between 1 and 720),
  -- 7. When the nightly cleanup runs, and in which zone.
  cleanup_at time not null default '02:00',
  cleanup_timezone text not null default 'Asia/Kolkata',
  grace_hours integer not null default 12 check (grace_hours between 0 and 720),

  auto_reset_db boolean not null default true,
  auto_reset_uploads boolean not null default true,
  rotate_credentials boolean not null default true,
  rotate_credentials_days integer not null default 7
    check (rotate_credentials_days between 1 and 365),
  keep_session_logs boolean not null default true,
  session_log_retention_days integer not null default 30
    check (session_log_retention_days between 1 and 3650),

  warning_hours integer[] not null default array[24,12,6,1],
  updated_by uuid,
  updated_at timestamptz not null default now()
);
insert into public.demo_sandbox_settings (id) values (true) on conflict (id) do nothing;

/* --------------------------------------------------- 12/13. credentials */

create table if not exists public.demo_sandbox_credentials (
  id uuid primary key default gen_random_uuid(),
  sandbox_id uuid not null references public.demo_sandboxes(id) on delete cascade,
  role_type text not null check (role_type in ('demo_user','demo_admin')),
  username text not null,
  -- Only a hash is ever stored. The plaintext is returned once, at generation,
  -- to the operator who asked for it, and never again.
  password_hash text not null,
  version integer not null default 1,
  active boolean not null default true,
  rotated_at timestamptz,
  rotated_by uuid,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  -- One live credential per role per sandbox.
  constraint sandbox_credential_one_active
    exclude (sandbox_id with =, role_type with =) where (active)
);
create index if not exists sandbox_credentials_idx on public.demo_sandbox_credentials (sandbox_id);

comment on column public.demo_sandbox_credentials.password_hash is
  'A bcrypt hash. The plaintext is shown once at generation and never stored, '
  'never logged and never returned by any read.';

/* ------------------------------------------------------- 6. the activity */

create table if not exists public.demo_sandbox_activity (
  id uuid primary key default gen_random_uuid(),
  sandbox_id uuid not null references public.demo_sandboxes(id) on delete cascade,
  -- What counts as a hit is configured, not assumed. A page merely being open
  -- is a heartbeat and does not by itself keep a sandbox alive.
  kind text not null check (kind in ('http','auth','interaction','heartbeat')),
  qualifies boolean not null default true,
  path text,
  status_code integer,
  latency_ms integer,
  -- Deliberately no IP or user agent: a demo visitor is not being profiled.
  created_at timestamptz not null default now()
);
create index if not exists sandbox_activity_idx
  on public.demo_sandbox_activity (sandbox_id, created_at desc);

create table if not exists public.demo_sandbox_sessions (
  id uuid primary key default gen_random_uuid(),
  sandbox_id uuid not null references public.demo_sandboxes(id) on delete cascade,
  session_key text not null,
  role_type text,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  -- Set by the retention policy, so a purge can be explained.
  purge_after timestamptz,
  constraint sandbox_session_unique unique (sandbox_id, session_key)
);

/* ---------------------------------------------- 25. jobs, resets, cleanup */

create table if not exists public.demo_sandbox_jobs (
  id uuid primary key default gen_random_uuid(),
  sandbox_id uuid not null references public.demo_sandboxes(id) on delete cascade,
  operation text not null check (operation in
    ('create','reset','rotate_credentials','expire','cleanup','deploy','health_check','extend')),
  status text not null default 'queued'
    check (status in ('queued','running','succeeded','failed','blocked','cancelled')),
  attempt integer not null default 1 check (attempt >= 1),
  idempotency_key text not null unique,
  correlation_id uuid not null default gen_random_uuid(),
  -- 24. Only one job may hold a sandbox at a time.
  holds_lock boolean not null default false,
  error_category text,
  error_detail text,
  actor_id uuid,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists sandbox_jobs_idx on public.demo_sandbox_jobs (sandbox_id, created_at desc);

-- 24. The lock itself. One running job per sandbox, enforced by the database
-- rather than by the caller remembering to check.
create unique index if not exists sandbox_single_lock
  on public.demo_sandbox_jobs (sandbox_id) where holds_lock;

create table if not exists public.demo_sandbox_resets (
  id uuid primary key default gen_random_uuid(),
  sandbox_id uuid not null references public.demo_sandboxes(id) on delete cascade,
  job_id uuid references public.demo_sandbox_jobs(id) on delete set null,
  trigger text not null check (trigger in ('scheduled','manual','demo_reset','expiry')),
  -- Each stage records what actually happened, so a partial failure is visible
  -- rather than averaged into a single "done".
  stages jsonb not null default '{}'::jsonb,
  database_reset boolean not null default false,
  uploads_reset boolean not null default false,
  branding_reapplied boolean not null default false,
  health_passed boolean not null default false,
  outcome text not null default 'pending'
    check (outcome in ('pending','succeeded','partial','failed','blocked')),
  failure_reason text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.demo_sandbox_cleanup_jobs (
  id uuid primary key default gen_random_uuid(),
  sandbox_id uuid references public.demo_sandboxes(id) on delete set null,
  scope text not null default 'expired',
  status text not null default 'queued'
    check (status in ('queued','running','succeeded','partial','failed','blocked')),
  -- What it removed and what it deliberately kept, counted at the time.
  removed jsonb not null default '{}'::jsonb,
  preserved jsonb not null default '{}'::jsonb,
  error_detail text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.demo_sandbox_snapshots (
  id uuid primary key default gen_random_uuid(),
  sandbox_id uuid not null references public.demo_sandboxes(id) on delete cascade,
  version text not null,
  deployment_version text,
  db_version text,
  assets_digest text,
  configuration jsonb not null default '{}'::jsonb,
  -- A baseline is only usable once something has actually captured it.
  captured boolean not null default false,
  captured_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  constraint sandbox_snapshot_version unique (sandbox_id, version)
);

create table if not exists public.demo_sandbox_expiry_events (
  id uuid primary key default gen_random_uuid(),
  sandbox_id uuid not null references public.demo_sandboxes(id) on delete cascade,
  kind text not null check (kind in ('warning','expiring','expired','cleanup','extended')),
  hours_out integer,
  notified boolean not null default false,
  created_at timestamptz not null default now(),
  constraint sandbox_expiry_once unique (sandbox_id, kind, hours_out)
);

create table if not exists public.demo_sandbox_health_checks (
  id uuid primary key default gen_random_uuid(),
  sandbox_id uuid not null references public.demo_sandboxes(id) on delete cascade,
  job_id uuid references public.demo_sandbox_jobs(id) on delete set null,
  -- Each check names its own result. A check that could not run is 'skipped',
  -- never 'passed'.
  checks jsonb not null default '{}'::jsonb,
  result text not null check (result in ('healthy','degraded','down','unknown')),
  detail text,
  created_at timestamptz not null default now()
);

/* ------------------------------------------------------------------- RLS */

do $$
declare t text;
begin
  foreach t in array array['demo_sandboxes','demo_sandbox_settings','demo_sandbox_credentials',
                           'demo_sandbox_activity','demo_sandbox_sessions','demo_sandbox_jobs',
                           'demo_sandbox_resets','demo_sandbox_cleanup_jobs',
                           'demo_sandbox_snapshots','demo_sandbox_expiry_events',
                           'demo_sandbox_health_checks'] loop
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

-- 31. An author or vendor sees the sandbox for their own product and nothing
-- else. Credentials are excluded from that: no seller policy exists on the
-- credentials table at all, so only an operator can read even the hash.
drop policy if exists demo_sandboxes_own on public.demo_sandboxes;
create policy demo_sandboxes_own on public.demo_sandboxes
  for select to authenticated
  using (public.mm_is_operator()
         or exists (select 1 from public.marketplace_products p
                     where p.id = demo_sandboxes.product_id
                       and public.marketplace_is_seller_member(p.seller_id)));

-- 30. Cross-sandbox reads are impossible for anybody but an operator, and the
-- activity log carries no identifying data to leak in the first place.
drop policy if exists sandbox_activity_own on public.demo_sandbox_activity;
create policy sandbox_activity_own on public.demo_sandbox_activity
  for select to authenticated
  using (public.mm_is_operator()
         or exists (select 1 from public.demo_sandboxes s
                     join public.marketplace_products p on p.id = s.product_id
                    where s.id = demo_sandbox_activity.sandbox_id
                      and public.marketplace_is_seller_member(p.seller_id)));
