-- Register the verified local Ollama model and map only agent runners that call it.
-- VPS-only application; do not apply to the Supabase cloud project.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.ai_providers WHERE slug = 'ollama-local'
  ) THEN
    RAISE EXCEPTION 'Required VPS provider ollama-local is missing';
  END IF;
END
$$;

INSERT INTO public.ai_models (
  provider_id, name, model_id, modality, context_window,
  input_cost_per_1k, output_cost_per_1k, status, latency_ms, quality_score, is_default
)
SELECT p.id, 'Qwen 2.5 3B', 'qwen2.5:3b', 'text', 4096,
       0, 0, 'active', 0, 0, false
  FROM public.ai_providers p
 WHERE p.slug = 'ollama-local'
ON CONFLICT (model_id) DO UPDATE
  SET provider_id = EXCLUDED.provider_id,
      name = EXCLUDED.name,
      modality = EXCLUDED.modality,
      context_window = EXCLUDED.context_window,
      status = EXCLUDED.status;

UPDATE public.ai_agents
   SET model_id = (SELECT id FROM public.ai_models WHERE model_id = 'qwen2.5:3b')
 WHERE agent_key IN (
    'customer-success',
    'demo-brand-compliance',
    'demo-health',
    'demo-intake',
    'demo-intelligence',
    'demo-marketplace-matching',
    'demo-sync',
    'inventory-operations',
    'marketing-intelligence',
    'mon-approval-monitor',
    'mon-author',
    'mon-automation',
    'mon-commission',
    'mon-company-brain-monitor',
    'mon-developer',
    'mon-finance',
    'mon-franchise',
    'mon-goal-monitor',
    'mon-influencer',
    'mon-integration',
    'mon-kpi-monitor',
    'mon-lead',
    'mon-legal',
    'mon-license',
    'mon-marketplace',
    'mon-product-demo',
    'mon-promise',
    'mon-renewal',
    'mon-reseller',
    'mon-revenue',
    'mon-sales',
    'mon-subscription',
    'mon-support',
    'mon-task',
    'mon-user',
    'product-intelligence',
    'sales-affiliate-sales',
    'sales-africa',
    'sales-agency-sales',
    'sales-channel-sales',
    'sales-checkout-recovery',
    'sales-competitive-intelligence',
    'sales-crm-sales',
    'sales-customer-expansion',
    'sales-customer-reactivation',
    'sales-dormant-customer',
    'sales-education-sales',
    'sales-enterprise-account',
    'sales-erp-sales',
    'sales-europe',
    'sales-franchise-recruitment',
    'sales-franchise-sales',
    'sales-high-value-lead',
    'sales-inbound-sales',
    'sales-india',
    'sales-international-sales',
    'sales-latin-america',
    'sales-localization-sales',
    'sales-lost-lead-recovery',
    'sales-middle-east',
    'sales-negotiation-support',
    'sales-north-america',
    'sales-offline-software-sales',
    'sales-outbound-sales',
    'sales-partner-sales',
    'sales-pos-sales',
    'sales-quotation',
    'sales-referral-sales',
    'sales-regional-sales-intelligence',
    'sales-reseller-recruitment',
    'sales-review-management-sales',
    'sales-saas-sales',
    'sales-sales-analytics',
    'sales-software-sales',
    'sales-southeast-asia',
    'sales-lead-followup',
    'support-reply-drafter',
    'sales-demo-booking',
    'sales-demo-followup',
    'sales-trial-conversion',
    'sales-subscription-sales',
    'sales-renewal-sales',
    'sales-upsell',
    'sales-cross-sell',
    'sales-smb-sales',
    'sales-reseller-sales',
    'sales-marketplace-sales',
    'sales-objection-handling',
    'sales-proposal',
    'mon-reputation',
    'mon-customer',
    'research'
 );
