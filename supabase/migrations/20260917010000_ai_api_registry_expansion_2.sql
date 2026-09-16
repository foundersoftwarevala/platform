-- Additive AI/API Manager registry expansion (batch 2)
-- Fills remaining catalogue gaps identified during the global architecture
-- pass: GitHub Models (coding AI), Google Maps Platform (business/local),
-- Vercel (developer/cloud deploy), HubSpot (marketing/CRM), DataForSEO and
-- Moz (backlink/domain/rank intelligence), DuckDuckGo Instant Answer (search),
-- and Google Perspective API (AI safety/moderation). All rows inserted as
-- status='inactive' / approval_status='pending' (catalogue-only; no
-- credentials created, nothing activated). Idempotent: safe to re-run.

INSERT INTO public.api_services (
  name, slug, type, category, status, endpoint_url, official_url, docs_url,
  auth_type, pricing_tier, owner_team, approval_status, terms_url,
  supported_countries, supported_search_engines, connected_modules, commercial_use_notes
) VALUES
  ('GitHub Models API', 'github-models-api', 'external', 'ai', 'inactive', 'https://models.inference.ai.azure.com', 'https://github.com/marketplace/models', 'https://docs.github.com/en/github-models', 'token', 'free-tier', 'AI', 'pending', 'https://docs.github.com/en/site-policy/github-terms/github-marketplace-terms-of-service', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: create a GitHub fine-grained personal access token with models:read scope; free-tier rate limits apply per GitHub account.'),
  ('Google Maps Platform', 'google-maps-platform', 'external', 'business-local', 'inactive', 'https://maps.googleapis.com/maps/api', 'https://mapsplatform.google.com', 'https://developers.google.com/maps/documentation', 'api_key', 'free-tier', 'SEO', 'pending', 'https://cloud.google.com/maps-platform/terms', ARRAY['global']::text[], ARRAY['Google']::text[], ARRAY['AI API Manager','Global SEO Tools']::text[], 'ACTION REQUIRED: enable Maps/Places/Geocoding APIs on a Google Cloud project with billing enabled; monthly free credit applies, then usage-billed.'),
  ('Vercel API', 'vercel-api', 'external', 'developer', 'inactive', 'https://api.vercel.com', 'https://vercel.com', 'https://vercel.com/docs/rest-api', 'token', 'free-tier', 'Platform', 'pending', 'https://vercel.com/legal/terms', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: create a Vercel account and personal/team access token.'),
  ('HubSpot API', 'hubspot-api', 'external', 'developer', 'inactive', 'https://api.hubapi.com', 'https://www.hubspot.com', 'https://developers.hubspot.com/docs/api/overview', 'oauth2', 'free-tier', 'Growth', 'pending', 'https://legal.hubspot.com/terms-of-service', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: create a HubSpot developer account/app and complete OAuth or private-app token setup.'),
  ('DataForSEO API', 'dataforseo-api', 'external', 'seo-search', 'inactive', 'https://api.dataforseo.com/v3', 'https://dataforseo.com', 'https://docs.dataforseo.com', 'basic_auth', 'paid', 'SEO', 'pending', 'https://dataforseo.com/terms-and-conditions', ARRAY['global']::text[], ARRAY['Google','Bing','Yandex','Baidu']::text[], ARRAY['AI API Manager','Global SEO Tools']::text[], 'ACTION REQUIRED: create a DataForSEO account (prepaid, usage-billed) and API login/password credentials. Provides SERP, keyword, backlink, and domain-intelligence capabilities.'),
  ('Moz API', 'moz-api', 'external', 'seo-search', 'inactive', 'https://lsapi.seomoz.com/v2', 'https://moz.com', 'https://moz.com/help/moz-api', 'access_id_secret', 'paid', 'SEO', 'pending', 'https://moz.com/terms', ARRAY['global']::text[], ARRAY['Google']::text[], ARRAY['AI API Manager','Global SEO Tools']::text[], 'ACTION REQUIRED: create a Moz API account (paid subscription) and generate Access ID / Secret Key. Provides domain authority, backlink and link-intelligence capabilities.'),
  ('DuckDuckGo Instant Answer API', 'duckduckgo-instant-answer', 'external', 'seo-search', 'inactive', 'https://api.duckduckgo.com', 'https://duckduckgo.com', 'https://duckduckgo.com/api', 'none', 'free', 'SEO', 'pending', 'https://duckduckgo.com/terms', ARRAY['global']::text[], ARRAY['DuckDuckGo']::text[], ARRAY['AI API Manager','Global SEO Tools']::text[], 'No authentication required. Instant Answer only (no full SERP/ranking data); provided for zero-click answer/knowledge lookups only.'),
  ('Google Perspective API', 'google-perspective-api', 'external', 'ai', 'inactive', 'https://commentanalyzer.googleapis.com/v1alpha1', 'https://perspectiveapi.com', 'https://developers.perspectiveapi.com/s/docs', 'api_key', 'free', 'AI', 'pending', 'https://developers.perspectiveapi.com/s/about-the-api-terms-of-service', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: request Perspective API access and generate an API key via Google Cloud console. Content moderation / toxicity-scoring capability, free within published quotas.')
ON CONFLICT (slug) DO NOTHING;

-- Capability records for the new services above, plus a moderation capability
-- on the existing OpenAI service (catalogued only; automation_status remains
-- manual_test_required until an owner-approved real test is executed in the
-- separate verification/activation phase).
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
    ('openai-api','moderation','Content moderation / policy classification','https://platform.openai.com/docs/api-reference/moderations',true,'free','api_key',ARRAY[]::text[]),
    ('github-models-api','text_generation','Text generation via GitHub-hosted model catalog','https://docs.github.com/en/github-models/prototyping-with-ai-models',true,'free-tier','token',ARRAY[]::text[]),
    ('google-maps-platform','geocoding','Address to coordinate geocoding','https://developers.google.com/maps/documentation/geocoding',true,'free-tier','api_key',ARRAY['Google']::text[]),
    ('google-maps-platform','places','Place search and business details','https://developers.google.com/maps/documentation/places/web-service',true,'free-tier','api_key',ARRAY['Google']::text[]),
    ('vercel-api','deployments','Deployment listing and management','https://vercel.com/docs/rest-api/endpoints/deployments',true,'free-tier','token',ARRAY[]::text[]),
    ('hubspot-api','contacts','CRM contact management','https://developers.hubspot.com/docs/api/crm/contacts',true,'free-tier','oauth2',ARRAY[]::text[]),
    ('dataforseo-api','serp','Multi-engine SERP data','https://docs.dataforseo.com/v3/serp/overview/',true,'paid','basic_auth',ARRAY['Google','Bing','Yandex','Baidu']::text[]),
    ('dataforseo-api','backlinks','Backlink and referring-domain intelligence','https://docs.dataforseo.com/v3/backlinks/overview/',true,'paid','basic_auth',ARRAY[]::text[]),
    ('dataforseo-api','keyword_data','Keyword volume and difficulty data','https://docs.dataforseo.com/v3/keywords_data/overview/',true,'paid','basic_auth',ARRAY[]::text[]),
    ('moz-api','domain_authority','Domain/page authority scoring','https://moz.com/help/moz-api/links/domain-authority',true,'paid','access_id_secret',ARRAY['Google']::text[]),
    ('moz-api','backlinks','Link intelligence and referring domains','https://moz.com/help/moz-api/links',true,'paid','access_id_secret',ARRAY[]::text[]),
    ('duckduckgo-instant-answer','instant_answer','Zero-click instant answer lookup','https://duckduckgo.com/api',true,'free','none',ARRAY['DuckDuckGo']::text[]),
    ('google-perspective-api','toxicity_scoring','Toxicity / content-safety scoring','https://developers.perspectiveapi.com/s/about-the-api-methods',true,'free','api_key',ARRAY[]::text[])
) AS c(slug, capability_key, capability_name, docs_url, api_available, pricing_tier, auth_type, engines)
  ON s.slug = c.slug
ON CONFLICT (service_id, capability_key) DO NOTHING;
