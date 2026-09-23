-- Language system: bounded growth and a cheaper job claim.
--
-- 1. i18n_prune(): finished translation jobs and old quota windows are
--    deleted. Nothing reads a job once it is done or failed (its result is in
--    translation memory), and a quota window is only consulted while it is
--    current. Without this both tables grow with traffic: one quota row per
--    visitor per hour, one job per string and language ever queued. The
--    application calls it hourly from its job worker.
--
-- 2. The claim query orders queued jobs by (priority, created_at) and takes
--    the first few. The previous index put run_after between the two, so
--    Postgres read and sorted every queued job of the top priority (about
--    9,000 rows, 166 ms, measured) to return 8. An index in the query's own
--    order returns them directly.

create or replace function public.i18n_prune(
  p_job_days integer default 7,
  p_quota_hours integer default 48
)
returns table (jobs_deleted bigint, quota_windows_deleted bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jobs bigint;
  v_quota bigint;
begin
  delete from public.i18n_translation_jobs
   where status in ('done', 'failed', 'cancelled')
     and coalesce(finished_at, updated_at) < now() - make_interval(days => greatest(p_job_days, 1));
  get diagnostics v_jobs = row_count;

  -- The longest window in use is a day; anything older than two is history.
  delete from public.i18n_request_quota
   where window_start < now() - make_interval(hours => greatest(p_quota_hours, 25));
  get diagnostics v_quota = row_count;

  return query select v_jobs, v_quota;
end;
$$;

revoke all on function public.i18n_prune(integer, integer) from public, anon, authenticated;
grant execute on function public.i18n_prune(integer, integer) to service_role;

create index if not exists i18n_translation_jobs_claim_order_idx
  on public.i18n_translation_jobs (priority, created_at)
  where status = 'queued';

drop index if exists public.i18n_translation_jobs_claim_idx;
