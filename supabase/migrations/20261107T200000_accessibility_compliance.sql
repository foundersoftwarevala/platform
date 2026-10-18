-- Accessibility results for demo pages.
--
-- The Demo Operations Center (OpsScorePanel, useOpsAccessibility) reads
-- accessibility_compliance and matches each row to a demo by host in page_url,
-- showing the WCAG level and status. The table was never created, so the read
-- failed and every demo showed "a11y n/a" with an error behind it. Nothing
-- else in the database records an accessibility check, so this is the table
-- itself, minimal: one row per checked page.
--
-- Secured like the sibling demo tables (demo_alerts, demo_login_credentials):
-- admin and boss manage it, anon is denied. The checker that fills it runs
-- server-side with the service key.

begin;

create table if not exists public.accessibility_compliance (
  id          uuid primary key default gen_random_uuid(),
  page_url    text not null,
  wcag_level  text,                                -- e.g. A, AA, AAA
  status      text not null default 'pending',     -- pass, fail, partial, pending
  score       numeric,
  issues      jsonb not null default '[]'::jsonb,
  checked_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists accessibility_compliance_page_url_idx
  on public.accessibility_compliance (page_url);

alter table public.accessibility_compliance enable row level security;

drop policy if exists anon_write_denied on public.accessibility_compliance;
create policy anon_write_denied on public.accessibility_compliance
  for all to anon using (false) with check (false);

drop policy if exists "accessibility_compliance admin all" on public.accessibility_compliance;
create policy "accessibility_compliance admin all" on public.accessibility_compliance
  for all to authenticated
  using (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'boss'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'boss'::app_role));

grant select, insert, update, delete on public.accessibility_compliance to authenticated;
grant all on public.accessibility_compliance to service_role;

notify pgrst, 'reload schema';

commit;
