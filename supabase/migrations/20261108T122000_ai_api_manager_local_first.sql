-- Register the two loopback-only text model services in the central AI
-- registry. The application gateway has an exact endpoint allowlist for
-- these slugs; no arbitrary private-network URL is enabled.
INSERT INTO public.ai_providers (
  name,
  slug,
  category,
  status,
  base_url,
  region,
  monthly_cost_usd,
  api_kind,
  content_generation_enabled,
  auth_type,
  pricing_tier,
  approval_status
)
VALUES
  (
    'Ollama Local',
    'ollama-local',
    'ai',
    'active',
    'http://127.0.0.1:11434',
    'local',
    0,
    'openai-compatible',
    true,
    'none',
    'local',
    'approved'
  ),
  (
    'Founder AI Local Bridge',
    'founder-ai-local',
    'ai',
    'active',
    'http://127.0.0.1:5200',
    'local',
    0,
    'openai-compatible',
    true,
    'none',
    'local',
    'approved'
  )
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.ai_models (
  provider_id,
  name,
  model_id,
  modality,
  context_window,
  input_cost_per_1k,
  output_cost_per_1k,
  status,
  is_default
)
SELECT p.id, 'Qwen 2.5 7B', 'qwen2.5:7b', 'text', 32768, 0, 0, 'active', true
FROM public.ai_providers p
WHERE p.slug = 'ollama-local'
  AND NOT EXISTS (
    SELECT 1
    FROM public.ai_models m
    WHERE m.model_id = 'qwen2.5:7b'
  )
ON CONFLICT (model_id) DO NOTHING;

INSERT INTO public.api_services (
  name,
  slug,
  provider_id,
  type,
  category,
  status,
  endpoint_url,
  health_status,
  version,
  owner_team,
  auth_type,
  pricing_tier,
  approval_status,
  connected_modules,
  capabilities
)
SELECT
  s.name,
  s.slug,
  p.id,
  'local',
  'ai',
  'active',
  s.endpoint_url,
  'unknown',
  'openai-compatible-v1',
  'Platform',
  'none',
  'local',
  'approved',
  ARRAY['SEO Manager', 'Vala AI', 'Marketplace SEO']::text[],
  ARRAY['chat_completion', 'content_generation']::text[]
FROM (
  VALUES
    (
      'Ollama Local',
      'ollama-local',
      'http://127.0.0.1:11434/v1/chat/completions'
    ),
    (
      'Founder AI Local Bridge',
      'founder-ai-local',
      'http://127.0.0.1:5200/v1/chat/completions'
    )
) AS s(name, slug, endpoint_url)
JOIN public.ai_providers p ON p.slug = s.slug
ON CONFLICT (slug) DO NOTHING;
