-- Central SEO/API registry metadata.
--
-- Additive only: existing rows and SEO data are preserved. New providers are
-- deliberately inactive until the owner supplies credentials and approves them.
-- SEO modules must use api_services through the AI/API Manager; this migration
-- does not create a second SEO gateway.

ALTER TABLE public.api_services
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS official_url text,
  ADD COLUMN IF NOT EXISTS docs_url text,
  ADD COLUMN IF NOT EXISTS status_url text,
  ADD COLUMN IF NOT EXISTS auth_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS pricing_tier text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS supported_countries text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS supported_languages text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS supported_search_engines text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS capabilities text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rate_limit_notes text,
  ADD COLUMN IF NOT EXISTS terms_url text,
  ADD COLUMN IF NOT EXISTS commercial_use_notes text,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS credential_env text,
  ADD COLUMN IF NOT EXISTS connected_modules text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.ai_providers
  ADD COLUMN IF NOT EXISTS official_url text,
  ADD COLUMN IF NOT EXISTS auth_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS pricing_tier text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS credential_env text;

-- Normalized capability inventory for the central registry. A capability is
-- not treated as connected merely because it is catalogued: verification and
-- approval remain explicit fields, and service status remains the activation
-- gate. This supports hundreds of distinct capabilities without duplicating
-- provider rows or creating a second SEO database.
CREATE TABLE IF NOT EXISTS public.api_service_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.api_services(id) ON DELETE CASCADE,
  capability_key text NOT NULL,
  capability_name text NOT NULL,
  official_docs_url text,
  api_available boolean NOT NULL DEFAULT false,
  pricing_tier text NOT NULL DEFAULT 'unknown',
  authentication_type text NOT NULL DEFAULT 'none',
  supported_countries text[] NOT NULL DEFAULT '{}',
  supported_languages text[] NOT NULL DEFAULT '{}',
  supported_search_engines text[] NOT NULL DEFAULT '{}',
  automation_status text NOT NULL DEFAULT 'not_verified',
  verification_status text NOT NULL DEFAULT 'unverified',
  verification_evidence text,
  last_verified_at timestamptz,
  approval_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_id, capability_key)
);

ALTER TABLE public.api_service_capabilities ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS api_service_capabilities_service_idx
  ON public.api_service_capabilities (service_id);

CREATE INDEX IF NOT EXISTS api_service_capabilities_verification_idx
  ON public.api_service_capabilities (verification_status, approval_status);

