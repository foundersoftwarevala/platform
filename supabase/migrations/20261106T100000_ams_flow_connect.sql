-- AMS: the existing engine, connected end to end.
--
-- The engine was complete and had never produced anything: 0 activity events,
-- 0 XP, 0 passports. Four things stood between real platform activity and a
-- person's AMS state, and this fixes those four without adding a second engine,
-- a second catalogue or a second ledger.
--
-- 1. Identity. The hooks passed the wrong ids as the person: a
--    marketplace_sellers id for a seller's sale or product, a lead_agents id
--    for a lead, a tm_members id for a task. ams_ingest_event found no role for
--    those ids and dropped every event. The hooks now resolve the real user.
--
-- 2. Role vocabulary. Platform roles (admin, boss, customer ...) are not AMS
--    roles (administrator, founder, user ...), so an event stamped "admin"
--    matched no rule. ams_role_of() maps the unambiguous ones. marketing, sales,
--    finance and employee have no AMS role yet and are left unmapped - AMS
--    simply does not apply to them until the owner decides.
--
-- 3. Isolation. XP, level, rank and passport were one row per person, and the
--    evaluator took "the role" from the person's latest event, so someone with
--    two roles pooled XP across them. They are now one row per person and role,
--    each role's XP is summed from that role's own ledger lines, and each role
--    is evaluated against its own rules and catalogue. Both tables were empty,
--    so changing their key moves no data.
--
-- 4. Evaluation. Ingest recorded an event and nothing evaluated it: ams_sweep
--    had no scheduler. Ingest now evaluates the person straight away.
--
-- Developer tasks, code-review approvals and resolved support tickets had XP
-- rules and no hook; they get one. SEO activity has rules too, but no SEO table
-- records who did the work, so there is nothing to attribute it to yet.
--
-- ams_backfill() replays the platform's real history through the same path,
-- once, so existing work is recognised. It is callable by the service role only.

begin;

-- ---------------------------------------------------------------- role map
create or replace function public.ams_role_of(p_app_role text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(p_app_role, ''))
    when 'reseller'              then 'reseller'
    when 'vendor'                then 'vendor'
    when 'author'                then 'author'
    when 'affiliate'             then 'affiliate'
    when 'influencer'            then 'influencer'
    when 'franchise'             then 'franchise'
    when 'developer'             then 'developer'
    when 'seo'                   then 'seo'
    when 'support'               then 'support'
    when 'sales_support_manager' then 'support'
    when 'customer'              then 'user'
    when 'user'                  then 'user'
    when 'creator'               then 'creator'
    when 'manager'               then 'manager'
    when 'operator'              then 'operator'
    when 'admin'                 then 'administrator'
    when 'super_admin'           then 'administrator'
    when 'boss'                  then 'founder'
    when 'boss_owner'            then 'founder'
    when 'founder'               then 'founder'
    when 'owner'                 then 'founder'
    else null
  end
$$;

-- The AMS role an event belongs to. A hook that knows the capacity the person
-- acted in (a vendor's sale, a reseller's referral) names it; it is honoured
-- only if the person really holds a platform role that maps to it, so a caller
-- cannot claim a role. Without a hint, the person's specialist role is taken
-- before an operator role, so a developer who is also an admin earns as a
-- developer for development work.
create or replace function public.ams_resolve_role(p_user uuid, p_hint text)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  with held as (
    select distinct public.ams_role_of(r.role::text) as ams_role
    from public.user_roles r
    where r.user_id = p_user
  )
  select coalesce(
    (select h.ams_role from held h where p_hint is not null and h.ams_role = p_hint),
    (select h.ams_role from held h
      where h.ams_role is not null
      order by array_position(array['reseller','vendor','author','affiliate','influencer',
                                    'franchise','developer','seo','support','creator',
                                    'manager','operator','user','administrator','founder'],
                              h.ams_role)
      limit 1)
  )
$$;

create or replace function public.ams_user_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path to 'public', 'auth'
as $$
  select u.id from auth.users u
  where p_email is not null and lower(u.email) = lower(p_email)
  limit 1
$$;

