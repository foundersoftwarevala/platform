-- AMS: the person behind a lead contact.
--
-- lead_communications.created_by holds the agent's display name ("Neha
-- Verma"), not a user id, so the lead-contact hook handed ams_ingest_event a
-- name, the call failed, and the hook's exception handler hid it: no contact
-- was ever recognised. The name is resolved here through lead_agents to the
-- agent's email and from there to their account. An agent with no account -
-- every lead agent today - is skipped, which is the honest outcome.

begin;

create or replace function public.ams_user_by_lead_agent_name(p_name text)
returns uuid
language sql
stable
security definer
set search_path to 'public', 'auth'
as $$
  select public.ams_user_by_email(a.email)
  from public.lead_agents a
  where p_name is not null and lower(btrim(a.name)) = lower(btrim(p_name))
  limit 1
$$;
revoke all on function public.ams_user_by_lead_agent_name(text) from public, anon, authenticated;

create or replace function public.ams_on_lead_contact()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_who uuid;
begin
  if new.created_by is not null then
    begin
      v_who := public.ams_user_by_lead_agent_name(new.created_by);
      if v_who is not null then
        perform public.ams_ingest_event(
          v_who, 'lead.contacted', 'lead_communications', new.id::text, 1,
          coalesce(new.created_at, now()), 'trigger', '{}'::jsonb);
      end if;
    exception when others then null;
    end;
  end if;
  return new;
end $function$;

