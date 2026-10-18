-- Platform operators can read the audit trail.
--
-- audit_logs had row-level security on, a policy only for refusing anonymous
-- writes, and no SELECT grant to signed-in users at all - so every screen that
-- reads it (Sales & Support's Reports & Audit, the Demo Manager's activity log)
-- answered "permission denied for table audit_logs" and showed nothing.
--
-- Reading is opened to platform operators only - boss, boss_owner, founder,
-- admin, super_admin, finance - through is_platform_operator(). Nothing about
-- writing changes. Whether sales and support managers should read the whole
-- trail is left to the owner: the trail covers the entire platform, not only
-- their own module.

grant select on public.audit_logs to authenticated;

drop policy if exists audit_logs_operator_read on public.audit_logs;
create policy audit_logs_operator_read on public.audit_logs
  for select to authenticated
  using (public.is_platform_operator());
