-- Demo Sandbox Controls, part three: expiry, cleanup, the console.

/* --------------------------------------------------- 15/16. expiry engine */

create or replace function public.mm_sandbox_expiry_run()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_set record; h integer; r record;
  v_warned integer := 0; v_expiring integer := 0; v_expired integer := 0;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;
  select * into v_set from public.demo_sandbox_settings where id;

  -- Warnings at each configured threshold, once each.
  foreach h in array v_set.warning_hours loop
    for r in
      select * from public.demo_sandboxes
       where status in ('active','expiring') and expires_at is not null
         and expires_at between now() and now() + (h || ' hours')::interval
         and not exists (select 1 from public.demo_sandbox_expiry_events e
                          where e.sandbox_id = demo_sandboxes.id
                            and e.kind='warning' and e.hours_out = h)
    loop
      insert into public.demo_sandbox_expiry_events (sandbox_id, kind, hours_out, notified)
      values (r.id, 'warning', h, true) on conflict do nothing;
      v_warned := v_warned + 1;

      perform public.mm_notify('sandbox.expiring',
        format('Sandbox %s expires in %s hour(s)', r.sandbox_ref, h),
        format('No qualifying activity since %s. It expires at %s unless it is used or extended.',
               coalesce(to_char(r.last_activity_at,'DD Mon HH24:MI'),'never'),
               to_char(r.expires_at,'DD Mon HH24:MI')),
        null, array['admin','boss'], '/marketplace-manager', 'Open',
        60 * 6, case when h <= 6 then 'warning' else 'info' end);
    end loop;
  end loop;

  -- Idle past its window: expiring, still reachable during grace.
  for r in
    select * from public.demo_sandboxes
     where status = 'active' and expires_at is not null and expires_at <= now()
  loop
    update public.demo_sandboxes set status='expiring', updated_at=now() where id=r.id;
    insert into public.demo_sandbox_expiry_events (sandbox_id, kind, hours_out)
    values (r.id, 'expiring', 0) on conflict do nothing;
    v_expiring := v_expiring + 1;
  end loop;

  -- Past grace: expired and queued for cleanup. Never deleted here.
  for r in
    select * from public.demo_sandboxes
     where status = 'expiring' and cleanup_after is not null and cleanup_after <= now()
  loop
    update public.demo_sandboxes
       set status='expired', cleanup_status='pending', updated_at=now() where id=r.id;
    insert into public.demo_sandbox_expiry_events (sandbox_id, kind, hours_out)
    values (r.id, 'expired', 0) on conflict do nothing;
    v_expired := v_expired + 1;
  end loop;

  return jsonb_build_object('ok', true,
    'thresholds', to_jsonb(v_set.warning_hours),
    'warned', v_warned, 'entered_expiring', v_expiring, 'expired', v_expired,
    'note','An expired sandbox is queued for cleanup, not removed. Its product, audit trail and deployment history are never touched.');
end;
$$;

/* --------------------------------------------------------- 7/17. cleanup */

