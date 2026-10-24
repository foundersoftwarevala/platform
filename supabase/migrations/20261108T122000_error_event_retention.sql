create extension if not exists pg_cron;

create or replace function public.purge_old_error_events()
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted_count bigint;
begin
  delete from public.error_events
   where occurred_at < now() - interval '30 days';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.purge_old_error_events() from public, anon, authenticated;
grant execute on function public.purge_old_error_events() to service_role;

do $$
declare
  existing_job_id bigint;
begin
  select jobid
    into existing_job_id
    from cron.job
   where jobname = 'purge-error-events-older-than-30-days';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'purge-error-events-older-than-30-days',
    '23 3 * * *',
    'select public.purge_old_error_events();'
  );
end;
$$;

comment on function public.purge_old_error_events() is
  'Deletes error_events records older than 30 days; scheduled daily by pg_cron.';
