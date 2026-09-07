-- The notification engine, on the one channel that needs no provider.
--
-- Six channels are specified. Five of them - email, WhatsApp, SMS, web push,
-- Telegram - have no credential of any kind in this environment, so nothing
-- can be delivered on any of them and none is reported as connected.
--
-- The sixth, the in-app bell, needs nothing external. Its tables already exist
-- and are all empty: notifications, user_notifications, notification_rules and
-- notification_templates hold zero rows between them, because nothing has ever
-- written one.
--
-- So this is the engine, and it is wired to events that genuinely happen in
-- this system already - a licence being issued, an offer going live, a demo
-- going offline - rather than to a demonstration trigger.

/* --------------------------------------------------------------- the write */

-- Raise one notification.
--
-- Deduplicated on purpose: the demo monitor runs every fifteen minutes, and a
-- demo that stays offline must not produce ninety-six identical rows a day.
-- Within the dedupe window the same event for the same recipient is counted as
-- already told.
create or replace function public.mm_notify(
  p_event       text,
  p_title       text,
  p_message     text,
  p_user        uuid default null,
  p_role_target text[] default null,
  p_action_url  text default null,
  p_action_label text default null,
  p_dedupe_minutes integer default 60,
  -- `type` on this table is a severity, not a title. The sentence a person
  -- reads goes in `message`.
  p_severity text default 'info'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_targets uuid[];
  v_target uuid;
  v_sent integer := 0;
  v_skipped integer := 0;
begin
  if coalesce(btrim(p_title), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'title_required');
  end if;
  if p_user is null and p_role_target is null then
    return jsonb_build_object('ok', false, 'reason', 'no_recipient');
  end if;

  -- user_id is NOT NULL on this table, so a role broadcast is fanned out to
  -- the people who hold the role rather than stored as one row with no owner.
  -- That is the better shape anyway: read and dismissed are per person, so one
  -- operator clearing an alert does not clear it for everybody else.
  if p_user is not null then
    v_targets := array[p_user];
  else
    select coalesce(array_agg(distinct ur.user_id), '{}')
      into v_targets
      from public.user_roles ur
     where ur.role::text = any(p_role_target);
  end if;

  if coalesce(array_length(v_targets, 1), 0) = 0 then
    return jsonb_build_object('ok', true, 'delivered', 0,
                              'reason', 'no_recipient_holds_that_role');
  end if;

  foreach v_target in array v_targets loop
    -- Deduplicated per person, so a demo that stays offline does not produce
    -- ninety-six identical rows a day for each operator.
    if exists (
      select 1 from public.user_notifications n
       where n.event_type = p_event
         and n.user_id = v_target
         and n.created_at > now() - make_interval(mins => greatest(p_dedupe_minutes, 0))
         and not coalesce(n.is_dismissed, false))
    then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    insert into public.user_notifications
      (user_id, type, message, event_type, action_label, action_url,
       is_buzzer, is_read, is_dismissed, role_target)
    values (v_target,
            case when p_severity in ('info','success','warning','danger','priority')
                 then p_severity else 'info' end,
            case when coalesce(btrim(p_message), '') = '' then p_title
                 else p_title || ' - ' || p_message end,
            p_event, p_action_label, p_action_url,
            -- A buzzer is for the things somebody has to act on.
            p_event in ('demo.offline', 'seo.page_broken', 'license.issue_failed'),
            false, false, p_role_target)
    returning id into v_id;
    v_sent := v_sent + 1;
  end loop;

  return jsonb_build_object('ok', true, 'delivered', v_sent,
                            'deduplicated', v_skipped > 0 and v_sent = 0,
                            'suppressed', v_skipped, 'id', v_id);
end;
$$;

/* ----------------------------------------------------------- the bell read */

-- What one person should see in their bell, newest first.
create or replace function public.mm_notifications(p_limit integer default 25)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_roles text[];
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;

  select array_agg(role::text) into v_roles
    from public.user_roles where user_id = auth.uid();

  return jsonb_build_object(
    'ok', true,
    'unread', (
      select count(*) from public.user_notifications n
       where not coalesce(n.is_read, false) and not coalesce(n.is_dismissed, false)
         and (n.user_id = auth.uid()
              or (n.user_id is null and n.role_target && coalesce(v_roles, '{}')))),
    'notifications', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', n.id, 'severity', n.type, 'message', n.message,
               'event', n.event_type, 'action_url', n.action_url,
               'action_label', n.action_label, 'buzzer', n.is_buzzer,
               'read', n.is_read, 'created_at', n.created_at)
             order by n.created_at desc)
        from (select * from public.user_notifications n2
               where not coalesce(n2.is_dismissed, false)
                 and (n2.user_id = auth.uid()
                      or (n2.user_id is null and n2.role_target && coalesce(v_roles, '{}')))
               order by n2.created_at desc
               limit least(greatest(p_limit, 1), 100)) n), '[]'::jsonb));
