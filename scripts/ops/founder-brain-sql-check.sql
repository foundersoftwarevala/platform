-- The Company Brain's guarantees, checked where they actually live.
--
-- The REST-based check (founder-brain-check.mjs) needs a token the VPS
-- PostgREST accepts, which lives root-only on the server. This one asks the
-- database directly over psql, so it can run from anywhere the ops ssh key
-- reaches, and it tests the constraints and triggers themselves rather than a
-- layer above them.
--
--   node scripts/ops/db.mjs --file scripts/ops/founder-brain-sql-check.sql
--
-- Every row it writes carries the braincheck- marker that
-- founder_purge_check_learning will accept, and it removes all of them.

\set ON_ERROR_STOP 0
\timing off
\echo '=== Company Brain guarantees, checked against sv_platform ==='

-- Everything this writes carries the marker and is removed at the end.
\set mark 'braincheck-sql'

\echo '--- an AI-produced item may not be filed as a company fact ---'
INSERT INTO public.founder_knowledge (kind, claim, title, body, source_system, produced_by_ai)
VALUES ('POLICY','CURRENT_FACT','braincheck-sql fact','body','braincheck-sql', true);

\echo '--- the same item as an inference is accepted ---'
INSERT INTO public.founder_knowledge (kind, claim, title, body, source_system, produced_by_ai)
VALUES ('POLICY','AI_INFERENCE','braincheck-sql inference','body','braincheck-sql', true);

\echo '--- a pattern resting on one case is refused ---'
INSERT INTO public.founder_learning (stage, title, detail, actor_kind, source_system, pattern_key, sample_size)
VALUES ('PATTERN','braincheck-sql thin','detail','AI','braincheck-sql','k',1);

\echo '--- a pattern resting on five cases is accepted ---'
INSERT INTO public.founder_learning (stage, title, detail, actor_kind, source_system, pattern_key, sample_size)
VALUES ('PATTERN','braincheck-sql solid','detail','AI','braincheck-sql','k',5);

\echo '--- a learning record cannot be rewritten ---'
UPDATE public.founder_learning SET title = 'braincheck-sql rewritten'
 WHERE source_system = 'braincheck-sql';

\echo '--- a report with no findings and no limitations is refused ---'
INSERT INTO public.founder_reports (report_type,title,period_start,period_end,basis,findings,limitations,status)
VALUES ('KPI_REVIEW','braincheck-sql empty',now()-interval '7 days',now(),'{"generatedFrom":["founder_kpis"]}','[]','[]','generated');

\echo '--- a report that says it found nothing is accepted ---'
INSERT INTO public.founder_reports (report_type,title,period_start,period_end,basis,findings,limitations,insufficient_data,status)
VALUES ('KPI_REVIEW','braincheck-sql honest',now()-interval '7 days',now(),'{"generatedFrom":["founder_kpis"]}','[]','["No sufficient data available for this period."]',true,'generated');

\echo '--- a report that cannot name its basis is refused ---'
INSERT INTO public.founder_reports (report_type,title,period_start,period_end,basis,findings,status)
VALUES ('KPI_REVIEW','braincheck-sql nobasis',now(),now(),'{}','[{"kind":"FACT"}]','generated');

\echo '--- role-scoped totals: restricted report counted only for its role ---'
INSERT INTO public.founder_reports (report_type,title,period_start,period_end,basis,findings,limitations,insufficient_data,status,allowed_roles)
VALUES ('KPI_REVIEW','braincheck-sql restricted',now()-interval '1 day',now(),'{"generatedFrom":["founder_kpis"]}','[]','["No sufficient data available for this period."]',true,'generated','{braincheck-role}');

SELECT 'open reader total' AS who, total FROM public.founder_report_totals('{}');
SELECT 'role holder total' AS who, total FROM public.founder_report_totals('{braincheck-role}');

\echo '--- cleanup ---'
DELETE FROM public.founder_reports WHERE title LIKE 'braincheck-sql%';
SELECT public.founder_purge_check_learning('braincheck-sql');
DELETE FROM public.founder_knowledge WHERE source_system = 'braincheck-sql';

SELECT
 (SELECT count(*) FROM public.founder_knowledge WHERE source_system='braincheck-sql') AS left_knowledge,
 (SELECT count(*) FROM public.founder_learning WHERE source_system='braincheck-sql') AS left_learning,
 (SELECT count(*) FROM public.founder_reports WHERE title LIKE 'braincheck-sql%') AS left_reports;
