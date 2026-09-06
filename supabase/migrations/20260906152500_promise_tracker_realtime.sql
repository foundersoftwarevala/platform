-- Realtime.
--
-- The client subscribes to promises, the audit log and health events on one
-- channel. A channel is rejected as a whole when any table on it is missing
-- from the publication, so an omission here does not degrade live updates - it
-- silently kills them.

do $$
declare t text;
begin
  foreach t in array array['promises','promise_audit_logs','promise_health_events',
                           'promise_escalations','promise_ledger','promise_ai_insights']
  loop
    if not exists (select 1 from pg_publication_tables
                   where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