-- Capability records for the verified initial registrations above. They are
-- catalogued for future onboarding, but remain unverified/pending until an
-- official endpoint and owner credential are tested.
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
    ('google-search-console','search_analytics','Search analytics reporting','https://developers.google.com/webmaster-tools/v1/searchanalytics',true,'free','oauth2',ARRAY['Google']::text[]),
    ('google-search-console','url_inspection','URL inspection','https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect',true,'free','oauth2',ARRAY['Google']::text[]),
    ('google-search-console','sitemaps','Sitemap submission and listing','https://developers.google.com/webmaster-tools/v1/sitemaps',true,'free','oauth2',ARRAY['Google']::text[]),
    ('bing-webmaster-tools','search_analytics','Bing search performance data','https://learn.microsoft.com/en-us/bingwebmaster/api/webmaster-api-reference',true,'free','api_key',ARRAY['Bing']::text[]),
    ('bing-webmaster-tools','sitemaps','Bing sitemap management','https://learn.microsoft.com/en-us/bingwebmaster/api/webmaster-api-reference',true,'free','api_key',ARRAY['Bing']::text[]),
    ('bing-webmaster-tools','url_submission','Bing URL submission','https://learn.microsoft.com/en-us/bingwebmaster/api/webmaster-api-reference',true,'free','api_key',ARRAY['Bing']::text[]),
    ('indexnow','url_submission','URL submission to IndexNow participants','https://www.indexnow.org/documentation',true,'free','api_key',ARRAY['Bing','Yandex','Naver','Seznam','Ecosia']::text[]),
    ('openai-api','text_generation','Text generation','https://platform.openai.com/docs/api-reference/chat',true,'paid','api_key',ARRAY[]::text[]),
    ('openai-api','embeddings','Text embeddings','https://platform.openai.com/docs/api-reference/embeddings',true,'paid','api_key',ARRAY[]::text[]),
    ('openai-api','structured_output','Structured model output','https://platform.openai.com/docs/guides/structured-outputs',true,'paid','api_key',ARRAY[]::text[]),
    ('anthropic-api','text_generation','Text generation','https://docs.anthropic.com/en/api/messages',true,'paid','api_key',ARRAY[]::text[]),
    ('anthropic-api','structured_output','Structured model output','https://docs.anthropic.com/en/docs/build-with-claude/tool-use',true,'paid','api_key',ARRAY[]::text[]),
    ('github-api','repositories','Repository metadata','https://docs.github.com/en/rest/repos',true,'free-tier','token',ARRAY[]::text[]),
    ('github-api','issues','Issue management','https://docs.github.com/en/rest/issues',true,'free-tier','token',ARRAY[]::text[]),
    ('github-api','pull_requests','Pull request metadata','https://docs.github.com/en/rest/pulls',true,'free-tier','token',ARRAY[]::text[])
) AS c(slug, capability_key, capability_name, docs_url, api_available, pricing_tier, auth_type, engines)
  ON s.slug = c.slug
ON CONFLICT (service_id, capability_key) DO NOTHING;

-- Coverage reflects the documented product market or network, not a claim that
-- every operation is available in every country. Product, app-review, OAuth,
-- plan, and site-ownership restrictions remain enforced by approval/credential
-- state and by a provider-specific adapter before execution.
UPDATE public.api_services AS service
SET
  supported_countries = coverage.countries,
  supported_search_engines = coverage.engines,
  connected_modules = ARRAY['AI API Manager', 'Global SEO Tools'],
  commercial_use_notes = coverage.limitations
FROM (
  VALUES
    ('google-search-console', ARRAY['global']::text[], ARRAY['Google']::text[], 'Requires verified Search Console property and OAuth consent.'),
    ('google-pagespeed-insights', ARRAY['global']::text[], ARRAY['Google']::text[], 'Public URL analysis only; API-key quota applies.'),
    ('google-analytics-data', ARRAY['global']::text[], ARRAY['Google']::text[], 'Requires access to the selected Analytics property and OAuth consent.'),
    ('google-business-profile', ARRAY['global']::text[], ARRAY['Google']::text[], 'Requires eligible Business Profile access, OAuth scopes, and any Google approval.'),
    ('youtube-data', ARRAY['global']::text[], ARRAY['YouTube']::text[], 'OAuth-required operations are limited to authorized channel resources and quota.'),
    ('bing-webmaster-tools', ARRAY['global']::text[], ARRAY['Bing']::text[], 'Legacy SOAP and POX protocols are retired; do not activate until current REST operation is verified.'),
    ('indexnow', ARRAY['global']::text[], ARRAY['Bing','Yandex','Naver','Seznam','Ecosia']::text[], 'Receipt does not guarantee indexing; requires host ownership key.'),
    ('yandex-webmaster', ARRAY['Russia','Belarus','Kazakhstan','global']::text[], ARRAY['Yandex']::text[], 'Requires an authorized Yandex user and verified host.'),
    ('baidu-webmaster-url-submit', ARRAY['China']::text[], ARRAY['Baidu']::text[], 'Catalogued only for documented URL submission; verified Baidu site token required.'),
    ('naver-search', ARRAY['South Korea']::text[], ARRAY['Naver']::text[], 'Registered NAVER app, client credentials, and product quota required.'),
    ('naver-datalab-search-trends', ARRAY['South Korea']::text[], ARRAY['Naver']::text[], 'Trend values are relative interest, not keyword volume or unrestricted results.'),
    ('brave-search', ARRAY['global']::text[], ARRAY['Brave Search']::text[], 'Plan entitlement and API credits must be confirmed before activation.'),
    ('meta-graph-pages', ARRAY['global']::text[], ARRAY['Facebook','Instagram']::text[], 'Page access tokens, permissions, and Meta app review are required where applicable.'),
    ('linkedin-api', ARRAY['global']::text[], ARRAY['LinkedIn']::text[], 'Marketing and organization functions require product-specific entitlement.'),
    ('x-api', ARRAY['global']::text[], ARRAY['X']::text[], 'Endpoint access, rate limits, and search history depend on purchased X API plan.'),
    ('pinterest-api', ARRAY['global']::text[], ARRAY['Pinterest']::text[], 'Authorized OAuth scopes and approval are required for ads and catalog operations.'),
    ('reddit-data', ARRAY['global']::text[], ARRAY['Reddit']::text[], 'Moderation operations require moderator authorization; commercial usage may need approval.'),
    ('tiktok-developer', ARRAY['global']::text[], ARRAY['TikTok']::text[], 'Publishing and research access require product eligibility, scopes, and client verification.'),
    ('openai-api', ARRAY['global']::text[], ARRAY[]::text[], 'Paid API account, approved credential, and central AI policy are required.'),
    ('anthropic-api', ARRAY['global']::text[], ARRAY[]::text[], 'Paid API account, approved credential, and central AI policy are required.'),
    ('github-api', ARRAY['global']::text[], ARRAY['GitHub']::text[], 'Token scope and organization policy control repository and issue access.')
) AS coverage(slug, countries, engines, limitations)
WHERE service.slug = coverage.slug;

