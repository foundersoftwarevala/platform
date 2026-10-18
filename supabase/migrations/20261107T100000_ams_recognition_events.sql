-- AMS recognition events: from the engine's ledger to the person who earned it.
--
-- The engine (ams_ingest_event -> ams_evaluate_user) already decides what a
-- person has earned and writes it down. Nothing told the person. This adds the
-- step after the engine, without changing what the engine awards:
--
--   * Every recognition the engine grants now leaves one ledger line, which is
--     its durable identity. Achievements, stages and XP already did; badges,
--     trophies, the first passport and awards did not, and certificates were
--     never issued at all.
--   * A ledger line that is a recognition becomes one notification in
--     user_notifications - the table the bell already reads - keyed
--     'ams:ledger:<id>' so the same recognition can never be notified twice.
--   * A new notification is announced with pg_notify, which the app server
--     turns into a live stream for the signed-in person (the /realtime route
--     goes to the hosted project and never sees this database's writes).
--   * ams_recognition_presentations records, once per ledger line, that a
--     recognition was shown. Claiming a line is atomic, so a refresh, a second
--     tab or a reconnect can never show it again.
--
-- Level, rank and stage are one number in this engine (ams_evaluate_user sets
-- current_level = current_rank = stage), so a promotion is one recognition that
-- carries the new rank and level, not three.
--
-- Nothing here can fail a business transaction: notifying is wrapped and a
-- failure is written to error_events, and the ledger line it came from stays,
-- so ams_sweep repairs the notification later.

begin;

-- ---------------------------------------------------------------- schema

alter table public.user_notifications
  add column if not exists dedupe_key text,
  add column if not exists data jsonb;

create unique index if not exists user_notifications_dedupe_key
  on public.user_notifications (dedupe_key) where dedupe_key is not null;

-- The ledger's kinds, as before, plus the two recognitions that had no line:
-- an award in its own name, and a role's first passport.
alter table public.ams_award_ledger drop constraint if exists ams_award_ledger_asset_kind_check;
alter table public.ams_award_ledger add constraint ams_award_ledger_asset_kind_check
  check (asset_kind = any (array['xp','achievement','badge','trophy','certificate','stage','rank',
                                 'award','passport']));

-- One ledger line per recognised thing per person per role. XP is paid per
-- event and repeats by design; a claim is the person's own act, not a grant.
create unique index if not exists ams_award_ledger_recognition_once
  on public.ams_award_ledger (user_id, role, asset_kind, asset_slug)
  where asset_kind in ('stage','achievement','badge','trophy','award','certificate','passport')
    and coalesce(reason, '') <> 'claimed';

-- One certificate per person per role per stage.
create unique index if not exists ams_certificates_once
  on public.ams_certificates (user_id, role, stage);

create table if not exists public.ams_recognition_presentations (
  ledger_id    uuid primary key references public.ams_award_ledger(id),
  user_id      uuid not null,
  presented_at timestamptz not null default now(),
  -- 'browser' when a person's screen showed it; 'historical' for lines that
  -- existed before recognition was presented; 'silent' for a backfill.
  client       text not null default 'browser'
);
create index if not exists ams_recognition_presentations_user
  on public.ams_recognition_presentations (user_id, presented_at desc);

alter table public.ams_recognition_presentations enable row level security;
revoke all on public.ams_recognition_presentations from anon, authenticated;
grant select on public.ams_recognition_presentations to authenticated;
drop policy if exists ams_recognition_presentations_read on public.ams_recognition_presentations;
create policy ams_recognition_presentations_read on public.ams_recognition_presentations
  for select to authenticated
  using (user_id = auth.uid() or public.ams_is_operator());

-- ---------------------------------------------------------------- what counts

-- A ledger line is a recognition to tell the person about when it grants
-- something: not a claim (their own act) and not a zero-XP line.
create or replace function public.ams_recognition_notifiable(p_kind text, p_reason text, p_xp bigint)
returns boolean
language sql immutable
as $$
  select coalesce(p_reason, '') <> 'claimed'
     and (p_kind <> 'xp' or coalesce(p_xp, 0) > 0)
     and p_kind in ('xp','stage','achievement','badge','trophy','award','certificate','passport');
$$;

-- Everything a presentation needs, from the ledger line and the catalogue.
-- Built on the server every time, so a screen never shows a recognition it was
-- merely told about.
create or replace function public.ams_recognition_payload(p_ledger_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  l            public.ams_award_ledger;
  v_type       text;
  v_tier       text := 'standard';
  v_name       text;
  v_desc       text;
  v_rarity     text;
  v_cond       jsonb;
  v_stage      int;
  v_prev       int;
  v_priority   int;
  v_total      bigint;
  v_current    int;
  v_next_stage int;
  v_next_title text;
  v_next_min   bigint;
  v_rank       text;
  v_level      text;
begin
  select * into l from public.ams_award_ledger where id = p_ledger_id;
  if l.id is null then
    return null;
  end if;

  if l.asset_kind = 'xp' then
    v_type := 'xp';
    v_name := '+' || l.xp_awarded || ' XP';
    v_desc := nullif(regexp_replace(coalesce(l.reason, ''), '^ams:', ''), '');
  elsif l.asset_kind = 'stage' then
    v_stage := nullif(regexp_replace(coalesce(l.asset_slug, ''), '^.*-', ''), '')::int;
    select title, tagline into v_name, v_desc
      from public.ams_role_stages where role = l.role and stage = v_stage;
    v_type := case when v_stage >= 10 then 'legacy' else 'stage' end;
    select max(nullif(regexp_replace(asset_slug, '^.*-', ''), '')::int) into v_prev
      from public.ams_award_ledger
     where user_id = l.user_id and role = l.role and asset_kind = 'stage'
       and created_at < l.created_at;
  elsif l.asset_kind = 'achievement' then
    select name, description, rarity, conditions into v_name, v_desc, v_rarity, v_cond
      from public.achievements where slug = l.asset_slug;
    v_type := case when v_cond ? 'event_key' then 'milestone' else 'achievement' end;
  elsif l.asset_kind = 'badge' then
    select name, description, rarity, conditions into v_name, v_desc, v_rarity, v_cond
      from public.badges where slug = l.asset_slug;
    v_type := 'badge';
  elsif l.asset_kind = 'trophy' then
    select name, description, tier, conditions into v_name, v_desc, v_rarity, v_cond
      from public.trophies where slug = l.asset_slug;
    v_type := 'trophy';
  elsif l.asset_kind = 'award' then
    select name, description, rarity, priority, conditions
      into v_name, v_desc, v_rarity, v_priority, v_cond
      from public.awards where slug = l.asset_slug;
    v_type := 'award';
  elsif l.asset_kind = 'certificate' then
    select title, stage into v_name, v_stage
      from public.ams_certificates where certificate_no = l.asset_slug;
    if v_name is null then
      -- Before certificates were issued, an award was written as a certificate
      -- line under the award's own slug.
      select name, description, rarity, priority, conditions
        into v_name, v_desc, v_rarity, v_priority, v_cond
        from public.awards where slug = l.asset_slug;
    end if;
    v_type := 'certificate';
  elsif l.asset_kind = 'passport' then
    v_type := 'passport';
    v_name := l.asset_slug;
    select stage into v_stage from public.ams_passports where user_id = l.user_id and role = l.role;
  else
    v_type := l.asset_kind;
  end if;

  if v_stage is null and v_cond ? 'stage' then
    v_stage := (v_cond->>'stage')::int;
  end if;

  -- The catalogue's own tiers: stage 10 is the role's Legacy (rank "Legacy",
  -- rarity "founder"); stages 7-9 are legendary and mythic.
  if v_type not in ('xp', 'passport') then
    if v_type = 'legacy' or coalesce(v_stage, 0) >= 10 or v_rarity = 'founder' then
      v_tier := 'legacy';
    elsif coalesce(v_stage, 0) between 7 and 9 or v_rarity in ('legendary', 'mythic') then
      v_tier := 'legendary';
    end if;
  end if;

  select total_xp, current_level into v_total, v_current
    from public.user_xp where user_id = l.user_id and role = l.role;

  select stage, title, min_xp into v_next_stage, v_next_title, v_next_min
    from public.ams_role_stages
   where role = l.role and stage = coalesce(v_stage, v_current, 0) + 1;

  if v_stage is not null then
    select name into v_rank from public.ranks where rank_number = v_stage;
    select name into v_level from public.levels where level_number = v_stage;
  end if;

  return jsonb_build_object(
    'ledger_id',       l.id,
    'user_id',         l.user_id,
    'role',            l.role,
    'kind',            l.asset_kind,
    'type',            v_type,
    'tier',            v_tier,
    'slug',            l.asset_slug,
    'name',            coalesce(v_name, l.asset_slug, v_type),
    'description',     v_desc,
    'reason',          l.reason,
    'rarity',          v_rarity,
    'stage',           v_stage,
    'previous_stage',  v_prev,
    'rank',            v_rank,
    'level',           v_level,
    'xp',              coalesce(l.xp_awarded, 0),
    'total_xp',        coalesce(v_total, 0),
    'priority',        v_priority,
    'source_event_id', l.event_id,
    'next',            case when v_next_stage is null then null
                            else jsonb_build_object('stage', v_next_stage, 'title', v_next_title,
                                                    'min_xp', v_next_min) end,
    'action_url',      case when l.role in ('author','vendor','reseller','affiliate','influencer',
                                            'franchise','seo','developer')
                            then '/dashboard/' || l.role end,
    'created_at',      l.created_at);
end $$;

-- ---------------------------------------------------------------- notify

create or replace function public.ams_notify_recognition(p_ledger_id uuid)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  p      jsonb;
  v_role text;
  v_head text;
begin
  p := public.ams_recognition_payload(p_ledger_id);
  if p is null then
    return false;
  end if;

  v_role := case p->>'role' when 'seo' then 'SEO' else initcap(p->>'role') end;
  v_head := case p->>'type'
    when 'xp'          then '+' || (p->>'xp') || ' XP'
                               || coalesce(' for ' || replace(p->>'description', '.', ' '), '')
    when 'stage'       then 'Stage ' || (p->>'stage') || ' reached: ' || (p->>'name')
    when 'legacy'      then 'Legacy reached: ' || (p->>'name')
    when 'achievement' then 'Achievement unlocked: ' || (p->>'name')
    when 'milestone'   then 'Milestone reached: ' || (p->>'name')
    when 'badge'       then 'Badge earned: ' || (p->>'name')
    when 'trophy'      then 'Trophy earned: ' || (p->>'name')
    when 'award'       then 'Award earned: ' || (p->>'name')
    when 'certificate' then 'Certificate issued: ' || (p->>'name')
    when 'passport'    then 'Passport issued: ' || (p->>'name')
    else initcap(p->>'type') || ': ' || (p->>'name')
  end;

  insert into public.user_notifications
    (user_id, type, message, event_type, action_label, action_url,
     is_buzzer, is_read, is_dismissed, dedupe_key, data)
  values
    ((p->>'user_id')::uuid, 'success',
     v_head || ' (' || v_role || ')'
       || case when p->>'type' = 'stage' and p->>'rank' is not null
               then ' - rank ' || (p->>'rank') else '' end,
     'ams.recognition.' || (p->>'type'),
     case when p->>'action_url' is not null then 'Open AMS' end,
     p->>'action_url',
     false, false, false,
     'ams:ledger:' || p_ledger_id::text,
     p)
  on conflict (dedupe_key) where dedupe_key is not null do nothing;

  return true;
end $$;

create or replace function public.ams_on_ledger_recognition()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.ams_recognition_notifiable(new.asset_kind, new.reason, new.xp_awarded) then
    return null;
  end if;

  -- A backfill recognises history. It is recorded, not announced: marking it
  -- presented keeps the sweep's repair from announcing it later.
  if coalesce(current_setting('ams.silent', true), '') = 'on' then
    insert into public.ams_recognition_presentations (ledger_id, user_id, client)
    values (new.id, new.user_id, 'silent')
    on conflict (ledger_id) do nothing;
    return null;
  end if;

  begin
    perform public.ams_notify_recognition(new.id);
  exception when others then
    -- Never a failure of the evaluation that granted it. The ledger line
    -- stays; ams_sweep() -> ams_recognition_repair() writes the notification.
    perform public.ams_record_failure('ams_notify_recognition', sqlerrm,
      jsonb_build_object('ledger_id', new.id, 'user_id', new.user_id, 'kind', new.asset_kind));
  end;
  return null;
end $$;

drop trigger if exists ams_ledger_recognition on public.ams_award_ledger;
create trigger ams_ledger_recognition
  after insert on public.ams_award_ledger
  for each row execute function public.ams_on_ledger_recognition();

-- Every new notification is announced to the app server, which streams it to
-- the person it belongs to. Only identifiers travel; the reader fetches the
-- rest under its own permissions.
create or replace function public.sv_announce_user_notification()
returns trigger
language plpgsql
as $$
begin
  begin
    perform pg_notify('sv_user_notification', json_build_object(
      'id', new.id,
      'user_id', new.user_id,
      'event', new.event_type,
      'ledger_id', new.data->>'ledger_id')::text);
  exception when others then
    -- An announcement is a courtesy; the row is what matters.
    raise warning 'notification % not announced: %', new.id, sqlerrm;
  end;
  return null;
end $$;

drop trigger if exists user_notifications_announce on public.user_notifications;
create trigger user_notifications_announce
  after insert on public.user_notifications
  for each row execute function public.sv_announce_user_notification();

-- ---------------------------------------------------------------- engine

-- ams_evaluate_user, unchanged in what it awards. The differences:
--   * trophies and badges it grants now leave a ledger line each;
--   * the first time a role's passport is issued leaves a ledger line;
--   * every recognition line is written once (on conflict do nothing), so a
--     re-evaluation can never write the same recognition twice.
create or replace function public.ams_evaluate_user(p_user_id uuid)
returns jsonb
language plpgsql security definer
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
  v_issued    boolean;
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
              'reached stage ' || v_stage)
      on conflict (user_id, role, asset_kind, asset_slug)
        where asset_kind in ('stage','achievement','badge','trophy','award','certificate','passport')
          and coalesce(reason, '') <> 'claimed'
      do nothing;
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
          values (p_user_id, v_role, 'achievement', ach.slug, 'stage ' || v_stage)
          on conflict (user_id, role, asset_kind, asset_slug)
            where asset_kind in ('stage','achievement','badge','trophy','award','certificate','passport')
              and coalesce(reason, '') <> 'claimed'
          do nothing;
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
          values (p_user_id, v_role, 'achievement', ach.slug, ach.conditions->>'event_key')
          on conflict (user_id, role, asset_kind, asset_slug)
            where asset_kind in ('stage','achievement','badge','trophy','award','certificate','passport')
              and coalesce(reason, '') <> 'claimed'
          do nothing;
          v_unlocked := v_unlocked + 1;
        end if;
      end if;
    end loop;

    -- This role's stage trophies and badges the person has now reached, each
    -- with its ledger line.
    with granted as (
      insert into public.user_trophies (user_id, trophy_id, earned_at)
      select p_user_id, t.id, now()
      from public.trophies t
      where t.conditions->>'role' = v_role
        and (t.conditions->>'stage')::int <= v_stage
        and coalesce(t.status,'active') = 'active'
        and not exists (select 1 from public.user_trophies ut
                        where ut.user_id = p_user_id and ut.trophy_id = t.id)
      on conflict do nothing
      returning trophy_id
    )
    insert into public.ams_award_ledger (user_id, role, asset_kind, asset_slug, reason)
    select p_user_id, v_role, 'trophy', t.slug, 'stage ' || (t.conditions->>'stage')
    from granted g join public.trophies t on t.id = g.trophy_id
    on conflict (user_id, role, asset_kind, asset_slug)
      where asset_kind in ('stage','achievement','badge','trophy','award','certificate','passport')
        and coalesce(reason, '') <> 'claimed'
    do nothing;
    get diagnostics v_assets = row_count;

    with granted as (
      insert into public.user_badges (user_id, badge_id, earned_at)
      select p_user_id, b.id, now()
      from public.badges b
      where b.conditions->>'role' = v_role
        and (b.conditions->>'stage')::int <= v_stage
        and coalesce(b.status,'active') = 'active'
        and not exists (select 1 from public.user_badges ub
                        where ub.user_id = p_user_id and ub.badge_id = b.id)
      on conflict do nothing
      returning badge_id
    )
    insert into public.ams_award_ledger (user_id, role, asset_kind, asset_slug, reason)
    select p_user_id, v_role, 'badge', b.slug, 'stage ' || (b.conditions->>'stage')
    from granted g join public.badges b on b.id = g.badge_id
    on conflict (user_id, role, asset_kind, asset_slug)
      where asset_kind in ('stage','achievement','badge','trophy','award','certificate','passport')
        and coalesce(reason, '') <> 'claimed'
    do nothing;

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
      set level = excluded.level, stage = excluded.stage, updated_at = now()
    returning (xmax = 0) into v_issued;

    if v_issued then
      insert into public.ams_award_ledger (user_id, role, asset_kind, asset_slug, reason)
      values (p_user_id, v_role, 'passport', v_passport, 'passport issued')
      on conflict (user_id, role, asset_kind, asset_slug)
        where asset_kind in ('stage','achievement','badge','trophy','award','certificate','passport')
          and coalesce(reason, '') <> 'claimed'
      do nothing;
    end if;

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

-- ams_issue_awards: the same awards for the same stages. The ledger line is now
-- written for exactly the awards this call granted (it used to be every award
-- granted in the last five seconds, so a second evaluation inside that window
-- wrote the same lines again), under the kind 'award'. Each granted award also
-- issues its certificate - the engine already recorded an award as a
-- certificate; now the certificate exists, with a number that verifies.
create or replace function public.ams_issue_awards(p_user_id uuid, p_role text, p_stage integer)
returns integer
language plpgsql security definer
set search_path to 'public'
as $function$
declare
  n    int := 0;
  r    record;
  v_no text;
  h    text;
begin
  for r in
    insert into public.user_awards (user_id, award_id, earned_at)
    select p_user_id, a.id, now()
    from public.awards a
    where a.conditions->>'role' = p_role
      and (a.conditions->>'stage')::int <= p_stage
      and a.status = 'published'
      and not exists (select 1 from public.user_awards ua
                      where ua.user_id = p_user_id and ua.award_id = a.id)
    on conflict (user_id, award_id) do nothing
    returning award_id
  loop
    n := n + 1;

    insert into public.ams_award_ledger (user_id, role, asset_kind, asset_slug, reason)
    select p_user_id, p_role, 'award', a.slug, 'stage ' || (a.conditions->>'stage')
    from public.awards a where a.id = r.award_id
    on conflict (user_id, role, asset_kind, asset_slug)
      where asset_kind in ('stage','achievement','badge','trophy','award','certificate','passport')
        and coalesce(reason, '') <> 'claimed'
    do nothing;

    h := upper(md5(gen_random_uuid()::text));
    v_no := null;
    insert into public.ams_certificates (user_id, role, certificate_no, title, stage, achievement_slug)
    select p_user_id, p_role,
           'SV-CRT-' || substr(h,1,4) || '-' || substr(h,5,4) || '-' || substr(h,9,4)
             || '-' || upper(substr(p_role,1,3)) || lpad(a.conditions->>'stage', 2, '0'),
           a.name, (a.conditions->>'stage')::int,
           p_role || '-stage-' || lpad(a.conditions->>'stage', 2, '0')
    from public.awards a where a.id = r.award_id
    on conflict do nothing
    returning certificate_no into v_no;

    if v_no is not null then
      insert into public.ams_award_ledger (user_id, role, asset_kind, asset_slug, reason)
      values (p_user_id, p_role, 'certificate', v_no, 'certificate issued')
      on conflict (user_id, role, asset_kind, asset_slug)
        where asset_kind in ('stage','achievement','badge','trophy','award','certificate','passport')
          and coalesce(reason, '') <> 'claimed'
      do nothing;
    end if;
  end loop;

  return n;
end $function$;

-- ams_sweep, as before, then the repair: a recognition whose notification
-- failed to be written gets it now.
create or replace function public.ams_recognition_repair(p_limit integer default 500)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare r record; n int := 0;
begin
  for r in
    select l.id
      from public.ams_award_ledger l
     where l.created_at > now() - interval '7 days'
       and public.ams_recognition_notifiable(l.asset_kind, l.reason, l.xp_awarded)
       and not exists (select 1 from public.ams_recognition_presentations p where p.ledger_id = l.id)
       and not exists (select 1 from public.user_notifications n
                        where n.dedupe_key = 'ams:ledger:' || l.id::text)
     order by l.created_at
     limit greatest(p_limit, 1)
  loop
    begin
      if public.ams_notify_recognition(r.id) then
        n := n + 1;
      end if;
    exception when others then
      perform public.ams_record_failure('ams_recognition_repair', sqlerrm,
        jsonb_build_object('ledger_id', r.id));
    end;
  end loop;
  return n;
end $$;

create or replace function public.ams_sweep()
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $function$
declare u uuid; n int := 0; failed int := 0; repaired int := 0;
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

  begin
    repaired := public.ams_recognition_repair();
  exception when others then
    perform public.ams_record_failure('ams_recognition_repair', sqlerrm, '{}'::jsonb);
  end;

  return jsonb_build_object('ok', true, 'users_evaluated', n, 'users_failed', failed,
    'notifications_repaired', repaired,
    'pending_events', (select count(*) from public.ams_activity_events where processed_at is null));
end $function$;

-- ams_backfill recognises history: silent, so years of past activity do not
-- arrive as a burst of celebrations. The edit is made to the live definition
-- and checked, so the rest of the function stays exactly as it is.
do $$
declare
  def text := pg_get_functiondef('public.ams_backfill'::regproc);
  anchor text := 'perform set_config(''ams.defer_eval'', ''off'', true);';
begin
  if position('ams.silent' in def) > 0 then
    return;
  end if;
  if position(anchor in def) = 0 then
    raise exception 'ams_backfill no longer has the expected shape; not edited';
  end if;
  execute replace(def, anchor, anchor || E'\n  perform set_config(''ams.silent'', ''on'', true);');
end $$;

-- ---------------------------------------------------------------- readers

-- Claim recognitions for presentation. Only the person's own ledger lines, only
-- recognitions, and each line only once ever: the insert is the claim, so two
-- tabs or a refresh racing for the same line get it once between them.
create or replace function public.ams_recognition_claim(p_ledger_ids uuid[])
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_claimed jsonb := '[]'::jsonb;
  r         record;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;
  if p_ledger_ids is null or array_length(p_ledger_ids, 1) is null then
    return jsonb_build_object('ok', true, 'claimed', v_claimed);
  end if;

  for r in
    with wanted as (
      select l.id, l.user_id
        from public.ams_award_ledger l
       where l.id = any(p_ledger_ids[1:50])
         and l.user_id = v_uid
         and public.ams_recognition_notifiable(l.asset_kind, l.reason, l.xp_awarded)
    )
    insert into public.ams_recognition_presentations (ledger_id, user_id, client)
    select id, user_id, 'browser' from wanted
    on conflict (ledger_id) do nothing
    returning ledger_id
  loop
    v_claimed := v_claimed || jsonb_build_array(public.ams_recognition_payload(r.ledger_id));
  end loop;

  return jsonb_build_object('ok', true, 'claimed', v_claimed);
end $$;

-- Recognitions granted since a moment (a page's start) that no screen has
-- shown yet. Read-only; presenting one still goes through the claim.
create or replace function public.ams_recognition_pending(p_since timestamptz)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;
  return jsonb_build_object('ok', true, 'pending', coalesce((
    select jsonb_agg(l.id order by l.created_at, l.id)
      from (select l2.id, l2.created_at
              from public.ams_award_ledger l2
             where l2.user_id = v_uid
               and l2.created_at >= greatest(coalesce(p_since, now()), now() - interval '1 day')
               and public.ams_recognition_notifiable(l2.asset_kind, l2.reason, l2.xp_awarded)
               and not exists (select 1 from public.ams_recognition_presentations p
                                where p.ledger_id = l2.id)
             order by l2.created_at, l2.id
             limit 50) l), '[]'::jsonb));
end $$;

-- A person's recognition history for one role, newest first, with whether it
-- has been shown. An operator may read anyone's.
create or replace function public.ams_recognitions(p_role text, p_user_id uuid default null, p_limit integer default 100)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare v_target uuid := coalesce(p_user_id, auth.uid());
begin
  if v_target is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;
  if v_target is distinct from auth.uid() and not public.ams_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  return jsonb_build_object('ok', true, 'recognitions', coalesce((
    select jsonb_agg(public.ams_recognition_payload(l.id)
                       || jsonb_build_object('presented_at', p.presented_at, 'presented_by', p.client)
                     order by l.created_at desc, l.id)
      from (select * from public.ams_award_ledger l2
             where l2.user_id = v_target and l2.role = p_role
               and public.ams_recognition_notifiable(l2.asset_kind, l2.reason, l2.xp_awarded)
             order by l2.created_at desc, l2.id
             limit least(greatest(coalesce(p_limit, 100), 1), 500)) l
      left join public.ams_recognition_presentations p on p.ledger_id = l.id), '[]'::jsonb));
end $$;

-- Public verification of a certificate by its number. Says whether it is real
-- and what it certifies; never who holds it.
create or replace function public.ams_verify_certificate(p_certificate_no text)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object(
              'ok', true, 'valid', c.revoked_at is null,
              'certificate_no', c.certificate_no, 'role', c.role, 'title', c.title,
              'stage', c.stage, 'issued_at', c.issued_at,
              'verification', c.verification,
              'revoked_at', c.revoked_at, 'revoked_reason', c.revoked_reason)
       from public.ams_certificates c
      where c.certificate_no = upper(btrim(p_certificate_no))),
    jsonb_build_object('ok', true, 'valid', false, 'reason', 'not_found'));
