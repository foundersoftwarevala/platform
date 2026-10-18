-- Assist audit trail: only the audit function and the service key may write.
--
-- `assist_audit_insert` admitted any authenticated session with
-- `WITH CHECK (true)`. The `assist_audit_logs_stamp_actor` trigger overwrites
-- `actor_user_id` for browser roles, but `actor`, `actor_role`, `action`,
-- `target`, `result` and `severity` are free-form columns the row keeps as
-- submitted, so a signed-in user could append an audit entry attributed to
-- another operator identity and role. The log is append-only, so a forged row
-- cannot be corrected afterwards.
--
-- Every real writer goes through `public.assist_audit(...)`, a SECURITY
-- DEFINER function that derives actor, actor_role and target from
-- `auth.uid()` and `assist_sessions`; it runs as its owner and is unaffected
-- by RLS. No application code inserts into this table directly. Removing the
-- permissive policy therefore closes direct forgery without changing any
-- legitimate path. The service key bypasses RLS and keeps writing.

begin;

drop policy if exists assist_audit_insert on public.assist_audit_logs;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'assist_audit_logs'
      and cmd in ('INSERT', 'ALL')
      and roles::text like '%authenticated%'
  ) then
    raise exception 'A permissive assist audit INSERT policy is still present';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.assist_audit(text,uuid,text,jsonb,jsonb,text,text,text)',
    'EXECUTE'
  ) then
    raise exception 'Authenticated access to the assist audit function was not preserved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'assist_audit_logs'
      and policyname = 'assist_audit_read'
  ) then
    raise exception 'The assist audit read policy is missing';
  end if;
end
$$;

commit;