-- Official-source catalogue expansion. These records are discoverable in the
-- central manager but intentionally remain inactive, pending, and unverified.
-- Their capability names describe documented product operations only; no row
-- authorizes provider execution, scraping, or a commercial entitlement.
INSERT INTO public.api_services (
  name, slug, type, category, status, endpoint_url, official_url, docs_url,
  auth_type, pricing_tier, owner_team, approval_status, terms_url
)
VALUES
  ('Google Analytics Data API','google-analytics-data','external','seo-analytics','inactive','https://analyticsdata.googleapis.com/v1beta','https://analytics.google.com','https://developers.google.com/analytics/devguides/reporting/data/v1','oauth2','free-tier','SEO','pending','https://policies.google.com/terms'),
  ('Google Business Profile APIs','google-business-profile','external','seo-local','inactive','https://mybusinessbusinessinformation.googleapis.com/v1','https://www.google.com/business/','https://developers.google.com/my-business/content/overview','oauth2','unknown','SEO','pending','https://policies.google.com/terms'),
  ('YouTube Data API','youtube-data','external','seo-video','inactive','https://www.googleapis.com/youtube/v3','https://www.youtube.com','https://developers.google.com/youtube/v3/docs','oauth2','free','SEO','pending','https://www.youtube.com/t/terms'),
  ('Yandex Webmaster API','yandex-webmaster','external','seo-webmaster','inactive','https://api.webmaster.yandex.net/v4','https://webmaster.yandex.com','https://yandex.com/dev/webmaster/doc/en/concepts/getting-started','oauth2','free','SEO','pending','https://yandex.com/legal/termsofuse/'),
  ('Baidu Webmaster URL Submission','baidu-webmaster-url-submit','external','seo-indexing','inactive',NULL,'https://ziyuan.baidu.com/','https://ziyuan.baidu.com/college/articleinfo?id=110','token','unknown','SEO','pending','https://www.baidu.com/duty/'),
  ('NAVER Search Open API','naver-search','external','seo-search','inactive','https://openapi.naver.com/v1/search','https://www.naver.com','https://developers.naver.com/docs/serviceapi/search/','api_key','free-tier','SEO','pending','https://developers.naver.com/terms/'),
  ('NAVER DataLab Search Trend API','naver-datalab-search-trends','external','seo-trends','inactive','https://openapi.naver.com/v1/datalab/search','https://datalab.naver.com','https://developers.naver.com/docs/serviceapi/datalab/search/search.md','api_key','free-tier','SEO','pending','https://developers.naver.com/terms/'),
  ('Brave Search API','brave-search','external','seo-search','inactive','https://api.search.brave.com/res/v1','https://brave.com/search/api/','https://api-dashboard.search.brave.com/documentation','api_key','paid','SEO','pending','https://brave.com/terms-of-use/'),
  ('Meta Graph Pages API','meta-graph-pages','external','seo-social','inactive','https://graph.facebook.com','https://developers.facebook.com','https://developers.facebook.com/docs/graph-api/','oauth2','unknown','SEO','pending','https://www.facebook.com/legal/terms'),
  ('LinkedIn API','linkedin-api','external','seo-social','inactive','https://api.linkedin.com','https://www.linkedin.com','https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access','oauth2','unknown','SEO','pending','https://www.linkedin.com/legal/user-agreement'),
  ('X API','x-api','external','seo-social','inactive','https://api.x.com/2','https://developer.x.com','https://developer.x.com/en/docs/x-api','oauth2','paid','SEO','pending','https://x.com/en/tos'),
  ('Pinterest API v5','pinterest-api','external','seo-social','inactive','https://api.pinterest.com/v5','https://developers.pinterest.com','https://developers.pinterest.com/docs/api/v5/','oauth2','unknown','SEO','pending','https://policy.pinterest.com/en/terms-of-service'),
  ('Reddit Data API','reddit-data','external','seo-social','inactive','https://oauth.reddit.com','https://www.reddit.com','https://www.reddit.com/dev/api/','oauth2','unknown','SEO','pending','https://www.redditinc.com/policies/user-agreement'),
  ('TikTok Developer APIs','tiktok-developer','external','seo-social','inactive','https://open.tiktokapis.com/v2','https://developers.tiktok.com','https://developers.tiktok.com/doc','oauth2','unknown','SEO','pending','https://www.tiktok.com/legal/terms-of-service')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.api_service_capabilities (
  service_id, capability_key, capability_name, official_docs_url, api_available,
  pricing_tier, authentication_type, automation_status, verification_status, approval_status
)
SELECT s.id,
       'catalogued-' || item.ordinality,
       item.capability_name,
       c.docs_url,
       true,
       c.pricing_tier,
       c.auth_type,
       'manual_test_required',
       'catalogued',
       'pending'