-- ------------------------------------------------------ per-role state keys
alter table public.user_xp add column if not exists role text;
update public.user_xp set role = 'user' where role is null;
alter table public.user_xp alter column role set not null;
alter table public.user_xp drop constraint if exists user_xp_pkey;
alter table public.user_xp add primary key (user_id, role);

alter table public.ams_passports drop constraint if exists ams_passports_pkey;
alter table public.ams_passports alter column role set not null;
alter table public.ams_passports add primary key (user_id, role);

-- ------------------------------------------------------------------ ingest
create or replace function public.ams_ingest_event(
  p_user_id uuid, p_event_key text, p_entity_type text DEFAULT NULL::text,
  p_entity_id text DEFAULT NULL::text, p_value numeric DEFAULT 1,
  p_occurred_at timestamp with time zone DEFAULT now(), p_source text DEFAULT 'system'::text,
  p_payload jsonb DEFAULT '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role text;
  v_key  text;
  v_id   uuid;
begin
  if p_user_id is null or coalesce(p_event_key,'') = '' then
    return jsonb_build_object('ok', false, 'reason', 'user_and_event_required');
  end if;

  -- The AMS role this event belongs to, from the person's own roles.
  v_role := public.ams_resolve_role(p_user_id, nullif(p_payload->>'ams_role', ''));
  if v_role is null then
    -- Not an error: the person holds no role AMS covers yet.
    return jsonb_build_object('ok', false, 'reason', 'no_ams_role');
  end if;

  -- Derived from the occurrence itself, so the same real thing reported twice
  -- lands once. This is what makes re-imports and retried triggers safe.
  v_key := coalesce(p_entity_type,'-') || ':' || coalesce(p_entity_id,'-')
           || ':' || p_event_key || ':' || p_user_id::text;

  insert into public.ams_activity_events
    (user_id, role, event_key, entity_type, entity_id, value,
     occurred_at, source, dedupe_key, payload)
  values
    (p_user_id, v_role, p_event_key, p_entity_type, p_entity_id, coalesce(p_value,1),
     coalesce(p_occurred_at, now()), coalesce(p_source,'system'), v_key,
     coalesce(p_payload,'{}'::jsonb))
  on conflict (dedupe_key) do nothing
  returning id into v_id;

  if v_id is null then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  -- Evaluate now, so recognition follows the activity. A failure here never
  -- undoes the business event that caused it: the event stays unprocessed and
  -- ams_sweep() or ams_recompute() picks it up. A replay defers evaluation and
  -- evaluates each person once at the end.
  if coalesce(current_setting('ams.defer_eval', true), '') <> 'on' then
    begin
      perform public.ams_evaluate_user(p_user_id);
    exception when others then
      raise warning 'AMS evaluation deferred for %: %', p_user_id, sqlerrm;
    end;
  end if;

  return jsonb_build_object('ok', true, 'duplicate', false, 'event_id', v_id, 'role', v_role);
end $function$;

-- --------------------------------------------------------------- evaluator
create or replace function public.ams_evaluate_user(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role      text;
  v_xp_added  bigint := 0;
  v_total     bigint;
  v_stage     int;
  v_prev      int;
  v_unlocked  int;
  v_assets    int;
  v_results   jsonb := '[]'::jsonb;
  ev          record;
  rl          record;
  ach         record;
  v_today     int;
  v_last      timestamptz;
  v_gain      bigint;
  v_base      text;
  v_passport  text;
begin
  -- ---- XP from rules, one unprocessed event at a time -----------------------
  -- Each event carries the AMS role it belongs to; only that role's rules (or
  -- unscoped ones) can pay it.
  for ev in
    select * from public.ams_activity_events
    where user_id = p_user_id and processed_at is null
    order by occurred_at
  loop
    for rl in
      select r.id, r.xp_value, r.multiplier, r.cooldown_seconds, r.max_per_day, r.conditions
      from public.xp_rules r
      join public.xp_sources s on s.id = r.source_id
      where s.slug = ev.event_key
        and coalesce(r.status,'active') = 'active'
        and coalesce(s.status,'active') = 'active'
        and (r.conditions->>'role' is null or r.conditions->>'role' = ev.role)
    loop
      if coalesce(rl.cooldown_seconds,0) > 0 then
        select max(created_at) into v_last
        from public.xp_transactions
        where user_id = p_user_id and rule_id = rl.id;
        if v_last is not null and v_last > ev.occurred_at - make_interval(secs => rl.cooldown_seconds) then
          continue;
        end if;
      end if;

      if coalesce(rl.max_per_day,0) > 0 then
        select count(*) into v_today
        from public.xp_transactions
        where user_id = p_user_id and rule_id = rl.id
          and created_at >= date_trunc('day', ev.occurred_at)
          and created_at <  date_trunc('day', ev.occurred_at) + interval '1 day';
        if v_today >= rl.max_per_day then
          continue;
        end if;
      end if;

      v_gain := floor(coalesce(rl.xp_value,0) * coalesce(rl.multiplier,1))::bigint;
      if v_gain <> 0 then
        insert into public.xp_transactions (user_id, amount, source_id, rule_id, reason, metadata)
        select p_user_id, v_gain, r.source_id, rl.id,
               'ams:' || ev.event_key,
               jsonb_build_object('event_id', ev.id, 'entity', ev.entity_id, 'role', ev.role)
        from public.xp_rules r where r.id = rl.id;

        insert into public.ams_award_ledger
          (user_id, role, event_id, rule_id, asset_kind, xp_awarded, reason)
        values (p_user_id, ev.role, ev.id, rl.id, 'xp', v_gain, 'ams:' || ev.event_key);

        v_xp_added := v_xp_added + v_gain;
      end if;
    end loop;

    update public.ams_activity_events set processed_at = now() where id = ev.id;
  end loop;

  -- ---- Each role the person has activity in, on its own ---------------------
  for v_role in
    select distinct role from public.ams_activity_events
    where user_id = p_user_id and role is not null
  loop
    v_unlocked := 0;
    v_assets := 0;

    -- This role's XP only: the ledger lines paid for this role's events.
    select coalesce(sum(xp_awarded),0) into v_total
    from public.ams_award_ledger
    where user_id = p_user_id and role = v_role and asset_kind = 'xp';

    select coalesce(max(rank_number),1) into v_stage
    from public.ranks where min_xp <= v_total and coalesce(status,'active') = 'active';

    select current_level into v_prev
    from public.user_xp where user_id = p_user_id and role = v_role;

    insert into public.user_xp (user_id, role, total_xp, current_level, current_rank, updated_at)
    values (p_user_id, v_role, v_total, v_stage, v_stage, now())
    on conflict (user_id, role) do update
      set total_xp = excluded.total_xp,
          current_level = excluded.current_level,
          current_rank = excluded.current_rank,
          updated_at = now();

    if v_prev is null or v_stage > v_prev then
      insert into public.ams_award_ledger (user_id, role, asset_kind, asset_slug, reason)
      values (p_user_id, v_role, 'stage', v_role || '-' || lpad(v_stage::text,2,'0'),
              'reached stage ' || v_stage);
    end if;

    -- Achievements of this role whose requirement is now met.
    for ach in
      select a.id, a.slug, a.conditions
      from public.achievements a
      where coalesce(a.status,'active') = 'active'
        and a.conditions->>'role' = v_role
        and not exists (
          select 1 from public.user_achievements ua
          where ua.user_id = p_user_id and ua.achievement_id = a.id
            and ua.unlocked_at is not null)
    loop
      if ach.conditions ? 'stage' then
        if v_stage >= (ach.conditions->>'stage')::int then
          insert into public.user_achievements (user_id, achievement_id, progress, unlocked_at)
          values (p_user_id, ach.id, 100, now())
          on conflict do nothing;
          insert into public.ams_award_ledger (user_id, role, asset_kind, asset_slug, reason)
          values (p_user_id, v_role, 'achievement', ach.slug, 'stage ' || v_stage);
          v_unlocked := v_unlocked + 1;
        end if;
      elsif ach.conditions ? 'event_key' then
        if (select coalesce(sum(value),0) from public.ams_activity_events
            where user_id = p_user_id and role = v_role
              and event_key = ach.conditions->>'event_key')
           >= coalesce((ach.conditions->>'threshold')::numeric, 1)
        then
          insert into public.user_achievements (user_id, achievement_id, progress, unlocked_at)
          values (p_user_id, ach.id, 100, now())
          on conflict do nothing;
          insert into public.ams_award_ledger (user_id, role, asset_kind, asset_slug, reason)
          values (p_user_id, v_role, 'achievement', ach.slug, ach.conditions->>'event_key');
          v_unlocked := v_unlocked + 1;
        end if;
      end if;
    end loop;

    -- This role's stage trophies and badges the person has now reached.
    insert into public.user_trophies (user_id, trophy_id, earned_at)
    select p_user_id, t.id, now()
    from public.trophies t
    where t.conditions->>'role' = v_role
      and (t.conditions->>'stage')::int <= v_stage
      and coalesce(t.status,'active') = 'active'
      and not exists (select 1 from public.user_trophies ut
                      where ut.user_id = p_user_id and ut.trophy_id = t.id)
    on conflict do nothing;
    get diagnostics v_assets = row_count;

    insert into public.user_badges (user_id, badge_id, earned_at)
    select p_user_id, b.id, now()
    from public.badges b
    where b.conditions->>'role' = v_role
      and (b.conditions->>'stage')::int <= v_stage
      and coalesce(b.status,'active') = 'active'
      and not exists (select 1 from public.user_badges ub
                      where ub.user_id = p_user_id and ub.badge_id = b.id)
    on conflict do nothing;

    perform public.ams_issue_awards(p_user_id, v_role, v_stage);

    -- The role's passport. The number is the person's, with the role's code,
    -- so each role a person holds has its own passport.
    v_base := 'SV-AMS-'
      || lpad(((('x' || substr(replace(p_user_id::text,'-',''),1,6))::bit(24)::int) % 10000)::text, 4, '0')
      || '-'
      || lpad(((('x' || substr(replace(p_user_id::text,'-',''),7,6))::bit(24)::int) % 10000)::text, 4, '0');
    v_passport := v_base || '-' || upper(substr(v_role, 1, 3));

    insert into public.ams_passports (user_id, role, passport_no, level, stage, updated_at)
    values (p_user_id, v_role, v_passport, v_stage, v_stage, now())
    on conflict (user_id, role) do update
      set level = excluded.level, stage = excluded.stage, updated_at = now();

    v_results := v_results || jsonb_build_object(
      'role', v_role, 'total_xp', v_total, 'stage', v_stage,
      'achievements_unlocked', v_unlocked, 'trophies_granted', v_assets,
      'passport_no', v_passport);
  end loop;

  if jsonb_array_length(v_results) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_activity');
  end if;
  return jsonb_build_object('ok', true, 'xp_awarded', v_xp_added, 'roles', v_results);
end $function$;

-- ------------------------------------------------------------------- hooks
create or replace function public.ams_on_order_paid()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare r record;
begin
  if new.status::text = 'paid' and coalesce(old.status::text,'') is distinct from 'paid' then
    begin
      -- The seller behind each line, as the vendor or author they are.
      for r in
        select distinct s.owner_user_id as who, s.seller_kind as kind
        from public.marketplace_order_items oi
        join public.marketplace_sellers s on s.id = oi.seller_id
        where oi.order_id = new.id and s.owner_user_id is not null
      loop
        perform public.ams_ingest_event(
          r.who, 'order.paid', 'marketplace_orders', new.id::text, 1,
          coalesce(new.updated_at, now()), 'trigger',
          jsonb_build_object('order_id', new.id, 'as', 'seller', 'ams_role', r.kind));
      end loop;
      -- The reseller the order was credited to.
      for r in
        select distinct rs.user_id as who
        from public.marketplace_order_attributions a
        join public.resellers rs on rs.id = a.reseller_id
        where a.order_id = new.id and rs.user_id is not null
      loop
        perform public.ams_ingest_event(
          r.who, 'order.paid', 'marketplace_orders', new.id::text, 1,
          coalesce(new.updated_at, now()), 'trigger',
          jsonb_build_object('order_id', new.id, 'as', 'reseller', 'ams_role', 'reseller'));
      end loop;
      -- The affiliate the order was attributed to.
      for r in
        select distinct ap.user_id as who
        from public.marketplace_order_attributions a
        join public.marketplace_affiliate_partners ap on ap.id = a.affiliate_partner_id
        where a.order_id = new.id and ap.user_id is not null
      loop
        perform public.ams_ingest_event(
          r.who, 'order.paid', 'marketplace_orders', new.id::text, 1,
          coalesce(new.updated_at, now()), 'trigger',
          jsonb_build_object('order_id', new.id, 'as', 'affiliate', 'ams_role', 'affiliate'));
      end loop;
      -- The influencer the order was attributed to.
      for r in
        select distinct ip.user_id as who
        from public.marketplace_order_attributions a
        join public.influencer_profiles ip on ip.id = a.influencer_profile_id
        where a.order_id = new.id and ip.user_id is not null
      loop
        perform public.ams_ingest_event(
          r.who, 'order.paid', 'marketplace_orders', new.id::text, 1,
          coalesce(new.updated_at, now()), 'trigger',
          jsonb_build_object('order_id', new.id, 'as', 'influencer', 'ams_role', 'influencer'));
      end loop;
    exception when others then
      null;  -- Recognition never blocks a payment.
    end;
  end if;
  return new;
end $function$;

create or replace function public.ams_on_product_published()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_who uuid; v_kind text;
begin
  if new.content_status = 'published'
     and coalesce(old.content_status,'') is distinct from 'published'
     and new.seller_id is not null then
    begin
      select s.owner_user_id, s.seller_kind into v_who, v_kind
      from public.marketplace_sellers s where s.id = new.seller_id;
      if v_who is not null then
        perform public.ams_ingest_event(
          v_who, 'product.published', 'marketplace_products', new.id::text, 1,
          coalesce(new.updated_at, now()), 'trigger',
          jsonb_build_object('product_id', new.id, 'ams_role', v_kind));
      end if;
    exception when others then
      null;
    end;
  end if;
  return new;
end $function$;

create or replace function public.ams_on_lead()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_who uuid;
begin
  if new.assigned_agent_id is null then return new; end if;
  begin
    -- A lead agent is a sales-desk record; the person is found by its email.
    select public.ams_user_by_email(a.email) into v_who
    from public.lead_agents a where a.id = new.assigned_agent_id;
    if v_who is null then return new; end if;

    if tg_op = 'INSERT'
       or old.assigned_agent_id is distinct from new.assigned_agent_id then
      perform public.ams_ingest_event(
        v_who, 'lead.captured', 'leads', new.id::text, 1,
        coalesce(new.created_at, now()), 'trigger', jsonb_build_object('lead_id', new.id));
    end if;
    if new.status::text = 'won'
       and (tg_op = 'INSERT' or coalesce(old.status::text,'') is distinct from 'won') then
      perform public.ams_ingest_event(
        v_who, 'lead.converted', 'leads', new.id::text, 1,
        coalesce(new.updated_at, now()), 'trigger', jsonb_build_object('lead_id', new.id));
    end if;
  exception when others then
    null;
  end;
  return new;
end $function$;

create or replace function public.ams_on_task()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_who uuid;
begin
  if new.assigned_to is null then return new; end if;
  begin
    select m.user_id into v_who from public.tm_members m where m.id = new.assigned_to;
    if v_who is null then return new; end if;
    if new.status::text = 'completed' and coalesce(old.status::text,'') is distinct from 'completed' then
      perform public.ams_ingest_event(
        v_who, 'task.completed', 'tm_tasks', new.id::text, 1,
        coalesce(new.updated_at, now()), 'trigger', jsonb_build_object('task_id', new.id));
    end if;
    if new.status::text = 'approved' and coalesce(old.status::text,'') is distinct from 'approved' then
      perform public.ams_ingest_event(
        v_who, 'task.approved', 'tm_tasks', new.id::text, 1,
        coalesce(new.updated_at, now()), 'trigger', jsonb_build_object('task_id', new.id));
    end if;
  exception when others then
    null;
  end;
  return new;
end $function$;

-- Developer work: a developer task delivered, and a code submission approved
-- in review. Both are the developer's own activity.
create or replace function public.ams_on_developer_task()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_who uuid;
begin
  if new.developer_id is null then return new; end if;
  if new.status = 'completed' and coalesce(old.status,'') is distinct from 'completed' then
    begin
      select d.user_id into v_who from public.developers d where d.id = new.developer_id;
      if v_who is not null then
        perform public.ams_ingest_event(
          v_who, 'task.completed', 'developer_tasks', new.id::text, 1,
          coalesce(new.completed_at, new.updated_at, now()), 'trigger',
          jsonb_build_object('task_id', new.id, 'ams_role', 'developer'));
      end if;
    exception when others then
      null;
    end;
  end if;
  return new;
end $function$;

drop trigger if exists ams_developer_task on public.developer_tasks;
create trigger ams_developer_task
  after update on public.developer_tasks
  for each row execute function public.ams_on_developer_task();

create or replace function public.ams_on_code_review()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_who uuid;
begin
  if new.review_status = 'approved' and coalesce(old.review_status,'') is distinct from 'approved' then
    begin
      select d.user_id into v_who from public.developers d where d.id = new.developer_id;
      if v_who is not null then
        perform public.ams_ingest_event(
          v_who, 'task.approved', 'developer_code_submissions', new.id::text, 1,
          coalesce(new.reviewed_at, now()), 'trigger',
          jsonb_build_object('submission_id', new.id, 'task_id', new.task_id, 'ams_role', 'developer'));
      end if;
    exception when others then
      null;
    end;
  end if;
  return new;
end $function$;

drop trigger if exists ams_code_review on public.developer_code_submissions;
create trigger ams_code_review
  after update on public.developer_code_submissions
  for each row execute function public.ams_on_code_review();

-- Support: a ticket resolved by the person it was assigned to.
create or replace function public.ams_on_support_ticket()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_who uuid;
begin
  if new.status::text in ('resolved','closed')
     and coalesce(old.status::text,'') not in ('resolved','closed')
     and new.assigned_to is not null then
    begin
      select public.ams_user_by_email(tm.email) into v_who
      from public.team_members tm where tm.id = new.assigned_to;
      if v_who is not null then
        perform public.ams_ingest_event(
          v_who, 'support.resolved', 'support_tickets', new.id::text, 1,
          coalesce(new.resolved_at, new.updated_at, now()), 'trigger',
          jsonb_build_object('ticket_id', new.id, 'ams_role', 'support'));
      end if;
    exception when others then
      null;
    end;
  end if;
  return new;
end $function$;

drop trigger if exists ams_support_ticket on public.support_tickets;
create trigger ams_support_ticket
  after update on public.support_tickets
  for each row execute function public.ams_on_support_ticket();

create or replace function public.ams_on_ams_ticket()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.status::text in ('resolved','closed')
     and coalesce(old.status::text,'') not in ('resolved','closed')
     and new.assignee_id is not null then
    begin
      perform public.ams_ingest_event(
        new.assignee_id, 'support.resolved', 'ams_tickets', new.id::text, 1,
        coalesce(new.resolved_at, now()), 'trigger',
        jsonb_build_object('ticket_id', new.id, 'ams_role', 'support'));
    exception when others then
      null;
    end;
  end if;
  return new;
end $function$;

drop trigger if exists ams_ams_ticket on public.ams_tickets;
create trigger ams_ams_ticket
  after update on public.ams_tickets
  for each row execute function public.ams_on_ams_ticket();

-- ------------------------------------------------------------- role chain
-- One role's journey reads that role's XP and that role's passport.
create or replace function public.ams_role_chain(p_role text, p_user_id uuid DEFAULT NULL::uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_target  uuid;
  v_xp      bigint := 0;
  v_stage   int := 0;
  v_chain   jsonb;
begin
  v_target := coalesce(p_user_id, auth.uid());
  if v_target is distinct from auth.uid() and not public.ams_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  if v_target is not null then
    select coalesce(total_xp, 0), coalesce(current_level, 0)
      into v_xp, v_stage
    from public.user_xp where user_id = v_target and role = p_role;
    v_xp := coalesce(v_xp, 0);
    v_stage := coalesce(v_stage, 0);
  end if;

  select jsonb_agg(row_to_json(s)::jsonb order by s.stage) into v_chain
  from (
    select
      st.stage,
      st.title,
      st.tagline,
      st.min_xp,
      (select min_xp from public.ams_role_stages n
        where n.role = st.role and n.stage = st.stage + 1) as next_min_xp,
      case
        when v_target is null then 0
        when v_xp >= coalesce((select min_xp from public.ams_role_stages n
                               where n.role = st.role and n.stage = st.stage + 1),
                              st.min_xp) then 100
        when v_xp <= st.min_xp then 0
        else floor(
          (v_xp - st.min_xp)::numeric * 100
          / nullif((select min_xp from public.ams_role_stages n
                    where n.role = st.role and n.stage = st.stage + 1) - st.min_xp, 0)
        )::int
      end as progress_pct,
      jsonb_build_object(
        'slug',  t.slug,
        'name',  t.name,
        'tier',  t.tier,
        'state', public.ams_asset_state(
                   v_target, v_xp, st.min_xp, st.stage,
                   exists (select 1 from public.user_trophies ut
                           where ut.user_id = v_target and ut.trophy_id = t.id),
                   false)
      ) as trophy,
      jsonb_build_object(
        'slug',  aw.slug,
        'name',  aw.name,
        'rarity', aw.rarity,
        'state', public.ams_asset_state(
                   v_target, v_xp, st.min_xp, st.stage,
                   exists (select 1 from public.user_awards ua
                           where ua.user_id = v_target and ua.award_id = aw.id),
                   exists (select 1 from public.user_awards ua
                           where ua.user_id = v_target and ua.award_id = aw.id
                             and ua.claimed_at is not null))
      ) as award,
      jsonb_build_object(
        'slug',  b.slug,
        'name',  b.name,
        'rarity', b.rarity,
        'state', public.ams_asset_state(
                   v_target, v_xp, st.min_xp, st.stage,
                   exists (select 1 from public.user_badges ub
                           where ub.user_id = v_target and ub.badge_id = b.id),
                   false)
      ) as badge,
      jsonb_build_object(
        'slug',  ac.slug,
        'name',  ac.name,
        'rarity', ac.rarity,
        'state', public.ams_asset_state(
                   v_target, v_xp, st.min_xp, st.stage,
                   exists (select 1 from public.user_achievements ua
                           where ua.user_id = v_target and ua.achievement_id = ac.id
                             and ua.unlocked_at is not null),
                   false)
      ) as achievement,
      jsonb_build_object(
        'rank',  (select name from public.ranks  where rank_number  = st.stage),
        'level', (select name from public.levels where level_number = st.stage)
      ) as standing
    from public.ams_role_stages st
    left join public.trophies     t  on t.conditions->>'role'  = st.role
                                    and (t.conditions->>'stage')::int  = st.stage
    left join public.awards       aw on aw.conditions->>'role' = st.role
                                    and (aw.conditions->>'stage')::int = st.stage
    left join public.badges       b  on b.conditions->>'role'  = st.role
                                    and (b.conditions->>'stage')::int  = st.stage
    left join public.achievements ac on ac.conditions->>'role' = st.role
                                    and (ac.conditions->>'stage')::int = st.stage
    where st.role = p_role
  ) s;

  return jsonb_build_object(
    'ok', true,
    'role', p_role,
    'user_id', v_target,
    'total_xp', v_xp,
    'current_stage', v_stage,
    'passport', (select jsonb_build_object('passport_no', passport_no,
                                           'verification', verification,
                                           'issued_at', issued_at)
                 from public.ams_passports where user_id = v_target and role = p_role),
    'stages', coalesce(v_chain, '[]'::jsonb));
end $function$;

-- --------------------------------------------------------------- backfill
-- Replays the platform's real history through the same hooks' path, once.
-- Every event's dedupe key is the occurrence itself, so running it again
-- records nothing new.
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
    select c.created_by who, c.id cid, c.created_at at
    from public.lead_communications c where c.created_by is not null
  loop
    perform public.ams_ingest_event(r.who, 'lead.contacted', 'lead_communications', r.cid::text, 1, r.at,
      'backfill', jsonb_build_object('communication_id', r.cid));
    n := n + 1;
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
revoke all on function public.ams_resolve_role(uuid, text) from public, anon, authenticated;
revoke all on function public.ams_user_by_email(text) from public, anon, authenticated;
grant execute on function public.ams_role_of(text) to authenticated;

commit;

notify pgrst, 'reload schema';
