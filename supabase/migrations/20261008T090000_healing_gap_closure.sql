-- Closing the gaps the self-healing engine actually had.
--
-- Four things were genuinely missing, and each is added here against the
-- evidence that it was missing rather than on the assumption that a
-- production system ought to have it.
--
--   1. The recovery attempt log was described as append-only and was not.
--      Nothing stopped an UPDATE rewriting a failed recovery into a
--      successful one, which is the single change that would make every
--      other guarantee in this engine unprovable.
--
--   2. A recovery recorded what it did but not what it undid. Without the
--      state a recovery replaced there is nothing to roll back to, so
--      "reversible" was a word rather than a capability.
--
--   3. Incidents were picked by severity and age alone. Severity is an
--      opinion formed at detection; what an incident is worth fixing first
--      also depends on how much it touches and whether anything has ever
--      fixed it before.
--
--   4. The engine could say how many recoveries it had attempted but not
--      how good they were - what fraction verified, how often a fault came
--      back, how long a recovery took.
--
-- Nothing here changes how a recovery is chosen or run. The worker keeps
-- writing exactly the row it wrote before; the new columns are optional and
-- the new views are read-only.

-- ------------------------------------------------ 1. the audit becomes real
--
-- Written once, never rewritten. The worker already inserts a complete row
-- and has never updated one, so this closes a hole rather than changing a
-- behaviour - verified by grep across src/ and scripts/ before applying it.
--
-- DELETE is refused too. An incident that has been worked on therefore
-- cannot be deleted while its attempts stand, which is the intended
-- consequence: the record of a recovery outliving the incident is the point
-- of having it.

CREATE OR REPLACE FUNCTION public.founder_recovery_attempt_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'the recovery attempt log is append-only; % is not permitted', TG_OP
    USING ERRCODE = 'check_violation';
END
$$;

DROP TRIGGER IF EXISTS founder_recovery_attempts_no_rewrite ON public.founder_recovery_attempts;
CREATE TRIGGER founder_recovery_attempts_no_rewrite
  BEFORE UPDATE OR DELETE ON public.founder_recovery_attempts
  FOR EACH ROW EXECUTE FUNCTION public.founder_recovery_attempt_immutable();

-- The one narrow way back out, matching how the decision and learning logs
-- already do it: a marked test run can remove its own rows and nothing else.
-- The marker is checked, not trusted, and real incidents carry a real
-- source_system that can never match it.
CREATE OR REPLACE FUNCTION public.founder_purge_check_healing(p_marker text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  removed integer;
BEGIN
  IF p_marker IS NULL OR p_marker NOT LIKE 'healcheck-%' THEN
    RAISE EXCEPTION 'this only removes rows written by a healing check run'
      USING ERRCODE = 'check_violation';
  END IF;

  ALTER TABLE public.founder_recovery_attempts DISABLE TRIGGER founder_recovery_attempts_no_rewrite;
  DELETE FROM public.founder_incidents WHERE source_system = p_marker;
  GET DIAGNOSTICS removed = ROW_COUNT;
  ALTER TABLE public.founder_recovery_attempts ENABLE TRIGGER founder_recovery_attempts_no_rewrite;

  RETURN removed;
END
$$;

-- --------------------------------------------- 2. what a recovery replaced
--
-- previous_state is the last valid state of whatever the action changed,
-- captured before the change. A rollback is then a new attempt that puts it
-- back - never an edit of the original, which the trigger above now forbids
-- anyway. That keeps both the mistake and its reversal in the record.

ALTER TABLE public.founder_recovery_attempts
  ADD COLUMN IF NOT EXISTS previous_state jsonb,
  ADD COLUMN IF NOT EXISTS reversible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rollback_of uuid REFERENCES public.founder_recovery_attempts(id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'founder_recovery_reversible_has_a_state'
  ) THEN
    ALTER TABLE public.founder_recovery_attempts
      ADD CONSTRAINT founder_recovery_reversible_has_a_state CHECK (
        reversible = false OR previous_state IS NOT NULL
      );
  END IF;

  -- A rollback has to say what it is undoing, and cannot undo itself.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'founder_recovery_rollback_is_not_itself'
  ) THEN
    ALTER TABLE public.founder_recovery_attempts
      ADD CONSTRAINT founder_recovery_rollback_is_not_itself CHECK (
        rollback_of IS NULL OR rollback_of <> id
      );
  END IF;
END $$;

