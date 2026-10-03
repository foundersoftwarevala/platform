-- Every table and function the reseller area uses, read-only: existence,
-- RLS, policies, keys, constraints, indexes, grants; and for functions
-- SECURITY DEFINER, a pinned search_path and who may execute them.
--
--   node scripts/ops/db.mjs --file scripts/ops/reseller-db-inventory.sql
set default_transaction_read_only = on;

with wanted(name) as (values
  ('resellers'), ('reseller_membership_plans'), ('reseller_membership_orders'), ('reseller_memberships'),
  ('reseller_membership_events'), ('reseller_commission_rules'), ('reseller_commissions'), ('reseller_payouts'),
  ('reseller_payout_schedules'), ('reseller_notifications'), ('reseller_support_tickets'),
  ('marketplace_referral_codes'), ('marketplace_referral_sessions'), ('marketplace_order_attributions'),
  ('marketplace_orders'), ('marketplace_order_items'), ('marketplace_products'), ('marketplace_licenses'), ('licenses'),
  ('crm_customers'), ('crm_tasks'), ('leads'), ('lead_agents'), ('lead_follow_ups'), ('audit_logs'),
  ('finance_payment_rails'), ('finance_invoices'), ('leaderboard_entries'), ('user_notifications'), ('team_members'))
select w.name,
       coalesce(c.relkind::text, 'MISSING') kind,
       c.relrowsecurity rls,
       (select count(*) from pg_policy p where p.polrelid = c.oid) policies,
       (select count(*) from pg_policy p where p.polrelid = c.oid and pg_get_expr(p.polqual, p.polrelid) = 'true' and 'anon'::regrole = any(p.polroles)) anon_true_policies,
       (select count(*) from pg_constraint k where k.conrelid = c.oid and k.contype = 'f') fks,
       (select count(*) from pg_constraint k where k.conrelid = c.oid and k.contype = 'u')
         + (select count(*) from pg_index i where i.indrelid = c.oid and i.indisunique and not i.indisprimary
              and not exists (select 1 from pg_constraint k where k.conindid = i.indexrelid)) uniques,
       (select count(*) from pg_constraint k where k.conrelid = c.oid and k.contype = 'c') checks,
       (select count(*) from pg_index i where i.indrelid = c.oid) indexes,
       case when c.oid is null then null else has_table_privilege('anon', c.oid, 'insert') or has_table_privilege('anon', c.oid, 'update') or has_table_privilege('anon', c.oid, 'delete') end anon_write_grant,
       (select count(*) from pg_constraint k where k.conrelid = c.oid and k.contype = 'f'
          and not exists (select 1 from pg_index i where i.indrelid = c.oid and (i.indkey::int2[])[0] = k.conkey[1])) fks_without_index,
       c.reltuples::bigint est_rows
  from wanted w
  left join pg_class c on c.relname = w.name and c.relnamespace = 'public'::regnamespace
 order by (c.oid is null) desc, w.name;

-- Views are not protected by RLS on their own: say whose rights they run with.
select c.relname view_name, coalesce((select option_value from pg_options_to_table(c.reloptions) where option_name = 'security_invoker'), 'false') security_invoker,
       has_table_privilege('anon', c.oid, 'select') anon_select, has_table_privilege('authenticated', c.oid, 'select') authenticated_select
  from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'v' and c.relname like 'reseller%';

select p.proname, pg_get_function_identity_arguments(p.oid) args, p.prosecdef security_definer,
       coalesce(array_to_string(p.proconfig, ','), '-') config,
       has_function_privilege('anon', p.oid, 'execute') anon_exec,
       has_function_privilege('authenticated', p.oid, 'execute') auth_exec,
       position('mm_reseller_operator()' in pg_get_functiondef(p.oid)) > 0
         or position('mm_is_operator()' in pg_get_functiondef(p.oid)) > 0
         or position('reseller_is_finance()' in pg_get_functiondef(p.oid)) > 0
         or position('auth.uid()' in pg_get_functiondef(p.oid)) > 0 checks_caller
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and (p.proname ~ '^(mm_reseller|reseller_|create_reseller|submit_reseller|verify_reseller)' or p.proname in ('mm_resellers', 'mm_refund_request', 'ams_on_order_paid'))
 order by 1;