-- The nightly cleanup.
--
-- It removes what it genuinely may — expired sessions past their retention,
-- stale queued jobs, expired credentials — and records what it deliberately
-- kept. Infrastructure cleanup is reported as blocked because no infrastructure
-- was ever created; claiming to have released a temporary server that never
-- existed would be a lie in the audit trail.
create or replace function public.mm_sandbox_cleanup_run()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_set record; v_job uuid; r record;
  v_sessions integer := 0; v_jobs integer := 0; v_creds integer := 0;
  v_sandboxes integer := 0; v_removed jsonb; v_preserved jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;
  select * into v_set from public.demo_sandbox_settings where id;

  insert into public.demo_sandbox_cleanup_jobs (scope, status)
  values ('expired', 'running') returning id into v_job;

  -- 11. Session logs, under the configured retention policy.
  if v_set.keep_session_logs then
    delete from public.demo_sandbox_sessions
     where last_seen_at < now() - (v_set.session_log_retention_days || ' days')::interval;
    get diagnostics v_sessions = row_count;
  else
    delete from public.demo_sandbox_sessions where ended_at is not null;
    get diagnostics v_sessions = row_count;
  end if;

  -- Abandoned provisioning jobs: queued for over a day and never started.
  update public.demo_sandbox_jobs
     set status='cancelled', finished_at=now(),
         error_category='abandoned',
         error_detail='Queued for more than a day without starting; cancelled by the cleanup.'
   where status='queued' and created_at < now() - interval '1 day';
  get diagnostics v_jobs = row_count;

  -- Expired credentials stop working.
  update public.demo_sandbox_credentials
     set active=false
   where active and expires_at is not null and expires_at <= now();
  get diagnostics v_creds = row_count;

  -- Sandboxes past their cleanup window are marked cleaned. The row stays.
  for r in
    select * from public.demo_sandboxes
     where status='expired' and cleanup_status='pending'
  loop
    update public.demo_sandboxes
       set cleanup_status='done', status='cleaned', updated_at=now()
     where id = r.id;
    insert into public.demo_sandbox_expiry_events (sandbox_id, kind, hours_out)
    values (r.id, 'cleanup', 0) on conflict do nothing;
    v_sandboxes := v_sandboxes + 1;
  end loop;

  v_removed := jsonb_build_object(
    'session_rows', v_sessions, 'abandoned_jobs', v_jobs,
    'credentials_expired', v_creds, 'sandboxes_marked_cleaned', v_sandboxes,
    'temporary_deployments', 0, 'temporary_servers', 0, 'temporary_dns', 0);

  v_preserved := jsonb_build_object(
    'products','never touched',
    'audit_logs','never touched',
    'legal_records','never touched',
    'deployment_history','never touched',
    'sandbox_rows','kept and marked cleaned rather than deleted',
    'note','Temporary deployments, servers and DNS records show zero because none were ever created — there is no runtime. Recording a release that did not happen would put a false entry in the audit trail.');

  update public.demo_sandbox_cleanup_jobs
     set status='partial', removed=v_removed, preserved=v_preserved, finished_at=now(),
         error_detail='Record cleanup ran. Infrastructure cleanup is blocked: no deployment runtime exists.'
   where id = v_job;

  perform public.mm_audit('sandbox.cleanup','demo_sandbox_cleanup', v_job::text, null,
                          jsonb_build_object('removed', v_removed), null);

  return jsonb_build_object('ok', true, 'job_id', v_job, 'status','partial',
    'removed', v_removed, 'preserved', v_preserved);
end;
$$;

/* ---------------------------------------------------- 19. demo sync */