COMMENT ON COLUMN public.founder_recovery_attempts.previous_state IS
  'The last valid state of the thing this action changed, captured before changing it. Present only when the action is reversible.';

-- ------------------------------------------------- 3. what to fix first
--
-- Severity still leads, because a CRITICAL incident should not wait behind a
-- tidy LOW one. But three real things break the ties, and all three come from
-- columns that already exist rather than from a score invented here:
--
--   how much it touches   the policy's own scope ceiling for that class
--   whether anything works  whether a verified recovery has ever been
--                           recorded for this class and action set
--   how long it has waited  age, so nothing starves
--
-- Confidence is deliberately absent: the engine has no calibrated confidence
-- for an incident, and inventing one would be exactly the fake score this is
-- meant to avoid.

CREATE OR REPLACE VIEW public.founder_healing_priority AS
WITH proven AS (
  SELECT i.failure_class, a.action,
         count(*) FILTER (WHERE a.verified) AS verified_before,
         count(*) AS tried_before
    FROM public.founder_recovery_attempts a
    JOIN public.founder_incidents i ON i.id = a.incident_id
   GROUP BY i.failure_class, a.action
)
SELECT
  i.id,
  i.title,
  i.failure_class,
  i.severity,
  i.domain,
  i.entity_type,
  i.entity_id,
  i.state,
  i.attempts,
  i.detected_at,
  p.risk                       AS policy_risk,
  p.autonomous,
  p.max_attempts,
  b.max_scope_rows             AS scope_ceiling,
  b.max_recovery_minutes,
  round(extract(epoch FROM now() - i.detected_at) / 60.0, 1) AS minutes_waiting,
  -- Has anything ever actually fixed this class before?
  coalesce((
    SELECT sum(pr.verified_before) FROM proven pr
     WHERE pr.failure_class = i.failure_class
       AND pr.action = ANY (p.allowed_actions)
  ), 0)                        AS verified_recoveries_for_this_class,
  (
    CASE i.severity
      WHEN 'CRITICAL' THEN 400 WHEN 'HIGH' THEN 300
      WHEN 'MEDIUM'   THEN 200 WHEN 'LOW'  THEN 100 ELSE 50 END
    -- Breadth: a class permitted to touch more rows carries more risk of
    -- being left alone, so it moves up.
    + least(coalesce(b.max_scope_rows, 1), 10) * 3
    -- A class with a proven recovery is worth reaching for before one with
    -- none, because the attempt is likelier to end the incident.
    + CASE WHEN EXISTS (
        SELECT 1 FROM proven pr
         WHERE pr.failure_class = i.failure_class
           AND pr.action = ANY (p.allowed_actions)
           AND pr.verified_before > 0
      ) THEN 25 ELSE 0 END
    -- Age, bounded, so nothing starves and nothing dominates.
    + least(extract(epoch FROM now() - i.detected_at) / 600.0, 30)
  )::numeric(8,1)              AS priority,
  array_remove(ARRAY[
    format('severity %s', i.severity),
    format('may touch up to %s row(s)', coalesce(b.max_scope_rows, 1)),
    CASE WHEN EXISTS (
      SELECT 1 FROM proven pr WHERE pr.failure_class = i.failure_class
        AND pr.action = ANY (p.allowed_actions) AND pr.verified_before > 0)
      THEN 'a recovery of this class has verified before'
      ELSE 'no verified recovery of this class yet' END,
    format('waiting %s minute(s)', round(extract(epoch FROM now() - i.detected_at) / 60.0)),
    CASE WHEN NOT p.autonomous THEN 'not autonomously recoverable - a person decides' END,
    CASE WHEN i.circuit_open THEN 'circuit open' END,
    CASE WHEN i.recovery_blocked THEN 'blocked by the Founder' END
  ], NULL)                     AS reasons
FROM public.founder_incidents i
JOIN public.founder_recovery_policies p ON p.failure_class = i.failure_class
LEFT JOIN public.founder_recovery_budgets b ON b.failure_class = i.failure_class
WHERE i.state NOT IN ('RESOLVED', 'CONTAINED', 'FAILED')
ORDER BY 18 DESC, i.detected_at ASC;

-- ------------------------------------------ 4. how good the healing is
--
-- Every figure below is counted from rows that exist. Where there is nothing
-- to divide, the rate is null rather than zero, because "no recoveries yet"
-- and "no recovery ever worked" are different statements and a dashboard
-- that renders them the same is lying quietly.

