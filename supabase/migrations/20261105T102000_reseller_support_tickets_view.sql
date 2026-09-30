-- The Reseller Manager's support queue: the AMS tickets resellers have raised.
--
-- The Support wall showed four invented tickets ("License key not activating",
-- Ravi Kumar, Acme Digital) kept in the browser. A reseller's support requests
-- are AMS tickets - the dashboard's AMS desk raises them - so this is those
-- tickets, with the names the wall shows. The ticket itself is still worked
-- in the AMS Manager, which owns its statuses and its history; the wall reads.
--
-- Read by the manager's resource endpoint with the service key only.

create or replace view public.reseller_support_tickets
with (security_invoker = true) as
select t.id,
       t.ticket_no,
       t.subject,
       t.category,
       t.priority,
       t.status,
       t.created_at,
       t.updated_at,
       coalesce(nullif(p.display_name, ''), nullif(p.full_name, ''), nullif(p.username, ''), 'User') as requester,
       r.name as reseller,
       coalesce(nullif(a.display_name, ''), nullif(a.full_name, ''), nullif(a.username, '')) as assignee
  from public.ams_tickets t
  join public.user_roles ur on ur.user_id = t.created_by and ur.role = 'reseller'
  left join public.resellers r on r.user_id = t.created_by
  left join public.profiles p on p.id = t.created_by
  left join public.profiles a on a.id = t.assignee_id
 where t.deleted_at is null;

revoke all on public.reseller_support_tickets from public, anon, authenticated;
grant select on public.reseller_support_tickets to service_role;

comment on view public.reseller_support_tickets is
  'AMS tickets raised by resellers, for the Reseller Manager support wall. Worked in the AMS Manager.';
