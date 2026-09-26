-- The entity graph (13), internal-link recommendations (14) and the
-- opportunity engine (18).
--
-- None of the three existed. There is no entity table, no link recommendation
-- table and no opportunity table anywhere in this database, so each is created
-- here rather than extended - but every row they will hold is derived from
-- something that already exists. The graph is built from foreign keys and
-- columns the catalogue already maintains: a product belongs to a category
-- because marketplace_products.category_id says so, not because anything here
-- decided it should.
--
-- Nothing is dropped and no existing table is altered.

-- ------------------------------------------------------------------ 13
-- One row per thing the SEO system can reason about. `key` is the natural,
-- stable identifier within a kind - a slug, a country name, an industry label
-- - so a rebuild recognises what it built last time instead of duplicating it.
CREATE TABLE IF NOT EXISTS public.seo_entities (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         text NOT NULL,
  key          text NOT NULL,
  label        text NOT NULL,
  -- Where this came from, so every entity can be traced back to the row that
  -- produced it and nothing here is taken on trust.
  source_table text,
  source_id    uuid,
  url          text,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  status       text NOT NULL DEFAULT 'active',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seo_entities_kind_known CHECK (kind IN (
    'organisation','category','card','product','country','region','industry',
    'business_type','software_type','technology','use_case','audience',
    'problem','solution','demo','seo_page','content','faq'
  )),
  CONSTRAINT seo_entities_unique_key UNIQUE (kind, key)
);

COMMENT ON TABLE public.seo_entities IS
  'Every thing the SEO system reasons about, each traceable to the row that produced it.';

CREATE INDEX IF NOT EXISTS seo_entities_kind_idx ON public.seo_entities (kind);
CREATE INDEX IF NOT EXISTS seo_entities_url_idx ON public.seo_entities (url) WHERE url IS NOT NULL;
CREATE INDEX IF NOT EXISTS seo_entities_source_idx ON public.seo_entities (source_table, source_id);

-- An edge is only ever written with the evidence that produced it. A
-- relationship with no evidence is an invention, and an invented relationship
-- is how a link graph turns into a doorway network.
CREATE TABLE IF NOT EXISTS public.seo_entity_edges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id    uuid NOT NULL REFERENCES public.seo_entities(id) ON DELETE CASCADE,
  target_id    uuid NOT NULL REFERENCES public.seo_entities(id) ON DELETE CASCADE,
  relationship text NOT NULL,
  -- The column or join that proved it, in words. Never null.
  evidence     text NOT NULL,
  -- 1.0 when a foreign key proved it; lower only when something inferred it,
  -- and nothing infers anything yet.
  confidence   numeric NOT NULL DEFAULT 1.0,
  status       text NOT NULL DEFAULT 'active',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seo_entity_edges_not_self CHECK (source_id <> target_id),
  CONSTRAINT seo_entity_edges_confidence CHECK (confidence > 0 AND confidence <= 1),
  CONSTRAINT seo_entity_edges_unique UNIQUE (source_id, target_id, relationship)
);

COMMENT ON TABLE public.seo_entity_edges IS
  'Relationships between entities. Every edge carries the evidence that produced it; an edge without evidence cannot be written.';

CREATE INDEX IF NOT EXISTS seo_entity_edges_source_idx ON public.seo_entity_edges (source_id, relationship);
CREATE INDEX IF NOT EXISTS seo_entity_edges_target_idx ON public.seo_entity_edges (target_id, relationship);
CREATE INDEX IF NOT EXISTS seo_entity_edges_rel_idx ON public.seo_entity_edges (relationship);

-- ------------------------------------------------------------------ 14
-- A proposed internal link, with the reason it was proposed.
--
-- Recommendations, not links: nothing here edits a page. A recommendation that
-- reaches PUBLISHED has been through the same approval the rest of the SEO
-- system uses, and the reason travels with it so a reviewer is judging an
-- argument rather than a URL pair.
CREATE TABLE IF NOT EXISTS public.seo_link_recommendations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url    text NOT NULL,
  target_url    text NOT NULL,
  -- Which edge in the graph justifies it.
  relationship  text NOT NULL,
  anchor        text,
  -- Why this link is worth having, in a sentence a person can disagree with.
  reason        text NOT NULL,
  -- 1 is the strongest. Same card ecosystem first, then category, then geo.
  priority      integer NOT NULL DEFAULT 5,
  state         text NOT NULL DEFAULT 'GENERATED',
  qa_findings   jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_at  timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seo_link_recommendations_state_known CHECK (state IN (
    'GENERATED','QA','APPROVAL_REQUIRED','APPROVED','PUBLISHED','REJECTED','ROLLED_BACK'
  )),
  CONSTRAINT seo_link_recommendations_not_self CHECK (source_url <> target_url),
  CONSTRAINT seo_link_recommendations_unique UNIQUE (source_url, target_url, relationship)
);

