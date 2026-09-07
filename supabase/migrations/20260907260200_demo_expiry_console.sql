-- Demo Domain Manager, part three: expiry, health, the console.

/* ------------------------------------------------------ 16. expiry engine */

-- Send the configured reminders, start grace periods and expire what is due.
--
-- Everything is measured from each demo's own timestamps against the configured
-- thresholds. Nothing is deleted: an expired demo is disabled and kept, and a
-- reminder is recorded once per threshold so a nightly run does not spam.
create or replace function public.mm_demo_expiry_run()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_s record; d integer; r record;
  v_reminded integer := 0; v_grace integer := 0; v_expired integer := 0;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;
  select * into v_s from public.demo_access_settings where id;

  -- Reminders, at each configured threshold.
  foreach d in array v_s.reminder_days loop
    for r in
      select * from public.demo_domains
       where status in ('live','disabled')
         and expires_at is not null
         and expires_at between now() and now() + (d || ' days')::interval
         and not exists (select 1 from public.demo_expiry_events e
                          where e.demo_id = demo_domains.id
                            and e.kind='reminder' and e.days_out = d)
    loop
      insert into public.demo_expiry_events (demo_id, kind, days_out, notified)
      values (r.id, 'reminder', d, true) on conflict do nothing;
      v_reminded := v_reminded + 1;

      perform public.mm_notify('demo.expiring',
        format('%s expires in %s day(s)', r.hostname, d),
        format('The demo for this product expires on %s. Renew it or it will be disabled.',
               to_char(r.expires_at, 'DD Mon YYYY')),
        null, array['admin','boss'], '/marketplace-manager', 'Open',
        60 * 24, case when d <= 3 then 'warning' else 'info' end);
    end loop;
  end loop;

  -- Past expiry but inside grace: recorded, still reachable.
  for r in
    select * from public.demo_domains
     where status = 'live' and expires_at is not null and expires_at <= now()
       and (grace_until is null or grace_until > now())
  loop
    insert into public.demo_expiry_events (demo_id, kind, days_out)
    values (r.id, 'grace_started', 0) on conflict do nothing;
    v_grace := v_grace + 1;
  end loop;

  -- Past grace: disabled, never deleted.
  for r in
    select * from public.demo_domains
     where status in ('live','disabled')
       and expires_at is not null and expires_at <= now()
       and grace_until is not null and grace_until <= now()
       and status <> 'expired'
  loop
    update public.demo_domains
       set status='expired', updated_at=now() where id = r.id;
    insert into public.demo_expiry_events (demo_id, kind, days_out)
    values (r.id, 'expired', 0) on conflict do nothing;
    insert into public.demo_domain_events
      (demo_id, product_id, event, actor_id, previous_state, new_state, reason)
    values (r.id, r.product_id, 'demo.expired', auth.uid(), r.status, 'expired',
            'The grace period ended. The demo was disabled; nothing was deleted.');
    v_expired := v_expired + 1;
  end loop;

  return jsonb_build_object('ok', true,
    'thresholds', to_jsonb(v_s.reminder_days),
    'reminded', v_reminded, 'entered_grace', v_grace, 'expired', v_expired,
    'note','An expired demo is disabled and kept. Its DNS record, certificate and deployment history are preserved for an authorised renewal.');
end;
$$;

/* ---------------------------------------------------------- the console */

