-- Reporting views must answer as the person asking, not as their owner.
--
-- A view without `security_invoker` runs with its owner's rights, and these
-- five are owned by `postgres`, so every row-level policy on the tables
-- underneath them was skipped. `ai_content_audit_logs` reads
-- `marketplace_audit_logs`, which only admins and finance may read; the four
-- `founder_*` views read `founder_incidents`, `founder_recovery_attempts`,
-- `founder_recovery_policies` and `i18n_translation_jobs`, which are
-- service-role or operator tables. Because PostgREST exposes views like
-- tables, any signed-in account could read all of it.
--
-- Reproduced on the production API before this change: an ordinary
-- non-staff account received rows from ai_content_audit_logs,
-- founder_healing_pressure, founder_healing_quality and
-- founder_recovery_strategy_performance, while the same account correctly
-- received nothing from marketplace_audit_logs and founder_incidents
-- directly.
--
-- Turning on `security_invoker` makes each view obey the policies its base
-- tables already define. The background self-healing worker reads
-- `founder_recovery_strategy_performance` with the service key, which the
-- `*_service_role` policies allow; nothing else in the application reads
-- these views.

begin;

alter view public.ai_content_audit_logs set (security_invoker = on);
alter view public.founder_healing_pressure set (security_invoker = on);
alter view public.founder_healing_priority set (security_invoker = on);
alter view public.founder_healing_quality set (security_invoker = on);
alter view public.founder_recovery_strategy_performance set (security_invoker = on);

revoke select on public.ai_content_audit_logs from anon;
revoke select on public.founder_healing_pressure from anon;
revoke select on public.founder_healing_priority from anon;
revoke select on public.founder_healing_quality from anon;
revoke select on public.founder_recovery_strategy_performance from anon;

do $$
declare
  leaky text;
begin
  select string_agg(c.relname, ', ') into leaky
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('v', 'm')
    and coalesce((
      select option_value from pg_options_to_table(c.reloptions)
      where option_name = 'security_invoker'
    ), 'off') not in ('on', 'true')
    and (
      has_table_privilege('anon', c.oid, 'SELECT')
      or has_table_privilege('authenticated', c.oid, 'SELECT')
    );

  if leaky is not null then
    raise exception 'Views still bypass row security for API roles: %', leaky;
  end if;
end
$$;

commit;