$$;

-- The role's journey, as before, plus the certificates issued for it.
do $$
declare
  def text := pg_get_functiondef('public.ams_role_chain'::regproc);
  anchor text := '''stages'', coalesce(v_chain, ''[]''::jsonb));';
begin
  if position('''certificates''' in def) > 0 then
    return;
  end if;
  if position(anchor in def) = 0 then
    raise exception 'ams_role_chain no longer has the expected shape; not edited';
  end if;
  execute replace(def, anchor,
    '''certificates'', coalesce((select jsonb_agg(jsonb_build_object(' ||
    '''certificate_no'', c.certificate_no, ''title'', c.title, ''stage'', c.stage, ' ||
    '''achievement_slug'', c.achievement_slug, ''issued_at'', c.issued_at, ' ||
    '''verification'', c.verification, ''revoked_at'', c.revoked_at) order by c.stage) ' ||
    'from public.ams_certificates c where c.user_id = v_target and c.role = p_role), ''[]''::jsonb),' ||
    E'\n     ' || anchor);
end $$;

-- ---------------------------------------------------------------- grants

revoke all on function public.ams_recognition_payload(uuid) from public, anon, authenticated;
revoke all on function public.ams_notify_recognition(uuid) from public, anon, authenticated;
revoke all on function public.ams_recognition_repair(integer) from public, anon, authenticated;
revoke all on function public.ams_on_ledger_recognition() from public, anon, authenticated;
revoke all on function public.ams_recognition_claim(uuid[]) from public, anon;
revoke all on function public.ams_recognition_pending(timestamptz) from public, anon;
revoke all on function public.ams_recognitions(text, uuid, integer) from public, anon;
grant execute on function public.ams_recognition_claim(uuid[]) to authenticated;
grant execute on function public.ams_recognition_pending(timestamptz) to authenticated;
grant execute on function public.ams_recognitions(text, uuid, integer) to authenticated;
grant execute on function public.ams_verify_certificate(text) to anon, authenticated;

-- ---------------------------------------------------------------- history

-- Recognition that existed before today is history: never presented as new.
-- Only on the first application: run again later, this would mark recognition
-- that is genuinely waiting to be shown as history.
insert into public.ams_recognition_presentations (ledger_id, user_id, presented_at, client)
select l.id, l.user_id, l.created_at, 'historical'
  from public.ams_award_ledger l
 where public.ams_recognition_notifiable(l.asset_kind, l.reason, l.xp_awarded)
   and not exists (select 1 from public.ams_recognition_presentations)
on conflict (ledger_id) do nothing;

-- Awards already earned get the certificate the engine now issues with every
-- award. Issued silently: these are records of the past, not new recognition.
insert into public.ams_certificates (user_id, role, certificate_no, title, stage, achievement_slug, issued_at)
select ua.user_id, a.conditions->>'role',
       'SV-CRT-' || substr(h.h,1,4) || '-' || substr(h.h,5,4) || '-' || substr(h.h,9,4)
         || '-' || upper(substr(a.conditions->>'role',1,3)) || lpad(a.conditions->>'stage', 2, '0'),
       a.name, (a.conditions->>'stage')::int,
       (a.conditions->>'role') || '-stage-' || lpad(a.conditions->>'stage', 2, '0'),
       ua.earned_at
  from public.user_awards ua
  join public.awards a on a.id = ua.award_id
  cross join lateral (select upper(md5(gen_random_uuid()::text)) h) h
 where a.conditions ? 'role' and a.conditions ? 'stage'
on conflict do nothing;

commit;