FROM (
  VALUES
    ('google-search-console','https://developers.google.com/webmaster-tools/v1/api_reference_index','free','oauth2',ARRAY['List sites','Add site','Delete site','Get site metadata','Filter analytics by date','Group analytics by query','Group analytics by page','Group analytics by country','Group analytics by device','Group analytics by search type','List sitemaps','Get sitemap','Delete sitemap','Inspect URL index status']::text[]),
    ('bing-webmaster-tools','https://learn.microsoft.com/en-us/bingwebmaster/api-protocols','free','api_key',ARRAY['Add site','Remove site','Get sites','Get rank and traffic statistics','Get crawl information','Get keyword query data','Get linked pages','Get inbound links','Get sitemap data','Submit sitemap','Submit URL','Submit URL batch','Get diagnostic errors']::text[]),
    ('indexnow','https://www.indexnow.org/documentation','free','api_key',ARRAY['Submit one added updated or deleted URL','Submit batch of up to 10000 URLs','Verify host ownership with key file']::text[]),
    ('google-analytics-data','https://developers.google.com/analytics/devguides/reporting/data/v1','free-tier','oauth2',ARRAY['Run custom report','Report pages and screens','Report acquisition','Report geography','Report devices','Batch reports','Run pivot report','Batch pivot reports','Run realtime report','Get report metadata','Check metric compatibility','Check dimension compatibility','Create audience export','Run funnel report']::text[]),
    ('google-business-profile','https://developers.google.com/my-business/content/overview','unknown','oauth2',ARRAY['Manage accounts','List locations','Get location data','Edit business information','Manage opening hours','Manage categories','Manage attributes','Manage service areas','Manage profile labels','Manage location groups','Get performance metrics','Manage media','Manage reviews and replies','Receive profile notifications']::text[]),
    ('youtube-data','https://developers.google.com/youtube/v3/docs','free','oauth2',ARRAY['Search videos channels and playlists','Get videos','Update owned videos','Upload videos','Delete owned videos','Get channels','Manage playlists','Manage playlist items','Get comment threads','Moderate owned comments','Manage captions','Get activities','Manage subscriptions','Manage live broadcasts streams and chat']::text[]),
    ('yandex-webmaster','https://yandex.com/dev/webmaster/doc/en/concepts/getting-started','free','oauth2',ARRAY['Get user ID','List hosts','Add host','Delete host','Get host data','Get host summary statistics','Monitor important URLs','Get important URL history','Get verification state','List verified owners','List sitemaps','Add sitemap','Remove sitemap','Get sitemap details','Get SQI history','Get popular queries','Request recrawl','Get diagnostics']::text[]),
    ('baidu-webmaster-url-submit','https://ziyuan.baidu.com/college/articleinfo?id=110','unknown','token',ARRAY['Submit individual URL','Batch submit URLs']::text[]),
    ('naver-search','https://developers.naver.com/docs/serviceapi/search/','free-tier','api_key',ARRAY['News search','Blog search','Cafe article search','Knowledge-iN search','Image search','Encyclopedia search','Book search','Shopping search','Web document search','Local business search']::text[]),
    ('naver-datalab-search-trends','https://developers.naver.com/docs/serviceapi/datalab/search/search.md','free-tier','api_key',ARRAY['Compare keyword groups','Return period trend series','Segment by device','Segment by gender and age']::text[]),
    ('brave-search','https://api-dashboard.search.brave.com/documentation','paid','api_key',ARRAY['Web search','LLM context search','News search','Image search','Video search','Places search','AI answer features','Rich result retrieval']::text[]),
    ('meta-graph-pages','https://developers.facebook.com/docs/graph-api/','unknown','oauth2',ARRAY['Get Page profile','Publish Page post','Get Page posts','Update Page post','Delete Page post','Get Page insights','Get post insights','Manage Page comments','Reply to comments','Get Page media','Publish photo','Publish video','Get Page events','Receive webhooks']::text[]),
    ('linkedin-api','https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access','unknown','oauth2',ARRAY['OpenID member identity','Publish member post','Get organization data','Manage organization posts','Get social actions','Get organization analytics','Get ad analytics','Manage ad accounts','Lead generation flows','Receive webhooks']::text[]),
    ('x-api','https://developer.x.com/en/docs/x-api','paid','oauth2',ARRAY['Create post','Delete owned post','Look up posts','Look up users','Recent post search','Filtered stream','Sampled stream','Manage stream rules','Get followers and following','Manage lists','Get Spaces','Get post metrics','Manage media']::text[]),
    ('pinterest-api','https://developers.pinterest.com/docs/api/v5/','unknown','oauth2',ARRAY['Get authorized user','Manage boards','Get boards','Create Pins','Update Pins','Delete Pins','Get Pins','Manage catalog feeds','Get catalog products','Manage product groups','Manage ad accounts','Manage campaigns','Get ad analytics']::text[]),
    ('reddit-data','https://www.reddit.com/dev/api/','unknown','oauth2',ARRAY['Get posts and listings','Get comments','Search posts and subreddits','Submit post','Submit comment','Edit owned content','Delete owned content','Vote','Save content','Hide content','Manage subscriptions','Get authorized account','Manage moderation queue','Approve remove or mark spam','Manage bans mutes flair and rules','Access modmail']::text[]),
    ('tiktok-developer','https://developers.tiktok.com/doc','unknown','oauth2',ARRAY['TikTok Login','Get authorized profile','Get authorized video list','Get video data','Initialize video upload','Upload video','Direct post video','Direct post photo','Get posting status','Receive webhooks','Access approved research data','Marketing API reporting with approval']::text[])
) AS c(slug, docs_url, pricing_tier, auth_type, capability_names)
JOIN public.api_services s ON s.slug = c.slug
CROSS JOIN LATERAL unnest(c.capability_names) WITH ORDINALITY AS item(capability_name, ordinality)
ON CONFLICT (service_id, capability_key) DO NOTHING;

