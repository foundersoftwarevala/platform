-- Platform access hardening (fresh forensic scan of sv_platform, 2026-10-03).
--
-- Every change below closes a path proven in a rolled-back transaction with a
-- real customer account, and keeps each screen that legitimately uses the
-- object working (callers traced in src/ first):
--
--  1. marketplace_reviews: a customer inserted a review already 'published',
--     marked moderated by themselves, on another buyer's order item; and could
--     publish their own review by update. A buyer now submits a 'pending'
--     review on their own purchase; status, moderation, publication, the
--     seller's response and the counters stay with Marketplace operators.
--  2. seo_leads, seo_inbox_messages, seo_social_comments, seo_email_campaigns,
--     seo_activity_log were readable by every signed-in user (lead e-mail and
--     phone, inbox, activity). They are read by the SEO console (operators,
--     seo, marketing: mm_is_operator) and Lead Manager (sales, support,
--     sales_support_manager: is_support_staff) - those keep access.
--  3. affiliate_dashboard_stats / affiliate_top returned every partner's
--     revenue to any signed-in user. They serve /affiliate-manager, whose gate
--     admits finance, support, sales_support_manager and the operators.
--  4. log_safe_assist_ai_event / verify_safe_assist_connection acted on any
--     session id: a customer raised another session's risk score (and could
--     terminate it) and wrote codes into it. The caller must now be the
--     session's user, its support agent, or support staff.
--  5. mm_ai_usage_record let any signed-in user inject AI cost rows
--     (99,999 USD in the test). Its only caller is mm_ai_generation_finish
--     (SECURITY DEFINER), so EXECUTE is revoked from users.
--  6. demo_escalations / demo_validation_logs: USING/WITH CHECK (true) for
--     every signed-in user, including UPDATE and DELETE. The demo screens
--     admit developers and operators; those keep access.
--  7. bot_conversation_logs, bot_training_documents, canned_responses were
--     readable by every signed-in user (chat transcripts). Support staff and
--     operators keep access.
--  8. Audit trails: assist_audit_logs, assist_emergency_stops, legal_logs,
--     marketing_audit_logs and promise_audit_logs accepted any actor id from
--     the client. The acting user's id is now stamped from the session on
--     every direct insert (functions running as their owner are unaffected).
--     franchise_audit_logs (written only by the server) accepts inserts from
--     franchise staff only.
--  9. Read-only operational functions callable by anonymous visitors, none of
--     which a public page or a policy uses, are no longer callable by anon.
-- 10. 38 "console read/write" policies granted anon full access on CRM, chat,
--     support, sales and team tables; the restrictive anon_write_denied policy
--     cancelled them, but one dropped policy away from exposure. Dropped.
-- 11. mm_publish_readiness had RLS off (no grants, nothing exposed); enabled
--     to match every other table.

-- 0 ---------------------------------------------------------------------------
-- Inside a SECURITY DEFINER function current_user is the owner, so the caller
-- is read from the request: the service key (role service_role) or no JWT at
-- all (a direct server connection or a scheduled job) is trusted; a browser's
-- anon or authenticated token is not.
create or replace function public.request_is_trusted()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(
    nullif((nullif(current_setting('request.jwt.claims', true), '')::jsonb) ->> 'role', ''),
    'none'
  ) in ('service_role', 'none');
$$;

-- 1 ---------------------------------------------------------------------------
alter policy marketplace_reviews_owner_write on public.marketplace_reviews
  with check (
    buyer_id = auth.uid()
    and status = 'pending'
    and moderated_by is null and moderated_at is null and published_at is null
    and seller_response is null
    and coalesce(helpful_count, 0) = 0 and coalesce(report_count, 0) = 0
    and (
      order_item_id is null
      or exists (
        select 1
          from public.marketplace_order_items oi
          join public.marketplace_orders o on o.id = oi.order_id
         where oi.id = marketplace_reviews.order_item_id
           and o.buyer_id = auth.uid()
      )
    )
  );

create or replace function public.marketplace_reviews_guard_buyer_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon')
     or public.mm_is_operator() or public.marketplace_is_admin() then
    return new;
  end if;
  if (new.status, new.moderated_by, new.moderated_at, new.moderation_note, new.published_at,
      new.seller_response, new.helpful_count, new.report_count, new.buyer_id, new.product_id,
      new.order_item_id)
     is distinct from
     (old.status, old.moderated_by, old.moderated_at, old.moderation_note, old.published_at,
      old.seller_response, old.helpful_count, old.report_count, old.buyer_id, old.product_id,
      old.order_item_id) then
    raise exception 'A review is published, hidden or answered by the marketplace, not by its author'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists marketplace_reviews_guard_buyer_update on public.marketplace_reviews;