-- Keep a sandbox in step with its demo domain.
--
-- Disabling a demo disables its sandbox, enabling re-enables it, and expiring
-- the demo expires the sandbox. The two consoles cannot drift apart.
create or replace function public.mm_sandbox_sync(p_demo uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_d record; v_s record; v_to text;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;
  select * into v_d from public.demo_domains where id = p_demo;
  if not found then return jsonb_build_object('ok', false, 'reason','unknown_demo'); end if;
  select * into v_s from public.demo_sandboxes
   where demo_id = p_demo and status not in ('cleaned','failed');
  if not found then
    return jsonb_build_object('ok', true, 'changed', false,
      'note','This demo has no live sandbox to keep in step.');
  end if;

  v_to := case v_d.status
    when 'disabled' then 'disabled'
    when 'expired'  then 'expired'
    when 'live'     then 'active'
    when 'resetting' then 'resetting'
    else v_s.status end;

  if v_to = v_s.status then
    return jsonb_build_object('ok', true, 'changed', false, 'status', v_s.status);
  end if;

  update public.demo_sandboxes
     set status = v_to,
         cleanup_status = case when v_to='expired' then 'pending' else cleanup_status end,
         updated_at = now()
   where id = v_s.id;

  insert into public.demo_domain_events
    (demo_id, product_id, event, actor_id, previous_state, new_state, reason)
  values (p_demo, v_d.product_id, 'sandbox.synced', auth.uid(), v_s.status, v_to,
          format('Followed the demo, which is %s.', v_d.status));

  return jsonb_build_object('ok', true, 'changed', true,
    'from', v_s.status, 'to', v_to);
end;
$$;

/* ------------------------------------------------------------ the console */

create or replace function public.mm_sandboxes(p_query jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text := nullif(p_query->>'status','');
  v_search text := nullif(btrim(coalesce(p_query->>'search','')),'');
  v_limit integer := least(greatest(coalesce((p_query->>'limit')::int,50),1),200);
  v_set record;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;
  select * into v_set from public.demo_sandbox_settings where id;

  return jsonb_build_object(
    'ok', true,
    'settings', to_jsonb(v_set),
    'capabilities', public.mm_sandbox_capabilities(),

    -- The four metric cards. Counted, never asserted.
    'active', (select count(*) from public.demo_sandboxes where status='active'),
    'resetting', (select count(*) from public.demo_sandboxes where status='resetting'),
    'expiring_24h', (select count(*) from public.demo_sandboxes
                      where status in ('active','expiring') and expires_at is not null
                        and expires_at <= now() + interval '24 hours'),
    'cleanups_today', (select count(*) from public.demo_sandbox_cleanup_jobs
                        where started_at >= date_trunc('day', now())),

    'by_status', coalesce((select jsonb_object_agg(status, n)
                             from (select status, count(*) n from public.demo_sandboxes
                                    group by status) t), '{}'::jsonb),
    'total', (select count(*) from public.demo_sandboxes),

    -- Read from Server Manager, never duplicated.
    'infrastructure', jsonb_build_object(
      'server_instances', (select count(*) from public.server_instances),
      'unhealthy_servers', (select count(*) from public.server_instances
                             where coalesce(status,'') not in ('running','active','healthy')),
      'note','Server Manager remains the infrastructure source of truth.'),

    'sandboxes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'sandbox_ref', s.sandbox_ref,
               'demo_id', s.demo_id,
               'hostname', (select hostname from public.demo_domains where id=s.demo_id),
               'demo_status', (select status from public.demo_domains where id=s.demo_id),
               'product_id', s.product_id,
               'product', (select name from public.marketplace_products where id=s.product_id),
               'owner', (select sel.display_name from public.marketplace_products p
                          join public.marketplace_sellers sel on sel.id=p.seller_id
                         where p.id=s.product_id),
               'status', s.status, 'failure_reason', s.failure_reason,
               'isolation', s.isolation_strategy,
               'health', s.health, 'last_health_at', s.last_health_at,
               'last_activity_at', s.last_activity_at,
               'last_reset_at', s.last_reset_at, 'next_reset_at', s.next_reset_at,
               'expires_at', s.expires_at, 'cleanup_after', s.cleanup_after,
               'cleanup_status', s.cleanup_status,
               'hours_remaining', case when s.expires_at is null then null
                 else greatest(0, round(extract(epoch from s.expires_at - now())/3600)::int) end,
               'qualifying_hits', (select count(*) from public.demo_sandbox_activity a
                                    where a.sandbox_id = s.id and a.qualifies),
               'credentials', coalesce((select jsonb_agg(jsonb_build_object(
                                 'role', c.role_type, 'username', c.username,
                                 'version', c.version, 'expires_at', c.expires_at)
                                 order by c.role_type)
                                 from public.demo_sandbox_credentials c
                                where c.sandbox_id = s.id and c.active), '[]'::jsonb),
               'baseline_captured', (select captured from public.demo_sandbox_snapshots sn
                                      where sn.sandbox_id = s.id
                                      order by sn.created_at desc limit 1),
               'last_reset', (select jsonb_build_object('outcome', r.outcome,
                                'stages', r.stages, 'at', r.finished_at)
                                from public.demo_sandbox_resets r
                               where r.sandbox_id = s.id order by r.started_at desc limit 1),
               'locked', exists (select 1 from public.demo_sandbox_jobs j
                                  where j.sandbox_id = s.id and j.holds_lock),
               'created_at', s.created_at)
             order by s.updated_at desc)
        from (select * from public.demo_sandboxes s2
               where (v_status is null or s2.status = v_status)
                 and (v_search is null
                      or s2.sandbox_ref ilike '%'||v_search||'%'
                      or exists (select 1 from public.marketplace_products p
                                  where p.id = s2.product_id
                                    and p.name ilike '%'||v_search||'%'))
               order by s2.updated_at desc limit v_limit) s), '[]'::jsonb));