end;
$$;

grant execute on function public.mm_notifications(integer) to authenticated;

create or replace function public.mm_notification_read(p_id uuid, p_dismiss boolean default false)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_roles text[]; v_ok boolean;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;
  select array_agg(role::text) into v_roles from public.user_roles where user_id = auth.uid();

  -- Only your own, or one addressed to a role you hold.
  select exists (
    select 1 from public.user_notifications n
     where n.id = p_id
       and (n.user_id = auth.uid()
            or (n.user_id is null and n.role_target && coalesce(v_roles, '{}'))))
    into v_ok;
  if not v_ok then
    return jsonb_build_object('ok', false, 'reason', 'not_yours');
  end if;

  update public.user_notifications
     set is_read = true, read_at = coalesce(read_at, now()),
         is_dismissed = case when p_dismiss then true else is_dismissed end,
         dismissed_at = case when p_dismiss then now() else dismissed_at end
   where id = p_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.mm_notification_read(uuid, boolean) to authenticated;

/* ------------------------------------------------------- channel reporting */

-- What each channel can actually do. The in-app bell is the only one that
-- works, and the rest say why not rather than showing a toggle that implies
-- they might.
create or replace function public.mm_notification_channels()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  return jsonb_build_object(
    'ok', true,
    'channels', jsonb_build_array(
      jsonb_build_object(
        'channel', 'in_app', 'label', 'In-app bell', 'configured', true,
        'delivered', (select count(*) from public.user_notifications),
        'unread', (select count(*) from public.user_notifications
                    where not coalesce(is_read,false) and not coalesce(is_dismissed,false)),
        'last_delivery', (select max(created_at) from public.user_notifications),
        'note', 'Needs no external provider. This is the fallback every other channel falls back to.'),
      jsonb_build_object('channel','email','label','Email','configured',false,'delivered',0,
        'note','No SMTP, SendGrid, Resend or Postmark setting is present. Nothing can be delivered.'),
      jsonb_build_object('channel','whatsapp','label','WhatsApp','configured',false,'delivered',0,
        'note','No WhatsApp Business provider is configured. Templates also require approval before any send.'),
      jsonb_build_object('channel','sms','label','SMS','configured',false,'delivered',0,
        'note','SMS PROVIDER NOT CONNECTED.'),
      jsonb_build_object('channel','web_push','label','Web push','configured',false,'delivered',0,
        'note','No VAPID key pair is configured, and no device subscriptions are stored.'),
      jsonb_build_object('channel','telegram','label','Telegram','configured',false,'delivered',0,
        'note','No Bot API token is configured.')),
    'templates', (select count(*) from public.notification_templates),
    'rules',     (select count(*) from public.notification_rules));
end;
$$;

/* ------------------------------------------------------- real event wiring */

-- A licence being issued is worth telling the buyer about, and it is an event
-- this system genuinely produces.
create or replace function public.mm_notify_license_issued()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_product text;
begin
  select name into v_product from public.marketplace_products where id = new.product_id;
  perform public.mm_notify(
    'license.issued',
    'Your licence is ready',
    format('Licence %s for %s is active.', new.license_key, coalesce(v_product, 'your purchase')),
    new.buyer_id, null, '/account/purchases', 'View purchases', 5, 'success');
  return new;
end;
$$;

drop trigger if exists mm_notify_license_issued on public.marketplace_licenses;
create trigger mm_notify_license_issued
  after insert on public.marketplace_licenses
  for each row execute function public.mm_notify_license_issued();

