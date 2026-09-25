-- Indexes the lead list and the reports actually sort and filter on.
--
-- Every lead query orders by created_at descending, and the reports group by
-- source and by status. With a few hundred rows PostgreSQL scans the table and
-- nobody notices. At the volume this platform is built for - hundreds of orders
-- a day, hundreds of resellers, leads into the hundreds of thousands - a
-- sequential scan and a sort on every page of every screen is the difference
-- between a dashboard that opens and one that times out.
--
-- Nothing is dropped and no data is touched. CONCURRENTLY is deliberately not
-- used so this runs inside the migration transaction; the tables are small
-- enough today that the brief lock costs nothing, and running it now is what
-- keeps it cheap.

-- The list: newest first, which is what every screen asks for.
create index if not exists leads_created_at_idx
  on public.leads (created_at desc);

-- The master table pages through one status at a time, newest first.
create index if not exists leads_status_created_at_idx
  on public.leads (status, created_at desc);

-- The source-wise report counts and sums by source, and by source within won.
create index if not exists leads_source_status_idx
  on public.leads (source, status);

-- The overview counts today, this week and this month among open leads, and
-- lists what is unassigned.
create index if not exists leads_open_unassigned_idx
  on public.leads (assigned_agent_id, created_at desc)
  where status not in ('won', 'lost', 'spam');

-- Alerts are read active-first and grouped by type on the overview.
create index if not exists lead_alerts_active_type_idx
  on public.lead_alerts (alert_type, created_at desc)
  where is_active;

-- A lead's own history: notes, communications, follow-ups and assignments are
-- all fetched by lead_id and shown newest first.
create index if not exists lead_notes_lead_created_idx
  on public.lead_notes (lead_id, created_at desc);
create index if not exists lead_communications_lead_created_idx
  on public.lead_communications (lead_id, created_at desc);
create index if not exists lead_follow_ups_lead_scheduled_idx
  on public.lead_follow_ups (lead_id, scheduled_at);
create index if not exists lead_assignments_lead_created_idx
  on public.lead_assignments (lead_id, created_at desc);
create index if not exists lead_audit_logs_lead_created_idx
  on public.lead_audit_logs (lead_id, created_at desc);