CREATE OR REPLACE VIEW public.founder_healing_quality AS
WITH a AS (SELECT * FROM public.founder_recovery_attempts),
     i AS (SELECT * FROM public.founder_incidents),
     recur AS (
       -- The same correlation key opening again after it was resolved: the
       -- only recurrence this schema can actually see.
       SELECT count(*) AS recurrences FROM (
         SELECT correlation_key
           FROM i
          WHERE correlation_key IS NOT NULL
          GROUP BY correlation_key
         HAVING count(*) FILTER (WHERE state = 'RESOLVED') >= 1
            AND count(*) > 1
       ) r
     )
SELECT
  (SELECT count(*) FROM i)                                          AS incidents,
  (SELECT count(*) FROM a)                                          AS attempts,
  (SELECT count(*) FROM a WHERE verified)                           AS verified_attempts,
  (SELECT count(*) FROM a WHERE rollback_of IS NOT NULL)            AS rollbacks,
  (SELECT count(*) FROM i WHERE state = 'ESCALATED')                AS escalations,
  (SELECT recurrences FROM recur)                                   AS recurrences,

  -- verified resolution rate: of the incidents that reached an end, how many
  -- ended because a recovery was verified.
  (SELECT CASE WHEN count(*) FILTER (WHERE state IN ('RESOLVED','ESCALATED','FAILED','CONTAINED')) = 0
               THEN NULL
               ELSE round(100.0 * count(*) FILTER (WHERE state = 'RESOLVED')
                        / count(*) FILTER (WHERE state IN ('RESOLVED','ESCALATED','FAILED','CONTAINED')), 1)
          END FROM i)                                               AS verified_resolution_rate,

  -- verification failure rate: the action worked and the check still said no.
  -- This is the engine's honesty showing, so it is reported, not hidden.
  (SELECT CASE WHEN count(*) FILTER (WHERE result = 'SUCCEEDED') = 0 THEN NULL
               ELSE round(100.0 * count(*) FILTER (WHERE result = 'SUCCEEDED' AND NOT verified)
                        / count(*) FILTER (WHERE result = 'SUCCEEDED'), 1)
          END FROM a)                                               AS verification_failure_rate,

  -- false recovery rate: an incident resolved that later came back under the
  -- same correlation key. Anything above zero means a verification is wrong.
  (SELECT CASE WHEN count(*) FILTER (WHERE state = 'RESOLVED') = 0 THEN NULL
               ELSE round(100.0 * (SELECT recurrences FROM recur)
                        / count(*) FILTER (WHERE state = 'RESOLVED'), 1)
          END FROM i)                                               AS false_recovery_rate,

  (SELECT CASE WHEN count(*) FILTER (WHERE state IN ('RESOLVED','ESCALATED','FAILED','CONTAINED')) = 0
               THEN NULL
               ELSE round(100.0 * count(*) FILTER (WHERE state = 'ESCALATED')
                        / count(*) FILTER (WHERE state IN ('RESOLVED','ESCALATED','FAILED','CONTAINED')), 1)
          END FROM i)                                               AS escalation_rate,

  (SELECT round(avg(extract(epoch FROM resolved_at - detected_at)), 1)
     FROM i WHERE resolved_at IS NOT NULL)                          AS mean_recovery_seconds,
  (SELECT round(max(extract(epoch FROM resolved_at - detected_at)), 1)
     FROM i WHERE resolved_at IS NOT NULL)                          AS slowest_recovery_seconds,

  -- Recovery cost, in the only unit this engine can measure honestly: how
  -- many attempts it took and how many rows they touched. Nothing here is
  -- money, because none of it is priced.
  (SELECT round(avg(attempt_number), 2) FROM a WHERE verified)      AS mean_attempts_to_verify,
  (SELECT coalesce(sum(scope_rows), 0) FROM a)                      AS total_rows_touched,
  (SELECT max(scope_rows) FROM a)                                   AS widest_single_recovery;

-- ------------------------------- 5. which strategies actually work
--
-- Learning, in the only sense that can be evidenced: counting what has been
-- tried and what verified. No model is trained here and none is claimed.