end;
$$;

create or replace function public.mm_sandbox_settings_set(p_patch jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_before jsonb; v_after jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;
  select to_jsonb(s) into v_before from public.demo_sandbox_settings s where s.id;

  update public.demo_sandbox_settings set
    auto_reset_hours = coalesce((p_patch->>'auto_reset_hours')::int, auto_reset_hours),
    expire_after_idle_hours = coalesce((p_patch->>'expire_after_idle_hours')::int, expire_after_idle_hours),
    cleanup_at = coalesce((p_patch->>'cleanup_at')::time, cleanup_at),
    cleanup_timezone = coalesce(nullif(p_patch->>'cleanup_timezone',''), cleanup_timezone),
    grace_hours = coalesce((p_patch->>'grace_hours')::int, grace_hours),
    auto_reset_db = coalesce((p_patch->>'auto_reset_db')::boolean, auto_reset_db),
    auto_reset_uploads = coalesce((p_patch->>'auto_reset_uploads')::boolean, auto_reset_uploads),
    rotate_credentials = coalesce((p_patch->>'rotate_credentials')::boolean, rotate_credentials),
    rotate_credentials_days = coalesce((p_patch->>'rotate_credentials_days')::int, rotate_credentials_days),
    keep_session_logs = coalesce((p_patch->>'keep_session_logs')::boolean, keep_session_logs),
    session_log_retention_days = coalesce((p_patch->>'session_log_retention_days')::int, session_log_retention_days),
    updated_by = auth.uid(), updated_at = now()
  where id returning to_jsonb(demo_sandbox_settings) into v_after;

  perform public.mm_audit('sandbox.settings_changed','demo_sandbox_settings','settings',
                          v_before, v_after, nullif(p_patch->>'reason',''));
  return jsonb_build_object('ok', true, 'settings', v_after);
end;
$$;

-- Extend a sandbox rather than letting it expire.
create or replace function public.mm_sandbox_extend(p_sandbox uuid, p_hours integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_s record; v_after jsonb; v_set record;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;
  if p_hours is null or p_hours < 1 or p_hours > 8760 then
    return jsonb_build_object('ok', false, 'reason','bad_extension');
  end if;
  select * into v_s from public.demo_sandboxes where id = p_sandbox;
  if not found then return jsonb_build_object('ok', false, 'reason','unknown_sandbox'); end if;
  select * into v_set from public.demo_sandbox_settings where id;

  update public.demo_sandboxes
     set expires_at = greatest(coalesce(expires_at, now()), now()) + (p_hours || ' hours')::interval,
         cleanup_after = greatest(coalesce(expires_at, now()), now())
                       + ((p_hours + v_set.grace_hours) || ' hours')::interval,
         status = case when status in ('expiring','expired') then 'active' else status end,
         cleanup_status = case when status in ('expiring','expired') then 'none' else cleanup_status end,
         updated_at = now()
   where id = p_sandbox returning to_jsonb(demo_sandboxes) into v_after;

  insert into public.demo_sandbox_expiry_events (sandbox_id, kind, hours_out)
  values (p_sandbox, 'extended', p_hours) on conflict do nothing;

  perform public.mm_audit('sandbox.extended','demo_sandbox', p_sandbox::text,
                          to_jsonb(v_s), v_after, format('extended by %s hours', p_hours));

  return jsonb_build_object('ok', true, 'sandbox', v_after);
end;
$$;
