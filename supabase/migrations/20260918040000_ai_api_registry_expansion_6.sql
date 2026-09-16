-- Additive AI/API Manager registry expansion (batch 6)
-- Global expansion pass (closing catalogue items): a general-purpose
-- cloud hosting provider (DigitalOcean), coding-AI agent extension
-- platform (GitHub Copilot Extensions), a conversational AI-agent
-- builder (Microsoft Copilot Studio), a machine-translation provider
-- (Yandex Translate), and a domain/WHOIS intelligence provider
-- (WhoisXML API) for competitor/domain research.
-- All rows inserted as status='inactive' / approval_status='pending'
-- (catalogue-only; no credentials created, nothing activated).
-- Idempotent: safe to re-run.

INSERT INTO public.api_services (
  name, slug, type, category, status, endpoint_url, official_url, docs_url,
  auth_type, pricing_tier, owner_team, approval_status, terms_url,
  supported_countries, supported_search_engines, connected_modules, commercial_use_notes
) VALUES
  ('DigitalOcean API', 'digitalocean-api', 'external', 'developer', 'inactive', 'https://api.digitalocean.com/v2', 'https://www.digitalocean.com', 'https://docs.digitalocean.com/reference/api/', 'token', 'paid', 'Platform', 'pending', 'https://www.digitalocean.com/legal/terms-of-service-agreement', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: create a DigitalOcean account and personal access token. Cloud hosting/deployment capability.'),
  ('GitHub Copilot Extensions API', 'github-copilot-extensions-api', 'external', 'ai', 'inactive', 'https://api.githubcopilot.com', 'https://github.com/features/copilot', 'https://docs.github.com/en/copilot/building-copilot-extensions', 'oauth2', 'paid', 'AI', 'pending', 'https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: register a GitHub App and complete the Copilot Extensions publishing flow; requires org/user with an active Copilot subscription. Coding-AI agent-extension capability.'),
  ('Microsoft Copilot Studio API', 'microsoft-copilot-studio-api', 'external', 'ai', 'inactive', 'https://api.powerplatform.com', 'https://www.microsoft.com/en-us/microsoft-copilot/microsoft-copilot-studio', 'https://learn.microsoft.com/en-us/microsoft-copilot-studio/', 'oauth2', 'paid', 'AI', 'pending', 'https://www.microsoft.com/en-us/licensing/product-licensing/products', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: requires a Microsoft Power Platform/Copilot Studio license and Entra ID app registration. Conversational AI-agent builder capability.'),
  ('Yandex Translate API', 'yandex-translate-api', 'external', 'ai', 'inactive', 'https://translate.api.cloud.yandex.net/translate/v2', 'https://cloud.yandex.com/en/services/translate', 'https://cloud.yandex.com/en/docs/translate/', 'api_key', 'free-tier', 'AI', 'pending', 'https://yandex.com/legal/cloud_termsofuse/', ARRAY['global']::text[], ARRAY['Yandex']::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: create a Yandex Cloud account and API key. Machine-translation capability.'),
  ('WhoisXML API', 'whoisxml-api', 'external', 'seo-intelligence', 'inactive', 'https://www.whoisxmlapi.com/whoisserver/WhoisService', 'https://whoisxmlapi.com', 'https://whoisxmlapi.com/documentation/making-requests', 'api_key', 'free-tier', 'SEO', 'pending', 'https://whoisxmlapi.com/terms-of-use', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager','Global SEO Tools']::text[], 'ACTION REQUIRED: create a WhoisXML API account and API key. Domain/WHOIS intelligence capability for competitor and domain research.')
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
    ('digitalocean-api','deployment','Cloud droplet/app deployment and management','https://docs.digitalocean.com/reference/api/',true,'paid','token',ARRAY[]::text[]),
    ('github-copilot-extensions-api','ai_agent','Coding-AI chat extension/agent integration','https://docs.github.com/en/copilot/building-copilot-extensions',true,'paid','oauth2',ARRAY[]::text[]),
    ('microsoft-copilot-studio-api','ai_agent','Conversational AI-agent building/runtime','https://learn.microsoft.com/en-us/microsoft-copilot-studio/',true,'paid','oauth2',ARRAY[]::text[]),
    ('yandex-translate-api','translation','Machine translation','https://cloud.yandex.com/en/docs/translate/',true,'free-tier','api_key',ARRAY['Yandex']::text[]),
    ('whoisxml-api','domain_intelligence','WHOIS/domain ownership and history lookup','https://whoisxmlapi.com/documentation/making-requests',true,'free-tier','api_key',ARRAY[]::text[])
) AS c(slug, capability_key, capability_name, docs_url, api_available, pricing_tier, auth_type, engines)
  ON s.slug = c.slug
ON CONFLICT (service_id, capability_key) DO NOTHING;
