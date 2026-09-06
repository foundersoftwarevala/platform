-- AMS engine functions: ingestion and evaluation.
--
-- Ingestion records that something real happened. Evaluation turns recorded
-- activity into XP, achievements, assets, stage and rank. They are separate on
-- purpose: reporting an event is cheap and happens inline with platform work,
-- while evaluation is idempotent and can be re-run without paying twice.

-- ---------------------------------------------------------------------------
-- Ingestion — the only door in.
-- ---------------------------------------------------------------------------

create or replace function public.ams_ingest_event(
  p_user_id     uuid,
  p_event_key   text,
  p_entity_type text default null,
  p_entity_id   text default null,
  p_value       numeric default 1,
  p_occurred_at timestamptz default now(),
  p_source      text default 'system',
  p_payload     jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_role text;
  v_key  text;
  v_id   uuid;
begin
  if p_user_id is null or coalesce(p_event_key,'') = '' then
    return jsonb_build_object('ok', false, 'reason', 'user_and_event_required');
  end if;

  -- The person's role decides which rules can apply. Taken from user_roles
  -- rather than from the caller, so a caller cannot claim a role.
  select r.role::text into v_role
  from public.user_roles r
  where r.user_id = p_user_id
  order by case r.role::text
             when 'boss' then 0 when 'admin' then 1 else 2 end
  limit 1;

  if v_role is null then
    -- Not an error: plenty of accounts hold no role, and AMS simply does not
    -- apply to them yet. Saying so is more useful than failing.
    return jsonb_build_object('ok', false, 'reason', 'no_role');
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
  return jsonb_build_object('ok', true, 'duplicate', false, 'event_id', v_id);
end $$;

-- Nobody signed in may call this. Only the service role, which bypasses grants,
-- and therefore only server code. A page cannot report its own activity.
revoke all on function public.ams_ingest_event(uuid,text,text,text,numeric,timestamptz,text,jsonb) from public;
revoke all on function public.ams_ingest_event(uuid,text,text,text,numeric,timestamptz,text,jsonb) from authenticated;
revoke all on function public.ams_ingest_event(uuid,text,text,text,numeric,timestamptz,text,jsonb) from anon;

-- ---------------------------------------------------------------------------
-- Evaluation — activity becomes standing.
-- ---------------------------------------------------------------------------

create or replace function public.ams_evaluate_user(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_role      text;
  v_xp_added  bigint := 0;
  v_unlocked  int := 0;
  v_assets    int := 0;
  v_total     bigint;
  v_stage     int;
  v_rank      int;
  v_prev      int;
  ev          record;
  rl          record;
  ach         record;
  v_today     int;
  v_last      timestamptz;
  v_gain      bigint;
  v_passport  text;
begin
  select role into v_role from public.ams_activity_events
  where user_id = p_user_id order by occurred_at desc limit 1;
  if v_role is null then
    select r.role::text into v_role from public.user_roles r where r.user_id = p_user_id limit 1;
  end if;
  if v_role is null then
    return jsonb_build_object('ok', false, 'reason', 'no_role');
  end if;

  -- ---- XP from rules, one unprocessed event at a time -----------------------
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
        -- A rule may be scoped to a role; an unscoped rule applies to all.
        and (r.conditions->>'role' is null or r.conditions->>'role' = ev.role)
    loop
      -- Cooldown: has this rule paid this person too recently?
      if coalesce(rl.cooldown_seconds,0) > 0 then
        select max(created_at) into v_last
        from public.xp_transactions
        where user_id = p_user_id and rule_id = rl.id;
        if v_last is not null and v_last > ev.occurred_at - make_interval(secs => rl.cooldown_seconds) then
          continue;
        end if;
      end if;

      -- Daily ceiling, counted against the day the event belongs to.
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
               jsonb_build_object('event_id', ev.id, 'entity', ev.entity_id)
        from public.xp_rules r where r.id = rl.id;

        insert into public.ams_award_ledger
          (user_id, role, event_id, rule_id, asset_kind, xp_awarded, reason)
        values (p_user_id, ev.role, ev.id, rl.id, 'xp', v_gain, 'ams:' || ev.event_key);

        v_xp_added := v_xp_added + v_gain;
      end if;
    end loop;

    update public.ams_activity_events set processed_at = now() where id = ev.id;
  end loop;

  -- ---- Totals, stage and rank ----------------------------------------------
  select coalesce(sum(amount),0) into v_total from public.xp_transactions where user_id = p_user_id;

  select coalesce(max(rank_number),1) into v_rank
  from public.ranks where min_xp <= v_total and coalesce(status,'active') = 'active';
  v_stage := v_rank;

  select current_level into v_prev from public.user_xp where user_id = p_user_id;

  insert into public.user_xp (user_id, total_xp, current_level, current_rank, updated_at)
  values (p_user_id, v_total, v_stage, v_rank, now())
  on conflict (user_id) do update
    set total_xp = excluded.total_xp,
        current_level = excluded.current_level,
        current_rank = excluded.current_rank,
        updated_at = now();

  if v_prev is null or v_stage > v_prev then
    insert into public.ams_award_ledger (user_id, role, asset_kind, asset_slug, reason)
    values (p_user_id, v_role, 'stage', v_role || '-' || lpad(v_stage::text,2,'0'),
            'reached stage ' || v_stage);
  end if;

  -- ---- Achievements whose requirement is now met ---------------------------
  -- Convention: conditions carries {"role":…, "event_key":…, "threshold":N} to
  -- count activity, or {"role":…, "stage":N} to follow progression.
  for ach in
    select a.id, a.slug, a.name, a.xp_reward, a.conditions
    from public.achievements a
    where coalesce(a.status,'active') = 'active'
      and (a.conditions->>'role' is null or a.conditions->>'role' = v_role)
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
          where user_id = p_user_id and event_key = ach.conditions->>'event_key')
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

  -- ---- Stage trophies and badges the person has now reached -----------------
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

  -- ---- Passport keeps up with the person -----------------------------------
  v_passport := 'SV-AMS-'
    || lpad(((('x' || substr(replace(p_user_id::text,'-',''),1,6))::bit(24)::int) % 10000)::text, 4, '0')
    || '-'
    || lpad(((('x' || substr(replace(p_user_id::text,'-',''),7,6))::bit(24)::int) % 10000)::text, 4, '0');

  insert into public.ams_passports (user_id, role, passport_no, level, stage, updated_at)
  values (p_user_id, v_role, v_passport, v_stage, v_stage, now())
  on conflict (user_id) do update
    set level = excluded.level, stage = excluded.stage,
        role = excluded.role, updated_at = now();

  return jsonb_build_object(
    'ok', true, 'role', v_role, 'xp_awarded', v_xp_added,
    'total_xp', v_total, 'stage', v_stage, 'rank', v_rank,
    'achievements_unlocked', v_unlocked, 'trophies_granted', v_assets);
end $$;

-- Server-side only, including for signed-in people. Leaving this callable by
-- `authenticated` was a real hole caught by the test suite: evaluation takes a
-- user id, so anyone could have run it against *another* person and read back
-- their role, XP and stage in the result. The operator path is ams_recompute,
-- which checks ams_is_operator() first.
revoke all on function public.ams_evaluate_user(uuid) from public;
revoke all on function public.ams_evaluate_user(uuid) from anon;
revoke all on function public.ams_evaluate_user(uuid) from authenticated;

-- An operator may recompute a person; a person may not recompute themselves
-- into a higher standing, because evaluation only ever reads recorded events.
create or replace function public.ams_recompute(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.ams_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  return public.ams_evaluate_user(p_user_id);
end $$;

grant execute on function public.ams_recompute(uuid) to authenticated;

-- The sweep the cron runs: everyone with activity waiting to be counted.
create or replace function public.ams_sweep()
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid; n int := 0;
begin
  for u in
    select distinct user_id from public.ams_activity_events where processed_at is null limit 500
  loop
    perform public.ams_evaluate_user(u);
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'users_evaluated', n);
end $$;

revoke all on function public.ams_sweep() from public;
revoke all on function public.ams_sweep() from anon;
revoke all on function public.ams_sweep() from authenticated;
