-- Short-lived records for public demo launches.
-- The UUID is a tracking/isolation hint; the external demo must understand it
-- before it can isolate server-side application data.

create table if not exists public.demo_visitor_sessions (
  visitor_session_id uuid primary key,
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  demo_url_id uuid not null references public.product_demo_urls(id) on delete cascade,
  category_id uuid not null references public.marketplace_categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  constraint demo_visitor_sessions_expiry_check check (expires_at > created_at)
);

create index if not exists demo_visitor_sessions_expiry_idx
  on public.demo_visitor_sessions (expires_at);

create index if not exists demo_visitor_sessions_ended_idx
  on public.demo_visitor_sessions (ended_at)
  where ended_at is not null;

comment on table public.demo_visitor_sessions is
  'Thirty-minute demo launch records. The session UUID is forwarded to the external demo as sv_session_id; it is not an isolation boundary unless that demo supports it.';

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'sv_app') then
    grant select, insert, update, delete on public.demo_visitor_sessions to sv_app;
  end if;
end
$$;
