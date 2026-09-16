-- Additive AI/API Manager registry expansion (batch 7)
-- Global expansion pass: business/local maps & discovery (Foursquare
-- Places, HERE Maps, OpenStreetMap Nominatim, Apple Maps Server,
-- Trustpilot Business reviews), AI-native search (You.com), SEO content
-- optimization (Surfer SEO), and Google's distinct Indexing API
-- (JobPosting/BroadcastEvent-only, separate product from Search
-- Console). Also adds narrowly-scoped capability records to four
-- EXISTING services to correctly surface official, previously-uncaptured
-- capabilities:
--   * github-api            -> copilot_seat_management (GitHub Copilot
--     Business/Enterprise seat management REST API; NOT the same thing
--     as an OpenAI-style completions API - this only manages seats).
--   * github-models-api     -> model_catalog (list/inspect available
--     GitHub Models for inference).
--   * ahrefs-api            -> rank_tracking (keyword rank-position
--     tracking, distinct from the existing backlinks/domain_intelligence
--     capabilities already catalogued).
--   * dataforseo-api        -> ai_overview_tracking (Google AI Overview
--     presence/content tracking within SERP results).
-- All new service rows inserted as status='inactive' /
-- approval_status='pending' (catalogue-only; no credentials created,
-- nothing activated). New capability rows follow the same
-- catalogued/pending/manual_test_required convention used throughout
-- this registry. Idempotent: safe to re-run.