create trigger marketplace_reviews_guard_buyer_update
  before update on public.marketplace_reviews
  for each row execute function public.marketplace_reviews_guard_buyer_update();

-- 2 ---------------------------------------------------------------------------
alter policy "Public read seo_leads" on public.seo_leads
  to authenticated using (public.mm_is_operator() or public.is_support_staff(auth.uid()));
alter policy "Public read seo_inbox_messages" on public.seo_inbox_messages
  to authenticated using (public.mm_is_operator() or public.is_support_staff(auth.uid()));
alter policy "Public read seo_social_comments" on public.seo_social_comments
  to authenticated using (public.mm_is_operator() or public.is_support_staff(auth.uid()));
alter policy "Public read seo_email_campaigns" on public.seo_email_campaigns
  to authenticated using (public.mm_is_operator() or public.is_support_staff(auth.uid()));
alter policy "SEO activity is readable" on public.seo_activity_log
  to authenticated using (public.mm_is_operator() or public.is_support_staff(auth.uid()));

-- 3 ---------------------------------------------------------------------------
create or replace function public.affiliate_manager_viewer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
     where user_id = auth.uid()
       and role::text in ('admin', 'boss', 'boss_owner', 'super_admin', 'founder', 'owner',
                          'finance', 'support', 'sales_support_manager')
  );
$$;
revoke execute on function public.affiliate_manager_viewer() from public, anon;
grant execute on function public.affiliate_manager_viewer() to authenticated, service_role;

create or replace function public.affiliate_dashboard_stats()
returns json
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_result json;
begin
  if not public.request_is_trusted() and not public.affiliate_manager_viewer() then
    raise exception 'Affiliate Manager access required' using errcode = '42501';
  end if;
  with partners as (
    select * from public.marketplace_affiliate_partners
  ),
  attributed as (
    select a.*, o.total, o.currency, o.status as order_status, o.created_at as ordered_at
      from public.marketplace_order_attributions a
      left join public.marketplace_orders o on o.id = a.order_id
     where a.affiliate_partner_id is not null
  ),
  recent as (
    select * from attributed where ordered_at >= now() - interval '30 days'
  )
  select json_build_object(
    'affiliates_total', (select count(*) from partners),
    'affiliates_verified', (select count(*) from partners where status in ('active','verified','approved')),
    'affiliates_pending', (select count(*) from partners where status = 'pending'),
    'affiliates_suspended', (select count(*) from partners where status in ('suspended','blocked')),
    -- A partner's country is not recorded on this table yet.
    'countries', 0,
    'links_total', (select count(*) from public.marketplace_order_attributions where referral_code_id is not null),
    -- No campaigns table exists on this database.
    'campaigns_active', 0,
    'leads_30d', (select count(distinct session_id) from recent where session_id is not null),
    'customers_30d', (select count(distinct order_id) from recent),
    'sales_30d', (select count(*) from recent where order_status = 'paid'),
    'revenue_cents_30d', (
      select coalesce(round(sum(coalesce(total, 0)) * 100)::bigint, 0)
        from recent where order_status = 'paid'
    ),
    -- Affiliate commission, wallet and payouts have no tables here yet.
    'commission_approved_cents', 0,
    'wallet_balance_cents', 0,
    'payouts_pending_cents', 0
  ) into v_result;
  return v_result;
end;
$function$;

create or replace function public.affiliate_top(_limit integer default 5)
returns table(id uuid, display_name text, country text, status text, revenue_cents bigint, commission_cents bigint, conversions bigint)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.request_is_trusted() and not public.affiliate_manager_viewer() then
    raise exception 'Affiliate Manager access required' using errcode = '42501';
  end if;
  return query
  select
    p.id,
    p.display_name,
    null::text as country,
    p.status::text,
    coalesce(round(sum(case when o.status = 'paid' then o.total else 0 end) * 100)::bigint, 0) as revenue_cents,
    0::bigint as commission_cents,
    count(a.id)::bigint as conversions
  from public.marketplace_affiliate_partners p
  left join public.marketplace_order_attributions a on a.affiliate_partner_id = p.id
  left join public.marketplace_orders o on o.id = a.order_id
  group by p.id, p.display_name, p.status
  order by revenue_cents desc, conversions desc
  limit greatest(coalesce(_limit, 5), 1);
end;
$function$;

-- 4 ---------------------------------------------------------------------------
create or replace function public.log_safe_assist_ai_event(p_session_id uuid, p_event_type character varying, p_risk_level character varying, p_analysis jsonb, p_recommended_action character varying, p_auto_handle boolean default false)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_log_id uuid;
  v_session record;
