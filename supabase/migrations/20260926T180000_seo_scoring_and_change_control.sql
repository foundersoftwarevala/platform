-- Per-page SEO scoring (section 15) and SEO change control (section 19).
--
-- Both were named as pending and neither existed. `seo_pages` already carries a
-- single `seo_score` written by the crawler; what it has never carried is why
-- that number is what it is - which component failed, what the evidence was, or
-- when it was last judged. A score nobody can argue with is a score nobody can
-- act on.
--
-- Change control had nowhere to live at all. `seo_activity_log` records that
-- something happened and by whom, and carries an approval_ref, but not what the
-- value was before or what it became, so nothing could be reviewed and nothing
-- could be put back.
--
-- Nothing here is dropped or rewritten. Every column added is nullable or has a
-- default, and the 1,901 rows already in seo_pages keep the scores they have.

-- ---------------------------------------------------------------- section 15
ALTER TABLE public.seo_pages
  -- The component scores behind the single number: technical, content,
  -- structured data, internal linking, geo and indexation, each with its own
  -- score and the checks that produced it.
  ADD COLUMN IF NOT EXISTS score_components jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- What is wrong, with a severity and a remediation for each. This is the list
  -- an operator works from; the score is only the summary of it.
  ADD COLUMN IF NOT EXISTS score_issues     jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- When the judgement was made, and from what evidence. A score with no date
  -- is a claim about a page that may no longer exist in that form.
  ADD COLUMN IF NOT EXISTS scored_at        timestamptz,
  -- crawl | gate | both | none - so a score computed without crawl evidence is
  -- never mistaken for one that had it.
  ADD COLUMN IF NOT EXISTS score_source     text;

COMMENT ON COLUMN public.seo_pages.score_components IS
  'Per-component scores behind seo_score: technical, content, schema, links, geo, indexation.';
COMMENT ON COLUMN public.seo_pages.score_issues IS
  'What is wrong, each with severity and remediation. The score is the summary of this.';
COMMENT ON COLUMN public.seo_pages.score_source IS
  'Which evidence the score was computed from, so a score without crawl data is not mistaken for one with it.';

CREATE INDEX IF NOT EXISTS seo_pages_score_idx
  ON public.seo_pages (seo_score, scored_at DESC) WHERE seo_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS seo_pages_scored_at_idx
  ON public.seo_pages (scored_at DESC) WHERE scored_at IS NOT NULL;

-- ---------------------------------------------------------------- section 19
-- One row per proposed change to anything the SEO system owns.
--
-- The point is that a change is a proposal until somebody accepts it, and that
-- what it replaced is kept so it can be put back. An AI suggestion, an operator
-- edit and an automation all take the same path and are told apart by `source`.
CREATE TABLE IF NOT EXISTS public.seo_change_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What is being changed.
  entity_type     text NOT NULL,              -- card_slot | seo_page | meta_rule | product
  entity_id       uuid,
  target_url      text,
  field           text NOT NULL,              -- the column or key being changed

  -- The change itself. jsonb so a keyword array and a title are both storable.
  old_value       jsonb,
  new_value       jsonb,
  reason          text,

  -- Where it came from. `provider` names the AI service when source is 'ai',
  -- so a change can be traced to the model that proposed it.
  source          text NOT NULL DEFAULT 'manual',   -- manual | ai | crawler | automation
  provider        text,
  model           text,

  -- Where it is in the workflow section 19 sets out.
  state           text NOT NULL DEFAULT 'DRAFT',
  -- DRAFT | ANALYSIS | QA | APPROVAL_REQUIRED | APPROVED | PUBLISHED
  --       | REJECTED | ROLLED_BACK
  qa_findings     jsonb NOT NULL DEFAULT '[]'::jsonb,
  impact          text NOT NULL DEFAULT 'normal',   -- normal | high

  requested_by    uuid,
  approved_by     uuid,
  approved_at     timestamptz,
  published_at    timestamptz,
  rejected_at     timestamptz,
  rolled_back_at  timestamptz,
  -- When this row exists to undo another one.
  rollback_of     uuid REFERENCES public.seo_change_requests(id),

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT seo_change_requests_state_known CHECK (state IN (
    'DRAFT','ANALYSIS','QA','APPROVAL_REQUIRED','APPROVED','PUBLISHED','REJECTED','ROLLED_BACK'
  )),
  CONSTRAINT seo_change_requests_source_known CHECK (source IN (
    'manual','ai','crawler','automation'
  )),
  -- A published change must say what it replaced, or it cannot be undone.
  CONSTRAINT seo_change_requests_published_has_old CHECK (
    state <> 'PUBLISHED' OR old_value IS NOT NULL OR rollback_of IS NOT NULL
  )
);

COMMENT ON TABLE public.seo_change_requests IS
  'Every proposed change to SEO data: what it was, what it would become, who asked, who approved, and how to put it back.';

CREATE INDEX IF NOT EXISTS seo_change_requests_state_idx
  ON public.seo_change_requests (state, created_at DESC);
CREATE INDEX IF NOT EXISTS seo_change_requests_entity_idx
  ON public.seo_change_requests (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS seo_change_requests_url_idx
  ON public.seo_change_requests (target_url) WHERE target_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS seo_change_requests_awaiting_idx
  ON public.seo_change_requests (created_at DESC) WHERE state = 'APPROVAL_REQUIRED';

-- Keep updated_at honest.
CREATE OR REPLACE FUNCTION public.seo_change_requests_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seo_change_requests_touch ON public.seo_change_requests;
CREATE TRIGGER seo_change_requests_touch
  BEFORE UPDATE ON public.seo_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.seo_change_requests_touch();

-- The same access rule the rest of the SEO tables carry.
ALTER TABLE public.seo_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS seo_change_requests_service_role ON public.seo_change_requests;
CREATE POLICY seo_change_requests_service_role
  ON public.seo_change_requests FOR ALL TO service_role
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.seo_change_requests TO service_role;
