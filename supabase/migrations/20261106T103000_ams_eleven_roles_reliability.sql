-- AMS: exactly eleven roles, and processing that is reliable and visible.
--
-- The AMS roles are User, Reseller, Franchise, Author, Vendor, Affiliate,
-- Influencer, Developer, Creator, SEO and Support - no others. AMS Manager is
-- the module that runs them, not a role. ams_role_of() therefore no longer maps
-- admin, boss or any operator role anywhere: AMS does not apply to them.
--
-- Processing:
--  - the dedupe key carries the role, so one occurrence recognised under two
--    roles is two events, and the same occurrence reported twice is still one;
--  - an evaluation that fails leaves its event unprocessed, counts the attempt,
--    keeps the error on the event and writes it to error_events, where the
--    Error Monitor shows it; the scheduled ams_sweep (sv-sweeps.sh, every five
--    minutes) retries it;
--  - a hook that fails no longer discards the failure: it is written to
--    error_events, and the business event it belonged to still succeeds;
--  - one evaluation of a person runs at a time, so a trigger and the sweep can
--    never both pay the same event.
-- No engine, table or scheduler is added: these are the existing ones.

begin;

-- Database-side failures, beside the application's own in the Error Monitor.
alter table public.error_events drop constraint if exists error_events_source_check;
alter table public.error_events add constraint error_events_source_check
  check (source = any (array['server_fn'::text, 'client'::text, 'ssr'::text, 'db_trigger'::text]));

create or replace function public.ams_record_failure(p_context text, p_error text, p_meta jsonb DEFAULT '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.error_events (source, severity, fingerprint, message, fn_name, metadata)
  values ('db_trigger', 'error', md5('ams:' || coalesce(p_context,'') || ':' || coalesce(p_error,'')),
          left(coalesce(p_error, 'unknown error'), 1000), p_context, coalesce(p_meta, '{}'::jsonb));
exception when others then
  -- Recording a failure must never become a failure of its own.
  raise warning 'AMS failure not recorded (%): %', p_context, p_error;
end $function$;
revoke all on function public.ams_record_failure(text, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------- eleven roles
create or replace function public.ams_role_of(p_app_role text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(p_app_role, ''))
    when 'reseller'              then 'reseller'
    when 'franchise'             then 'franchise'
    when 'author'                then 'author'
    when 'vendor'                then 'vendor'
    when 'affiliate'             then 'affiliate'
    when 'influencer'            then 'influencer'
    when 'developer'             then 'developer'
    when 'creator'               then 'creator'
    when 'seo'                   then 'seo'
    when 'support'               then 'support'
    when 'sales_support_manager' then 'support'
    when 'customer'              then 'user'
    when 'user'                  then 'user'
    else null
  end
$$;

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
                                    'franchise','developer','seo','support','creator','user'],
                              h.ams_role)
      limit 1)
  )
$$;
revoke all on function public.ams_resolve_role(uuid, text) from public, anon, authenticated;

-- ------------------------------------------------ event processing state
alter table public.ams_activity_events add column if not exists attempts integer not null default 0;
alter table public.ams_activity_events add column if not exists last_error text;
alter table public.ams_activity_events add column if not exists last_attempt_at timestamptz;

-- The one event recorded before the role joined the key gets the new form.
-- The append-only guard is lifted for this statement alone and restored.
alter table public.ams_activity_events disable trigger ams_events_no_rewrite;
update public.ams_activity_events
   set dedupe_key = dedupe_key || ':' || role
 where dedupe_key not like '%:' || role;
alter table public.ams_activity_events enable trigger ams_events_no_rewrite;

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
  -- An event that names the capacity the person acted in belongs to that role
  -- or to none: it is never re-filed under another role the person holds.
  if nullif(p_payload->>'ams_role', '') is not null and v_role is distinct from p_payload->>'ams_role' then
    return jsonb_build_object('ok', false, 'reason', 'role_not_held');
  end if;
  if v_role is null then
    -- Not an error: the person holds no role AMS covers yet.
    return jsonb_build_object('ok', false, 'reason', 'no_ams_role');
  end if;

  -- The occurrence, the person and the role: the same real thing reported
  -- twice lands once, and the same thing recognised under two roles is two.
  v_key := coalesce(p_entity_type,'-') || ':' || coalesce(p_entity_id,'-')
           || ':' || p_event_key || ':' || p_user_id::text || ':' || v_role;

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
      -- The event stays unprocessed for the sweep to retry, and the failure is
      -- written down where it can be seen.
      update public.ams_activity_events
         set attempts = attempts + 1, last_error = left(sqlerrm, 500), last_attempt_at = now()
       where id = v_id;
      perform public.ams_record_failure('ams_evaluate_user', sqlerrm,
        jsonb_build_object('user_id', p_user_id, 'event_id', v_id, 'event_key', p_event_key));
    end;
  end if;

  return jsonb_build_object('ok', true, 'duplicate', false, 'event_id', v_id, 'role', v_role);
