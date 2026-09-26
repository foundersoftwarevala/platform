-- Opportunities, derived from evidence that already exists.
--
-- Every row carries the figures it was derived from in `evidence`, so a reader
-- can check the reasoning instead of trusting it. The table refuses an empty
-- evidence object, which is the mechanism: an opportunity nobody can check is
-- an opinion, and this system has no way to write one.
--
-- Where a judgement needs search-performance data the platform does not have,
-- the row says NOT_CONFIGURED rather than guessing. Where the evidence is real
-- but thin, it says so in `confidence`.
--
-- Re-runnable: keyed on (kind, entity_kind, entity_key, target_url).

BEGIN;

-- 1. Every product page is held out of the index, which suppresses the most
--    natural internal link on the site. Found by the link engine: 7,280 card
--    slots would link to the product they hold, and every one of those targets
--    is refused by our own gate.
INSERT INTO seo_opportunities
  (kind, entity_kind, entity_key, target_url, evidence, source, severity, impact, confidence, recommended_action)
SELECT
  'product_pages_not_indexable', 'organisation', 'software-vala', NULL,
  jsonb_build_object(
    'product_pages_judged', (SELECT count(*) FROM seo_indexing_decisions WHERE entity_type='product'),
    'not_indexable',        (SELECT count(*) FROM seo_indexing_decisions WHERE entity_type='product' AND indexable = false),
    'card_to_product_links_suppressed',
      (SELECT count(*) FROM seo_entity_edges e
         JOIN seo_entities t ON t.id = e.target_id AND t.kind='product'
         JOIN seo_indexing_decisions d ON d.url = t.url
        WHERE e.relationship='hosts' AND d.indexable = false),
    'top_reasons', (SELECT jsonb_agg(r) FROM (
        SELECT split_part(coalesce(blocking_reason,'(none)'), ':', 1) AS reason, count(*) AS pages
        FROM seo_indexing_decisions WHERE entity_type='product'
        GROUP BY 1 ORDER BY 2 DESC LIMIT 4) r)),
  'gate+graph+links', 'critical', 'site-wide', 'high',
  'Every product page is judged too thin to index, so the card that sells it cannot be recommended to link to it. Deepening product pages unlocks both the pages and 7,280 internal links.'
WHERE EXISTS (SELECT 1 FROM seo_indexing_decisions WHERE entity_type='product' AND indexable = false)
ON CONFLICT (kind, entity_kind, entity_key, target_url) DO UPDATE
  SET evidence = EXCLUDED.evidence, updated_at = now();

-- 2. Pages the scoring engine judged weak, each with its own components.
INSERT INTO seo_opportunities
  (kind, entity_kind, entity_key, target_url, evidence, source, severity, impact, confidence, recommended_action)
SELECT
  'weak_page_score', 'seo_page', sp.url, sp.url,
  jsonb_build_object(
    'score', sp.seo_score,
    'issues', sp.issues_count,
    'words', sp.word_count,
    'components', sp.score_components,
    'scored_at', sp.scored_at,
    'evidence_used', sp.score_source),
  'score',
  CASE WHEN sp.seo_score < 50 THEN 'high' ELSE 'medium' END,
  'page', 'high',
  'The scoring engine recorded which components failed and what to do about each; work the issue list on this page.'
FROM seo_pages sp
WHERE sp.scored_at IS NOT NULL AND sp.seo_score IS NOT NULL AND sp.seo_score < 70
ON CONFLICT (kind, entity_kind, entity_key, target_url) DO UPDATE
  SET evidence = EXCLUDED.evidence, severity = EXCLUDED.severity, updated_at = now();

-- 3. Categories that do not reach every country the catalogue serves.
INSERT INTO seo_opportunities
  (kind, entity_kind, entity_key, target_url, evidence, source, severity, impact, confidence, recommended_action)
SELECT
  'category_geo_gap', 'category', cat.key, cat.url,
  jsonb_build_object(
    'countries_covered', covered.n,
    'countries_in_catalogue', (SELECT count(*) FROM seo_entities WHERE kind='country'),
    'missing', (SELECT count(*) FROM seo_entities WHERE kind='country') - covered.n),
  'graph', 'medium', 'geo', 'high',
  'This category has card slots for fewer countries than the catalogue serves. A gap is only worth filling where the category genuinely applies in that market.'
FROM seo_entities cat
JOIN LATERAL (
  SELECT count(DISTINCT c_edge.target_id) AS n
  FROM seo_entity_edges rep
  JOIN seo_entity_edges c_edge ON c_edge.source_id = rep.source_id AND c_edge.relationship = 'serves'
  WHERE rep.target_id = cat.id AND rep.relationship = 'represents'
) covered ON true
WHERE cat.kind = 'category'
  AND covered.n < (SELECT count(*) FROM seo_entities WHERE kind='country')
ON CONFLICT (kind, entity_kind, entity_key, target_url) DO UPDATE
  SET evidence = EXCLUDED.evidence, updated_at = now();

-- 4. Pages the gate holds back as duplicates, with the page each duplicates.
INSERT INTO seo_opportunities
  (kind, entity_kind, entity_key, target_url, evidence, source, severity, impact, confidence, recommended_action)
SELECT
  'duplicate_page', 'seo_page', d.url, d.url,
  jsonb_build_object(
    'fingerprint_class', d.fingerprint_class,
    'duplicate_of', d.duplicate_of,
    'blocking_reason', d.blocking_reason,
    'entity_type', d.entity_type),
  'gate', 'high', 'page', 'high',
  'Two pages saying the same thing compete with each other. Give this one something the other does not have, or accept that only one of them should be advertised.'