CREATE OR REPLACE VIEW public.founder_recovery_strategy_performance AS
SELECT
  i.failure_class,
  a.action                                                   AS strategy,
  count(*)                                                   AS executions,
  count(*) FILTER (WHERE a.result = 'SUCCEEDED')             AS succeeded,
  count(*) FILTER (WHERE a.verified)                         AS verified,
  count(*) FILTER (WHERE a.result = 'SUCCEEDED' AND NOT a.verified) AS succeeded_but_unverified,
  count(*) FILTER (WHERE a.result = 'FAILED')                AS failed,
  count(*) FILTER (WHERE a.result = 'INCONCLUSIVE')          AS inconclusive,
  CASE WHEN count(*) = 0 THEN NULL
       ELSE round(100.0 * count(*) FILTER (WHERE a.verified) / count(*), 1) END
                                                             AS verified_rate,
  round(avg(a.attempt_number), 2)                            AS mean_attempt_number,
  round(avg(extract(epoch FROM a.finished_at - a.started_at)), 1) AS mean_seconds,
  max(a.verified_at)                                         AS last_verified_at,
  -- Only a strategy with a verified outcome may be preferred. Everything
  -- else is a strategy nobody has yet seen work.
  (count(*) FILTER (WHERE a.verified) > 0)                   AS proven
FROM public.founder_recovery_attempts a
JOIN public.founder_incidents i ON i.id = a.incident_id
GROUP BY i.failure_class, a.action
ORDER BY i.failure_class, verified DESC, executions DESC;

-- ------------------------------------- 6. pressure, before it is a failure
--
-- Weak signals only. Nothing here is an incident and nothing here creates
-- one; each row is a measurement with a threshold beside it so a reader can
-- see how close it is rather than being told a verdict.

CREATE OR REPLACE VIEW public.founder_healing_pressure AS
SELECT * FROM (
  -- How deep the one real queue is, and how stale its oldest waiting item.
  SELECT 'translation queue depth'::text AS signal,
         'i18n_translation_jobs'::text   AS component,
         (SELECT count(*) FROM public.i18n_translation_jobs WHERE status = 'queued')::numeric AS measured,
         100000::numeric                 AS watch_above,
         'queued rows'::text             AS unit
  UNION ALL
  SELECT 'oldest queued item age', 'i18n_translation_jobs',
         coalesce((SELECT round(extract(epoch FROM now() - min(created_at)) / 3600.0, 1)
                     FROM public.i18n_translation_jobs WHERE status = 'queued'), 0),
         24, 'hours'
  UNION ALL
  -- A lease held far past its life means a worker died holding work.
  SELECT 'translation leases held past their life', 'i18n_translation_jobs',
         (SELECT count(*) FROM public.i18n_translation_jobs
           WHERE status = 'running' AND locked_at < now() - interval '30 minutes'),
         1, 'jobs'
  UNION ALL
  -- Recovery effort rising is itself a signal: something is failing more.
  SELECT 'recovery attempts in the last hour', 'self-healing',
         (SELECT count(*) FROM public.founder_recovery_attempts WHERE started_at > now() - interval '1 hour'),
         20, 'attempts'
  UNION ALL
  SELECT 'recoveries that acted but did not verify, last 24h', 'self-healing',
         (SELECT count(*) FROM public.founder_recovery_attempts
           WHERE started_at > now() - interval '24 hours' AND result = 'SUCCEEDED' AND NOT verified),
         3, 'attempts'
  UNION ALL
  SELECT 'incidents waiting for recovery', 'self-healing',
         (SELECT count(*) FROM public.founder_incidents
           WHERE state IN ('ELIGIBLE', 'RETRY_PENDING') AND circuit_open = false),
         5, 'incidents'
  UNION ALL
  SELECT 'open circuits', 'self-healing',
         (SELECT count(*) FROM public.founder_incidents WHERE circuit_open), 1, 'incidents'
  UNION ALL
  SELECT 'incident locks held past their timeout', 'self-healing',
         (SELECT count(*) FROM public.founder_incidents
           WHERE locked_at IS NOT NULL AND locked_at < now() - interval '10 minutes'
             AND state NOT IN ('RESOLVED','CONTAINED','ESCALATED','FAILED')),
         1, 'incidents'
) s
ORDER BY
  CASE WHEN watch_above > 0 AND measured >= watch_above THEN 0 ELSE 1 END,
  (measured / NULLIF(watch_above, 0)) DESC NULLS LAST;

COMMENT ON VIEW public.founder_healing_pressure IS
  'Weak pre-failure signals with the threshold beside each. A row at or above its threshold is a risk worth looking at, never a confirmed failure, and nothing here opens an incident.';

GRANT SELECT ON public.founder_healing_priority,
                public.founder_healing_quality,
                public.founder_recovery_strategy_performance,
                public.founder_healing_pressure
  TO service_role;
