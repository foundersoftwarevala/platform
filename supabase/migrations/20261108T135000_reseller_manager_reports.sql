-- Saved Reseller Manager report definitions and durable run history.

create table if not exists public.reseller_manager_reports (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  report_type text not null check (report_type in ('sales', 'commissions')),
  from_date date not null,
  to_date date not null,
  last_run_at timestamptz,
  last_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reseller_manager_reports_date_range check (to_date >= from_date)
);

create table if not exists public.reseller_manager_report_runs (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reseller_manager_reports(id) on delete cascade,
  result jsonb not null,
  row_count integer not null check (row_count between 0 and 20000),
  created_at timestamptz not null default now()
);

create index if not exists reseller_manager_reports_updated_idx
  on public.reseller_manager_reports (updated_at desc);
create index if not exists reseller_manager_report_runs_report_created_idx
  on public.reseller_manager_report_runs (report_id, created_at desc);

alter table public.reseller_manager_reports enable row level security;
alter table public.reseller_manager_report_runs enable row level security;

revoke all on public.reseller_manager_reports, public.reseller_manager_report_runs
  from public, anon, authenticated;
grant all on public.reseller_manager_reports, public.reseller_manager_report_runs
  to service_role;

comment on table public.reseller_manager_reports is
  'Saved Reseller Manager report parameters and the most recent result snapshot.';
comment on table public.reseller_manager_report_runs is
  'Append-only history of generated Reseller Manager report result snapshots.';

NOTIFY pgrst, 'reload schema';
