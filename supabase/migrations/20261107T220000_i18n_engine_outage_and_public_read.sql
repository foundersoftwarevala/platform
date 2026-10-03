-- Translation jobs survive an engine outage, and public read access to
-- translation memory is limited to what the language pack serves.
--
-- 1. i18n_finish_translation_job. A job's attempt is counted when it is
--    claimed (i18n_claim_translation_jobs). A batch that found the engine
--    down (error "engine_unavailable", from src/lib/i18n/jobs.server.ts) spent
--    one attempt per job, and after three - 60, 120 and 240 seconds apart,
--    about seven minutes - the job was failed for good, though nothing was
--    wrong with it. Such a failure now gives its attempt back and the job is
--    tried again in two minutes; any other failure is handled as before.
--    The worker also stops claiming jobs while the engine does not answer
--    /ready, so this is the second line, not the first.
--
-- 2. i18n_requeue_engine_failures(). Jobs already failed for that reason (or
--    failed by an older worker) are put back in the queue; the worker calls
--    it hourly. Service role only.
--
-- 3. "translations public read" now also requires namespace = 'ui'. The
--    language pack, the only public reader, serves that namespace alone, and
--    it reads with the service role; other namespaces' rows and metadata were
--    readable by anyone for no purpose.

begin;

create or replace function public.i18n_finish_translation_job(
  p_id uuid, p_worker text, p_ok boolean, p_result_status text, p_quality numeric, p_error text)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  update public.i18n_translation_jobs
     set status = case
                    when p_ok then 'done'
                    -- The engine was down: not the job's fault, never final.
                    when coalesce(p_error, '') like 'engine_unavailable%' then 'queued'
                    when attempts >= max_attempts then 'failed'
                    else 'queued'
                  end,
         attempts = case
                      when not p_ok and coalesce(p_error, '') like 'engine_unavailable%'
                        then greatest(attempts - 1, 0)
                      else attempts
                    end,
         run_after = case
                       when p_ok then run_after
                       when coalesce(p_error, '') like 'engine_unavailable%' then now() + interval '2 minutes'
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
$function$;

create or replace function public.i18n_requeue_engine_failures()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_count integer;
begin
  update public.i18n_translation_jobs
     set status = 'queued',
         attempts = 0,
         run_after = now(),
         locked_at = null,
         locked_by = null,
         finished_at = null,
         updated_at = now()
   where status = 'failed'
     and coalesce(last_error, '') like 'engine_unavailable%';
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke all on function public.i18n_requeue_engine_failures() from public, anon, authenticated;
grant execute on function public.i18n_requeue_engine_failures() to service_role;

alter policy "translations public read" on public.marketplace_translations
  using (status = any (array['machine'::text, 'verified'::text]) and namespace = 'ui');

commit;