COMMENT ON TABLE public.seo_link_recommendations IS
  'Proposed internal links with the reason for each. Nothing here edits a page; publication goes through approval.';

CREATE INDEX IF NOT EXISTS seo_link_recs_source_idx ON public.seo_link_recommendations (source_url);
CREATE INDEX IF NOT EXISTS seo_link_recs_state_idx ON public.seo_link_recommendations (state, priority);
CREATE INDEX IF NOT EXISTS seo_link_recs_target_idx ON public.seo_link_recommendations (target_url);

-- ------------------------------------------------------------------ 18
-- Something worth doing, with the evidence that says so.
--
-- `evidence` is not optional and is not prose: it holds the figures the
-- opportunity was derived from, so a reader can check the reasoning rather
-- than trust it. `confidence` may be UNVERIFIED, and a dimension that needs
-- search-performance data says NOT_CONFIGURED rather than guessing.
CREATE TABLE IF NOT EXISTS public.seo_opportunities (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind               text NOT NULL,
  entity_kind        text,
  entity_key         text,
  target_url         text,
  evidence           jsonb NOT NULL,
  -- score | crawler | gate | graph | links | leads | gsc | bing
  source             text NOT NULL,
  severity           text NOT NULL DEFAULT 'medium',
  -- A category, never an invented number of visits or pounds.
  impact             text NOT NULL DEFAULT 'unknown',
  confidence         text NOT NULL DEFAULT 'medium',
  recommended_action text NOT NULL,
  status             text NOT NULL DEFAULT 'open',
  detected_at        timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seo_opportunities_severity_known CHECK (severity IN ('critical','high','medium','low')),
  CONSTRAINT seo_opportunities_confidence_known CHECK (confidence IN ('high','medium','low','UNVERIFIED','NOT_CONFIGURED')),
  CONSTRAINT seo_opportunities_status_known CHECK (status IN ('open','acknowledged','in_progress','done','dismissed')),
  CONSTRAINT seo_opportunities_evidence_present CHECK (evidence <> '{}'::jsonb),
  CONSTRAINT seo_opportunities_unique UNIQUE (kind, entity_kind, entity_key, target_url)
);

COMMENT ON TABLE public.seo_opportunities IS
  'Evidence-backed things worth doing. The evidence column carries the figures it was derived from; an opportunity cannot be written without them.';

CREATE INDEX IF NOT EXISTS seo_opportunities_open_idx
  ON public.seo_opportunities (severity, detected_at DESC) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS seo_opportunities_kind_idx ON public.seo_opportunities (kind, status);
CREATE INDEX IF NOT EXISTS seo_opportunities_url_idx
  ON public.seo_opportunities (target_url) WHERE target_url IS NOT NULL;

-- ------------------------------------------------------------ housekeeping
CREATE OR REPLACE FUNCTION public.seo_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seo_entities_touch ON public.seo_entities;
CREATE TRIGGER seo_entities_touch BEFORE UPDATE ON public.seo_entities
  FOR EACH ROW EXECUTE FUNCTION public.seo_touch_updated_at();

DROP TRIGGER IF EXISTS seo_entity_edges_touch ON public.seo_entity_edges;
CREATE TRIGGER seo_entity_edges_touch BEFORE UPDATE ON public.seo_entity_edges
  FOR EACH ROW EXECUTE FUNCTION public.seo_touch_updated_at();

DROP TRIGGER IF EXISTS seo_link_recommendations_touch ON public.seo_link_recommendations;
CREATE TRIGGER seo_link_recommendations_touch BEFORE UPDATE ON public.seo_link_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.seo_touch_updated_at();

DROP TRIGGER IF EXISTS seo_opportunities_touch ON public.seo_opportunities;
CREATE TRIGGER seo_opportunities_touch BEFORE UPDATE ON public.seo_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.seo_touch_updated_at();

-- The access rule the rest of the SEO tables carry.
ALTER TABLE public.seo_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_entity_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_link_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_opportunities ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['seo_entities','seo_entity_edges','seo_link_recommendations','seo_opportunities']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_service_role ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_service_role ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t, t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role', t);
  END LOOP;
END $$;
