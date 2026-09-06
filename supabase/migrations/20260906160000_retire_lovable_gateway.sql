-- Retire the Lovable gateway inside AI API Manager.
--
-- Ten features in the application read LOVABLE_API_KEY and posted to
-- ai.gateway.lovable.dev directly. Lovable is no longer part of Software Vala
-- and that variable is not set, so every one of them failed the moment it was
-- used. Those call sites now resolve through AI API Manager, which means the
-- registry itself has to stop advertising a vendor that will not answer.
--
-- Nothing is deleted. The provider, its models and its two services are marked
-- inactive, so the usage history behind them stays readable and the resolver
-- can never choose them again.
--
-- With Lovable retired, the Anthropic entry is the active chat-capable service.
-- Its model row was left in 'evaluation' with no default and a gateway-style
-- slug that the Anthropic API would reject, and its credential was filed under
-- 'staging' where the running site does not look - so the registry could not
-- have answered a request even once a key existed. Both are corrected here.
-- The model id is a working default an operator can change without a
-- deployment.
--
-- The one thing this migration cannot do is supply a credential. No API key is
-- stored for any service in this project, so AI features will refuse with that
-- reason until somebody adds one in AI API Manager.

update public.ai_providers
   set status = 'inactive'
 where slug = 'lovable-ai' and status <> 'inactive';

update public.ai_models m
   set status = 'retired'
  from public.ai_providers p
 where p.id = m.provider_id
   and p.slug = 'lovable-ai'
   and m.status <> 'retired';

update public.api_services
   set status = 'inactive'
 where endpoint_url ilike '%lovable%'
   and status <> 'inactive';

update public.ai_models m
   set model_id = 'claude-3-5-sonnet-latest',
       status = 'active',
       is_default = true
  from public.ai_providers p
 where p.id = m.provider_id
   and p.slug = 'anthropic';

update public.api_keys k
   set environment = 'production'
  from public.api_services s
 where s.id = k.service_id
   and s.name = 'Claude Reasoning'
   and k.environment = 'staging';
