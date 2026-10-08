-- Audit trails: writes require the same standing the trail requires to read.
--
-- `legal_logs_insert`, `marketing_audit_insert`, `promise_audit_insert` and
-- `promise_health_insert` all used `WITH CHECK (true)`, so any signed-in
-- account — including an ordinary customer who never sees these screens —
-- could append rows to four append-only audit trails. The actor-stamping
-- triggers fix only the actor's user id; `actor`, `actor_role`, `action`,
-- `result`, `severity` and the state snapshots are kept as submitted, so a
-- forged entry can name another operator, and because the trails reject
-- UPDATE and DELETE it can never be corrected.
--
-- Each table already names the staff who may read it. The insert check now
-- uses the same predicate, which is exactly the set of people whose screens
-- write these rows:
--   legal_logs            -> legal_is_reviewer()      (Legal Manager)
--   marketing_audit_logs  -> marketing_is_operator()  (Marketing Manager)
--   promise_health_events -> pt_is_operator()/pt_is_manager() (Promise Tracker)
--
-- `promise_audit_logs` has no browser writer at all: every entry comes from
-- `public.pt_audit(...)`, a SECURITY DEFINER function owned by `postgres`
-- that derives the actor from `auth.uid()`. It bypasses RLS, so the table
-- policy is removed rather than narrowed.
--
-- The service key bypasses row security and keeps writing to all four.

begin;

drop policy if exists legal_logs_insert on public.legal_logs;
create policy legal_logs_insert on public.legal_logs
  for insert to authenticated
  with check (public.legal_is_reviewer());

drop policy if exists marketing_audit_insert on public.marketing_audit_logs;
create policy marketing_audit_insert on public.marketing_audit_logs
  for insert to authenticated
  with check (public.marketing_is_operator());

drop policy if exists promise_health_insert on public.promise_health_events;
create policy promise_health_insert on public.promise_health_events
  for insert to authenticated
  with check (public.pt_is_operator() or public.pt_is_manager());

drop policy if exists promise_audit_insert on public.promise_audit_logs;

do $$
declare
  open_policy text;
begin
  select tablename || '.' || policyname into open_policy
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'legal_logs', 'marketing_audit_logs',
      'promise_audit_logs', 'promise_health_events'
    )
    and cmd in ('INSERT', 'ALL')
    and roles::text like '%authenticated%'
    and (with_check is null or with_check in ('true', '(true)'))
  limit 1;

  if open_policy is not null then
    raise exception 'An unrestricted audit INSERT policy remains: %', open_policy;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'promise_audit_logs'
      and cmd in ('INSERT', 'ALL')
      and roles::text like '%authenticated%'
  ) then
    raise exception 'A direct promise audit INSERT path remains';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.pt_audit(text,uuid,text,text,text,text,boolean)',
    'EXECUTE'
  ) then
    raise exception 'Authenticated access to pt_audit was not preserved';
  end if;

  if (select count(*) from pg_policies
      where schemaname = 'public'
        and tablename in (
          'legal_logs', 'marketing_audit_logs', 'promise_health_events'
        )
        and cmd = 'INSERT') <> 3 then
    raise exception 'The replacement audit INSERT policies are not all present';
  end if;
end
$$;

commit;