begin
  select * into v_session from public.safe_assist_sessions where id = p_session_id;
  if not found then
    raise exception 'Session not found';
  end if;
  -- Only a party to the session (its user or support agent) or support staff
  -- may record events on it.
  if not public.request_is_trusted()
     and auth.uid() is distinct from v_session.user_id
     and auth.uid() is distinct from v_session.support_agent_id
     and not public.is_support_staff(auth.uid()) then
    raise exception 'Not a party to this session' using errcode = '42501';
  end if;

  insert into public.safe_assist_ai_logs (session_id, event_type, risk_level, ai_analysis, action_recommended, auto_handled)
  values (p_session_id, p_event_type, p_risk_level, p_analysis, p_recommended_action, p_auto_handle)
  returning id into v_log_id;

  update public.safe_assist_sessions
     set ai_risk_score = ai_risk_score + case
           when p_risk_level = 'critical' then 50
           when p_risk_level = 'high' then 30
           when p_risk_level = 'medium' then 15
           else 5 end,
         ai_flags = ai_flags || jsonb_build_array(jsonb_build_object('type', p_event_type, 'risk', p_risk_level, 'time', now()))
   where id = p_session_id;

  if p_risk_level = 'critical' and p_auto_handle then
    update public.safe_assist_sessions set status = 'terminated', ended_at = now() where id = p_session_id;
    insert into public.safe_assist_notifications (session_id, user_id, notification_type, title, message, severity)
    values (p_session_id, v_session.user_id, 'session_terminated', 'Safe Assist Terminated',
            'Session was automatically terminated due to security concerns. Our team will contact you.', 'error');
  elsif p_risk_level in ('high','critical') then
    insert into public.safe_assist_notifications (session_id, user_id, notification_type, title, message, severity)
    values (p_session_id, v_session.user_id, 'security_alert', 'Security Alert',
            'Unusual activity detected. AI is monitoring closely. Click to review.', 'warning');
  end if;

  return v_log_id;
end;
$function$;