-- The backfill's lead-contact step, resolved the same way. Everything else in
-- it is unchanged from 20261106T100000.
create or replace function public.ams_backfill()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare r record; n int := 0; u uuid; evaluated int := 0;
begin
  perform set_config('ams.defer_eval', 'on', true);

  for r in
    select distinct s.owner_user_id who, s.seller_kind kind, o.id oid, coalesce(o.updated_at, o.created_at) at
    from public.marketplace_orders o
    join public.marketplace_order_items oi on oi.order_id = o.id
    join public.marketplace_sellers s on s.id = oi.seller_id
    where o.status::text = 'paid' and s.owner_user_id is not null
  loop
    perform public.ams_ingest_event(r.who, 'order.paid', 'marketplace_orders', r.oid::text, 1, r.at,
      'backfill', jsonb_build_object('order_id', r.oid, 'as', 'seller', 'ams_role', r.kind));
    n := n + 1;
  end loop;

  for r in
    select distinct rs.user_id who, o.id oid, coalesce(o.updated_at, o.created_at) at
    from public.marketplace_orders o
    join public.marketplace_order_attributions a on a.order_id = o.id
    join public.resellers rs on rs.id = a.reseller_id
    where o.status::text = 'paid' and rs.user_id is not null
  loop
    perform public.ams_ingest_event(r.who, 'order.paid', 'marketplace_orders', r.oid::text, 1, r.at,
      'backfill', jsonb_build_object('order_id', r.oid, 'as', 'reseller', 'ams_role', 'reseller'));
    n := n + 1;
  end loop;

  for r in
    select distinct ap.user_id who, o.id oid, coalesce(o.updated_at, o.created_at) at
    from public.marketplace_orders o
    join public.marketplace_order_attributions a on a.order_id = o.id
    join public.marketplace_affiliate_partners ap on ap.id = a.affiliate_partner_id
    where o.status::text = 'paid' and ap.user_id is not null
  loop
    perform public.ams_ingest_event(r.who, 'order.paid', 'marketplace_orders', r.oid::text, 1, r.at,
      'backfill', jsonb_build_object('order_id', r.oid, 'as', 'affiliate', 'ams_role', 'affiliate'));
    n := n + 1;
  end loop;

  for r in
    select distinct ip.user_id who, o.id oid, coalesce(o.updated_at, o.created_at) at
    from public.marketplace_orders o
    join public.marketplace_order_attributions a on a.order_id = o.id
    join public.influencer_profiles ip on ip.id = a.influencer_profile_id
    where o.status::text = 'paid' and ip.user_id is not null
  loop
    perform public.ams_ingest_event(r.who, 'order.paid', 'marketplace_orders', r.oid::text, 1, r.at,
      'backfill', jsonb_build_object('order_id', r.oid, 'as', 'influencer', 'ams_role', 'influencer'));
    n := n + 1;
  end loop;

  for r in
    select s.owner_user_id who, s.seller_kind kind, p.id pid, coalesce(p.approved_at, p.updated_at) at
    from public.marketplace_products p
    join public.marketplace_sellers s on s.id = p.seller_id
    where p.content_status = 'published' and s.owner_user_id is not null
  loop
    perform public.ams_ingest_event(r.who, 'product.published', 'marketplace_products', r.pid::text, 1, r.at,
      'backfill', jsonb_build_object('product_id', r.pid, 'ams_role', r.kind));
    n := n + 1;
  end loop;

  for r in
    select public.ams_user_by_email(a.email) who, l.id lid, l.status::text st, l.created_at c, l.updated_at u
    from public.leads l join public.lead_agents a on a.id = l.assigned_agent_id
  loop
    if r.who is not null then
      perform public.ams_ingest_event(r.who, 'lead.captured', 'leads', r.lid::text, 1, r.c,
        'backfill', jsonb_build_object('lead_id', r.lid));
      n := n + 1;
      if r.st = 'won' then
        perform public.ams_ingest_event(r.who, 'lead.converted', 'leads', r.lid::text, 1, coalesce(r.u, r.c),
          'backfill', jsonb_build_object('lead_id', r.lid));
        n := n + 1;
      end if;
    end if;
  end loop;

  for r in
    select public.ams_user_by_lead_agent_name(c.created_by) who, c.id cid, c.created_at at
    from public.lead_communications c where c.created_by is not null
  loop
    if r.who is not null then
      perform public.ams_ingest_event(r.who, 'lead.contacted', 'lead_communications', r.cid::text, 1, r.at,
        'backfill', jsonb_build_object('communication_id', r.cid));
      n := n + 1;
    end if;
  end loop;

  for r in
    select c.owner_id who, c.id cid, coalesce(c.updated_at, c.created_at) at
    from public.marketing_campaigns c
    where c.status::text = 'completed' and c.owner_id is not null
  loop
    perform public.ams_ingest_event(r.who, 'campaign.delivered', 'marketing_campaigns', r.cid::text, 1, r.at,
      'backfill', jsonb_build_object('campaign_id', r.cid));
    n := n + 1;
  end loop;

  for r in
    select m.user_id who, t.id tid, t.status::text st, coalesce(t.updated_at, t.created_at) at
    from public.tm_tasks t join public.tm_members m on m.id = t.assigned_to
    where t.status::text in ('completed','approved') and m.user_id is not null
  loop
    perform public.ams_ingest_event(r.who, 'task.' || r.st, 'tm_tasks', r.tid::text, 1, r.at,
      'backfill', jsonb_build_object('task_id', r.tid));
    n := n + 1;
  end loop;

  for r in
    select d.user_id who, t.id tid, coalesce(t.completed_at, t.updated_at) at
    from public.developer_tasks t join public.developers d on d.id = t.developer_id
    where t.status = 'completed' and d.user_id is not null
  loop
    perform public.ams_ingest_event(r.who, 'task.completed', 'developer_tasks', r.tid::text, 1, r.at,
      'backfill', jsonb_build_object('task_id', r.tid, 'ams_role', 'developer'));
    n := n + 1;
  end loop;

  for r in
    select d.user_id who, s.id sid, s.task_id tid, coalesce(s.reviewed_at, s.created_at) at
    from public.developer_code_submissions s join public.developers d on d.id = s.developer_id
    where s.review_status = 'approved' and d.user_id is not null
  loop
    perform public.ams_ingest_event(r.who, 'task.approved', 'developer_code_submissions', r.sid::text, 1, r.at,
      'backfill', jsonb_build_object('submission_id', r.sid, 'task_id', r.tid, 'ams_role', 'developer'));
    n := n + 1;
  end loop;

  for r in
    select public.ams_user_by_email(tm.email) who, t.id tid, coalesce(t.resolved_at, t.updated_at) at
    from public.support_tickets t join public.team_members tm on tm.id = t.assigned_to
    where t.status::text in ('resolved','closed')
  loop
    if r.who is not null then
      perform public.ams_ingest_event(r.who, 'support.resolved', 'support_tickets', r.tid::text, 1, r.at,
        'backfill', jsonb_build_object('ticket_id', r.tid, 'ams_role', 'support'));
      n := n + 1;
    end if;
  end loop;

  for r in
    select t.assignee_id who, t.id tid, coalesce(t.resolved_at, t.updated_at) at
    from public.ams_tickets t
    where t.status::text in ('resolved','closed') and t.assignee_id is not null
  loop
    perform public.ams_ingest_event(r.who, 'support.resolved', 'ams_tickets', r.tid::text, 1, r.at,
      'backfill', jsonb_build_object('ticket_id', r.tid, 'ams_role', 'support'));
    n := n + 1;
  end loop;

  perform set_config('ams.defer_eval', 'off', true);

  for u in select distinct user_id from public.ams_activity_events where processed_at is null loop
    perform public.ams_evaluate_user(u);
    evaluated := evaluated + 1;
  end loop;

  return jsonb_build_object('ok', true, 'events_offered', n, 'users_evaluated', evaluated);
end $function$;

revoke all on function public.ams_backfill() from public, anon, authenticated;
grant execute on function public.ams_backfill() to service_role;

commit;

notify pgrst, 'reload schema';
