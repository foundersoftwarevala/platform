-- AMS: every XP transaction names the role it was earned in.
--
-- XP is kept per person and role, and the ledger already carried the role; the
-- XP transactions carried it only inside metadata. It is now a column, written
-- by the evaluator from the event it pays for, so historical XP always keeps
-- the role it was earned under and no reader has to infer it. The table is
-- empty, so nothing needs filling in.

begin;

alter table public.xp_transactions add column if not exists role text;
create index if not exists xp_transactions_user_role_idx on public.xp_transactions (user_id, role);

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
        insert into public.xp_transactions (user_id, role, amount, source_id, rule_id, reason, metadata)
        select p_user_id, ev.role, v_gain, r.source_id, rl.id,
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

commit;

notify pgrst, 'reload schema';
