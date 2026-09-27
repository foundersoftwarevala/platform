-- Can stale memory ever win?
--
-- The rule this exists to hold is "never allow stale memory to silently
-- override newer verified information". These check that the database makes
-- that true rather than trusting whatever writes here.
--
--   node scripts/ops/db.mjs --file scripts/ops/founder-memory-check.sql
--
-- Runs inside a transaction that is always rolled back.
\set ON_ERROR_STOP 0

BEGIN;

\echo '=== a memory needs a source ==='
SAVEPOINT s1;
INSERT INTO public.founder_memory (scope, subject, statement, source_system)
VALUES ('COMPANY', 'memcheck.subject', 'something is true', '   ');
ROLLBACK TO s1;

\echo '=== working memory must say when it stops mattering ==='
SAVEPOINT s2;
INSERT INTO public.founder_memory (scope, subject, statement, source_system)
VALUES ('WORKING', 'memcheck.scratch', 'a note from this conversation', 'memcheck');
ROLLBACK TO s2;

\echo '=== with an end, it is accepted ==='
INSERT INTO public.founder_memory (scope, subject, statement, source_system, valid_until)
VALUES ('WORKING', 'memcheck.scratch', 'a note from this conversation', 'memcheck',
        now() + interval '1 hour');

\echo '=== nothing claims to be measured without saying when it was checked ==='
SAVEPOINT s3;
INSERT INTO public.founder_memory (scope, subject, statement, source_system, confidence)
VALUES ('COMPANY', 'memcheck.measured', 'a measured fact', 'memcheck', 'MEASURED');
ROLLBACK TO s3;

\echo '=== a first memory about a subject ==='
INSERT INTO public.founder_memory (scope, subject, statement, source_system, confidence, verified_at)
VALUES ('COMPANY', 'memcheck.gateway', 'Gateway A is the primary payment route', 'memcheck',
        'MEASURED', now() - interval '200 days');

\echo '=== a second, contradicting one, cannot simply be added alongside ==='
SAVEPOINT s4;
INSERT INTO public.founder_memory (scope, subject, statement, source_system)
VALUES ('COMPANY', 'memcheck.gateway', 'Gateway B is the primary payment route', 'memcheck');
ROLLBACK TO s4;

\echo '=== superseding without saying why is refused ==='
SAVEPOINT s5;
UPDATE public.founder_memory SET status = 'SUPERSEDED'
 WHERE subject = 'memcheck.gateway' AND status = 'ACTIVE';
ROLLBACK TO s5;

\echo '=== superseding properly, then recording the newer fact ==='
WITH replacement AS (
  INSERT INTO public.founder_memory (scope, subject, statement, source_system, confidence, verified_at, status)
  VALUES ('COMPANY', 'memcheck.gateway.new', 'Gateway B is the primary payment route', 'memcheck',
          'MEASURED', now(), 'ACTIVE')
  RETURNING id
)
UPDATE public.founder_memory m
   SET status = 'SUPERSEDED', superseded_by = (SELECT id FROM replacement),
       superseded_at = now(), supersede_reason = 'Gateway A was retired'
 WHERE m.subject = 'memcheck.gateway' AND m.status = 'ACTIVE';

\echo '=== a superseded memory cannot be made current again ==='
SAVEPOINT s6;
UPDATE public.founder_memory SET status = 'ACTIVE'
 WHERE subject = 'memcheck.gateway' AND status = 'SUPERSEDED';
ROLLBACK TO s6;

\echo '=== an active memory cannot name a replacement and stay active ==='
SAVEPOINT s7;
UPDATE public.founder_memory
   SET superseded_by = (SELECT id FROM public.founder_memory WHERE subject = 'memcheck.gateway.new')
 WHERE subject = 'memcheck.scratch' AND status = 'ACTIVE';
ROLLBACK TO s7;

\echo '=== what the current view returns: the new fact, not the old one ==='
SELECT subject, statement FROM public.founder_memory_current
 WHERE subject LIKE 'memcheck.gateway%' ORDER BY subject;

\echo '=== an end cannot be set before the start ==='
SAVEPOINT s8;
UPDATE public.founder_memory SET valid_until = now() - interval '1 minute'
 WHERE subject = 'memcheck.scratch';
ROLLBACK TO s8;

\echo '=== expired working memory drops out of current the moment it passes ==='
-- Moved wholly into the past, which is what an expired note looks like.
UPDATE public.founder_memory
   SET valid_from = now() - interval '2 hours', valid_until = now() - interval '1 hour'
 WHERE subject = 'memcheck.scratch';
SELECT count(*) AS scratch_still_current FROM public.founder_memory_current
 WHERE subject = 'memcheck.scratch';
SELECT count(*) AS scratch_still_in_table FROM public.founder_memory
 WHERE subject = 'memcheck.scratch';

\echo '=== memory nobody has confirmed in ninety days is surfaced ==='
SELECT count(*) AS unconfirmed FROM public.founder_memory_stale
 WHERE subject LIKE 'memcheck%';

\echo '=== the totals ==='
SELECT active, superseded, expired_but_active, working FROM public.founder_memory_totals;

ROLLBACK;

\echo '=== nothing survived the check ==='
SELECT count(*) AS memories_left FROM public.founder_memory;
