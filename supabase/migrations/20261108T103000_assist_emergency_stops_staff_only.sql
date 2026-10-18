-- Emergency stop records may only be written by the people who can stop a session.
--
-- `assist_stops_insert` used `WITH CHECK (true)`, so any signed-in account
-- could append a row claiming an emergency stop against any session code,
-- naming any `stopped_by`, any `stop_type` and any `sessions_affected`
-- count. The stamping trigger fixes only `stopped_by_user_id`. Nothing was
-- actually stopped by such a row, which is the dangerous part: the Assist
-- Manager stop log would show terminations that never happened, and real
-- ones would be lost among them.
--
-- The check now matches the predicate the table already uses to decide who
-- may read the log, which is the Assist Manager staff whose screens write
-- these rows. A customer stopping their own session goes through
-- `public.assist_emergency_stop(...)`, a SECURITY DEFINER function that
-- performs the real revocation and records the stop with the caller's own
-- identity; it bypasses row security and is unaffected.

begin;

drop policy if exists assist_stops_insert on public.assist_emergency_stops;
create policy assist_stops_insert on public.assist_emergency_stops
  for insert to authenticated
  with check (public.assist_is_agent());

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'assist_emergency_stops'
      and cmd in ('INSERT', 'ALL')
      and roles::text like '%authenticated%'
      and (with_check is null or with_check in ('true', '(true)'))
  ) then
    raise exception 'An unrestricted emergency stop INSERT policy remains';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.assist_emergency_stop(uuid,text,boolean)',
    'EXECUTE'
  ) then
    raise exception 'Authenticated access to assist_emergency_stop was not preserved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'assist_emergency_stops'
      and policyname = 'assist_stops_read'
  ) then
    raise exception 'The emergency stop read policy is missing';
  end if;
end
$$;

commit;
