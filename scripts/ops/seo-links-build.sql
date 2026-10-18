-- Internal-link recommendations, derived from the entity graph.
--
-- Recommendations, not links. Nothing here edits a page: every row lands in
-- GENERATED and has to go through approval before it is anything more than an
-- argument. The reason travels with each one so a reviewer is judging the
-- argument rather than a pair of URLs.
--
-- Three quality rules are applied before a row is written, not after:
--
--   * the target must be a page the indexing gate allows in. Linking to a page
--     we ourselves refuse to advertise spends authority on a dead end.
--   * no page may link to itself.
--   * geo siblings are capped at two per card. The point is a contextual link
--     to a close relative, not a ring of seventy-nine country pages, which is
--     the shape a doorway network takes.
--
-- Re-runnable: keyed on (source, target, relationship).

BEGIN;

-- 1. A card links to the product currently in it. The strongest relationship
--    there is: the card exists to sell that product today.
INSERT INTO seo_link_recommendations (source_url, target_url, relationship, anchor, reason, priority)
SELECT
  src.url, tgt.url, 'hosts',
  tgt.label,
  'This card slot currently holds ' || tgt.label || '. A visitor on the slot should be able to reach the product it is about.',
  1
FROM seo_entity_edges e
JOIN seo_entities src ON src.id = e.source_id AND src.kind = 'card'
JOIN seo_entities tgt ON tgt.id = e.target_id AND tgt.kind = 'product'
LEFT JOIN seo_indexing_decisions d ON d.url = tgt.url
WHERE e.relationship = 'hosts'
  AND src.url IS NOT NULL AND tgt.url IS NOT NULL
  AND src.url <> tgt.url
  AND coalesce(d.indexable, true)
ON CONFLICT (source_url, target_url, relationship) DO UPDATE
  SET reason = EXCLUDED.reason, updated_at = now();

-- 2. A card links up to its category. This is the breadcrumb relationship and
--    the one that makes a category page worth ranking.
INSERT INTO seo_link_recommendations (source_url, target_url, relationship, anchor, reason, priority)
SELECT
  src.url, tgt.url, 'represents',
  tgt.label,
  'This card is one slot of the ' || tgt.label || ' category. Linking up gives the category page the standing its slots earn it.',
  2
FROM seo_entity_edges e
JOIN seo_entities src ON src.id = e.source_id AND src.kind = 'card'
JOIN seo_entities tgt ON tgt.id = e.target_id AND tgt.kind = 'category'
LEFT JOIN seo_indexing_decisions d ON d.url = tgt.url
WHERE e.relationship = 'represents'
  AND src.url IS NOT NULL AND tgt.url IS NOT NULL
  AND src.url <> tgt.url
  AND coalesce(d.indexable, true)
ON CONFLICT (source_url, target_url, relationship) DO UPDATE
  SET reason = EXCLUDED.reason, updated_at = now();

-- 3. A card links to at most two siblings: the same category in another
--    country of the same region. Same subject, neighbouring market - which is
--    the one internal link a reader of a country page plausibly wants.
--
--    Capped deliberately. Every country of a category linking to every other
--    is seventy-nine links per page about the same thing, which is a doorway
--    ring however it is described.
WITH sibling AS (
  SELECT
    src.url        AS source_url,
    tgt.url        AS target_url,
    tgt.label      AS target_label,
    srcc.label     AS source_country,
    tgtc.label     AS target_country,
    cat.label      AS category_label,
    row_number() OVER (PARTITION BY src.id ORDER BY tgt.key) AS rank
  FROM seo_entity_edges ec_src
  JOIN seo_entities src  ON src.id = ec_src.source_id AND src.kind = 'card'
  JOIN seo_entities cat  ON cat.id = ec_src.target_id AND cat.kind = 'category'
  -- other cards of the same category
  JOIN seo_entity_edges ec_tgt ON ec_tgt.target_id = cat.id AND ec_tgt.relationship = 'represents'
  JOIN seo_entities tgt  ON tgt.id = ec_tgt.source_id AND tgt.kind = 'card' AND tgt.id <> src.id
  -- both in the same region
  JOIN seo_entity_edges r_src ON r_src.source_id = src.id AND r_src.relationship = 'in_region'
  JOIN seo_entity_edges r_tgt ON r_tgt.source_id = tgt.id AND r_tgt.relationship = 'in_region'
                             AND r_tgt.target_id = r_src.target_id
  -- and their countries, for the anchor
  JOIN seo_entity_edges c_src ON c_src.source_id = src.id AND c_src.relationship = 'serves'
  JOIN seo_entities srcc ON srcc.id = c_src.target_id
  JOIN seo_entity_edges c_tgt ON c_tgt.source_id = tgt.id AND c_tgt.relationship = 'serves'
  JOIN seo_entities tgtc ON tgtc.id = c_tgt.target_id
  LEFT JOIN seo_indexing_decisions d ON d.url = tgt.url
  WHERE ec_src.relationship = 'represents'
    AND src.url IS NOT NULL AND tgt.url IS NOT NULL
    AND src.url <> tgt.url
    AND coalesce(d.indexable, true)
)
INSERT INTO seo_link_recommendations (source_url, target_url, relationship, anchor, reason, priority)
SELECT
  source_url, target_url, 'geo_sibling',
  category_label || ' in ' || target_country,
  'Same category in a neighbouring market: ' || category_label || ' for ' || source_country ||
    ' and for ' || target_country || ' are the nearest relatives this page has.',
  3
FROM sibling
WHERE rank <= 2
ON CONFLICT (source_url, target_url, relationship) DO UPDATE
  SET reason = EXCLUDED.reason, updated_at = now();

-- 4. A product page links up to its category.
INSERT INTO seo_link_recommendations (source_url, target_url, relationship, anchor, reason, priority)
SELECT
  src.url, tgt.url, 'belongs_to',
  tgt.label,
  src.label || ' is a ' || tgt.label || ' product. The category page is the natural next step for a reader comparing options.',
  2
FROM seo_entity_edges e
JOIN seo_entities src ON src.id = e.source_id AND src.kind = 'product'
JOIN seo_entities tgt ON tgt.id = e.target_id AND tgt.kind = 'category'
LEFT JOIN seo_indexing_decisions d ON d.url = tgt.url
LEFT JOIN seo_indexing_decisions ds ON ds.url = src.url
WHERE e.relationship = 'belongs_to'
  AND src.url IS NOT NULL AND tgt.url IS NOT NULL
  AND src.url <> tgt.url
  AND coalesce(d.indexable, true)
ON CONFLICT (source_url, target_url, relationship) DO UPDATE
  SET reason = EXCLUDED.reason, updated_at = now();

COMMIT;

\echo == recommendations by relationship ==
SELECT relationship, priority, count(*) FROM seo_link_recommendations GROUP BY 1,2 ORDER BY 2,3 DESC;
\echo == by state ==
SELECT state, count(*) FROM seo_link_recommendations GROUP BY 1;
\echo == quality guards ==
SELECT
  (SELECT count(*) FROM seo_link_recommendations WHERE source_url = target_url) AS self_links,
  (SELECT count(*) FROM seo_link_recommendations WHERE reason IS NULL OR reason = '') AS without_reason,
  (SELECT count(*) FROM seo_link_recommendations r
     JOIN seo_indexing_decisions d ON d.url = r.target_url
    WHERE d.indexable = false) AS to_blocked_pages,
  (SELECT max(n) FROM (SELECT count(*) n FROM seo_link_recommendations GROUP BY source_url) x) AS most_from_one_page;
