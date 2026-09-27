-- A queue Founder AI teams can share, taken from the one that already works.
--
-- The platform has a real, proven job queue: i18n_translation_jobs, with
-- i18n_claim_translation_jobs on top of it, has moved 191,369 jobs. Its claim
-- is correct in the ways that matter — expired leases are reclaimed before
-- anything is picked, candidates are taken with FOR UPDATE SKIP LOCKED so two
-- workers cannot take the same row, and the pick is ordered by priority then
-- age against a partial index that only covers queued rows. Its idempotency is
-- a partial unique index over the open statuses, so the same logical job cannot
-- be queued twice while one is outstanding but may be run again later.
--
-- None of that is specific to translation. What is specific is the table it
-- reads, which is why every other queue-shaped thing on the platform —
-- demo_provision_jobs, product_url_jobs, security_scan_jobs, server_backup_jobs
-- — is its own small table with none of the machinery. The Demo Operations team
-- needs four workers, and building a fifth private queue for them would be the
-- fourth mistake of the same shape.
--
-- So the mechanism moves here and the translation queue is left exactly as it
-- is. Nothing in this migration touches i18n: it has 191,369 jobs of history
-- and a schema tuned to its own work, and rewriting it to prove a point would
-- risk the one queue that is already carrying load.
--
-- What is deliberately NOT here: any business logic. fa_jobs knows a job type,
-- a payload and how to hand it to one worker at a time. What a demo scan does
-- lives in the Demo Manager, where it already does.
--
--   fa_enqueue(type, payload, ...)   put work in, or return the open job that
--                                    already covers it
--   fa_claim(worker, type, n, lease) take up to n, respecting the type's
--                                    concurrency limit
--   fa_heartbeat(ids, worker)        extend the lease on long work
--   fa_complete(id, worker, result)  done
--   fa_fail(id, worker, error, class) retry with backoff, or dead-letter
--   fa_cancel(id, reason)            stop work that has not started

-- ---------------------------------------------------------------- the states
--   queued       waiting, claimable once run_after has passed
--   running      leased to a worker
--   completed    finished
--   retrying     failed, waiting for next_retry_at, claimable after it
--   dead_letter  out of attempts, or a failure no retry could fix
--   cancelled    withdrawn before it ran
--
-- retrying is a separate state from queued on purpose: "waiting to be tried
-- again" and "never tried" are different things to an operator looking at a
-- backlog, and collapsing them hides how much of a queue is actually stuck.

CREATE TABLE IF NOT EXISTS public.fa_jobs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type         text        NOT NULL,
  payload          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  -- What the job is about, so a row can be found without reading payloads:
  -- a product id, a demo id, a url. Never used for locking.
  reference        text,
  priority         smallint    NOT NULL DEFAULT 100,
  status           text        NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','completed','retrying','dead_letter','cancelled')),

  attempts         smallint    NOT NULL DEFAULT 0,
  max_attempts     smallint    NOT NULL DEFAULT 5,
  run_after        timestamptz NOT NULL DEFAULT now(),
  next_retry_at    timestamptz,

  locked_by        text,
  locked_at        timestamptz,
  lease_expires_at timestamptz,

  -- The same key may exist many times in history; the partial index below
  -- allows only one open at a time.
  idempotency_key  text,
  -- Ties a job to the agent run that asked for it, so the chain from a Founder
  -- AI decision through to a provider call can be followed in one direction.
  correlation_id   uuid,

  result           jsonb,
  last_error       text,
  last_error_class text
    CHECK (last_error_class IS NULL OR last_error_class IN
      ('transient','permanent','rate_limit','auth','provider_credit','timeout','validation','unknown')),

  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  started_at       timestamptz,
  completed_at     timestamptz,
  failed_at        timestamptz
);

-- The claim reads only queued and retrying rows, so the index covers only
-- those. On a table that is mostly history this is the difference between
-- scanning the backlog and scanning everything that ever ran.
CREATE INDEX IF NOT EXISTS fa_jobs_claim_idx
  ON public.fa_jobs (job_type, priority, run_after)
  WHERE status IN ('queued','retrying');

-- Reclaiming expired leases reads only running rows.
CREATE INDEX IF NOT EXISTS fa_jobs_lease_idx
  ON public.fa_jobs (lease_expires_at)
  WHERE status = 'running';