-- This pass follows the expansion insert so fresh deployments receive the
-- same scoped coverage metadata as databases that already have these rows.
UPDATE public.api_services AS service
SET
  supported_countries = coverage.countries,
  supported_search_engines = coverage.engines,
  connected_modules = ARRAY['AI API Manager', 'Global SEO Tools'],
  commercial_use_notes = coverage.limitations
FROM (
  VALUES
    ('google-analytics-data', ARRAY['global']::text[], ARRAY['Google']::text[], 'Requires access to the selected Analytics property and OAuth consent.'),
    ('google-business-profile', ARRAY['global']::text[], ARRAY['Google']::text[], 'Requires eligible Business Profile access, OAuth scopes, and any Google approval.'),
    ('youtube-data', ARRAY['global']::text[], ARRAY['YouTube']::text[], 'OAuth-required operations are limited to authorized channel resources and quota.'),
    ('yandex-webmaster', ARRAY['Russia','Belarus','Kazakhstan','global']::text[], ARRAY['Yandex']::text[], 'Requires an authorized Yandex user and verified host.'),
    ('baidu-webmaster-url-submit', ARRAY['China']::text[], ARRAY['Baidu']::text[], 'Catalogued only for documented URL submission; verified Baidu site token required.'),
    ('naver-search', ARRAY['South Korea']::text[], ARRAY['Naver']::text[], 'Registered NAVER app, client credentials, and product quota required.'),
    ('naver-datalab-search-trends', ARRAY['South Korea']::text[], ARRAY['Naver']::text[], 'Trend values are relative interest, not keyword volume or unrestricted results.'),
    ('brave-search', ARRAY['global']::text[], ARRAY['Brave Search']::text[], 'Plan entitlement and API credits must be confirmed before activation.'),
    ('meta-graph-pages', ARRAY['global']::text[], ARRAY['Facebook','Instagram']::text[], 'Page access tokens, permissions, and Meta app review are required where applicable.'),
    ('linkedin-api', ARRAY['global']::text[], ARRAY['LinkedIn']::text[], 'Marketing and organization functions require product-specific entitlement.'),
    ('x-api', ARRAY['global']::text[], ARRAY['X']::text[], 'Endpoint access, rate limits, and search history depend on purchased X API plan.'),
    ('pinterest-api', ARRAY['global']::text[], ARRAY['Pinterest']::text[], 'Authorized OAuth scopes and approval are required for ads and catalog operations.'),
    ('reddit-data', ARRAY['global']::text[], ARRAY['Reddit']::text[], 'Moderation operations require moderator authorization; commercial usage may need approval.'),
    ('tiktok-developer', ARRAY['global']::text[], ARRAY['TikTok']::text[], 'Publishing and research access require product eligibility, scopes, and client verification.')
) AS coverage(slug, countries, engines, limitations)
WHERE service.slug = coverage.slug;

