-- Let a lead say where it actually came from.
--
-- The chain the owner cares about is SEO -> lead -> demo -> payment, and the
-- first arrow did not exist. /api/marketplace/lead wrote `source` as the
-- literal "marketplace" for every capture, so a visitor who searched on
-- Google, landed on a slot page and asked for a demo was recorded as a
-- marketplace walk-in. Of 139 leads, 15 carry the page they converted on, 18
-- the button they pressed and 10 the product; none carries a referrer, a
-- campaign parameter, a search engine or the card slot they arrived through.
-- Lead Manager therefore cannot answer "which SEO page produced this lead",
-- which is the question the whole SEO programme exists to answer.
--
-- Nothing here replaces the lead model. `leads` already holds source,
-- sub_source, campaign, category, country, product_id, cta_action and
-- source_page; these are the fields it was missing, added beside them. No
-- column is dropped, no value is rewritten, and every column is nullable, so
-- the 139 existing rows remain exactly as they are and a capture that supplies
-- none of this still succeeds.

ALTER TABLE public.leads
  -- Where the visitor came from, as the browser reported it.
  ADD COLUMN IF NOT EXISTS referrer        text,
  -- The search engine the referrer belongs to - google, bing, yandex, naver,
  -- duckduckgo, baidu - resolved once on capture so the question "which engine
  -- sends leads" is an index scan rather than a scan of every referrer string.
  ADD COLUMN IF NOT EXISTS search_engine   text,
  -- The five standard campaign parameters. `campaign` already exists and is
  -- kept as the operator-facing name; utm_campaign is what the URL actually
  -- carried, which is not always the same thing.
  ADD COLUMN IF NOT EXISTS utm_source      text,
  ADD COLUMN IF NOT EXISTS utm_medium      text,
  ADD COLUMN IF NOT EXISTS utm_campaign    text,
  ADD COLUMN IF NOT EXISTS utm_term        text,
  ADD COLUMN IF NOT EXISTS utm_content     text,
  -- The first page of the visit, which is the one a search engine ranked.
  -- source_page is the page they were on when they converted; on a site where
  -- people browse before enquiring these are usually different pages, and
  -- crediting the second one would credit the wrong page.
  ADD COLUMN IF NOT EXISTS landing_page    text,
  -- The card slot the visitor arrived through. A slot is a fixed
  -- category-by-country position that outlives whichever product occupies it,
  -- so attributing to the slot survives a product rotation in a way that
  -- attributing only to product_id does not.
  ADD COLUMN IF NOT EXISTS card_slot_id    uuid REFERENCES public.marketplace_card_slots(id),
  ADD COLUMN IF NOT EXISTS region          text,
  -- Anything else the capture legitimately observed, kept whole. A jsonb
  -- column beside the named ones means a new signal does not need a migration
  -- before it can be recorded, and the named ones stay fast to query.
  ADD COLUMN IF NOT EXISTS attribution     jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.leads.landing_page IS
  'First page of the visit - the page search ranked. source_page is where they converted.';
COMMENT ON COLUMN public.leads.card_slot_id IS
  'The fixed category-by-country slot the visitor arrived through; survives product rotation.';
COMMENT ON COLUMN public.leads.attribution IS
  'The whole capture envelope, for signals without a column of their own.';

-- The questions section 2 requires Lead Manager to answer, at 2,000+ leads a
-- day and a catalogue of 7,280 slots. Partial where the column is usually
-- null, so the index stays small and is only consulted when it can help.
CREATE INDEX IF NOT EXISTS leads_search_engine_idx
  ON public.leads (search_engine, created_at DESC) WHERE search_engine IS NOT NULL;
CREATE INDEX IF NOT EXISTS leads_landing_page_idx
  ON public.leads (landing_page) WHERE landing_page IS NOT NULL;
CREATE INDEX IF NOT EXISTS leads_card_slot_idx
  ON public.leads (card_slot_id, created_at DESC) WHERE card_slot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS leads_utm_campaign_idx
  ON public.leads (utm_campaign, created_at DESC) WHERE utm_campaign IS NOT NULL;
CREATE INDEX IF NOT EXISTS leads_utm_source_medium_idx
  ON public.leads (utm_source, utm_medium) WHERE utm_source IS NOT NULL;
-- "Which SEO pages produced leads this month" reads source + created_at.
CREATE INDEX IF NOT EXISTS leads_source_created_at_idx
  ON public.leads (source, created_at DESC);
