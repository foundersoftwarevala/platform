-- Remove the non-enum owner alias from platform role checks.
-- Keep existing migrations immutable and preserve all other authorized roles.

DO $$
DECLARE
  table_name text;
BEGIN
  IF to_regclass('public.user_roles') IS NULL THEN
    RETURN;
  END IF;

  FOREACH table_name IN ARRAY ARRAY[
    'rnd_ideas',
    'rnd_prototypes',
    'rnd_impact_analyses',
    'rnd_trends',
    'rnd_market_gaps',
    'rnd_feedback',
    'rnd_decisions',
    'rnd_notifications',
    'rnd_budgets',
    'rnd_transactions',
    'rnd_technologies',
    'rnd_pipeline_items',
    'rnd_idea_evaluations',
    'rnd_ai_messages',
    'pm_users',
    'pm_products',
    'pm_licenses',
    'pm_tickets',
    'pm_issues',
    'pm_assist_sessions',
    'pm_promises',
    'pm_upgrades',
    'pm_renewals',
    'pm_usage',
    'pm_ai_conversations',
    'pm_ai_messages',
    'pm_communication_logs',
    'pm_alerts',
    'pm_satisfaction',
    'pm_compliance',
    'pm_audit_logs',
    'pm_settings',
    'pm_health_metrics',
    'pm_escalations',
    'pm_quality_alerts',
    'pm_manager_metrics',
    'pm_decisions',
    'pm_reports',
    'rd_opportunities',
    'rd_opportunity_events',
    'rd_evaluations',
    'rd_projects',
    'rnd_team_feedback',
    'rnd_feedback_insights',
    'rd_team_members'
  ]
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS rd_module_operator_read ON public.%I', table_name);
      EXECUTE format(
        $policy$
          CREATE POLICY rd_module_operator_read ON public.%I
          FOR SELECT TO authenticated
          USING (
            EXISTS (
              SELECT 1
              FROM public.user_roles
              WHERE user_id = auth.uid()
                AND role::text IN ('boss', 'boss_owner', 'admin', 'super_admin', 'founder')
            )
          )
        $policy$,
        table_name
      );
    END IF;
  END LOOP;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.user_roles') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE $function$
    CREATE OR REPLACE FUNCTION public.affiliate_manager_viewer()
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $body$
      SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role::text IN (
            'admin',
            'boss',
            'boss_owner',
            'super_admin',
            'founder',
            'finance',
            'support',
            'sales_support_manager'
          )
      );
    $body$
  $function$;
  EXECUTE 'REVOKE EXECUTE ON FUNCTION public.affiliate_manager_viewer() FROM PUBLIC, anon';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.affiliate_manager_viewer() TO authenticated, service_role';
END
$$;