CREATE INDEX IF NOT EXISTS api_services_category_status_idx
  ON public.api_services (category, status, approval_status);

CREATE INDEX IF NOT EXISTS api_services_pricing_tier_idx
  ON public.api_services (pricing_tier);

-- Verified official service records. These are registrations only, not
-- activations: no credentials are inserted and every row is inactive/pending.
INSERT INTO public.api_services (
  name, slug, type, category, status, endpoint_url, official_url, docs_url,
  auth_type, pricing_tier, capabilities, supported_search_engines,
  owner_team, approval_status, credential_env, terms_url
)
VALUES
(
  'Google Search Console',
  'google-search-console',
  'external',
  'seo-webmaster',
  'inactive',
  'https://searchconsole.googleapis.com',
  'https://search.google.com/search-console',
  'https://developers.google.com/webmaster-tools',
  'oauth2',
  'free',
  ARRAY['search-analytics','url-inspection','sitemaps'],
  ARRAY['Google'],
  'SEO',
  'pending',
  'GOOGLE_SEARCH_CONSOLE_CREDENTIALS',
  'https://developers.google.com/terms'
),
(
  'Bing Webmaster Tools',
  'bing-webmaster-tools',
  'external',
  'seo-webmaster',
  'inactive',
  'https://ssl.bing.com/webmaster/api.svc',
  'https://www.bing.com/webmasters',
  'https://learn.microsoft.com/en-us/bingwebmaster/',
  'api_key',
  'free',
  ARRAY['search-analytics','sitemaps','url-submission'],
  ARRAY['Bing'],
  'SEO',
  'pending',
  'BING_WEBMASTER_API_KEY',
  'https://www.microsoft.com/en-us/servicesagreement'
),
(
  'IndexNow',
  'indexnow',
  'external',
  'seo-indexing',
  'inactive',
  'https://api.indexnow.org/indexnow',
  'https://www.indexnow.org',
  'https://www.indexnow.org/documentation',
  'api_key',
  'free',
  ARRAY['url-submission'],
  ARRAY['Bing','Yandex','Naver','Seznam','Ecosia'],
  'SEO',
  'pending',
  'INDEXNOW_API_KEY',
  'https://www.indexnow.org/terms'
),
(
  'Google PageSpeed Insights',
  'google-pagespeed-insights',
  'external',
  'seo-performance',
  'inactive',
  'https://www.googleapis.com/pagespeedonline/v5/runPagespeed',
  'https://pagespeed.web.dev',
  'https://developers.google.com/speed/docs/insights/v5/get-started',
  'api_key',
  'free',
  ARRAY['pagespeed-audit','core-web-vitals','lighthouse-category-scores'],
  ARRAY['Google'],
  'SEO',
  'pending',
  'GOOGLE_PAGESPEED_API_KEY',
  'https://developers.google.com/terms'
),
(
  'OpenAI API',
  'openai-api',
  'external',
  'ai',
  'inactive',
  'https://api.openai.com/v1',
  'https://openai.com',
  'https://platform.openai.com/docs',
  'api_key',
  'paid',
  ARRAY['text-generation','embeddings','structured-output'],
  ARRAY[]::text[],
  'AI Manager',
  'pending',
  'OPENAI_API_KEY',
  'https://openai.com/policies/terms-of-use'
),
(
  'Anthropic API',
  'anthropic-api',
  'external',
  'ai',
  'inactive',
  'https://api.anthropic.com/v1',
  'https://www.anthropic.com',
  'https://docs.anthropic.com',
  'api_key',
  'paid',
  ARRAY['text-generation','structured-output'],
  ARRAY[]::text[],
  'AI Manager',
  'pending',
  'ANTHROPIC_API_KEY',
  'https://www.anthropic.com/legal/consumer-terms'
),
(
  'GitHub API',
  'github-api',
  'external',
  'developer',
  'inactive',
  'https://api.github.com',
  'https://github.com',
  'https://docs.github.com/en/rest',
  'token',
  'free-tier',
  ARRAY['repositories','issues','pull-requests'],
  ARRAY[]::text[],
  'Developer Manager',
  'pending',
  'GITHUB_TOKEN',
  'https://docs.github.com/en/site-policy/github-terms/github-terms-of-service'
)
ON CONFLICT (slug) DO NOTHING;

