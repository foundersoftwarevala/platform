-- Additive AI/API Manager registry expansion (batch 5)
-- Global expansion pass: payments (Stripe global gateway; PhonePe and
-- Paytm India UPI rails), AI embeddings specialist (Voyage AI),
-- monitoring/observability (New Relic, PagerDuty, Grafana Cloud), media
-- management (Cloudinary), search-as-a-service (Algolia), workflow
-- automation (Zapier Platform), marketing/product-analytics (OneSignal,
-- Mixpanel, Amplitude, Segment), CRM/support (Salesforce, Zendesk), and
-- AI agent/conversational-bot builders (Botpress, Voiceflow).
-- All rows inserted as status='inactive' / approval_status='pending'
-- (catalogue-only; no credentials created, nothing activated).
-- Idempotent: safe to re-run.

INSERT INTO public.api_services (
  name, slug, type, category, status, endpoint_url, official_url, docs_url,
  auth_type, pricing_tier, owner_team, approval_status, terms_url,
  supported_countries, supported_search_engines, connected_modules, commercial_use_notes
) VALUES
  ('Stripe API', 'stripe-api', 'external', 'payments', 'inactive', 'https://api.stripe.com/v1', 'https://stripe.com', 'https://stripe.com/docs/api', 'api_key', 'free-tier', 'Billing', 'pending', 'https://stripe.com/legal', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: create a Stripe account (business verification/KYC required) and API keys. Global payment gateway.'),
  ('PhonePe Payment Gateway API', 'phonepe-payment-gateway-api', 'external', 'payments', 'inactive', 'https://api.phonepe.com/apis/hermes', 'https://www.phonepe.com/business-solutions/payment-gateway/', 'https://developer.phonepe.com/', 'api_key', 'paid', 'Billing', 'pending', 'https://www.phonepe.com/business-terms-and-conditions/', ARRAY['india']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: PhonePe merchant onboarding (KYC/business verification) before API credentials are issued. India UPI payment rail.'),
  ('Paytm Payment Gateway API', 'paytm-payment-gateway-api', 'external', 'payments', 'inactive', 'https://securegw.paytm.in', 'https://business.paytm.com/payment-gateway', 'https://business.paytm.com/docs', 'api_key', 'paid', 'Billing', 'pending', 'https://paytm.com/legal/paytm-payment-gateway', ARRAY['india']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: Paytm merchant onboarding (KYC/business verification) before API credentials are issued. India UPI payment rail.'),
  ('Voyage AI Embeddings API', 'voyage-ai-api', 'external', 'ai', 'inactive', 'https://api.voyageai.com/v1', 'https://www.voyageai.com', 'https://docs.voyageai.com/', 'api_key', 'free-tier', 'AI', 'pending', 'https://www.voyageai.com/terms', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: create a Voyage AI account and API key. Text-embedding specialist provider (recommended by Anthropic docs).'),
  ('New Relic API', 'new-relic-api', 'external', 'developer', 'inactive', 'https://api.newrelic.com/v2', 'https://newrelic.com', 'https://docs.newrelic.com/docs/apis/', 'api_key', 'free-tier', 'Platform', 'pending', 'https://newrelic.com/termsandconditions/services', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: create a New Relic account and API key. Application performance monitoring/logging.'),
  ('PagerDuty API', 'pagerduty-api', 'external', 'developer', 'inactive', 'https://api.pagerduty.com', 'https://www.pagerduty.com', 'https://developer.pagerduty.com/', 'api_key', 'free-tier', 'Platform', 'pending', 'https://www.pagerduty.com/terms-and-conditions/', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: create a PagerDuty account and API key. Incident-management/alerting capability.'),
  ('Grafana Cloud API', 'grafana-cloud-api', 'external', 'developer', 'inactive', 'https://grafana.com/api', 'https://grafana.com/products/cloud/', 'https://grafana.com/docs/grafana-cloud/developer-resources/api-reference/', 'api_key', 'free-tier', 'Platform', 'pending', 'https://grafana.com/legal/terms/', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: create a Grafana Cloud account and API key. Monitoring/observability dashboards.'),
  ('Cloudinary API', 'cloudinary-api', 'external', 'developer', 'inactive', 'https://api.cloudinary.com/v1_1', 'https://cloudinary.com', 'https://cloudinary.com/documentation', 'api_key', 'free-tier', 'Platform', 'pending', 'https://cloudinary.com/terms', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: create a Cloudinary account and API key. Media (image/video) storage, transformation and CDN delivery.'),
  ('Algolia Search API', 'algolia-search-api', 'external', 'developer', 'inactive', 'https://{app-id}.algolia.net', 'https://www.algolia.com', 'https://www.algolia.com/doc/api-client/getting-started/', 'api_key', 'free-tier', 'Platform', 'pending', 'https://www.algolia.com/policies/terms/', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: create an Algolia account and API key. Hosted site/app search-as-a-service.'),
  ('Zapier Platform API', 'zapier-platform-api', 'external', 'developer', 'inactive', 'https://api.zapier.com', 'https://zapier.com', 'https://platform.zapier.com/docs', 'oauth2', 'free-tier', 'Platform', 'pending', 'https://zapier.com/legal', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: register a Zapier developer app / platform integration. Workflow-automation connector capability.'),
  ('OneSignal API', 'onesignal-api', 'external', 'marketing', 'inactive', 'https://onesignal.com/api/v1', 'https://onesignal.com', 'https://documentation.onesignal.com/reference', 'api_key', 'free-tier', 'Growth', 'pending', 'https://onesignal.com/terms-of-service', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: create a OneSignal account and API key. Push-notification/marketing-messaging capability.'),
  ('Mixpanel API', 'mixpanel-api', 'external', 'analytics', 'inactive', 'https://api.mixpanel.com', 'https://mixpanel.com', 'https://developer.mixpanel.com/reference', 'api_key', 'free-tier', 'Growth', 'pending', 'https://mixpanel.com/legal/terms-of-use/', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: create a Mixpanel account and API key/project token. Product-analytics capability.'),
  ('Amplitude API', 'amplitude-api', 'external', 'analytics', 'inactive', 'https://amplitude.com/api', 'https://amplitude.com', 'https://amplitude.com/docs/apis', 'api_key', 'free-tier', 'Growth', 'pending', 'https://amplitude.com/terms-conditions', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: create an Amplitude account and API key. Product-analytics capability.'),
  ('Segment API', 'segment-api', 'external', 'analytics', 'inactive', 'https://api.segment.io/v1', 'https://segment.com', 'https://segment.com/docs/connections/spec/', 'api_key', 'free-tier', 'Growth', 'pending', 'https://segment.com/legal/terms/', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: create a Segment (Twilio) account and write key. Customer-data-platform / event-routing capability.'),
  ('Salesforce REST API', 'salesforce-rest-api', 'external', 'business-local', 'inactive', 'https://{instance}.salesforce.com/services/data', 'https://www.salesforce.com', 'https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/', 'oauth2', 'paid', 'Sales', 'pending', 'https://www.salesforce.com/company/legal/agreements/', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: requires an active Salesforce org/license and a Connected App with OAuth setup. CRM capability.'),
  ('Zendesk API', 'zendesk-api', 'external', 'business-local', 'inactive', 'https://{subdomain}.zendesk.com/api/v2', 'https://www.zendesk.com', 'https://developer.zendesk.com/api-reference/', 'api_key', 'paid', 'Support', 'pending', 'https://www.zendesk.com/company/agreements-and-terms/', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: requires an active Zendesk subscription and API token. Customer-support/ticketing capability.'),
  ('Botpress API', 'botpress-api', 'external', 'ai', 'inactive', 'https://api.botpress.cloud', 'https://botpress.com', 'https://botpress.com/docs', 'api_key', 'free-tier', 'AI', 'pending', 'https://botpress.com/terms', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: create a Botpress Cloud account and API key/PAT. Conversational AI-agent builder capability.'),
  ('Voiceflow API', 'voiceflow-api', 'external', 'ai', 'inactive', 'https://general-runtime.voiceflow.com', 'https://www.voiceflow.com', 'https://docs.voiceflow.com', 'api_key', 'free-tier', 'AI', 'pending', 'https://www.voiceflow.com/legal/terms-of-service', ARRAY['global']::text[], ARRAY[]::text[], ARRAY['AI API Manager']::text[], 'ACTION REQUIRED: create a Voiceflow account and API key. Conversational AI-agent builder capability.')
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
    ('stripe-api','payment_processing','Card/wallet/bank payment processing','https://stripe.com/docs/api',true,'free-tier','api_key',ARRAY[]::text[]),
    ('phonepe-payment-gateway-api','upi_payment','UPI/wallet payment collection','https://developer.phonepe.com/',true,'paid','api_key',ARRAY[]::text[]),
    ('paytm-payment-gateway-api','upi_payment','UPI/wallet payment collection','https://business.paytm.com/docs',true,'paid','api_key',ARRAY[]::text[]),
    ('voyage-ai-api','embeddings','Text embedding generation','https://docs.voyageai.com/',true,'free-tier','api_key',ARRAY[]::text[]),
    ('new-relic-api','monitoring','Application performance monitoring','https://docs.newrelic.com/docs/apis/',true,'free-tier','api_key',ARRAY[]::text[]),
    ('pagerduty-api','incident_management','Alerting and on-call incident management','https://developer.pagerduty.com/',true,'free-tier','api_key',ARRAY[]::text[]),
    ('grafana-cloud-api','monitoring','Metrics/logs dashboards and alerting','https://grafana.com/docs/grafana-cloud/developer-resources/api-reference/',true,'free-tier','api_key',ARRAY[]::text[]),
    ('cloudinary-api','media_management','Image/video upload, transformation and CDN delivery','https://cloudinary.com/documentation',true,'free-tier','api_key',ARRAY[]::text[]),
    ('algolia-search-api','site_search','Hosted search-as-a-service indexing/query','https://www.algolia.com/doc/api-client/getting-started/',true,'free-tier','api_key',ARRAY[]::text[]),
    ('zapier-platform-api','automation','Workflow automation trigger/action integration','https://platform.zapier.com/docs',true,'free-tier','oauth2',ARRAY[]::text[]),
    ('onesignal-api','push_notifications','Push/email/SMS marketing notifications','https://documentation.onesignal.com/reference',true,'free-tier','api_key',ARRAY[]::text[]),
    ('mixpanel-api','product_analytics','Event-based product analytics','https://developer.mixpanel.com/reference',true,'free-tier','api_key',ARRAY[]::text[]),
    ('amplitude-api','product_analytics','Event-based product analytics','https://amplitude.com/docs/apis',true,'free-tier','api_key',ARRAY[]::text[]),
    ('segment-api','customer_data_platform','Event routing/customer-data-platform','https://segment.com/docs/connections/spec/',true,'free-tier','api_key',ARRAY[]::text[]),
    ('salesforce-rest-api','crm','CRM records and workflow management','https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/',true,'paid','oauth2',ARRAY[]::text[]),
    ('zendesk-api','support_ticketing','Customer support ticket management','https://developer.zendesk.com/api-reference/',true,'paid','api_key',ARRAY[]::text[]),
    ('botpress-api','ai_agent','Conversational AI-agent building/runtime','https://botpress.com/docs',true,'free-tier','api_key',ARRAY[]::text[]),
    ('voiceflow-api','ai_agent','Conversational AI-agent building/runtime','https://docs.voiceflow.com',true,'free-tier','api_key',ARRAY[]::text[])
) AS c(slug, capability_key, capability_name, docs_url, api_available, pricing_tier, auth_type, engines)
  ON s.slug = c.slug
ON CONFLICT (service_id, capability_key) DO NOTHING;
