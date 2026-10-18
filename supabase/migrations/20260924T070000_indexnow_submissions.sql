-- Every URL this platform has told a search engine about, and what it said back.
--
-- src/lib/bing-indexnow-integration.functions.ts has been writing submissions
-- to indexnow_submissions since it was written, and the table has never
-- existed, so every submission it made was lost the moment it returned. This
-- creates it. Nothing is dropped and nothing existing is altered.
--
-- The response body is kept as the service sent it: a submission that was
-- refused is worth more than one that was quietly forgotten.

create table if not exists public.indexnow_submissions (
  id uuid primary key default gen_random_uuid(),
  submission_id text not null,
  host text not null,
  url_count integer not null default 0,
  urls_submitted jsonb not null default '[]'::jsonb,
  status text not null default 'submitted',
  response_status integer,
  response_body text,
  created_at timestamptz not null default now()
);

create index if not exists indexnow_submissions_created_at_idx
  on public.indexnow_submissions (created_at desc);
create index if not exists indexnow_submissions_host_idx
  on public.indexnow_submissions (host);

alter table public.indexnow_submissions enable row level security;

-- Read by the operator consoles through the service role, like the other
-- operations tables. No policy grants the browser anything, which is what
-- keeps a submission log out of a visitor's reach.
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'indexnow_submissions'
       and policyname = 'indexnow_submissions_service_role'
  ) then
    create policy indexnow_submissions_service_role
      on public.indexnow_submissions
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

comment on table public.indexnow_submissions is
  'URLs submitted to IndexNow, with the status and body the service returned.';
