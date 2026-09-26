-- Build the entity graph from what the catalogue already knows.
--
-- Every entity and every edge here is derived from a column that already
-- exists. A product belongs to a category because marketplace_products
-- .category_id says so; a card serves a country because country_marker says
-- so. Nothing is inferred, nothing is guessed, and an edge that cannot name
-- the column that produced it is not written - the table will not accept one.
--
-- Written as set-based SQL on purpose. There are 7,280 cards and 7,357
-- products and both will grow; a builder that walked them row by row would
-- stop being usable at exactly the size that makes a graph worth having.
--
-- Re-runnable. Entities are keyed on (kind, key) and edges on
-- (source, target, relationship), so a second run updates rather than
-- duplicates.

BEGIN;

-- ---------------------------------------------------------------- entities
INSERT INTO seo_entities (kind, key, label, source_table, url, metadata)
VALUES ('organisation', 'software-vala', 'Software Vala', NULL, '/', '{}'::jsonb)
ON CONFLICT (kind, key) DO UPDATE SET label = EXCLUDED.label, updated_at = now();

INSERT INTO seo_entities (kind, key, label, source_table, source_id, url)
SELECT 'category', c.slug, c.name, 'marketplace_categories', c.id,
       '/marketplace/category/' || c.slug
FROM marketplace_categories c
WHERE NOT c.is_hidden
ON CONFLICT (kind, key) DO UPDATE
  SET label = EXCLUDED.label, url = EXCLUDED.url, source_id = EXCLUDED.source_id, updated_at = now();

INSERT INTO seo_entities (kind, key, label, source_table, source_id, url, metadata)
SELECT 'card', s.slot_url, coalesce(s.slot_title, s.slot_url), 'marketplace_card_slots', s.id, s.slot_url,
       jsonb_strip_nulls(jsonb_build_object(
         'country', s.country_marker, 'region', s.region,
         'business_type', s.business_type, 'software_type', s.software_type,
         'primary_keyword', s.primary_keyword))
FROM marketplace_card_slots s
ON CONFLICT (kind, key) DO UPDATE
  SET label = EXCLUDED.label, metadata = EXCLUDED.metadata, source_id = EXCLUDED.source_id, updated_at = now();

INSERT INTO seo_entities (kind, key, label, source_table, source_id, url)
SELECT 'product', p.slug, p.name, 'marketplace_products', p.id, '/marketplace/product/' || p.slug
FROM marketplace_products p
WHERE p.visible AND p.slug IS NOT NULL AND p.slug <> ''
ON CONFLICT (kind, key) DO UPDATE
  SET label = EXCLUDED.label, url = EXCLUDED.url, source_id = EXCLUDED.source_id, updated_at = now();

INSERT INTO seo_entities (kind, key, label, source_table, url)
SELECT DISTINCT 'country', lower(s.country_marker), s.country_marker, 'marketplace_card_slots',
       '/marketplace/country/' || lower(replace(s.country_marker, ' ', '-'))
FROM marketplace_card_slots s
WHERE s.country_marker IS NOT NULL AND s.country_marker <> ''
ON CONFLICT (kind, key) DO UPDATE SET label = EXCLUDED.label, updated_at = now();

INSERT INTO seo_entities (kind, key, label, source_table)
SELECT DISTINCT 'region', lower(s.region), s.region, 'marketplace_card_slots'
FROM marketplace_card_slots s
WHERE s.region IS NOT NULL AND s.region <> ''
ON CONFLICT (kind, key) DO UPDATE SET label = EXCLUDED.label, updated_at = now();

INSERT INTO seo_entities (kind, key, label, source_table)
SELECT DISTINCT 'industry', lower(p.industry_label), p.industry_label, 'marketplace_products'
FROM marketplace_products p
WHERE p.visible AND p.industry_label IS NOT NULL AND p.industry_label <> ''
ON CONFLICT (kind, key) DO UPDATE SET label = EXCLUDED.label, updated_at = now();

INSERT INTO seo_entities (kind, key, label, source_table)
SELECT DISTINCT 'business_type', lower(s.business_type), s.business_type, 'marketplace_card_slots'
FROM marketplace_card_slots s
WHERE s.business_type IS NOT NULL AND s.business_type <> ''
ON CONFLICT (kind, key) DO UPDATE SET label = EXCLUDED.label, updated_at = now();

