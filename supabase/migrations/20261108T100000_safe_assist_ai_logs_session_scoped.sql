-- Safe Assist AI logs: restrict direct INSERT to parties of the named session.
--
-- The previous policy "Participants insert ai logs" only required
-- `auth.uid() is not null`, so any authenticated user could insert a log row
-- naming *another* user's session, forging AI risk evidence against a session
-- they are not part of. The sibling table `safe_assist_events` already scopes
-- inserts to the session's user or support agent; this applies the same rule
-- here, and additionally admits support staff, matching the authorization that
-- `log_safe_assist_ai_event` performs. Legitimate participant and support-staff
-- writes, the SECURITY DEFINER RPC and service-role writes are unaffected.

begin;

drop policy if exists "Participants insert ai logs" on public.safe_assist_ai_logs;

create policy "Participants insert ai logs"
  on public.safe_assist_ai_logs
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.safe_assist_sessions s
      where s.id = safe_assist_ai_logs.session_id
        and (s.user_id = auth.uid() or s.support_agent_id = auth.uid())
    )
    or public.is_support_staff(auth.uid())
  );

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'safe_assist_ai_logs'
      and policyname = 'Participants insert ai logs'
      and coalesce(with_check, '') like '%safe_assist_sessions%'
  ) then
    raise exception 'Safe Assist AI log INSERT policy was not scoped to the session';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.log_safe_assist_ai_event(uuid,character varying,character varying,jsonb,character varying,boolean)',
    'EXECUTE'
  ) then
    raise exception 'Authenticated Safe Assist event RPC access was not preserved';
  end if;

  if not has_table_privilege('service_role', 'public.safe_assist_ai_logs', 'INSERT') then
    raise exception 'Safe Assist AI log INSERT is unavailable to service_role';
  end if;
end
$$;

commit;
