-- Does the existing task engine actually enforce its lifecycle?
--
-- tm_tasks carries ten triggers, among them tm_tasks_enforce_transition,
-- tm_tasks_audit_status and tm_tasks_audit_assignment. This checks that they
-- do what their names claim rather than taking the names on trust, because a
-- guard that has quietly stopped firing looks exactly like one that works.
--
--   node scripts/ops/db.mjs --file scripts/ops/task-engine-check.sql
--
-- The whole check runs inside a transaction that is always rolled back, so it
-- cannot leave anything behind. An earlier version deleted its own rows at the
-- end and could not: deleting a task cascades into tm_activity, which is
-- append-only by design, so the test task survived its own cleanup. A rollback
-- has no such problem, and needs no exception to a protection that should not
-- have one.
--
-- Each statement expected to fail is wrapped in a savepoint, because an error
-- inside a transaction aborts it and everything after would fail for the wrong
-- reason.
\set ON_ERROR_STOP 0

\echo '=== the lifecycle, as the engine defines it ==='
SELECT s AS from_status, array_to_string(public.tm_allowed_transitions(s), ', ') AS allowed
  FROM unnest(ARRAY['claimed','accepted','in_progress','completed']) AS s;

BEGIN;

\echo '=== a task to work on ==='
INSERT INTO public.tm_tasks (code, title, description, status, priority)
VALUES ('TECHECK-1', 'techeck task', 'created by the task engine check', 'claimed', 'medium');

\echo '=== an unlawful jump is refused ==='
SAVEPOINT s1;
UPDATE public.tm_tasks SET status = 'closed' WHERE code = 'TECHECK-1';
ROLLBACK TO s1;

\echo '=== a lawful step is allowed, and stamps its own timestamp ==='
UPDATE public.tm_tasks SET status = 'in_progress' WHERE code = 'TECHECK-1';
SELECT status, (started_at IS NOT NULL) AS started_at_stamped
  FROM public.tm_tasks WHERE code = 'TECHECK-1';

\echo '=== the engine stamps completion without the caller remembering to ==='
UPDATE public.tm_tasks SET status = 'completed' WHERE code = 'TECHECK-1';
SELECT status, (completed_at IS NOT NULL) AS completed_at_stamped
  FROM public.tm_tasks WHERE code = 'TECHECK-1';

\echo '=== completing did not approve it: approved_at is still empty ==='
SELECT (approved_at IS NULL) AS not_yet_approved FROM public.tm_tasks WHERE code = 'TECHECK-1';

\echo '=== going backwards from completed is refused ==='
SAVEPOINT s2;
UPDATE public.tm_tasks SET status = 'in_progress' WHERE code = 'TECHECK-1';
ROLLBACK TO s2;

\echo '=== every status change was recorded in the task activity log ==='
SELECT count(*) AS activity_rows
  FROM public.tm_activity
 WHERE task_id = (SELECT id FROM public.tm_tasks WHERE code = 'TECHECK-1');

\echo '=== that log cannot be rewritten ==='
SAVEPOINT s3;
DELETE FROM public.tm_activity
 WHERE task_id = (SELECT id FROM public.tm_tasks WHERE code = 'TECHECK-1');
ROLLBACK TO s3;

\echo '=== automations are rules, not hardcoded behaviour ==='
SELECT count(*) AS rules, count(*) FILTER (WHERE coalesce(is_enabled, enabled)) AS enabled_rules
  FROM public.automation_rules;

ROLLBACK;

\echo '=== nothing survived the check ==='
SELECT (SELECT count(*) FROM public.tm_tasks WHERE code LIKE 'TECHECK%') AS techeck_left,
       (SELECT count(*) FROM public.tm_tasks) AS tasks_total;