INSERT INTO seo_entities (kind, key, label, source_table)
SELECT DISTINCT 'software_type', lower(s.software_type), s.software_type, 'marketplace_card_slots'
FROM marketplace_card_slots s
WHERE s.software_type IS NOT NULL AND s.software_type <> ''
ON CONFLICT (kind, key) DO UPDATE SET label = EXCLUDED.label, updated_at = now();

INSERT INTO seo_entities (kind, key, label, source_table, source_id, url)
SELECT 'seo_page', sp.url, coalesce(nullif(sp.title, ''), sp.url), 'seo_pages', sp.id, sp.url
FROM seo_pages sp
WHERE sp.url IS NOT NULL AND sp.url <> ''
ON CONFLICT (kind, key) DO UPDATE
  SET label = EXCLUDED.label, source_id = EXCLUDED.source_id, updated_at = now();

INSERT INTO seo_entities (kind, key, label, source_table, source_id)
SELECT 'demo', d.id::text, coalesce(nullif(d.demo_name, ''), 'demo'), 'product_demo_urls', d.id
FROM product_demo_urls d
WHERE d.status = 'active'
ON CONFLICT (kind, key) DO UPDATE SET label = EXCLUDED.label, updated_at = now();

INSERT INTO seo_entities (kind, key, label, source_table, source_id, url)
SELECT 'content', ci.id::text, coalesce(nullif(ci.title, ''), 'content'), 'seo_content_items', ci.id, ci.url
FROM seo_content_items ci
ON CONFLICT (kind, key) DO UPDATE SET label = EXCLUDED.label, updated_at = now();

-- ------------------------------------------------------------------- edges
-- Each block names, in `evidence`, the column that proved the relationship.

-- Every category belongs to the organisation.
INSERT INTO seo_entity_edges (source_id, target_id, relationship, evidence)
SELECT c.id, o.id, 'belongs_to', 'marketplace_categories is the catalogue of this organisation'
FROM seo_entities c
CROSS JOIN seo_entities o
WHERE c.kind = 'category' AND o.kind = 'organisation' AND o.key = 'software-vala'
ON CONFLICT (source_id, target_id, relationship) DO UPDATE SET updated_at = now();

-- A card represents the category it is a slot of.
INSERT INTO seo_entity_edges (source_id, target_id, relationship, evidence)
SELECT ec.id, ecat.id, 'represents', 'marketplace_card_slots.category_id'
FROM marketplace_card_slots s
JOIN seo_entities ec ON ec.kind = 'card' AND ec.key = s.slot_url
JOIN marketplace_categories c ON c.id = s.category_id
JOIN seo_entities ecat ON ecat.kind = 'category' AND ecat.key = c.slug
ON CONFLICT (source_id, target_id, relationship) DO UPDATE SET updated_at = now();

-- A card serves the country it is the slot for.
INSERT INTO seo_entity_edges (source_id, target_id, relationship, evidence)
SELECT ec.id, eco.id, 'serves', 'marketplace_card_slots.country_marker'
FROM marketplace_card_slots s
JOIN seo_entities ec ON ec.kind = 'card' AND ec.key = s.slot_url
JOIN seo_entities eco ON eco.kind = 'country' AND eco.key = lower(s.country_marker)
WHERE s.country_marker IS NOT NULL AND s.country_marker <> ''
ON CONFLICT (source_id, target_id, relationship) DO UPDATE SET updated_at = now();

-- A card sits in a region.
INSERT INTO seo_entity_edges (source_id, target_id, relationship, evidence)
SELECT ec.id, er.id, 'in_region', 'marketplace_card_slots.region'
FROM marketplace_card_slots s
JOIN seo_entities ec ON ec.kind = 'card' AND ec.key = s.slot_url
JOIN seo_entities er ON er.kind = 'region' AND er.key = lower(s.region)
WHERE s.region IS NOT NULL AND s.region <> ''
ON CONFLICT (source_id, target_id, relationship) DO UPDATE SET updated_at = now();

-- A card hosts whichever product currently occupies it. The card outlives the
-- tenancy, which is why this is an edge rather than a property of the card.
INSERT INTO seo_entity_edges (source_id, target_id, relationship, evidence)
SELECT ec.id, ep.id, 'hosts', 'marketplace_card_slots.current_product_id'
FROM marketplace_card_slots s
JOIN seo_entities ec ON ec.kind = 'card' AND ec.key = s.slot_url
JOIN marketplace_products p ON p.id = s.current_product_id
JOIN seo_entities ep ON ep.kind = 'product' AND ep.key = p.slug
ON CONFLICT (source_id, target_id, relationship) DO UPDATE SET updated_at = now();

