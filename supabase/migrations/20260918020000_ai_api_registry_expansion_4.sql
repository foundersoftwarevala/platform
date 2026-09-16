-- Additive AI/API Manager registry expansion (batch 4)
-- Global expansion pass: regional AI/LLM providers (Alibaba Qwen, Baidu
-- ERNIE, iFlytek Spark, Naver HyperCLOVA X), AI safety/moderation (Azure
-- AI Content Safety), AI search (Google Vertex AI Search), advertising/
-- campaign APIs (Google Ads, Meta Marketing, Microsoft Advertising,
-- LinkedIn Marketing, TikTok Marketing, Snapchat Marketing), a regional
-- webmaster platform (Naver Webmaster Tools / Search Advisor), and
-- developer/cloud deployment services (Docker Hub, Render, Railway).
-- All rows inserted as status='inactive' / approval_status='pending'
-- (catalogue-only; no credentials created, nothing activated).
-- Idempotent: safe to re-run.

INSERT INTO public.api_services (
  name, slug, type, category, status, endpoint_url, official_url, docs_url,
  auth_type, pricing_tier, owner_team, approval_status, terms_url,
  supported_countries, supported_search_engines, connected_modules, commercial_use_notes
) VALUES
  ('Alibaba Cloud Qwen API (Model Studio)', 'alibaba-qwen-api', 'external', 'ai', 'inactive', 'https://dashscope.aliyuncs.com/api/v1', 'https://www.alibabacloud.com/en/product/modelstudio', 'https://www.alibabacloud.com/help/en/model-studio/developer-reference/api-details', 'api_key', 'free-tier', 'AI', 'pending', 'https://www.alibabacloud.com/help/en/legal-notice', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: create an Alibaba Cloud account and Model Studio API key. Regional (China-origin, globally available) LLM provider.'),
  ('Baidu ERNIE Bot API (Wenxin Qianfan)', 'baidu-ernie-api', 'external', 'ai', 'inactive', 'https://qianfan.baidubce.com/v2', 'https://cloud.baidu.com/product/wenxinworkshop', 'https://cloud.baidu.com/doc/WENXINWORKSHOP/index.html', 'api_key', 'paid', 'AI', 'pending', 'https://cloud.baidu.com/doc/Agreement/s/Jjwvyq0m8', ARRAY['china']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: create a Baidu AI Cloud (Qianfan) account and API key; typically requires a China-mainland phone/business verification. Regional (China) LLM provider.'),
  ('iFlytek Spark API', 'iflytek-spark-api', 'external', 'ai', 'inactive', 'https://spark-api-open.xf-yun.com/v1', 'https://xinghuo.xfyun.cn', 'https://www.xfyun.cn/doc/spark/Web.html', 'api_key', 'paid', 'AI', 'pending', 'https://www.xfyun.cn/doc/policy_tos.html', ARRAY['china']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: create an iFlytek open-platform account and API key. Regional (China) LLM/voice provider.'),
  ('Naver HyperCLOVA X API (Clova Studio)', 'naver-hyperclova-x-api', 'external', 'ai', 'inactive', 'https://clovastudio.stream.ntruss.com', 'https://www.ncloud.com/product/aiService/clovaStudio', 'https://guide.ncloud-docs.com/docs/clovastudio-overview', 'api_key', 'paid', 'AI', 'pending', 'https://www.ncloud.com/policy/terms', ARRAY['south-korea']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: create a Naver Cloud Platform account and Clova Studio API key. Regional (South Korea) LLM provider.'),
  ('Azure AI Content Safety', 'azure-ai-content-safety', 'external', 'ai', 'inactive', NULL, 'https://azure.microsoft.com/en-us/products/ai-services/ai-content-safety', 'https://learn.microsoft.com/en-us/azure/ai-services/content-safety/', 'api_key', 'free-tier', 'AI', 'pending', 'https://azure.microsoft.com/en-us/support/legal/', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: create an Azure AI Content Safety resource and API key. Content moderation / safety-classification capability.'),
  ('Google Vertex AI Search', 'google-vertex-ai-search', 'external', 'ai', 'inactive', 'https://discoveryengine.googleapis.com/v1', 'https://cloud.google.com/enterprise-search', 'https://cloud.google.com/generative-ai-app-builder/docs/reference/rest', 'oauth2', 'paid', 'AI', 'pending', 'https://cloud.google.com/terms', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: enable Vertex AI Search on a Google Cloud project with billing. Enterprise AI-search/retrieval capability.'),
  ('Google Ads API', 'google-ads-api', 'external', 'developer', 'inactive', 'https://googleads.googleapis.com', 'https://ads.google.com', 'https://developers.google.com/google-ads/api/docs/start', 'oauth2', 'free', 'Growth', 'pending', 'https://developers.google.com/google-ads/api/terms', ARRAY['global']::text[], ARRAY['Google']::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: apply for a Google Ads API developer token (basic/standard access review) plus OAuth client. API access itself is free; ad spend is billed separately per campaign.'),
  ('Meta Marketing API', 'meta-marketing-api', 'external', 'developer', 'inactive', 'https://graph.facebook.com', 'https://developers.facebook.com/docs/marketing-apis', 'https://developers.facebook.com/docs/marketing-apis', 'oauth2', 'free', 'Growth', 'pending', 'https://developers.facebook.com/terms', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: Meta Business verification, an ad account, and app review for Marketing API access. API access is free; ad spend billed separately.'),
  ('Microsoft Advertising API', 'microsoft-advertising-api', 'external', 'developer', 'inactive', NULL, 'https://ads.microsoft.com', 'https://learn.microsoft.com/en-us/advertising/guides/?view=bingads-13', 'oauth2', 'free', 'Growth', 'pending', 'https://about.ads.microsoft.com/en-us/legal-agreements', ARRAY['global']::text[], ARRAY['Bing']::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: create a Microsoft Advertising account, developer token application, and OAuth client. API access is free; ad spend billed separately.'),
  ('LinkedIn Marketing API', 'linkedin-marketing-api', 'external', 'developer', 'inactive', 'https://api.linkedin.com/rest', 'https://learn.microsoft.com/en-us/linkedin/marketing/', 'https://learn.microsoft.com/en-us/linkedin/marketing/', 'oauth2', 'free', 'Growth', 'pending', 'https://www.linkedin.com/legal/l/api-terms-of-use', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: apply to the LinkedIn Marketing Developer Platform partner program (approval required) and complete OAuth setup.'),
  ('TikTok Marketing API', 'tiktok-marketing-api', 'external', 'developer', 'inactive', 'https://business-api.tiktok.com/open_api', 'https://ads.tiktok.com', 'https://business-api.tiktok.com/portal/docs', 'oauth2', 'free', 'Growth', 'pending', 'https://ads.tiktok.com/i18n/official/policy/terms-of-service', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: register a TikTok for Business developer app and complete app review/OAuth for Marketing API access.'),
  ('Snapchat Marketing API', 'snapchat-marketing-api', 'external', 'developer', 'inactive', 'https://adsapi.snapchat.com', 'https://forbusiness.snapchat.com', 'https://developers.snapchat.com/api/docs/', 'oauth2', 'free', 'Growth', 'pending', 'https://businesshelp.snapchat.com/s/article/terms', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: create a Snapchat Business/Ads Manager account and OAuth client for the Marketing API.'),
  ('Naver Webmaster Tools (Search Advisor)', 'naver-webmaster-tools', 'external', 'seo-webmaster', 'inactive', NULL, 'https://searchadvisor.naver.com', 'https://searchadvisor.naver.com/guide', 'oauth2', 'free', 'SEO', 'pending', 'https://www.naver.com/policy/service.html', ARRAY['south-korea']::text[], ARRAY['Naver']::text[], ARRAY['AI API Manager','Global SEO Tools']::text[], 'ACTION REQUIRED: verify site ownership in Naver Search Advisor; primarily a managed portal (sitemap submission, RSS) with limited bulk/API tooling. Regional (South Korea).'),
  ('Docker Hub API', 'docker-hub-api', 'external', 'developer', 'inactive', 'https://hub.docker.com/v2', 'https://hub.docker.com', 'https://docs.docker.com/reference/api/hub/latest/', 'token', 'free-tier', 'Platform', 'pending', 'https://www.docker.com/legal/docker-terms-of-service/', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: create a Docker Hub account and personal access token. Container image registry/deployment capability.'),
  ('Render API', 'render-api', 'external', 'developer', 'inactive', 'https://api.render.com/v1', 'https://render.com', 'https://api-docs.render.com', 'api_key', 'free-tier', 'Platform', 'pending', 'https://render.com/tos', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: create a Render account and API key. Deployment/hosting capability.'),
  ('Railway API', 'railway-api', 'external', 'developer', 'inactive', 'https://backboard.railway.com/graphql/v2', 'https://railway.com', 'https://docs.railway.com/reference/public-api', 'token', 'free-tier', 'Platform', 'pending', 'https://railway.com/legal/terms', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: create a Railway account and API token. Deployment/hosting capability.')
ON CONFLICT (slug) DO NOTHING;

-- Capability records for the new services above (catalogued only;
-- automation_status remains manual_test_required until an owner-approved
-- real test is executed in the separate verification/activation phase).
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
    ('alibaba-qwen-api','text_generation','Qwen model text generation','https://www.alibabacloud.com/help/en/model-studio/developer-reference/api-details',true,'free-tier','api_key',ARRAY[]::text[]),
    ('baidu-ernie-api','text_generation','ERNIE model text generation','https://cloud.baidu.com/doc/WENXINWORKSHOP/index.html',true,'paid','api_key',ARRAY[]::text[]),
    ('iflytek-spark-api','text_generation','Spark model text generation','https://www.xfyun.cn/doc/spark/Web.html',true,'paid','api_key',ARRAY[]::text[]),
    ('naver-hyperclova-x-api','text_generation','HyperCLOVA X model text generation','https://guide.ncloud-docs.com/docs/clovastudio-overview',true,'paid','api_key',ARRAY[]::text[]),
    ('azure-ai-content-safety','moderation','Text and image content-safety classification','https://learn.microsoft.com/en-us/azure/ai-services/content-safety/',true,'free-tier','api_key',ARRAY[]::text[]),
    ('google-vertex-ai-search','ai_search','Enterprise retrieval-augmented search','https://cloud.google.com/generative-ai-app-builder/docs/reference/rest',true,'paid','oauth2',ARRAY[]::text[]),
    ('google-ads-api','advertising','Search/display campaign management','https://developers.google.com/google-ads/api/docs/start',true,'free','oauth2',ARRAY['Google']::text[]),
    ('meta-marketing-api','advertising','Facebook/Instagram ad campaign management','https://developers.facebook.com/docs/marketing-apis',true,'free','oauth2',ARRAY[]::text[]),
    ('microsoft-advertising-api','advertising','Bing Ads campaign management','https://learn.microsoft.com/en-us/advertising/guides/?view=bingads-13',true,'free','oauth2',ARRAY['Bing']::text[]),
    ('linkedin-marketing-api','advertising','LinkedIn ad campaign management','https://learn.microsoft.com/en-us/linkedin/marketing/',true,'free','oauth2',ARRAY[]::text[]),
    ('tiktok-marketing-api','advertising','TikTok ad campaign management','https://business-api.tiktok.com/portal/docs',true,'free','oauth2',ARRAY[]::text[]),
    ('snapchat-marketing-api','advertising','Snapchat ad campaign management','https://developers.snapchat.com/api/docs/',true,'free','oauth2',ARRAY[]::text[]),
    ('naver-webmaster-tools','sitemap_submission','Sitemap/RSS submission and site verification','https://searchadvisor.naver.com/guide',true,'free','oauth2',ARRAY['Naver']::text[]),
    ('docker-hub-api','container_registry','Container image registry management','https://docs.docker.com/reference/api/hub/latest/',true,'free-tier','token',ARRAY[]::text[]),
    ('render-api','deployment','Service deployment and management','https://api-docs.render.com',true,'free-tier','api_key',ARRAY[]::text[]),
    ('railway-api','deployment','Service deployment and management','https://docs.railway.com/reference/public-api',true,'free-tier','token',ARRAY[]::text[])
) AS c(slug, capability_key, capability_name, docs_url, api_available, pricing_tier, auth_type, engines)
  ON s.slug = c.slug
ON CONFLICT (service_id, capability_key) DO NOTHING;
