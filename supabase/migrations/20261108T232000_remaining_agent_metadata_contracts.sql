-- Activate the remaining configured agents with catalog-metadata-only READ contracts.
-- No business rows, customer data, or agent-provided tools are accessed.
DO $$
DECLARE
  changed integer;
BEGIN
  UPDATE public.ai_agents AS a
     SET task_contract =
           'Read-only approximate relation-count summary for ' || v.domain ||
           '. Inspect PostgreSQL catalog estimates for these sources only: ' ||
           CASE
             WHEN cardinality(v.tables) > 0 THEN
               (SELECT string_agg('public.' || table_name, ', ' ORDER BY ordinality)
                  FROM unnest(v.tables) WITH ORDINALITY AS t(table_name, ordinality))
             ELSE 'no verified domain relation is available'
           END ||
           '. Send only relation names and estimated row counts to local Ollama and record a bounded summary in ai_agent_runs. Do not read business rows or personal data, write business data, contact users, call external services, or execute jobs.' ||
           CASE WHEN v.limitation IS NOT NULL THEN ' Limitation: ' || v.limitation ELSE '' END,
         lifecycle = 'AVAILABLE'
    FROM (VALUES
      ('customer-success', 'customer support', ARRAY['support_tickets']::text[], NULL::text),
      ('demo-brand-compliance', 'brand and legal metadata', ARRAY['legal_documents','marketplace_products']::text[], NULL::text),
      ('demo-health', 'demo health', ARRAY['demo_health','product_demo_urls']::text[], NULL::text),
      ('demo-intake', 'demo intake', ARRAY['demo_requests']::text[], NULL::text),
      ('demo-intelligence', 'demo analytics', ARRAY['demo_analytics','demos']::text[], NULL::text),
      ('demo-marketplace-matching', 'marketplace matching', ARRAY['marketplace_products','marketplace_categories']::text[], NULL::text),
      ('demo-sync', 'demo synchronization', ARRAY['demo_sandbox_jobs','demo_sandboxes']::text[], NULL::text),
      ('inventory-operations', 'inventory operations', ARRAY[]::text[], 'No authoritative inventory relation was verified; inventory levels cannot be inferred.'),
      ('marketing-intelligence', 'marketing activity', ARRAY['marketing_campaigns','marketing_leads']::text[], NULL::text),
      ('mon-approval-monitor', 'approval workflow', ARRAY['founder_decisions']::text[], NULL::text),
      ('mon-author', 'author submissions', ARRAY['author_submissions','author_approval_evidence']::text[], NULL::text),
      ('mon-automation', 'agent run operations', ARRAY['ai_agent_runs']::text[], NULL::text),
      ('mon-commission', 'commission records', ARRAY['finance_commissions','marketplace_commissions']::text[], NULL::text),
      ('mon-company-brain-monitor', 'founder knowledge', ARRAY['founder_knowledge']::text[], NULL::text),
      ('mon-developer', 'developer tasks', ARRAY['developer_tasks','tm_tasks']::text[], NULL::text),
      ('mon-finance', 'finance activity', ARRAY['marketplace_orders','finance_commissions']::text[], NULL::text),
      ('mon-franchise', 'franchise records', ARRAY['franchises','franchise_contracts']::text[], NULL::text),
      ('mon-goal-monitor', 'company goals', ARRAY['founder_goals']::text[], NULL::text),
      ('mon-influencer', 'influencer records', ARRAY['influencer_profiles','influencer_campaign_assignments']::text[], NULL::text),
      ('mon-integration', 'service integrations', ARRAY['api_integrations','api_services']::text[], NULL::text),
      ('mon-kpi-monitor', 'reporting records', ARRAY['founder_reports']::text[], NULL::text),
      ('mon-lead', 'lead pipeline', ARRAY['leads','lead_scores']::text[], NULL::text),
      ('mon-legal', 'legal records', ARRAY['legal_documents','legal_policies']::text[], NULL::text),
      ('mon-license', 'license records', ARRAY['marketplace_licenses','licenses']::text[], NULL::text),
      ('mon-marketplace', 'marketplace activity', ARRAY['marketplace_products','marketplace_sellers','marketplace_orders']::text[], NULL::text),
      ('mon-product-demo', 'product demo records', ARRAY['product_demo_urls','demo_requests']::text[], NULL::text),
      ('mon-promise', 'promise records', ARRAY['pm_promises','promises']::text[], NULL::text),
      ('mon-renewal', 'renewal activity', ARRAY['server_subscriptions','finance_subscriptions']::text[], NULL::text),
      ('mon-reseller', 'reseller records', ARRAY['resellers','reseller_memberships']::text[], NULL::text),
      ('mon-revenue', 'revenue records', ARRAY['marketplace_orders']::text[], NULL::text),
      ('mon-sales', 'sales pipeline', ARRAY['leads','sales_leads']::text[], NULL::text),
      ('mon-subscription', 'subscription records', ARRAY['server_subscriptions','finance_subscriptions']::text[], NULL::text),
      ('mon-support', 'support workload', ARRAY['support_tickets']::text[], NULL::text),
      ('mon-task', 'task operations', ARRAY['tm_tasks','tm_activity']::text[], NULL::text),
      ('mon-user', 'user account metadata', ARRAY['profiles','user_roles']::text[], NULL::text),
      ('product-intelligence', 'product catalog', ARRAY['marketplace_products','marketplace_product_pricing','marketplace_order_items']::text[], NULL::text),
      ('sales-affiliate-sales', 'affiliate sales metadata', ARRAY['leads','marketplace_commissions']::text[], NULL::text),
      ('sales-africa', 'Africa sales metadata', ARRAY['leads']::text[], NULL::text),
      ('sales-agency-sales', 'agency sales metadata', ARRAY['leads']::text[], NULL::text),
      ('sales-channel-sales', 'channel sales metadata', ARRAY['leads','lead_sources']::text[], NULL::text),
      ('sales-checkout-recovery', 'checkout recovery', ARRAY['leads']::text[], 'No verified checkout-session or abandonment relation was found; lead counts do not measure checkout drop-off.'),
      ('sales-competitive-intelligence', 'competitive intelligence', ARRAY['marketplace_products']::text[], 'No verified competitor data source was found; catalog counts are not competitor observations.'),
      ('sales-crm-sales', 'CRM sales pipeline', ARRAY['leads','lead_activities']::text[], NULL::text),
      ('sales-customer-expansion', 'customer expansion', ARRAY['server_subscriptions','profiles']::text[], NULL::text),
      ('sales-customer-reactivation', 'customer reactivation', ARRAY['server_subscriptions','profiles']::text[], NULL::text),
      ('sales-dormant-customer', 'dormant customer metadata', ARRAY['server_subscriptions','profiles']::text[], NULL::text),
      ('sales-education-sales', 'education sales metadata', ARRAY['leads']::text[], NULL::text),
      ('sales-enterprise-account', 'enterprise sales', ARRAY['leads']::text[], 'No verified employee-count field was found; enterprise size cannot be inferred.'),
      ('sales-erp-sales', 'ERP sales metadata', ARRAY['leads','marketplace_products']::text[], NULL::text),
      ('sales-europe', 'Europe sales metadata', ARRAY['leads']::text[], NULL::text),
      ('sales-franchise-recruitment', 'franchise recruitment', ARRAY['franchise_applications','franchise_leads']::text[], NULL::text),
      ('sales-franchise-sales', 'franchise sales', ARRAY['franchise_leads','franchises']::text[], NULL::text),
      ('sales-high-value-lead', 'high-value lead metadata', ARRAY['leads','lead_scores']::text[], NULL::text),
      ('sales-inbound-sales', 'inbound sales', ARRAY['leads','lead_sources']::text[], NULL::text),
      ('sales-india', 'India sales metadata', ARRAY['leads']::text[], NULL::text),
      ('sales-international-sales', 'international sales metadata', ARRAY['leads']::text[], NULL::text),
      ('sales-latin-america', 'Latin America sales metadata', ARRAY['leads']::text[], NULL::text),
      ('sales-localization-sales', 'localization sales metadata', ARRAY['leads']::text[], NULL::text),
      ('sales-lost-lead-recovery', 'lost-lead recovery metadata', ARRAY['leads','lead_activities']::text[], NULL::text),
      ('sales-middle-east', 'Middle East sales metadata', ARRAY['leads']::text[], NULL::text),
      ('sales-negotiation-support', 'negotiation pipeline metadata', ARRAY['leads']::text[], NULL::text),
      ('sales-north-america', 'North America sales metadata', ARRAY['leads']::text[], NULL::text),
      ('sales-offline-software-sales', 'offline software sales metadata', ARRAY['leads','marketplace_products']::text[], 'No verified offline-capability field was found; offline compatibility cannot be inferred.'),
      ('sales-outbound-sales', 'outbound sales metadata', ARRAY['leads','lead_activities']::text[], NULL::text),
      ('sales-partner-sales', 'partner sales metadata', ARRAY['resellers','leads']::text[], NULL::text),
      ('sales-pos-sales', 'POS sales metadata', ARRAY['leads','marketplace_products']::text[], NULL::text),
      ('sales-quotation', 'quotation metadata', ARRAY['leads','marketplace_product_pricing']::text[], NULL::text),
      ('sales-referral-sales', 'referral sales metadata', ARRAY['leads','lead_sources']::text[], NULL::text),
      ('sales-regional-sales-intelligence', 'regional sales metadata', ARRAY['leads','lead_sources']::text[], NULL::text),
      ('sales-reseller-recruitment', 'reseller recruitment', ARRAY['resellers','reseller_memberships','leads']::text[], NULL::text),
      ('sales-review-management-sales', 'review management metadata', ARRAY['marketplace_reviews','leads']::text[], NULL::text),
      ('sales-saas-sales', 'SaaS sales metadata', ARRAY['server_subscriptions','leads']::text[], NULL::text),
      ('sales-sales-analytics', 'sales analytics metadata', ARRAY['leads','marketplace_orders']::text[], NULL::text),
      ('sales-software-sales', 'software sales metadata', ARRAY['marketplace_products','leads']::text[], NULL::text),
      ('sales-southeast-asia', 'Southeast Asia sales metadata', ARRAY['leads']::text[], NULL::text)
    ) AS v(agent_key, domain, tables, limitation)
   WHERE a.agent_key = v.agent_key
     AND a.status = 'active'
     AND a.lifecycle = 'CONFIGURED'
     AND (a.task_contract IS NULL OR btrim(a.task_contract) = '')
     AND 'READ' = ANY(a.permissions);

  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed NOT IN (0, 75) THEN
    RAISE EXCEPTION 'Expected to activate 75 reviewed metadata-only agents or find them already active; updated %', changed;
  END IF;
END;
$$;