-- The service registrations above must exist before their normalized capability
-- rows can be linked. Keep this second idempotent pass after registration so a
-- fresh database receives both the visible service and its visible capabilities.
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
    ('google-search-console','search_analytics','Search analytics reporting','https://developers.google.com/webmaster-tools/v1/searchanalytics',true,'free','oauth2',ARRAY['Google']::text[]),
    ('google-search-console','url_inspection','URL inspection','https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect',true,'free','oauth2',ARRAY['Google']::text[]),
    ('google-search-console','sitemaps','Sitemap submission and listing','https://developers.google.com/webmaster-tools/v1/sitemaps',true,'free','oauth2',ARRAY['Google']::text[]),
    ('bing-webmaster-tools','search_analytics','Bing search performance data','https://learn.microsoft.com/en-us/bingwebmaster/api/webmaster-api-reference',true,'free','api_key',ARRAY['Bing']::text[]),
    ('bing-webmaster-tools','sitemaps','Bing sitemap management','https://learn.microsoft.com/en-us/bingwebmaster/api/webmaster-api-reference',true,'free','api_key',ARRAY['Bing']::text[]),
    ('bing-webmaster-tools','url_submission','Bing URL submission','https://learn.microsoft.com/en-us/bingwebmaster/api/webmaster-api-reference',true,'free','api_key',ARRAY['Bing']::text[]),
    ('indexnow','url_submission','URL submission to IndexNow participants','https://www.indexnow.org/documentation',true,'free','api_key',ARRAY['Bing','Yandex','Naver','Seznam','Ecosia']::text[]),
    ('google-pagespeed-insights','pagespeed_audit','PageSpeed Insights audit','https://developers.google.com/speed/docs/insights/v5/get-started',true,'free','api_key',ARRAY['Google']::text[]),
    ('google-pagespeed-insights','core_web_vitals','Core Web Vitals assessment','https://developers.google.com/speed/docs/insights/v5/get-started',true,'free','api_key',ARRAY['Google']::text[]),
    ('google-pagespeed-insights','lighthouse_scores','Lighthouse category scores','https://developers.google.com/speed/docs/insights/v5/get-started',true,'free','api_key',ARRAY['Google']::text[]),
    ('openai-api','text_generation','Text generation','https://platform.openai.com/docs/api-reference/chat',true,'paid','api_key',ARRAY[]::text[]),
    ('openai-api','embeddings','Text embeddings','https://platform.openai.com/docs/api-reference/embeddings',true,'paid','api_key',ARRAY[]::text[]),
    ('openai-api','structured_output','Structured model output','https://platform.openai.com/docs/guides/structured-outputs',true,'paid','api_key',ARRAY[]::text[]),
    ('anthropic-api','text_generation','Text generation','https://docs.anthropic.com/en/api/messages',true,'paid','api_key',ARRAY[]::text[]),
    ('anthropic-api','structured_output','Structured model output','https://docs.anthropic.com/en/docs/build-with-claude/tool-use',true,'paid','api_key',ARRAY[]::text[]),
    ('github-api','repositories','Repository metadata','https://docs.github.com/en/rest/repos',true,'free-tier','token',ARRAY[]::text[]),
    ('github-api','issues','Issue management','https://docs.github.com/en/rest/issues',true,'free-tier','token',ARRAY[]::text[]),
    ('github-api','pull_requests','Pull request metadata','https://docs.github.com/en/rest/pulls',true,'free-tier','token',ARRAY[]::text[])
) AS c(slug, capability_key, capability_name, docs_url, api_available, pricing_tier, auth_type, engines)
  ON s.slug = c.slug
ON CONFLICT (service_id, capability_key) DO NOTHING;
