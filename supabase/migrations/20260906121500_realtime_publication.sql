-- Put the realtime tables in the publication.
--
-- A channel subscribing to several tables fails as a whole if even one of them
-- is missing from the publication: the server rejects the subscription and every
-- table on that channel goes silent. One unpublished table was enough to make
-- realtime look completely dead across the platform.

do $$
declare t text;
begin
  foreach t in array array['developer_task_escalations', 'developer_task_internal_notes', 'developer_tasks', 'franchise_applications', 'franchise_escalations', 'franchise_royalties', 'tm_activity', 'tm_approvals', 'tm_attachments', 'tm_automations', 'tm_comments', 'tm_dependencies', 'tm_escalations', 'tm_members', 'tm_notifications', 'tm_reviews', 'tm_settings', 'tm_subtasks', 'tm_tasks', 'tm_time_logs']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
