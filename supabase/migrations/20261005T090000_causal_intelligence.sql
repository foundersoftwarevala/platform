-- Why something changed, and how sure we are allowed to sound about it.
--
-- The platform could already say what changed: events, KPI readings,
-- attention items, signals. What it could not say is why, and — more
-- importantly — it had no way to stop a guess about why being repeated until
-- it sounded like a finding. That is the failure this table exists to make
-- structurally impossible.
--
-- Three strengths, and the distance between them is the whole point:
--
--   CORRELATION      two things moved together. No claim about cause.
--   CAUSAL_HYPOTHESIS someone or something proposes a cause. Not established.
--   VERIFIED_CAUSE   the cause was tested and held.
--
-- A claim may only be recorded as VERIFIED_CAUSE with a named verification
-- method, a person or system that did the verifying, and the time it
-- happened. A hypothesis cannot be promoted by editing a field, because the
-- constraint refuses the row without the evidence that would justify it.
--
-- The second half is provenance. Every claim records the sources it was built
-- from and the reasoning applied, so "why did Founder AI tell me this" has an
-- answer that can be inspected rather than trusted.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'founder_claim_strength') THEN
    CREATE TYPE founder_claim_strength AS ENUM (
      'CORRELATION', 'CAUSAL_HYPOTHESIS', 'VERIFIED_CAUSE', 'REFUTED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.founder_causal_claims (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,

  -- What changed. The observation this is trying to explain.
  effect          text NOT NULL,
  effect_domain   text NOT NULL,
  effect_entity_type text,
  effect_entity_id   text,
  observed_at     timestamptz NOT NULL,

  -- The proposed explanation.
  cause           text NOT NULL,
  strength        founder_claim_strength NOT NULL DEFAULT 'CORRELATION',

  -- What it was built from, named table by table. A claim that cannot name
  -- its sources is an opinion.
  sources         jsonb NOT NULL,
  -- What was done to the data to get here: the transformation and the
  -- reasoning, in words a person can check.
  method          text NOT NULL,
  reasoning       text NOT NULL,

  -- What else could explain the same thing. A causal claim with no
  -- alternatives considered is a guess that stopped looking.
  alternatives    jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- What is not known, stated rather than left out.
  unknowns        jsonb NOT NULL DEFAULT '[]'::jsonb,

  confidence      founder_confidence NOT NULL DEFAULT 'UNKNOWN',

  -- Only meaningful for VERIFIED_CAUSE, and required for it.
  verification_method text,
  verified_by     uuid,
  verified_by_system text,
  verified_at     timestamptz,
  refuted_reason  text,

  -- What this would affect if it holds, and what happens if nobody acts.
  affects         jsonb NOT NULL DEFAULT '[]'::jsonb,
  if_unaddressed  text,

  produced_by_ai  boolean NOT NULL DEFAULT true,
  ai_request_id   text,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT founder_causal_effect_not_blank CHECK (length(btrim(effect)) > 0),
  CONSTRAINT founder_causal_cause_not_blank CHECK (length(btrim(cause)) > 0),
  CONSTRAINT founder_causal_method_not_blank CHECK (length(btrim(method)) > 0),
  CONSTRAINT founder_causal_reasoning_not_blank CHECK (length(btrim(reasoning)) > 0),
  -- Provenance is not optional. An empty sources object is the shape a
  -- fabricated claim takes.
  CONSTRAINT founder_causal_sources_present CHECK (sources <> '{}'::jsonb),

  -- The central rule. A verified cause has to name how it was verified, who
  -- or what verified it, and when. Without all three the row is refused, so
  -- a hypothesis cannot be promoted by changing one field.
  CONSTRAINT founder_causal_verification_is_evidenced CHECK (
    strength <> 'VERIFIED_CAUSE'
    OR (verification_method IS NOT NULL AND length(btrim(verification_method)) > 0
        AND verified_at IS NOT NULL
        AND (verified_by IS NOT NULL OR
             (verified_by_system IS NOT NULL AND length(btrim(verified_by_system)) > 0)))
  ),

  -- A claim that has not been verified may not carry verification fields, so
  -- a row cannot be quietly staged to look verified before it is.
  --
  -- REFUTED is deliberately exempt. A claim that was verified and later
  -- turned out to be wrong must keep the record of how it was verified —
  -- clearing those fields to refute it would erase the fact that the system
  -- once presented it as established, which is exactly the history worth
  -- keeping.
  CONSTRAINT founder_causal_unverified_has_no_verification CHECK (
    strength IN ('VERIFIED_CAUSE', 'REFUTED')
    OR (verification_method IS NULL AND verified_at IS NULL
        AND verified_by IS NULL AND verified_by_system IS NULL)
  ),

  -- A causal claim, hypothesis or verified, has to have looked at something
  -- else first.
  CONSTRAINT founder_causal_hypothesis_considered_alternatives CHECK (
    strength = 'CORRELATION' OR jsonb_array_length(alternatives) > 0
  ),

  CONSTRAINT founder_causal_refutation_is_explained CHECK (
    strength <> 'REFUTED'
    OR (refuted_reason IS NOT NULL AND length(btrim(refuted_reason)) > 0)
  ),

  -- A correlation is not allowed to describe itself as a cause. This is a
  -- wording check, and it is here because the failure is linguistic: the row
  -- says CORRELATION while the sentence says "caused by".
  CONSTRAINT founder_causal_correlation_does_not_claim_cause CHECK (
    strength <> 'CORRELATION'
    OR cause !~* '(\ycaused\y|\ybecause of\y|\ydue to\y|\yresulted in\y)'
  )
);