create or replace function public.verify_safe_assist_connection(p_session_id uuid, p_user_code character varying, p_agent_code character varying, p_is_agent boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_session record;
begin
  select * into v_session from public.safe_assist_sessions where id = p_session_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Session not found');
  end if;
  -- Each side enters its own code: the agent (or support staff) the user's
  -- code, the session's user the agent's code.
  if not public.request_is_trusted() then
    if p_is_agent then
      if auth.uid() is distinct from v_session.support_agent_id
         and not public.is_support_staff(auth.uid()) then
        raise exception 'Only the session''s support agent can enter the user''s code' using errcode = '42501';
      end if;
    elsif auth.uid() is distinct from v_session.user_id then
      raise exception 'Only the session''s user can enter the agent''s code' using errcode = '42501';
    end if;
  end if;

  if p_is_agent then
    update public.safe_assist_sessions set agent_entered_user_code = p_user_code where id = p_session_id;
  else
    update public.safe_assist_sessions set user_entered_agent_code = p_agent_code where id = p_session_id;
  end if;

  select * into v_session from public.safe_assist_sessions where id = p_session_id;

  if v_session.user_entered_agent_code is not null and v_session.agent_entered_user_code is not null then
    if upper(v_session.user_entered_agent_code) <> upper(coalesce(v_session.agent_verification_code, ''))
       or upper(v_session.agent_entered_user_code) <> upper(coalesce(v_session.user_verification_code, '')) then
      return jsonb_build_object('success', false, 'error', 'Verification codes do not match');
    end if;

    update public.safe_assist_sessions set dual_verified = true, status = 'connected' where id = p_session_id;

    insert into public.safe_assist_notifications (session_id, user_id, notification_type, title, message, severity)
    values (p_session_id, v_session.user_id, 'session_connected', 'Safe Assist Connected',
            'Support agent has connected to your session. All actions are monitored by AI.', 'info');

    return jsonb_build_object('success', true, 'message', 'Connection verified');
  end if;

  return jsonb_build_object('success', true, 'message', 'Code entered, waiting for other party');
end;
$function$;

-- 5 ---------------------------------------------------------------------------
revoke execute on function public.mm_ai_usage_record(text, text, text, jsonb) from public, anon, authenticated;

-- 6 ---------------------------------------------------------------------------
create or replace function public.demo_workspace_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.mm_is_operator() or exists (
    select 1 from public.user_roles where user_id = auth.uid() and role::text = 'developer'
  );
$$;
revoke execute on function public.demo_workspace_member() from public, anon;
grant execute on function public.demo_workspace_member() to authenticated, service_role;

alter policy "operators raise demo escalations" on public.demo_escalations
  with check (public.demo_workspace_member());
alter policy "operators read demo escalations" on public.demo_escalations
  using (public.demo_workspace_member());
alter policy "operators resolve demo escalations" on public.demo_escalations
  using (public.demo_workspace_member()) with check (public.demo_workspace_member());
alter policy "operators clear demo validations" on public.demo_validation_logs
  using (public.demo_workspace_member());
alter policy "operators read demo validations" on public.demo_validation_logs
  using (public.demo_workspace_member());
alter policy "operators write demo validations" on public.demo_validation_logs
  with check (public.demo_workspace_member());

-- 7 ---------------------------------------------------------------------------
alter policy "read bot_conversation_logs" on public.bot_conversation_logs
  using (public.is_support_staff(auth.uid()) or public.marketplace_is_admin());
alter policy "read bot_training_documents" on public.bot_training_documents
  using (public.is_support_staff(auth.uid()) or public.marketplace_is_admin());
alter policy "read canned_responses" on public.canned_responses
  using (public.is_support_staff(auth.uid()) or public.marketplace_is_admin());

-- 8 ---------------------------------------------------------------------------
create or replace function public.audit_stamp_actor()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- A signed-in user writing an audit row directly is recorded as who they
  -- are, whatever the row claimed. Owner-run functions and the service key
  -- keep the actor they set.
  if current_user in ('authenticated', 'anon') then
    case tg_argv[0]
      when 'actor_user_id' then new.actor_user_id := auth.uid();
      when 'stopped_by_user_id' then new.stopped_by_user_id := auth.uid();
      when 'actor_id' then new.actor_id := auth.uid();
    end case;
  end if;
  return new;
end;
$$;

drop trigger if exists assist_audit_logs_stamp_actor on public.assist_audit_logs;
create trigger assist_audit_logs_stamp_actor before insert on public.assist_audit_logs
  for each row execute function public.audit_stamp_actor('actor_user_id');
drop trigger if exists assist_emergency_stops_stamp_actor on public.assist_emergency_stops;
create trigger assist_emergency_stops_stamp_actor before insert on public.assist_emergency_stops
  for each row execute function public.audit_stamp_actor('stopped_by_user_id');
drop trigger if exists legal_logs_stamp_actor on public.legal_logs;
create trigger legal_logs_stamp_actor before insert on public.legal_logs
  for each row execute function public.audit_stamp_actor('actor_user_id');
drop trigger if exists marketing_audit_logs_stamp_actor on public.marketing_audit_logs;
create trigger marketing_audit_logs_stamp_actor before insert on public.marketing_audit_logs
  for each row execute function public.audit_stamp_actor('actor_id');
drop trigger if exists promise_audit_logs_stamp_actor on public.promise_audit_logs;
create trigger promise_audit_logs_stamp_actor before insert on public.promise_audit_logs
  for each row execute function public.audit_stamp_actor('actor_user_id');

alter policy franchise_audit_authenticated_write on public.franchise_audit_logs
  with check (public.is_franchise_staff());

-- 9 ---------------------------------------------------------------------------
-- Anonymous visitors inherit EXECUTE through PUBLIC, so PUBLIC is revoked as
-- well and the callers (signed-in users and the service key) are granted it.
revoke execute on function public.author_payments_due from public, anon;
grant execute on function public.author_payments_due to authenticated, service_role;
revoke execute on function public.mm_demo_ops from public, anon;
grant execute on function public.mm_demo_ops to authenticated, service_role;
revoke execute on function public.mm_demo_health from public, anon;
grant execute on function public.mm_demo_health to authenticated, service_role;
revoke execute on function public.mm_demo_batches from public, anon;
grant execute on function public.mm_demo_batches to authenticated, service_role;
revoke execute on function public.mm_demo_click_analytics from public, anon;
grant execute on function public.mm_demo_click_analytics to authenticated, service_role;
revoke execute on function public.mm_seo_audit_snapshot from public, anon;
grant execute on function public.mm_seo_audit_snapshot to authenticated, service_role;
revoke execute on function public.seo_report_summary from public, anon;
grant execute on function public.seo_report_summary to authenticated, service_role;

-- 10 --------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select tablename, policyname from pg_policies
     where schemaname = 'public' and roles::text = '{anon}'
       and (policyname like 'console read %' or policyname like 'console write %')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- 11 --------------------------------------------------------------------------
alter table public.mm_publish_readiness enable row level security;
