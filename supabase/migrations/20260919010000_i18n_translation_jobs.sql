-- Background translation jobs, and the reporting the Language Manager reads.
--
-- Jobs translate text ahead of time - the interface catalogue into every
-- language, catalogue content an operator asks for - through the same pipeline
-- as live requests, in "quality" mode, and store the result in translation
-- memory. Workers claim jobs with SKIP LOCKED leases, so any number of server
-- instances can run them without translating the same text twice.

create table if not exists public.i18n_translation_jobs (
  id               uuid primary key default gen_random_uuid(),
  source_hash      text not null check (source_hash ~ '^[0-9a-f]{32}$'),
  source_text      text not null check (char_length(source_text) between 1 and 5000),
  source_language  text not null default 'en'
                     references public.i18n_languages(code) on update cascade,
  target_language  text not null
                     references public.i18n_languages(code) on update cascade,
  namespace        text not null default 'ui'
                     check (namespace ~ '^[a-z0-9][a-z0-9._-]{0,47}$'),
  context          text check (context is null or char_length(context) <= 500),
  context_hash     text not null check (context_hash ~ '^[0-9a-f]{32}$'),
  -- Re-translate even if memory already holds an unreviewed machine translation.
  refresh          boolean not null default false,
  priority         smallint not null default 100,
  status           text not null default 'queued'
                     check (status in ('queued', 'running', 'done', 'failed', 'cancelled')),
  attempts         smallint not null default 0,
  max_attempts     smallint not null default 3,
  run_after        timestamptz not null default now(),
  locked_at        timestamptz,
  locked_by        text,
  result_status    text,
  quality_score    numeric(4, 3),
  last_error       text,
  requested_by     uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  finished_at      timestamptz
);

-- One open job per memory key.
create unique index if not exists i18n_translation_jobs_open_key
  on public.i18n_translation_jobs (source_hash, source_language, target_language, context_hash)
  where status in ('queued', 'running');

create index if not exists i18n_translation_jobs_claim_idx
  on public.i18n_translation_jobs (priority, run_after, created_at)
  where status = 'queued';

create index if not exists i18n_translation_jobs_status_idx
  on public.i18n_translation_jobs (status, target_language);

alter table public.i18n_translation_jobs enable row level security;

drop policy if exists i18n_translation_jobs_operator_read on public.i18n_translation_jobs;
create policy i18n_translation_jobs_operator_read on public.i18n_translation_jobs
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'boss'::public.app_role));