CREATE INDEX IF NOT EXISTS founder_causal_effect_idx
  ON public.founder_causal_claims (effect_domain, observed_at DESC);
CREATE INDEX IF NOT EXISTS founder_causal_strength_idx
  ON public.founder_causal_claims (strength, observed_at DESC);
CREATE INDEX IF NOT EXISTS founder_causal_entity_idx
  ON public.founder_causal_claims (effect_entity_type, effect_entity_id)
  WHERE effect_entity_id IS NOT NULL;

-- Strength may only move in ways the evidence supports.
--
-- A hypothesis may become verified or refuted. A verified cause may be
-- refuted — evidence can turn out wrong — but it may not quietly slide back
-- to being a hypothesis, because that would erase the fact that it was once
-- claimed as established.
CREATE OR REPLACE FUNCTION public.founder_causal_strength_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  allowed founder_claim_strength[];
BEGIN
  IF NEW.strength = OLD.strength THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  allowed := CASE OLD.strength
    WHEN 'CORRELATION'       THEN ARRAY['CAUSAL_HYPOTHESIS','REFUTED']::founder_claim_strength[]
    WHEN 'CAUSAL_HYPOTHESIS' THEN ARRAY['VERIFIED_CAUSE','REFUTED','CORRELATION']::founder_claim_strength[]
    WHEN 'VERIFIED_CAUSE'    THEN ARRAY['REFUTED']::founder_claim_strength[]
    WHEN 'REFUTED'           THEN ARRAY[]::founder_claim_strength[]
    ELSE ARRAY[]::founder_claim_strength[]
  END;

  IF NOT (NEW.strength = ANY (allowed)) THEN
    RAISE EXCEPTION 'a claim cannot go from % to %', OLD.strength, NEW.strength
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS founder_causal_strength_guard ON public.founder_causal_claims;
CREATE TRIGGER founder_causal_strength_guard
  BEFORE UPDATE ON public.founder_causal_claims
  FOR EACH ROW EXECUTE FUNCTION public.founder_causal_strength_guard();

ALTER TABLE public.founder_causal_claims ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='founder_causal_claims' AND policyname='founder_causal_claims_service_role'
  ) THEN
    CREATE POLICY founder_causal_claims_service_role ON public.founder_causal_claims
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- What may be repeated as established, and what may not.
--
-- A screen or an AI context builder reads this rather than the table, so a
-- hypothesis cannot reach a reader wearing the clothes of a finding. The
-- distinction is carried in the row, not left to whoever renders it.
CREATE OR REPLACE VIEW public.founder_causal_established
WITH (security_invoker = true) AS
SELECT id, effect, effect_domain, cause, method, reasoning, sources,
       verification_method, verified_at, confidence, affects, if_unaddressed, observed_at
FROM public.founder_causal_claims
WHERE strength = 'VERIFIED_CAUSE';

COMMENT ON VIEW public.founder_causal_established IS
  'Causes that were actually verified. Anything still a hypothesis is deliberately absent.';

CREATE OR REPLACE VIEW public.founder_causal_totals
WITH (security_invoker = true) AS
SELECT
  count(*)                                              AS claims,
  count(*) FILTER (WHERE strength = 'CORRELATION')      AS correlations,
  count(*) FILTER (WHERE strength = 'CAUSAL_HYPOTHESIS') AS hypotheses,
  count(*) FILTER (WHERE strength = 'VERIFIED_CAUSE')   AS verified,
  count(*) FILTER (WHERE strength = 'REFUTED')          AS refuted,
  count(*) FILTER (WHERE produced_by_ai)                AS produced_by_ai
FROM public.founder_causal_claims;

GRANT SELECT ON public.founder_causal_established TO service_role;
GRANT SELECT ON public.founder_causal_totals TO service_role;