create or replace function public.mm_demo_domains(p_query jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tab text := coalesce(p_query->>'tab','all');
  v_search text := nullif(btrim(coalesce(p_query->>'search','')),'');
  v_limit integer := least(greatest(coalesce((p_query->>'limit')::int,50),1),200);
  v_offset integer := greatest(coalesce((p_query->>'offset')::int,0),0);
  v_s record; v_prov jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;
  select * into v_s from public.demo_access_settings where id;
  v_prov := public.mm_demo_provider_status();

  return jsonb_build_object(
    'ok', true, 'tab', v_tab,
    'settings', to_jsonb(v_s),
    'providers', v_prov,

    'counts', jsonb_build_object(
      'total',      (select count(*) from public.demo_domains),
      'live',       (select count(*) from public.demo_domains where status='live'),
      'provisioning',(select count(*) from public.demo_domains
                       where status in ('provisioning','dns_pending','ssl_pending','deploying','health_check')),
      'resetting',  (select count(*) from public.demo_domains where status='resetting'),
      'disabled',   (select count(*) from public.demo_domains where status='disabled'),
      'expired',    (select count(*) from public.demo_domains where status='expired'),
      'failed',     (select count(*) from public.demo_domains where status='failed')),

    -- The demos this marketplace actually has today, and where they live. All
    -- thirteen are hosted by a third party, which is a different thing from a
    -- provisioned Software Vala demo.
    'external_demos', jsonb_build_object(
      'count', (select count(*) from public.product_demo_urls where status='active'),
      'hosts', coalesce((select jsonb_object_agg(host, n) from (
                 select split_part(split_part(url,'//',2),'/',1) host, count(*) n
                   from public.product_demo_urls where status='active'
                  group by 1 order by 2 desc limit 10) t), '{}'::jsonb),
      'note','These are the live demos the marketplace links to today. They are hosted elsewhere, not provisioned on Software Vala infrastructure, and this module does not control their DNS, certificates or branding.'),

    -- Health comes from the monitor that already runs every fifteen minutes.
    'health', jsonb_build_object(
      'checks_recorded', (select count(*) from public.demo_health),
      'last_check', (select max(checked_at) from public.demo_health),
      'working', (select count(*) from public.product_demo_urls where last_result='working'),
      'slow', (select count(*) from public.product_demo_urls where last_result='slow'),
      'offline', (select count(*) from public.product_demo_urls where last_result='offline'),
      'unknown', (select count(*) from public.product_demo_urls
                   where last_result is null or last_result='unknown')),

    -- Server Manager is the infrastructure source of truth; this reads it.
    'infrastructure', jsonb_build_object(
      'server_instances', (select count(*) from public.server_instances),
      'regions', (select count(*) from public.server_regions),
      'deployments', (select count(*) from public.server_deployments),
      'note','Read from Server Manager. This module keeps no server inventory of its own.'),

    'total', (select count(*) from public.demo_domains d
               where case v_tab
                 when 'live' then d.status='live'
                 when 'resetting' then d.status='resetting'
                 when 'disabled' then d.status='disabled'
                 when 'expired' then d.status='expired'
                 else true end),

    'demos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', d.id, 'demo_ref', d.demo_ref,
               'product_id', d.product_id,
               'product', (select name from public.marketplace_products where id=d.product_id),
               'owner', (select s.display_name from public.marketplace_products p
                          join public.marketplace_sellers s on s.id=p.seller_id
                         where p.id=d.product_id),
               'slug', d.slug, 'hostname', d.hostname,
               'url', 'https://' || d.hostname,
               'status', d.status, 'failure_reason', d.failure_reason,
               'dns_status', d.dns_status, 'ssl_status', d.ssl_status,
               'ssl_expires_at', d.ssl_expires_at,
               'health', d.health, 'last_health_at', d.last_health_at,
               'password_protected', d.password_protected,
               'allow_indexing', d.allow_indexing,
               'expires_at', d.expires_at, 'grace_until', d.grace_until,
               'days_remaining', case when d.expires_at is null then null
                                      else greatest(0, extract(day from d.expires_at - now())::int) end,
               'created_at', d.created_at, 'updated_at', d.updated_at,
               'qr', (select jsonb_build_object('target', q.target_url,
                        'scan_count', q.scan_count,
                        'analytics','not tracked')
                        from public.demo_qr_codes q
                       where q.demo_id = d.id and q.active limit 1),
               'jobs', (select count(*) from public.demo_provision_jobs j where j.demo_id = d.id),
               'last_job', (select jsonb_build_object('operation', j.operation,
                              'status', j.status, 'error', j.error_detail)
                              from public.demo_provision_jobs j
                             where j.demo_id = d.id order by j.created_at desc limit 1))
             order by d.updated_at desc)
        from (select * from public.demo_domains d2
               where case v_tab
                 when 'live' then d2.status='live'
                 when 'resetting' then d2.status='resetting'
                 when 'disabled' then d2.status='disabled'
                 when 'expired' then d2.status='expired'
                 else true end
                 and (v_search is null
                      or d2.hostname ilike '%'||v_search||'%'
                      or d2.slug ilike '%'||v_search||'%'
                      or d2.demo_ref ilike '%'||v_search||'%')
               order by d2.updated_at desc limit v_limit offset v_offset) d), '[]'::jsonb),

    'events', coalesce((select jsonb_agg(jsonb_build_object(
                 'event', e.event, 'at', e.created_at, 'reason', e.reason,
                 'from', e.previous_state, 'to', e.new_state)
               order by e.created_at desc)
                 from (select * from public.demo_domain_events
                        order by created_at desc limit 25) e), '[]'::jsonb));