-- A demo going offline is the thing an operator most needs to hear about, and
-- the monitor already detects it every fifteen minutes.
create or replace function public.mm_notify_demo_alert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(new.is_resolved, false) then
    perform public.mm_notify(
      'demo.offline',
      case new.severity when 'critical' then 'A demo is unreachable' else 'Demo warning' end,
      new.message,
      null, array['admin','boss','founder','super_admin'],
      '/marketplace-manager', 'Open Demo URL Manager',
      -- The monitor runs every fifteen minutes; six hours between repeats of
      -- the same alert is enough to notice without being buried.
      360,
      case new.severity when 'critical' then 'danger' else 'warning' end);
  end if;
  return new;
end;
$$;

drop trigger if exists mm_notify_demo_alert on public.demo_alerts;
create trigger mm_notify_demo_alert
  after insert on public.demo_alerts
  for each row execute function public.mm_notify_demo_alert();

/* --------------------------------------------------------------------- RLS */

alter table public.user_notifications enable row level security;

drop policy if exists user_notifications_own on public.user_notifications;
create policy user_notifications_own on public.user_notifications
  for select to authenticated
  using (user_id = auth.uid()
         or public.mm_is_operator()
         or (user_id is null and role_target && coalesce(
               (select array_agg(role::text) from public.user_roles where user_id = auth.uid()),
               '{}')));

drop policy if exists user_notifications_own_update on public.user_notifications;
create policy user_notifications_own_update on public.user_notifications
  for update to authenticated
  using (user_id = auth.uid() or public.mm_is_operator())
  with check (user_id = auth.uid() or public.mm_is_operator());

drop policy if exists user_notifications_anon_sel on public.user_notifications;
create policy user_notifications_anon_sel on public.user_notifications
  as restrictive for select to anon using (false);
drop policy if exists user_notifications_anon_ins on public.user_notifications;
create policy user_notifications_anon_ins on public.user_notifications
  as restrictive for insert to anon with check (false);
drop policy if exists user_notifications_anon_upd on public.user_notifications;
create policy user_notifications_anon_upd on public.user_notifications
  as restrictive for update to anon using (false) with check (false);

create index if not exists user_notifications_user_idx
  on public.user_notifications (user_id, is_read, created_at desc);
create index if not exists user_notifications_event_idx
  on public.user_notifications (event_type, created_at desc);
-- demo_alerts could not record an alert about a real demo.
--
-- Its demo_id references public.demos, which holds no rows. Every demo this
-- project actually has lives in product_demo_urls, so the monitoring worker
-- would have hit a foreign key violation the first time a demo went offline —
-- exactly when the alert mattered. It has not fired yet only because all nine
-- demos have been reachable on every check so far.
--
-- Fixed additively: demo_id becomes optional and a demo_url_id is added
-- alongside it, pointing at the table the demos are really in. Nothing is
-- dropped, and an alert must still name one or the other.

alter table public.demo_alerts alter column demo_id drop not null;

alter table public.demo_alerts
  add column if not exists demo_url_id uuid references public.product_demo_urls(id) on delete cascade;

alter table public.demo_alerts drop constraint if exists demo_alerts_subject_ck;
alter table public.demo_alerts
  add constraint demo_alerts_subject_ck
  check (demo_id is not null or demo_url_id is not null);

create index if not exists demo_alerts_url_idx on public.demo_alerts (demo_url_id, is_resolved);

-- The notification trigger reads whichever one is set.
create or replace function public.mm_notify_demo_alert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(new.is_resolved, false) then
    perform public.mm_notify(
      'demo.offline',
      case new.severity when 'critical' then 'A demo is unreachable' else 'Demo warning' end,
      new.message,
      null, array['admin','boss','founder','super_admin'],
      '/marketplace-manager', 'Open Demo URL Manager',
      360,
      case new.severity when 'critical' then 'danger' else 'warning' end);
  end if;
  return new;
end;
$$;

select 'demo_id nullable' as k,
  (select is_nullable from information_schema.columns
    where table_schema='public' and table_name='demo_alerts' and column_name='demo_id') as v
union all select 'demo_url_id exists',
  (select case when count(*)>0 then 'yes' else 'no' end from information_schema.columns
    where table_schema='public' and table_name='demo_alerts' and column_name='demo_url_id');
-- Adding the severity argument created a second overload, so a three-argument
-- call became ambiguous. The earlier signature is dropped so only one exists.
drop function if exists public.mm_notify(text, text, text, uuid, text[], text, text, integer);

select p.proname, pg_get_function_identity_arguments(p.oid) as args
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname='public' and p.proname='mm_notify';
