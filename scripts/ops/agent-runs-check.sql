-- What fa_agent_run_open / _close / _reap actually do, proven against the real
-- roster rather than described.
--
-- Every row this creates uses the scope 'archeck' and is removed at the end,
-- so it leaves nothing behind. The final SELECT is the proof that it did.
--
--   sudo -u postgres psql -d sv_platform -f scripts/ops/agent-runs-check.sql

\set ON_ERROR_STOP off
\pset pager off

-- 1. An agent that is not on the roster is refused, not invented.
SELECT '1 unknown agent' AS check,
       public.fa_agent_run_open('no-such-agent','archeck','READ','test','test') AS result;

-- 2. A permission the agent does not hold is refused by the existing trigger.
--    demo-health holds {READ,CREATE}, so EXECUTE_LOW_RISK must not be allowed.
--    This raises, which is the guard doing its job.
SELECT '2 permission not held' AS check;
SELECT public.fa_agent_run_open('demo-health','archeck','EXECUTE_LOW_RISK','test','test');

-- 3. The happy path: a run opens, and the job it was given points back at it.
SELECT '3 open' AS check;
INSERT INTO public.fa_jobs (job_type, payload, reference)
VALUES ('demo.health','{"archeck":true}'::jsonb,'archeck')
RETURNING id AS job_id \gset

SELECT public.fa_agent_run_open('demo-health','archeck','READ','test','test', :'job_id'::uuid) AS result \gset run_

SELECT '3a the job now names the run' AS check,
       (j.correlation_id IS NOT NULL) AS linked,
       j.correlation_id = (:'run_result'::jsonb->>'run_id')::uuid AS points_at_this_run
  FROM public.fa_jobs j WHERE j.id = :'job_id'::uuid;

SELECT '3b the run is RUNNING and unverified' AS check, state, verification
  FROM public.ai_agent_runs WHERE scope = 'archeck';

-- 4. A failure with no reason is refused, because the table would refuse it.
SELECT '4 failure needs a reason' AS check,
       public.fa_agent_run_close((:'run_result'::jsonb->>'run_id')::uuid,'FAILED',NULL,'  ') AS result;

-- 5. An unknown state is refused.
SELECT '5 unknown state' AS check,
       public.fa_agent_run_close((:'run_result'::jsonb->>'run_id')::uuid,'FINISHED-ISH') AS result;

-- 6. Closing works, and leaves verification alone.
SELECT '6 close' AS check,
       public.fa_agent_run_close((:'run_result'::jsonb->>'run_id')::uuid,'COMPLETED','checked 1 demo') AS result;

SELECT '6a state after closing' AS check, state, verification,
       (finished_at IS NOT NULL) AS has_finish, result
  FROM public.ai_agent_runs WHERE scope = 'archeck';

-- 7. A closed run cannot be closed again; the record of what happened stands.
SELECT '7 close twice' AS check,
       public.fa_agent_run_close((:'run_result'::jsonb->>'run_id')::uuid,'CANCELLED') AS result;

-- 8. The reaper leaves a young run alone and takes an old abandoned one.
SELECT '8 reap' AS check;
SELECT public.fa_agent_run_open('demo-health','archeck','READ','test','abandoned') AS result \gset young_

-- Still RUNNING, no job, opened just now: too young to be called abandoned.
SELECT '8a a young run survives' AS check, public.fa_agent_run_reap() AS result;
SELECT '8b it is still running' AS check, state
  FROM public.ai_agent_runs WHERE scope = 'archeck' AND action = 'abandoned';

-- Age it past the grace and it is recognised as abandoned.
UPDATE public.ai_agent_runs SET started_at = now() - interval '2 days'
 WHERE scope = 'archeck' AND action = 'abandoned';

SELECT '8c an old run is reaped' AS check, public.fa_agent_run_reap() AS result;
SELECT '8d it failed with a reason' AS check, state, error
  FROM public.ai_agent_runs WHERE scope = 'archeck' AND action = 'abandoned';

-- Clean up: only the rows this file created.
DELETE FROM public.ai_agent_runs WHERE scope = 'archeck';
DELETE FROM public.fa_jobs WHERE reference = 'archeck';

SELECT '9 nothing left behind' AS check,
       (SELECT count(*) FROM public.ai_agent_runs WHERE scope = 'archeck') AS runs_left,
       (SELECT count(*) FROM public.fa_jobs WHERE reference = 'archeck') AS jobs_left,
       (SELECT count(*) FROM public.ai_agent_runs) AS runs_in_total;