-- Enqueue. Skips a key that already has an open job, and - unless refresh is
-- asked for - a key memory already answers or holds for review.
create or replace function public.i18n_enqueue_translation_jobs(p_jobs jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if jsonb_typeof(p_jobs) <> 'array' or jsonb_array_length(p_jobs) > 20000 then
    raise exception 'p_jobs must be an array of at most 20000 jobs';
  end if;

  with incoming as (
    select distinct on (j.source_hash, coalesce(j.source_language, 'en'), j.target_language, j.context_hash)
           j.source_hash, j.source_text, coalesce(j.source_language, 'en') as source_language,
           j.target_language, coalesce(j.namespace, 'ui') as namespace, j.context, j.context_hash,
           coalesce(j.refresh, false) as refresh, coalesce(j.priority, 100)::smallint as priority,
           j.requested_by
      from jsonb_to_recordset(p_jobs) as j(
             source_hash text, source_text text, source_language text, target_language text,
             namespace text, context text, context_hash text, refresh boolean, priority integer,
             requested_by uuid)
  ), inserted as (
    insert into public.i18n_translation_jobs
      (source_hash, source_text, source_language, target_language, namespace, context,
       context_hash, refresh, priority, requested_by)
    select i.source_hash, i.source_text, i.source_language, i.target_language, i.namespace,
           i.context, i.context_hash, i.refresh, i.priority, i.requested_by
      from incoming i
     where i.refresh
        or not exists (
             select 1 from public.marketplace_translations m
              where m.source_hash = i.source_hash
                and m.source_language = i.source_language
                and m.target_language = i.target_language
                and m.context_hash = i.context_hash
                and m.status in ('machine', 'verified', 'needs_review', 'rejected'))
    on conflict (source_hash, source_language, target_language, context_hash)
      where status in ('queued', 'running')
      do nothing
    returning 1
  )
  select count(*) into v_count from inserted;
  return v_count;
end;
$$;

-- Claim up to p_limit jobs for p_worker. A lease older than p_lease_seconds is
-- taken back first, so a worker that died does not strand its jobs.
create or replace function public.i18n_claim_translation_jobs(
  p_worker text,
  p_limit integer,
  p_lease_seconds integer default 600
)
returns setof public.i18n_translation_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.i18n_translation_jobs
     set status = 'queued', locked_at = null, locked_by = null, updated_at = now()
   where status = 'running'
     and locked_at < now() - make_interval(secs => greatest(p_lease_seconds, 60));

  return query
  with picked as (
    select id
      from public.i18n_translation_jobs
     where status = 'queued' and run_after <= now()
     order by priority, created_at
     limit greatest(1, least(p_limit, 200))
     for update skip locked
  )
  update public.i18n_translation_jobs j
     set status = 'running', locked_at = now(), locked_by = p_worker,
         attempts = j.attempts + 1, updated_at = now()
    from picked
   where j.id = picked.id
  returning j.*;
end;
$$;

-- Record the outcome of a claimed job. A failure is retried with exponential
-- back-off until max_attempts.
create or replace function public.i18n_finish_translation_job(
  p_id uuid,
  p_worker text,
  p_ok boolean,
  p_result_status text,
  p_quality numeric,
  p_error text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.i18n_translation_jobs
     set status = case
                    when p_ok then 'done'
                    when attempts >= max_attempts then 'failed'
                    else 'queued'
                  end,
         run_after = case
                       when p_ok then run_after
                       else now() + make_interval(secs => 60 * power(2, attempts)::integer)
                     end,
         result_status = p_result_status,
         quality_score = p_quality,
         last_error = left(p_error, 1000),
         locked_at = null,
         locked_by = null,
         finished_at = case when p_ok then now() else finished_at end,
         updated_at = now()
   where id = p_id and locked_by = p_worker and status = 'running';
$$;

create or replace function public.i18n_translation_coverage()
returns table (
  target_language text,
  verified bigint,
  machine bigint,
  needs_review bigint,
  rejected bigint,
  legacy bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select m.target_language,
         count(*) filter (where m.status = 'verified'),
         count(*) filter (where m.status = 'machine'),
         count(*) filter (where m.status = 'needs_review'),
         count(*) filter (where m.status = 'rejected'),
         count(*) filter (where m.status in ('legacy', 'stale'))
    from public.marketplace_translations m
   where m.target_language is not null
   group by m.target_language;
$$;

create or replace function public.i18n_job_summary()
returns table (status text, target_language text, jobs bigint)
language sql
stable
security definer
set search_path = public
as $$
  select j.status, j.target_language, count(*)
    from public.i18n_translation_jobs j
   where j.status in ('queued', 'running', 'failed')
      or j.updated_at > now() - interval '1 day'
   group by j.status, j.target_language;
$$;

revoke all on function public.i18n_enqueue_translation_jobs(jsonb) from public, anon, authenticated;
revoke all on function public.i18n_claim_translation_jobs(text, integer, integer) from public, anon, authenticated;
revoke all on function public.i18n_finish_translation_job(uuid, text, boolean, text, numeric, text) from public, anon, authenticated;
revoke all on function public.i18n_translation_coverage() from public, anon, authenticated;
revoke all on function public.i18n_job_summary() from public, anon, authenticated;
grant execute on function public.i18n_enqueue_translation_jobs(jsonb) to service_role;
grant execute on function public.i18n_claim_translation_jobs(text, integer, integer) to service_role;
grant execute on function public.i18n_finish_translation_job(uuid, text, boolean, text, numeric, text) to service_role;
grant execute on function public.i18n_translation_coverage() to service_role;
grant execute on function public.i18n_job_summary() to service_role;
