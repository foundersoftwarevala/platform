-- Language system: the job queue heals itself, memory is no longer readable
-- through the public API, and the reads that run on a timer get their indexes.
--
-- 1. An engine outage no longer kills queued work. A job that could not run
--    because the engine did not answer (last error "engine_unavailable...")
--    did not fail: its attempt is given back and it waits five minutes.
--    Before, three such answers in about six minutes - one engine restart -
--    marked the job failed for good, and nothing queued it again.
-- 2. i18n_requeue_failed_jobs(): failed jobs whose last error matches a prefix
--    go back to the queue (the worker runs it hourly for engine outages; the
--    Language Manager can run it for any error). i18n_mark_upgrade_attempted():
--    a quality upgrade the gate refused is not queued again on every start.
-- 3. marketplace_translations is read and written only by the server (service
--    role). The anon/authenticated read policy let anyone holding the public
--    key list every servable row of every namespace; no client reads the table.
--    The operator write policy let a signed-in operator write memory directly,
--    past the quality gate and the caches.
-- 4. Indexes for the language pack build and the stale-marking pass.
-- 5. i18n_prune_revisions(): machine revision history is bounded.

-- 1 ---------------------------------------------------------------------------
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
                       when coalesce(p_error, '') like 'engine_unavailable%'
                         then now() + interval '5 minutes'
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

-- 2 ---------------------------------------------------------------------------
create or replace function public.i18n_requeue_failed_jobs(p_error_prefix text default 'engine_unavailable')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  -- A key that already has an open job is left alone (one open job per key).
  update public.i18n_translation_jobs j
     set status = 'queued', attempts = 0, run_after = now(), finished_at = null,
         locked_at = null, locked_by = null, updated_at = now()
   where j.status = 'failed'
     and (p_error_prefix is null or coalesce(j.last_error, '') like p_error_prefix || '%')
     and not exists (
           select 1 from public.i18n_translation_jobs o
            where o.source_hash = j.source_hash
              and o.source_language = j.source_language
              and o.target_language = j.target_language
              and o.context_hash = j.context_hash
              and o.status in ('queued', 'running'));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.i18n_requeue_failed_jobs(text) from public, anon, authenticated;
grant execute on function public.i18n_requeue_failed_jobs(text) to service_role;

-- Machine translations whose quality-mode upgrade failed the quality gate keep
-- their realtime text; this marks them so the catalogue sync stops queueing the
-- same upgrade on every start. p_keys: [{source_hash, source_language,
-- target_language, context_hash}].
create or replace function public.i18n_mark_upgrade_attempted(p_keys jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if jsonb_typeof(p_keys) <> 'array' or jsonb_array_length(p_keys) > 1000 then
    raise exception 'p_keys must be an array of at most 1000 keys';
  end if;
  update public.marketplace_translations m
     set metadata = m.metadata || jsonb_build_object('upgrade_attempted', now())
    from jsonb_to_recordset(p_keys) as k(source_hash text, source_language text,
                                         target_language text, context_hash text)
   where m.source_hash = k.source_hash
     and m.source_language = k.source_language
     and m.target_language = k.target_language
     and m.context_hash = k.context_hash
     and m.status = 'machine';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.i18n_mark_upgrade_attempted(jsonb) from public, anon, authenticated;
grant execute on function public.i18n_mark_upgrade_attempted(jsonb) to service_role;

-- 3 ---------------------------------------------------------------------------
drop policy if exists "translations public read" on public.marketplace_translations;
drop policy if exists "translations operator write" on public.marketplace_translations;

-- 4 ---------------------------------------------------------------------------
-- The language pack: one language's ui rows, newest first.
create index if not exists marketplace_translations_pack_idx
  on public.marketplace_translations (target_language, namespace, updated_at desc)
  where status in ('machine', 'verified', 'needs_review', 'rejected');

-- i18n_mark_stale and the catalogue sync filter keyed messages by context.
create index if not exists marketplace_translations_context_idx
  on public.marketplace_translations (namespace, context)
  where context is not null;

-- 5 ---------------------------------------------------------------------------
-- Keeps the newest p_keep revisions of each translation and every revision a
-- person made (changed_by set, or human text); older machine revisions go.
create or replace function public.i18n_prune_revisions(p_keep integer default 5)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted bigint;
begin
  with ranked as (
    select id,
           row_number() over (partition by translation_id order by version desc) as rn
      from public.i18n_translation_revisions
     where changed_by is null and coalesce(engine, '') <> 'human'
  )
  delete from public.i18n_translation_revisions r
   using ranked
   where r.id = ranked.id and ranked.rn > greatest(p_keep, 1);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.i18n_prune_revisions(integer) from public, anon, authenticated;
grant execute on function public.i18n_prune_revisions(integer) to service_role;
