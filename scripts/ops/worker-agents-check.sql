-- Do the Worker Agent rules actually hold?
--
-- Each block below tries the thing the owner said must never happen. A line
-- reading ERROR is the constraint doing its job; an INSERT or UPDATE that
-- succeeds where it should not is the finding.
--
--   node scripts/ops/db.mjs --file scripts/ops/worker-agents-check.sql
--
-- The lifecycle tests run against a throwaway agent, never against the
-- roster. An earlier version moved a real agent to AVAILABLE and could not
-- put it back, because the guard has no AVAILABLE -> CONFIGURED path — which
-- is correct, and is exactly why a check must not use a live row.
\set ON_ERROR_STOP 0

\echo '=== the roster ==='
SELECT count(*) AS agents_registered FROM public.ai_agents WHERE agent_key IS NOT NULL;
SELECT count(*) AS none_holds_approve FROM public.ai_agents
 WHERE NOT ('APPROVE' = ANY (permissions));
SELECT lifecycle, count(*) FROM public.ai_agents GROUP BY lifecycle ORDER BY 1;

\echo '=== a throwaway agent to test the rules on ==='
INSERT INTO public.ai_agents (agent_key, name, purpose, lifecycle, permissions, status)
VALUES ('wacheck-agent', 'wacheck', 'temporary row for the worker agent check',
        'CONFIGURED', ARRAY['READ','ANALYZE']::text[], 'inactive')
ON CONFLICT (agent_key) WHERE agent_key IS NOT NULL DO UPDATE
  SET lifecycle = 'CONFIGURED', permissions = ARRAY['READ','ANALYZE']::text[];

\echo '=== an agent cannot be granted APPROVE ==='
UPDATE public.ai_agents SET permissions = permissions || ARRAY['APPROVE']
 WHERE agent_key = 'wacheck-agent';

\echo '=== an agent cannot be granted a deployment permission ==='
UPDATE public.ai_agents SET permissions = permissions || ARRAY['DEPLOY']
 WHERE agent_key = 'wacheck-agent';

\echo '=== an agent cannot jump straight from CONFIGURED to VERIFIED ==='
UPDATE public.ai_agents SET lifecycle = 'VERIFIED' WHERE agent_key = 'wacheck-agent';

\echo '=== a legal transition is allowed ==='
UPDATE public.ai_agents SET lifecycle = 'AVAILABLE' WHERE agent_key = 'wacheck-agent';

\echo '=== an agent cannot be BLOCKED without a reason ==='
UPDATE public.ai_agents SET lifecycle = 'BLOCKED' WHERE agent_key = 'wacheck-agent';

\echo '=== a run cannot use a permission its agent does not hold ==='
INSERT INTO public.ai_agent_runs (agent_id, scope, permission_used, input_source, action)
SELECT id, 'wacheck', 'EXECUTE_LOW_RISK', 'founder_kpis', 'wacheck attempt'
  FROM public.ai_agents WHERE agent_key = 'wacheck-agent';

\echo '=== a run using a held permission is accepted ==='
INSERT INTO public.ai_agent_runs (agent_id, scope, permission_used, input_source, action)
SELECT id, 'wacheck', 'ANALYZE', 'founder_kpis', 'wacheck attempt'
  FROM public.ai_agents WHERE agent_key = 'wacheck-agent';

\echo '=== a run cannot be called VERIFIED without a result ==='
UPDATE public.ai_agent_runs SET verification = 'VERIFIED' WHERE scope = 'wacheck';

\echo '=== a failed run must say what went wrong ==='
UPDATE public.ai_agent_runs SET state = 'FAILED' WHERE scope = 'wacheck';

\echo '=== completing is not verifying ==='
UPDATE public.ai_agent_runs SET state = 'COMPLETED', result = 'analysed 0 readings'
 WHERE scope = 'wacheck';
SELECT state, verification FROM public.ai_agent_runs WHERE scope = 'wacheck';

\echo '=== cleanup ==='
DELETE FROM public.ai_agent_runs WHERE scope = 'wacheck';
DELETE FROM public.ai_agents WHERE agent_key = 'wacheck-agent';
SELECT
 (SELECT count(*) FROM public.ai_agent_runs WHERE scope = 'wacheck') AS runs_left,
 (SELECT count(*) FROM public.ai_agents WHERE agent_key = 'wacheck-agent') AS agents_left,
 (SELECT count(*) FROM public.ai_agents WHERE agent_key IS NOT NULL) AS roster,
 (SELECT count(*) FROM public.ai_agents WHERE lifecycle = 'CONFIGURED') AS configured;