end $function$;

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
  -- One evaluation of a person at a time. A trigger and the sweep, or two
  -- sweeps, reaching the same person wait for each other rather than both
  -- paying the same unprocessed event.
  perform pg_advisory_xact_lock(hashtextextended('ams:' || p_user_id::text, 0));

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

-- The scheduled sweep: every person with an unprocessed event, each on their
-- own, so one person's failure neither stops the others nor goes unseen.
create or replace function public.ams_sweep()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare u uuid; n int := 0; failed int := 0;
begin
  for u in
    select user_id from public.ams_activity_events
    where processed_at is null
    group by user_id
    order by min(occurred_at)
    limit 500
  loop
    begin
      perform public.ams_evaluate_user(u);
      n := n + 1;
    exception when others then
      failed := failed + 1;
      update public.ams_activity_events
         set attempts = attempts + 1, last_error = left(sqlerrm, 500), last_attempt_at = now()
       where user_id = u and processed_at is null;
      perform public.ams_record_failure('ams_sweep', sqlerrm, jsonb_build_object('user_id', u));
    end;
  end loop;
  return jsonb_build_object('ok', true, 'users_evaluated', n, 'users_failed', failed,
    'pending_events', (select count(*) from public.ams_activity_events where processed_at is null));
end $function$;

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
      -- Recognition never blocks the business event; the failure is recorded.
      perform public.ams_record_failure('ams_on_order_paid', sqlerrm,
        jsonb_build_object('table', tg_table_name, 'id', new.id));
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
      -- Recognition never blocks the business event; the failure is recorded.
      perform public.ams_record_failure('ams_on_product_published', sqlerrm,
        jsonb_build_object('table', tg_table_name, 'id', new.id));
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
      -- Recognition never blocks the business event; the failure is recorded.
      perform public.ams_record_failure('ams_on_lead', sqlerrm,
        jsonb_build_object('table', tg_table_name, 'id', new.id));
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
      -- Recognition never blocks the business event; the failure is recorded.
      perform public.ams_record_failure('ams_on_task', sqlerrm,
        jsonb_build_object('table', tg_table_name, 'id', new.id));
  end;
  return new;
end $function$;

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
      -- Recognition never blocks the business event; the failure is recorded.
      perform public.ams_record_failure('ams_on_developer_task', sqlerrm,
        jsonb_build_object('table', tg_table_name, 'id', new.id));
    end;
  end if;
  return new;
end $function$;

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
      -- Recognition never blocks the business event; the failure is recorded.
      perform public.ams_record_failure('ams_on_code_review', sqlerrm,
        jsonb_build_object('table', tg_table_name, 'id', new.id));
    end;
  end if;
  return new;
end $function$;

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
      -- Recognition never blocks the business event; the failure is recorded.
      perform public.ams_record_failure('ams_on_support_ticket', sqlerrm,
        jsonb_build_object('table', tg_table_name, 'id', new.id));
    end;
  end if;
  return new;
end $function$;

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
      -- Recognition never blocks the business event; the failure is recorded.
      perform public.ams_record_failure('ams_on_ams_ticket', sqlerrm,
        jsonb_build_object('table', tg_table_name, 'id', new.id));
    end;
  end if;
  return new;
end $function$;

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
    exception when others then
      -- Recognition never blocks the business event; the failure is recorded.
      perform public.ams_record_failure('ams_on_lead_contact', sqlerrm,
        jsonb_build_object('table', tg_table_name, 'id', new.id));
    end;
  end if;
  return new;
end $function$;

create or replace function public.ams_on_campaign()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.status::text = 'completed' and coalesce(old.status::text,'') is distinct from 'completed'
     and new.owner_id is not null then
    begin
      perform public.ams_ingest_event(
        new.owner_id, 'campaign.delivered', 'marketing_campaigns', new.id::text, 1,
        now(), 'trigger', '{}'::jsonb);
    exception when others then
      -- Recognition never blocks the business event; the failure is recorded.
      perform public.ams_record_failure('ams_on_campaign', sqlerrm,
        jsonb_build_object('table', tg_table_name, 'id', new.id));
    end;
  end if;
  return new;
end $function$;

commit;

notify pgrst, 'reload schema';