INSERT INTO public.api_services (
  name, slug, type, category, status, endpoint_url, official_url, docs_url,
  auth_type, pricing_tier, owner_team, approval_status, terms_url,
  supported_countries, supported_search_engines, connected_modules, commercial_use_notes
) VALUES
  ('Foursquare Places API', 'foursquare-places-api', 'external', 'business-local', 'inactive', 'https://places-api.foursquare.com', 'https://location.foursquare.com', 'https://docs.foursquare.com/developer/reference/places-api-overview', 'api_key', 'free-tier', 'SEO', 'pending', 'https://foursquare.com/legal/terms', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager','Global SEO Tools']::text[], 'ACTION REQUIRED: create a Foursquare developer account and API key. Business/place discovery and local-listing data capability.'),
  ('HERE Maps API', 'here-maps-api', 'external', 'business-local', 'inactive', 'https://geocode.search.hereapi.com/v1', 'https://www.here.com', 'https://www.here.com/docs', 'api_key', 'free-tier', 'SEO', 'pending', 'https://legal.here.com/en-gb/terms', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager','Global SEO Tools']::text[], 'ACTION REQUIRED: create a HERE Developer account and API key. Maps/geocoding/routing capability.'),
  ('OpenStreetMap Nominatim API', 'openstreetmap-nominatim-api', 'external', 'business-local', 'inactive', 'https://nominatim.openstreetmap.org', 'https://www.openstreetmap.org', 'https://nominatim.org/release-docs/latest/api/Overview/', 'none', 'free', 'SEO', 'pending', 'https://operations.osmfoundation.org/policies/nominatim/', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager','Global SEO Tools']::text[], 'ACTION REQUIRED (usage policy): free public geocoding endpoint with a strict usage policy (max 1 request/sec, requires identifying User-Agent, no heavy commercial use without a dedicated instance). No signup/API key required for light use, but production use requires reviewing the usage policy or self-hosting.'),
  ('You.com Search API', 'you-api', 'external', 'ai', 'inactive', 'https://api.ydc-index.io', 'https://you.com', 'https://documentation.you.com', 'api_key', 'paid', 'AI', 'pending', 'https://you.com/terms', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager','Global SEO Tools']::text[], 'ACTION REQUIRED: create a You.com API account and API key. AI-native web-search/RAG-snippet capability (AI-search visibility research).'),
  ('Surfer SEO API', 'surfer-seo-api', 'external', 'seo-technical', 'inactive', 'https://app.surferseo.com/api', 'https://surferseo.com', 'https://developers.surferseo.com', 'api_key', 'paid', 'SEO', 'pending', 'https://surferseo.com/terms-of-service/', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager','Global SEO Tools']::text[], 'ACTION REQUIRED: requires an active Surfer SEO subscription plus API access add-on. Content-optimization/SERP-content-scoring capability.'),
  ('Google Indexing API', 'google-indexing-api', 'external', 'seo-indexing', 'inactive', 'https://indexing.googleapis.com/v3', 'https://developers.google.com/search/apis/indexing-api/v3/quickstart', 'https://developers.google.com/search/apis/indexing-api/v3/quickstart', 'oauth2', 'free', 'SEO', 'pending', 'https://developers.google.com/terms', ARRAY['global']::text[], ARRAY['Google']::text[], ARRAY['AI API Manager','Global SEO Tools']::text[], 'ACTION REQUIRED: enable the Indexing API on a Google Cloud project + Search Console site ownership verification. NOTE (officially documented limitation): Google restricts general use to JobPosting/BroadcastEvent (livestream) structured-data pages only; not a general-purpose page-indexing tool.'),
  ('Apple Maps Server API', 'apple-maps-server-api', 'external', 'business-local', 'inactive', 'https://maps-api.apple.com', 'https://developer.apple.com/maps/', 'https://developer.apple.com/documentation/applemapsserverapi', 'token', 'paid', 'SEO', 'pending', 'https://developer.apple.com/support/terms/', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager','Global SEO Tools']::text[], 'ACTION REQUIRED: requires an active Apple Developer Program membership (paid, $99/yr) and a Maps identifier/JWT signing key. Geocoding/search/directions capability.'),
  ('Trustpilot Business API', 'trustpilot-business-api', 'external', 'business-local', 'inactive', 'https://api.trustpilot.com/v1', 'https://business.trustpilot.com', 'https://developers.trustpilot.com', 'oauth2', 'paid', 'SEO', 'pending', 'https://legal.trustpilot.com/end-user-terms-and-conditions', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager','Global SEO Tools']::text[], 'ACTION REQUIRED: requires an active Trustpilot Business subscription and API application approval. Business-reviews retrieval/response capability.')
ON CONFLICT (slug) DO NOTHING;

-- Capabilities for the 8 new services above.
INSERT INTO public.api_service_capabilities (
  service_id, capability_key, capability_name, official_docs_url,
  api_available, pricing_tier, authentication_type, supported_search_engines,
  automation_status, verification_status, approval_status
)
SELECT s.id, c.capability_key, c.capability_name, c.docs_url,
       c.api_available, c.pricing_tier, c.auth_type, c.engines,
       'manual_test_required', 'catalogued', 'pending'
FROM public.api_services s
JOIN (
  VALUES
    ('foursquare-places-api','places_search','Place search, category and detail lookup','https://docs.foursquare.com/developer/reference/places-api-overview',true,'free-tier','api_key',ARRAY[]::text[]),
    ('here-maps-api','geocoding','Geocoding, reverse geocoding and routing','https://www.here.com/docs',true,'free-tier','api_key',ARRAY[]::text[]),
    ('openstreetmap-nominatim-api','geocoding','Open geocoding and reverse geocoding','https://nominatim.org/release-docs/latest/api/Overview/',true,'free','none',ARRAY[]::text[]),
    ('you-api','ai_search','AI-native web search and RAG snippets','https://documentation.you.com',true,'paid','api_key',ARRAY[]::text[]),
    ('surfer-seo-api','content_optimization','SERP-based content scoring and optimization','https://developers.surferseo.com',true,'paid','api_key',ARRAY[]::text[]),
    ('google-indexing-api','indexing_request','Submit URL update/removal notifications (JobPosting/BroadcastEvent only)','https://developers.google.com/search/apis/indexing-api/v3/quickstart',true,'free','oauth2',ARRAY['Google']::text[]),
    ('apple-maps-server-api','geocoding','Geocoding, search and directions','https://developer.apple.com/documentation/applemapsserverapi',true,'paid','token',ARRAY[]::text[]),
    ('trustpilot-business-api','business_reviews','Business review retrieval and response management','https://developers.trustpilot.com',true,'paid','oauth2',ARRAY[]::text[])
) AS c(slug, capability_key, capability_name, docs_url, api_available, pricing_tier, auth_type, engines)
  ON s.slug = c.slug
ON CONFLICT (service_id, capability_key) DO NOTHING;

-- Additional, previously-uncaptured capabilities on EXISTING services
-- (no new service rows; purely additive capability records).
INSERT INTO public.api_service_capabilities (
  service_id, capability_key, capability_name, official_docs_url,
  api_available, pricing_tier, authentication_type, supported_search_engines,
  automation_status, verification_status, approval_status
)
SELECT s.id, c.capability_key, c.capability_name, c.docs_url,
       c.api_available, c.pricing_tier, c.auth_type, c.engines,
       'manual_test_required', 'catalogued', 'pending'
FROM public.api_services s
JOIN (
  VALUES
    ('github-api','copilot_seat_management','GitHub Copilot Business/Enterprise seat management','https://docs.github.com/en/rest/copilot/copilot-user-management',true,'paid','token',ARRAY[]::text[]),
    ('github-models-api','model_catalog','List/inspect available GitHub Models for inference','https://docs.github.com/en/rest/models',true,'free-tier','token',ARRAY[]::text[]),
    ('ahrefs-api','rank_tracking','Keyword rank-position tracking','https://docs.ahrefs.com',true,'paid','api_key',ARRAY[]::text[]),
    ('dataforseo-api','ai_overview_tracking','Google AI Overview presence/content tracking in SERP results','https://docs.dataforseo.com',true,'paid','api_key',ARRAY['Google']::text[])
) AS c(slug, capability_key, capability_name, docs_url, api_available, pricing_tier, auth_type, engines)
  ON s.slug = c.slug
ON CONFLICT (service_id, capability_key) DO NOTHING;