FROM seo_indexing_decisions d
WHERE d.fingerprint_class = 'LOW_VALUE_DUPLICATE' AND d.duplicate_of IS NOT NULL
ON CONFLICT (kind, entity_kind, entity_key, target_url) DO UPDATE
  SET evidence = EXCLUDED.evidence, updated_at = now();

-- 5. Landing pages that have earned leads. Real Lead Manager data, not
--    traffic: an anonymous visit is not a lead and is not counted here.
--    Where a page converts, the opportunity is to do more of it; the evidence
--    is the lead count and the pipeline value actually recorded.
INSERT INTO seo_opportunities
  (kind, entity_kind, entity_key, target_url, evidence, source, severity, impact, confidence, recommended_action)
SELECT
  'converting_landing_page', 'seo_page', l.landing_page, l.landing_page,
  jsonb_build_object(
    'leads', count(*),
    'from_search', count(*) FILTER (WHERE l.source = 'seo'),
    'search_engines', (SELECT jsonb_agg(DISTINCT e) FROM unnest(array_agg(l.search_engine)) e WHERE e IS NOT NULL),
    'pipeline_value', coalesce(sum(l.deal_value), 0),
    'won', count(*) FILTER (WHERE l.status = 'won'),
    'first_seen', min(l.created_at),
    'last_seen', max(l.created_at)),
  'leads', 'low', 'lead', 'high',
  'This page has produced leads that Lead Manager can name. Whatever it is doing is worth repeating on the pages that do not.'
FROM leads l
WHERE l.landing_page IS NOT NULL AND l.landing_page <> ''
GROUP BY l.landing_page
ON CONFLICT (kind, entity_kind, entity_key, target_url) DO UPDATE
  SET evidence = EXCLUDED.evidence, updated_at = now();

-- 6. Card slots that have never produced a lead, in a category that has.
--    Same category, same product ecosystem, one converts and one does not -
--    which is a comparison worth making and needs no external data.
INSERT INTO seo_opportunities
  (kind, entity_kind, entity_key, target_url, evidence, source, severity, impact, confidence, recommended_action)
SELECT
  'card_without_leads_in_converting_category', 'card', card.key, card.url,
  jsonb_build_object(
    'leads_from_this_card', 0,
    'leads_from_this_category', cat_leads.n,
    'category', cat.label,
    'country', country.label),
  'leads+graph', 'low', 'lead', 'medium',
  'Other slots of this category have produced leads and this one has not. Compare the two pages before assuming the market is the difference.'
FROM seo_entities card
JOIN seo_entity_edges rep ON rep.source_id = card.id AND rep.relationship = 'represents'
JOIN seo_entities cat ON cat.id = rep.target_id AND cat.kind = 'category'
JOIN seo_entity_edges srv ON srv.source_id = card.id AND srv.relationship = 'serves'
JOIN seo_entities country ON country.id = srv.target_id
JOIN LATERAL (
  SELECT count(*) AS n FROM leads l
  JOIN seo_entities c2 ON c2.kind = 'card' AND c2.url = l.landing_page
  JOIN seo_entity_edges r2 ON r2.source_id = c2.id AND r2.relationship = 'represents' AND r2.target_id = cat.id
) cat_leads ON cat_leads.n > 0
WHERE card.kind = 'card'
  AND NOT EXISTS (SELECT 1 FROM leads l2 WHERE l2.landing_page = card.url)
ON CONFLICT (kind, entity_kind, entity_key, target_url) DO UPDATE
  SET evidence = EXCLUDED.evidence, updated_at = now();

-- 7. The dimensions that need search-performance data nobody has yet.
--    Recorded as NOT_CONFIGURED rather than left out: a missing measurement is
--    a fact about this platform and belongs on the list, and an empty section
--    would read as "checked, nothing found".
INSERT INTO seo_opportunities
  (kind, entity_kind, entity_key, target_url, evidence, source, severity, impact, confidence, recommended_action)
SELECT
  'search_performance_unavailable', 'organisation', 'software-vala', NULL,
  jsonb_build_object(
    'providers_registered', 2,
    'providers_configured', 0,
    'dimensions_blocked', jsonb_build_array(
      'high impressions with low CTR',
      'high impressions with weak position',
      'rising and declining queries',
      'high-intent query with no matching page',
      'country opportunity from real impressions'),
    'google_search_console', 'registered, inactive, no credential',
    'bing_webmaster_tools', 'registered, inactive, no credential'),
  'gsc+bing', 'medium', 'site-wide', 'NOT_CONFIGURED',
  'Five kinds of opportunity cannot be detected at all without Search Console or Bing Webmaster data. Both are registered and free; each needs its credential set and the service activated.'
ON CONFLICT (kind, entity_kind, entity_key, target_url) DO UPDATE
  SET evidence = EXCLUDED.evidence, updated_at = now();

COMMIT;

\echo == opportunities by kind ==
SELECT kind, severity, confidence, count(*) FROM seo_opportunities GROUP BY 1,2,3 ORDER BY 4 DESC;
\echo == evidence integrity ==
SELECT count(*) AS total,
       count(*) FILTER (WHERE evidence = '{}'::jsonb) AS without_evidence,
       count(*) FILTER (WHERE recommended_action IS NULL OR recommended_action = '') AS without_action,
       count(*) FILTER (WHERE confidence = 'NOT_CONFIGURED') AS not_configured
FROM seo_opportunities;
