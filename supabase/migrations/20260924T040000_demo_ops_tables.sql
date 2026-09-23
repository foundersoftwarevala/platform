-- The two tables the Demo Operations centre reads and neither of which existed.
--
-- The screen says of itself "REAL MONITORING · ZERO FAKE DATA" and that every
-- tile is computed from live rows in demos, demo_alerts, demo_escalations,
-- demo_login_credentials and demo_validation_logs. Two of those five were not
-- there: every load answered 404 twice and the escalation queue and failure
-- detection had nothing behind them at all.
--
-- The columns are the ones the screens already write and read. Nothing is
-- seeded: an escalation is raised when something goes wrong, and a validation
-- is written when a demo is actually checked.

create table if not exists public.demo_validation_logs (
  id uuid primary key default gen_random_uuid(),
  demo_id uuid references public.product_demo_urls(id) on delete cascade,
  demo_url text,
  validation_type text not null default 'health',
  status text not null default 'passed',
  http_status integer,
  response_time_ms integer,
  error_message text,
  validated_by uuid references auth.users(id) on delete set null,
  validated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists demo_validation_logs_demo_idx
  on public.demo_validation_logs(demo_id, created_at desc);
create index if not exists demo_validation_logs_created_idx
  on public.demo_validation_logs(created_at desc);

create table if not exists public.demo_escalations (
  id uuid primary key default gen_random_uuid(),
  demo_id uuid references public.product_demo_urls(id) on delete cascade,
  reason text not null,
  role text,
  level integer not null default 1,
  severity text not null default 'medium',
  status text not null default 'open',
  assigned_to uuid references auth.users(id) on delete set null,
  resolution text,
  escalated_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists demo_escalations_status_idx
  on public.demo_escalations(status, created_at desc);

-- These are operator records: read and written from the consoles, which every
-- signed-in operator reaches through the role gate on the route itself.
grant select, insert, update, delete on public.demo_validation_logs to authenticated;
grant all on public.demo_validation_logs to service_role;
grant select, insert, update, delete on public.demo_escalations to authenticated;
grant all on public.demo_escalations to service_role;

alter table public.demo_validation_logs enable row level security;
alter table public.demo_escalations enable row level security;

do $$ begin
  create policy "operators read demo validations" on public.demo_validation_logs
    for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "operators write demo validations" on public.demo_validation_logs
    for insert to authenticated with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "operators clear demo validations" on public.demo_validation_logs
    for delete to authenticated using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "operators read demo escalations" on public.demo_escalations
    for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "operators raise demo escalations" on public.demo_escalations
    for insert to authenticated with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "operators resolve demo escalations" on public.demo_escalations
    for update to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