end;
$$;

create or replace function public.mm_demo_settings_set(p_patch jsonb)
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
  select to_jsonb(s) into v_before from public.demo_access_settings s where s.id;

  update public.demo_access_settings set
    base_domain = coalesce(nullif(p_patch->>'base_domain',''), base_domain),
    default_pattern = coalesce(nullif(p_patch->>'default_pattern',''), default_pattern),
    auto_provision_on_publish = coalesce((p_patch->>'auto_provision_on_publish')::boolean, auto_provision_on_publish),
    password_protect_by_default = coalesce((p_patch->>'password_protect_by_default')::boolean, password_protect_by_default),
    block_search_indexing = coalesce((p_patch->>'block_search_indexing')::boolean, block_search_indexing),
    default_ttl_days = coalesce((p_patch->>'default_ttl_days')::int, default_ttl_days),
    grace_days = coalesce((p_patch->>'grace_days')::int, grace_days),
    updated_by = auth.uid(), updated_at = now()
  where id returning to_jsonb(demo_access_settings) into v_after;

  insert into public.demo_domain_events (event, actor_id, reason, detail)
  values ('settings.changed', auth.uid(), nullif(p_patch->>'reason',''),
          jsonb_build_object('before', v_before, 'after', v_after));

  perform public.mm_audit('demo.settings_changed','demo_access_settings','settings',
                          v_before, v_after, nullif(p_patch->>'reason',''));
  return jsonb_build_object('ok', true, 'settings', v_after);
end;
$$;

/* ------------------------------------------------------ 9. the password */

-- Set or clear a demo password. The plaintext is hashed here and never stored.
create or replace function public.mm_demo_password_set(
  p_demo uuid, p_password text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp, extensions
as $$
declare v_d record;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;
  select * into v_d from public.demo_domains where id = p_demo;
  if not found then return jsonb_build_object('ok', false, 'reason','unknown_demo'); end if;

  if p_password is null or btrim(p_password) = '' then
    update public.demo_domains
       set password_hash = null, password_set_at = null,
           password_protected = false, updated_at = now()
     where id = p_demo;
    insert into public.demo_domain_events (demo_id, product_id, event, actor_id, new_state, reason)
    values (p_demo, v_d.product_id, 'demo.password_cleared', auth.uid(), 'open',
            'Password protection removed.');
    return jsonb_build_object('ok', true, 'password_protected', false);
  end if;

  if length(p_password) < 8 then
    return jsonb_build_object('ok', false, 'reason','password_too_short',
      'message','A demo password needs at least eight characters.');
  end if;

  update public.demo_domains
     set password_hash = crypt(p_password, gen_salt('bf', 10)),
         password_set_at = now(), password_protected = true, updated_at = now()
   where id = p_demo;

  insert into public.demo_domain_events (demo_id, product_id, event, actor_id, new_state, reason)
  values (p_demo, v_d.product_id, 'demo.password_set', auth.uid(), 'protected',
          'Password set. Only the hash is stored.');

  perform public.mm_audit('demo.password_set','demo_domain', p_demo::text, null,
                          jsonb_build_object('password_protected', true), null);

  -- The plaintext is deliberately not returned. Whoever set it already has it.
  return jsonb_build_object('ok', true, 'password_protected', true,
    'note','Only a bcrypt hash is stored. The password itself is not kept and is not returned here.');
end;
$$;