-- A product belongs to its category.
INSERT INTO seo_entity_edges (source_id, target_id, relationship, evidence)
SELECT ep.id, ecat.id, 'belongs_to', 'marketplace_products.category_id'
FROM marketplace_products p
JOIN seo_entities ep ON ep.kind = 'product' AND ep.key = p.slug
JOIN marketplace_categories c ON c.id = p.category_id
JOIN seo_entities ecat ON ecat.kind = 'category' AND ecat.key = c.slug
WHERE p.visible
ON CONFLICT (source_id, target_id, relationship) DO UPDATE SET updated_at = now();

-- A product serves an industry.
INSERT INTO seo_entity_edges (source_id, target_id, relationship, evidence)
SELECT ep.id, ei.id, 'serves_industry', 'marketplace_products.industry_label'
FROM marketplace_products p
JOIN seo_entities ep ON ep.kind = 'product' AND ep.key = p.slug
JOIN seo_entities ei ON ei.kind = 'industry' AND ei.key = lower(p.industry_label)
WHERE p.visible AND p.industry_label IS NOT NULL AND p.industry_label <> ''
ON CONFLICT (source_id, target_id, relationship) DO UPDATE SET updated_at = now();

-- What kind of business, and what kind of software, a card is for.
INSERT INTO seo_entity_edges (source_id, target_id, relationship, evidence)
SELECT ec.id, eb.id, 'for_business_type', 'marketplace_card_slots.business_type'
FROM marketplace_card_slots s
JOIN seo_entities ec ON ec.kind = 'card' AND ec.key = s.slot_url
JOIN seo_entities eb ON eb.kind = 'business_type' AND eb.key = lower(s.business_type)
WHERE s.business_type IS NOT NULL AND s.business_type <> ''
ON CONFLICT (source_id, target_id, relationship) DO UPDATE SET updated_at = now();

INSERT INTO seo_entity_edges (source_id, target_id, relationship, evidence)
SELECT ec.id, es.id, 'is_software_type', 'marketplace_card_slots.software_type'
FROM marketplace_card_slots s
JOIN seo_entities ec ON ec.kind = 'card' AND ec.key = s.slot_url
JOIN seo_entities es ON es.kind = 'software_type' AND es.key = lower(s.software_type)
WHERE s.software_type IS NOT NULL AND s.software_type <> ''
ON CONFLICT (source_id, target_id, relationship) DO UPDATE SET updated_at = now();

-- An SEO page represents the product it was crawled for.
INSERT INTO seo_entity_edges (source_id, target_id, relationship, evidence)
SELECT esp.id, ep.id, 'represents', 'seo_pages.product_id'
FROM seo_pages sp
JOIN seo_entities esp ON esp.kind = 'seo_page' AND esp.key = sp.url
JOIN marketplace_products p ON p.id = sp.product_id
JOIN seo_entities ep ON ep.kind = 'product' AND ep.key = p.slug
ON CONFLICT (source_id, target_id, relationship) DO UPDATE SET updated_at = now();

-- A demo demonstrates its product.
INSERT INTO seo_entity_edges (source_id, target_id, relationship, evidence)
SELECT ed.id, ep.id, 'demonstrates', 'product_demo_urls.product_id'
FROM product_demo_urls d
JOIN seo_entities ed ON ed.kind = 'demo' AND ed.key = d.id::text
JOIN marketplace_products p ON p.id = d.product_id
JOIN seo_entities ep ON ep.kind = 'product' AND ep.key = p.slug
WHERE d.status = 'active'
ON CONFLICT (source_id, target_id, relationship) DO UPDATE SET updated_at = now();

COMMIT;

\echo == entities ==
SELECT kind, count(*) FROM seo_entities GROUP BY kind ORDER BY 2 DESC;
\echo == relationships ==
SELECT relationship, count(*) FROM seo_entity_edges GROUP BY relationship ORDER BY 2 DESC;
\echo == totals ==
SELECT (SELECT count(*) FROM seo_entities) AS entities,
       (SELECT count(*) FROM seo_entity_edges) AS edges,
       (SELECT count(*) FROM seo_entity_edges WHERE evidence IS NULL OR evidence = '') AS edges_without_evidence;
