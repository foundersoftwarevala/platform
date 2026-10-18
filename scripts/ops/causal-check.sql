-- Can a guess ever be repeated as a finding?
--
-- The rule this exists to hold is "never present a hypothesis as a proven
-- cause". These check that the database refuses it rather than trusting
-- whatever writes here or whatever renders it.
--
--   node scripts/ops/db.mjs --file scripts/ops/causal-check.sql
--
-- Runs inside a transaction that is always rolled back.
\set ON_ERROR_STOP 0

BEGIN;

\echo '=== a claim must name what it was built from ==='
SAVEPOINT s1;
INSERT INTO public.founder_causal_claims
  (effect, effect_domain, observed_at, cause, method, reasoning, sources)
VALUES ('Conversion fell 12%', 'sales', now(), 'Checkout latency rose',
        'compared daily series', 'the two moved together', '{}'::jsonb);
ROLLBACK TO s1;

\echo '=== a correlation is accepted, and claims nothing about cause ==='
INSERT INTO public.founder_causal_claims
  (effect, effect_domain, observed_at, cause, method, reasoning, sources, strength)
VALUES ('causalcheck: conversion fell 12%', 'sales', now(),
        'checkout latency rose over the same period',
        'compared the two daily series over 30 days',
        'Both moved in the same direction across the window. Nothing here establishes which, if either, moved the other.',
        '{"generatedFrom":["marketplace_orders","api_services"]}'::jsonb,
        'CORRELATION');

\echo '=== a correlation that words itself as a cause is refused ==='
SAVEPOINT s2;
INSERT INTO public.founder_causal_claims
  (effect, effect_domain, observed_at, cause, method, reasoning, sources, strength)
VALUES ('causalcheck: conversion fell', 'sales', now(),
        'conversion fell because of checkout latency',
        'compared series', 'they moved together',
        '{"generatedFrom":["marketplace_orders"]}'::jsonb, 'CORRELATION');
ROLLBACK TO s2;

\echo '=== a hypothesis with no alternatives considered is refused ==='
SAVEPOINT s3;
INSERT INTO public.founder_causal_claims
  (effect, effect_domain, observed_at, cause, method, reasoning, sources, strength)
VALUES ('causalcheck: conversion fell', 'sales', now(), 'checkout latency',
        'compared series', 'latency is the likely driver',
        '{"generatedFrom":["marketplace_orders"]}'::jsonb, 'CAUSAL_HYPOTHESIS');
ROLLBACK TO s3;

\echo '=== with alternatives, a hypothesis is accepted ==='
INSERT INTO public.founder_causal_claims
  (effect, effect_domain, observed_at, cause, method, reasoning, sources, strength,
   alternatives, unknowns)
VALUES ('causalcheck: conversion fell 12%', 'sales', now() - interval '1 hour',
        'checkout latency above two seconds',
        'compared the two daily series and segmented by device',
        'Latency rose before conversion fell, and the fall is concentrated in the segment that saw the latency.',
        '{"generatedFrom":["marketplace_orders","api_services"]}'::jsonb,
        'CAUSAL_HYPOTHESIS',
        '[{"alternative":"a seasonal dip","status":"not ruled out"},{"alternative":"a pricing change","status":"ruled out: no price changed in the window"}]'::jsonb,
        '["No session-level timing is recorded, so the link is inferred from daily aggregates."]'::jsonb);

\echo '=== a hypothesis cannot carry verification fields ==='
SAVEPOINT s4;
UPDATE public.founder_causal_claims
   SET verification_method = 'we are fairly sure', verified_at = now()
 WHERE strength = 'CAUSAL_HYPOTHESIS' AND effect LIKE 'causalcheck%';
ROLLBACK TO s4;

\echo '=== it cannot be promoted to verified without the evidence ==='
SAVEPOINT s5;
UPDATE public.founder_causal_claims SET strength = 'VERIFIED_CAUSE'
 WHERE strength = 'CAUSAL_HYPOTHESIS' AND effect LIKE 'causalcheck%';
ROLLBACK TO s5;

\echo '=== with a named method, a verifier and a time, it can ==='
UPDATE public.founder_causal_claims
   SET strength = 'VERIFIED_CAUSE',
       verification_method = 'latency was capped for 48 hours and conversion recovered in the same segment',
       verified_by_system = 'founder-ops',
       verified_at = now()
 WHERE strength = 'CAUSAL_HYPOTHESIS' AND effect LIKE 'causalcheck%';

\echo '=== a verified cause cannot quietly become a hypothesis again ==='
SAVEPOINT s6;
UPDATE public.founder_causal_claims SET strength = 'CAUSAL_HYPOTHESIS'
 WHERE strength = 'VERIFIED_CAUSE' AND effect LIKE 'causalcheck%';
ROLLBACK TO s6;

\echo '=== but it can be refuted, with a reason ==='
SAVEPOINT s7;
-- Without a reason it is refused: withdrawing a claim is itself a claim.
UPDATE public.founder_causal_claims SET strength = 'REFUTED'
 WHERE strength = 'VERIFIED_CAUSE' AND effect LIKE 'causalcheck%';
ROLLBACK TO s7;

\echo '=== with a reason, the refutation stands ==='
UPDATE public.founder_causal_claims
   SET strength = 'REFUTED',
       refuted_reason = 'the recovery coincided with a pricing rollback, so the test did not isolate latency'
 WHERE strength = 'VERIFIED_CAUSE' AND effect LIKE 'causalcheck%';
SELECT strength, (refuted_reason IS NOT NULL) AS has_reason
  FROM public.founder_causal_claims WHERE effect LIKE 'causalcheck%' AND strength = 'REFUTED';

\echo '=== what may be repeated as established ==='
SELECT count(*) AS established FROM public.founder_causal_established
 WHERE effect LIKE 'causalcheck%';
\echo '=== the correlation is deliberately absent from it ==='
SELECT count(*) AS correlations_in_established FROM public.founder_causal_established
 WHERE cause LIKE '%over the same period%';

\echo '=== the totals ==='
SELECT correlations, hypotheses, verified FROM public.founder_causal_totals;

ROLLBACK;

\echo '=== nothing survived the check ==='
SELECT count(*) AS claims_left FROM public.founder_causal_claims;