CREATE INDEX IF NOT EXISTS fa_jobs_type_status_idx ON public.fa_jobs (job_type, status);
CREATE INDEX IF NOT EXISTS fa_jobs_reference_idx   ON public.fa_jobs (reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS fa_jobs_correlation_idx ON public.fa_jobs (correlation_id) WHERE correlation_id IS NOT NULL;

-- Idempotency, the way the translation queue does it: one open job per key.
-- A completed job does not block the same work being asked for again later,
-- which is what makes this usable for scheduled re-runs.
CREATE UNIQUE INDEX IF NOT EXISTS fa_jobs_open_key
  ON public.fa_jobs (job_type, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND status IN ('queued','running','retrying');

-- ------------------------------------------------------- concurrency by type
-- Not a number in code. AI work and HTTP scanning have different safe ceilings
-- and both change with the account behind them, so the ceiling is a row an
-- operator can raise without a deploy.
CREATE TABLE IF NOT EXISTS public.fa_job_limits (
  job_type       text PRIMARY KEY,
  max_concurrent integer NOT NULL CHECK (max_concurrent > 0),
  note           text,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fa_job_limits IS
  'How many jobs of a type may run at once. A type with no row here is not limited by the queue; the claim limit the worker asks for is then the only ceiling.';

-- ------------------------------------------------------------------ enqueue
CREATE OR REPLACE FUNCTION public.fa_enqueue(
  p_job_type        text,
  p_payload         jsonb DEFAULT '{}'::jsonb,
  p_reference       text DEFAULT NULL,
  p_priority        smallint DEFAULT 100,
  p_max_attempts    smallint DEFAULT 5,
  p_run_after       timestamptz DEFAULT now(),
  p_idempotency_key text DEFAULT NULL,
  p_correlation_id  uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_existing public.fa_jobs%ROWTYPE;
  v_row      public.fa_jobs%ROWTYPE;
BEGIN
  IF coalesce(btrim(p_job_type), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'job_type_required');
  END IF;

  -- The caller is told it was a duplicate rather than quietly handed a second
  -- job, because "we already have this" is usually what it wanted to know.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.fa_jobs
     WHERE job_type = p_job_type
       AND idempotency_key = p_idempotency_key
       AND status IN ('queued','running','retrying')
     LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true,
        'job_id', v_existing.id, 'status', v_existing.status);
    END IF;
  END IF;

  INSERT INTO public.fa_jobs
    (job_type, payload, reference, priority, max_attempts, run_after,
     idempotency_key, correlation_id, created_by)
  VALUES
    (btrim(p_job_type), coalesce(p_payload, '{}'::jsonb), p_reference,
     coalesce(p_priority, 100), greatest(coalesce(p_max_attempts, 5), 1),
     coalesce(p_run_after, now()), p_idempotency_key, p_correlation_id, auth.uid())
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'duplicate', false,
    'job_id', v_row.id, 'status', v_row.status);
EXCEPTION
  -- Two callers enqueueing the same key at the same moment: the index decides,
  -- and the loser is told the same thing the earlier check would have told it.
  WHEN unique_violation THEN
    SELECT * INTO v_existing FROM public.fa_jobs
     WHERE job_type = p_job_type
       AND idempotency_key = p_idempotency_key
       AND status IN ('queued','running','retrying')
     LIMIT 1;
    RETURN jsonb_build_object('ok', true, 'duplicate', true,
      'job_id', v_existing.id, 'status', v_existing.status);
END;
$function$;

-- -------------------------------------------------------------------- claim
CREATE OR REPLACE FUNCTION public.fa_claim(
  p_worker        text,
  p_job_type      text DEFAULT NULL,
  p_limit         integer DEFAULT 10,
  p_lease_seconds integer DEFAULT 300
)
RETURNS SETOF public.fa_jobs
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_lease   integer := greatest(coalesce(p_lease_seconds, 300), 30);
  v_want    integer := greatest(least(coalesce(p_limit, 10), 500), 1);
  v_running integer;
  v_cap     integer;
BEGIN
  IF coalesce(btrim(p_worker), '') = '' THEN
    RAISE EXCEPTION 'fa_claim needs a worker name so a lease can be owned';
  END IF;

  -- A worker that died holds its lease until it expires. Freeing those first
  -- is what makes a crash recoverable without anybody intervening; the attempt
  -- already counted, so a job cannot loop on this forever.
  UPDATE public.fa_jobs
     SET status = 'queued', locked_by = NULL, locked_at = NULL,
         lease_expires_at = NULL, updated_at = now(),
         last_error = coalesce(last_error, 'the worker holding this job stopped reporting'),
         last_error_class = coalesce(last_error_class, 'transient')
   WHERE status = 'running'
     AND lease_expires_at IS NOT NULL
     AND lease_expires_at < now()
     AND (p_job_type IS NULL OR job_type = p_job_type);

  -- A type's ceiling counts what is running everywhere, not just what this
  -- worker holds, so two machines cannot each run up to the limit.
  IF p_job_type IS NOT NULL THEN
    SELECT max_concurrent INTO v_cap FROM public.fa_job_limits WHERE job_type = p_job_type;
    IF v_cap IS NOT NULL THEN
      SELECT count(*) INTO v_running FROM public.fa_jobs
       WHERE job_type = p_job_type AND status = 'running';
      v_want := least(v_want, greatest(v_cap - v_running, 0));
      IF v_want = 0 THEN RETURN; END IF;
    END IF;
  END IF;

  RETURN QUERY
  WITH picked AS (
    SELECT id FROM public.fa_jobs
     WHERE status IN ('queued','retrying')
       AND run_after <= now()
       AND (next_retry_at IS NULL OR next_retry_at <= now())
       AND (p_job_type IS NULL OR job_type = p_job_type)
     ORDER BY priority, run_after, created_at
     LIMIT v_want
     FOR UPDATE SKIP LOCKED
  )
  UPDATE public.fa_jobs j
     SET status = 'running',
         locked_by = p_worker,
         locked_at = now(),
         lease_expires_at = now() + make_interval(secs => v_lease),
         attempts = j.attempts + 1,
         started_at = coalesce(j.started_at, now()),
         updated_at = now()
    FROM picked
   WHERE j.id = picked.id
  RETURNING j.*;
END;
$function$;

-- ---------------------------------------------------------------- heartbeat
CREATE OR REPLACE FUNCTION public.fa_heartbeat(
  p_ids uuid[],
  p_worker text,
  p_lease_seconds integer DEFAULT 300
)
RETURNS integer
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH extended AS (
    UPDATE public.fa_jobs
       SET lease_expires_at = now() + make_interval(secs => greatest(coalesce(p_lease_seconds, 300), 30)),
           updated_at = now()
     WHERE id = ANY(p_ids)
       AND status = 'running'
       -- Only the holder may extend, so a stale worker cannot keep a job it
       -- has already lost to a reclaim.
       AND locked_by = p_worker
    RETURNING 1)
  SELECT count(*)::int FROM extended;
$function$;

-- ----------------------------------------------------------------- complete
CREATE OR REPLACE FUNCTION public.fa_complete(
  p_id uuid, p_worker text, p_result jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_row public.fa_jobs%ROWTYPE;
BEGIN
  UPDATE public.fa_jobs
     SET status = 'completed', result = coalesce(p_result, '{}'::jsonb),
         completed_at = now(), updated_at = now(),
         locked_by = NULL, locked_at = NULL, lease_expires_at = NULL
   WHERE id = p_id AND status = 'running' AND locked_by = p_worker
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    -- Either somebody else holds it now or it is already finished. Saying which
    -- matters: a worker that lost its lease should stop, not retry.
    RETURN jsonb_build_object('ok', false, 'reason', 'not_held_by_worker');
  END IF;
  RETURN jsonb_build_object('ok', true, 'job_id', v_row.id, 'status', v_row.status);
END;
$function$;

-- --------------------------------------------------------------------- fail
CREATE OR REPLACE FUNCTION public.fa_fail(
  p_id uuid, p_worker text, p_error text, p_error_class text DEFAULT 'unknown'
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_row     public.fa_jobs%ROWTYPE;
  v_class   text := coalesce(nullif(btrim(p_error_class), ''), 'unknown');
  v_retry   boolean;
  v_delay   integer;
BEGIN
  SELECT * INTO v_row FROM public.fa_jobs
   WHERE id = p_id AND status = 'running' AND locked_by = p_worker;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_held_by_worker');
  END IF;

  -- Retrying a permanent failure is how a queue burns an afternoon proving
  -- something it already knew. A bad payload, a rejected credential and an
  -- exhausted provider balance will all fail again in a minute, so they go
  -- straight to the dead letter with the reason intact.
  v_retry := v_class IN ('transient','rate_limit','timeout','unknown')
             AND v_row.attempts < v_row.max_attempts;

  IF v_retry THEN
    -- Exponential, capped at an hour, with jitter so a batch that failed
    -- together does not come back together.
    v_delay := least(60 * power(2, greatest(v_row.attempts - 1, 0))::int, 3600);
    v_delay := v_delay + (random() * greatest(v_delay / 4, 1))::int;
    UPDATE public.fa_jobs
       SET status = 'retrying', last_error = left(coalesce(p_error, ''), 2000),
           last_error_class = v_class, failed_at = now(), updated_at = now(),
           next_retry_at = now() + make_interval(secs => v_delay),
           locked_by = NULL, locked_at = NULL, lease_expires_at = NULL
     WHERE id = p_id
    RETURNING * INTO v_row;
    RETURN jsonb_build_object('ok', true, 'status', 'retrying',
      'attempt', v_row.attempts, 'of', v_row.max_attempts,
      'next_retry_at', v_row.next_retry_at, 'error_class', v_class);
  END IF;

  UPDATE public.fa_jobs
     SET status = 'dead_letter', last_error = left(coalesce(p_error, ''), 2000),
         last_error_class = v_class, failed_at = now(), updated_at = now(),
         locked_by = NULL, locked_at = NULL, lease_expires_at = NULL
   WHERE id = p_id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'status', 'dead_letter',
    'attempt', v_row.attempts, 'of', v_row.max_attempts,
    'error_class', v_class,
    'reason', CASE WHEN v_row.attempts >= v_row.max_attempts
                   THEN 'out of attempts' ELSE 'the failure would repeat' END);
END;
$function$;

-- ------------------------------------------------------------------- cancel
CREATE OR REPLACE FUNCTION public.fa_cancel(p_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_row public.fa_jobs%ROWTYPE;
BEGIN
  -- Work in flight is left alone. Cancelling a running job would take its lease
  -- away while the worker is still acting on it, which is how a half-finished
  -- business action gets abandoned with nobody responsible for it.
  UPDATE public.fa_jobs
     SET status = 'cancelled', last_error = coalesce(p_reason, 'cancelled'),
         updated_at = now()
   WHERE id = p_id AND status IN ('queued','retrying')
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_cancellable',
      'message', 'Only a job that has not started can be cancelled.');
  END IF;
  RETURN jsonb_build_object('ok', true, 'job_id', v_row.id);
END;
$function$;

-- ------------------------------------------------------------------- health
CREATE OR REPLACE FUNCTION public.fa_queue_health(p_job_type text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  -- Guarded like the rest of the operator surface. How deep a queue is and
  -- which job types exist is not much on its own, but it describes the shape
  -- of the platform.s internal work and a visitor has no use for it.
  SELECT CASE WHEN NOT public.mm_is_operator()
              THEN jsonb_build_object('ok', false, 'reason', 'not_permitted')
              ELSE coalesce(jsonb_agg(row ORDER BY row->>'job_type'), '[]'::jsonb) END
  FROM (
    SELECT jsonb_build_object(
      'job_type', j.job_type,
      'queued',      count(*) FILTER (WHERE j.status = 'queued'),
      'running',     count(*) FILTER (WHERE j.status = 'running'),
      'retrying',    count(*) FILTER (WHERE j.status = 'retrying'),
      'completed',   count(*) FILTER (WHERE j.status = 'completed'),
      'dead_letter', count(*) FILTER (WHERE j.status = 'dead_letter'),
      'cancelled',   count(*) FILTER (WHERE j.status = 'cancelled'),
      -- How long the oldest thing still waiting has waited. A backlog that is
      -- not growing can still be a backlog nobody is serving.
      'oldest_wait_seconds',
        extract(epoch FROM now() - min(j.run_after) FILTER (WHERE j.status IN ('queued','retrying')))::int,
      'leases_expired',
        count(*) FILTER (WHERE j.status = 'running' AND j.lease_expires_at < now()),
      'max_concurrent', (SELECT l.max_concurrent FROM public.fa_job_limits l
                          WHERE l.job_type = j.job_type)
    ) AS row
    FROM public.fa_jobs j
    WHERE p_job_type IS NULL OR j.job_type = p_job_type
    GROUP BY j.job_type
  ) s;
$function$;

-- ------------------------------------------------------------------- access
ALTER TABLE public.fa_jobs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fa_job_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fa_jobs_operator   ON public.fa_jobs;
DROP POLICY IF EXISTS fa_limits_operator ON public.fa_job_limits;

-- The functions are SECURITY DEFINER and carry their own rules; the table
-- itself is operator-only, so nothing reaches a payload through PostgREST.
CREATE POLICY fa_jobs_operator   ON public.fa_jobs       FOR ALL USING (public.mm_is_operator());
CREATE POLICY fa_limits_operator ON public.fa_job_limits FOR ALL USING (public.mm_is_operator());

REVOKE ALL ON FUNCTION public.fa_enqueue(text, jsonb, text, smallint, smallint, timestamptz, text, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.fa_claim(text, text, integer, integer) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.fa_heartbeat(uuid[], text, integer) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.fa_complete(uuid, text, jsonb) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.fa_fail(uuid, text, text, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.fa_cancel(uuid, text) FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fa_enqueue(text, jsonb, text, smallint, smallint, timestamptz, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fa_claim(text, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.fa_heartbeat(uuid[], text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.fa_complete(uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fa_fail(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fa_cancel(uuid, text) TO service_role;
-- Health is readable by an operator screen, so it follows the mm_ convention.
GRANT EXECUTE ON FUNCTION public.fa_queue_health(text) TO PUBLIC;

COMMENT ON TABLE public.fa_jobs IS
  'The Founder AI work queue. Lease-based claiming with FOR UPDATE SKIP LOCKED, expired leases reclaimed on every claim, exponential backoff with jitter, a dead letter for failures no retry would fix, and one open job per idempotency key. Carries no business logic: a job names a type and a payload, and the module that owns that type decides what it means.';
