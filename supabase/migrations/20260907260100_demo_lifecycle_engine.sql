-- Demo Domain Manager, part two: slugs, gates, lifecycle.

/* ------------------------------------------------- 24/25/26/27. providers */

create or replace function public.mm_demo_provider_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_dns integer; v_ssl integer; v_dep integer;
begin
  select count(*) into v_dns from public.demo_provider_configs
   where kind='dns' and enabled and verified;
  select count(*) into v_ssl from public.demo_provider_configs
   where kind='ssl' and enabled and verified;
  select count(*) into v_dep from public.demo_provider_configs
   where kind='deployment' and enabled and verified;

  return jsonb_build_object(
    'dns', case when v_dns > 0 then 'CONNECTED' else 'REQUIRES_CONFIGURATION' end,
    'ssl', case when v_ssl > 0 then 'CONNECTED' else 'REQUIRES_CONFIGURATION' end,
    'deployment', case when v_dep > 0 then 'CONNECTED' else 'DEPLOYMENT_PROVIDER_NOT_CONFIGURED' end,
    'can_provision', v_dns > 0 and v_ssl > 0 and v_dep > 0,
    'providers', coalesce((select jsonb_agg(jsonb_build_object(
                   'slug', slug, 'label', label, 'kind', kind,
                   'enabled', enabled, 'verified', verified,
                   'credential_env', credential_env, 'last_error', last_error,
                   'state', case when enabled and verified then 'CONNECTED'
                                 when enabled then 'REQUIRES_CONFIGURATION'
                                 else 'NOT_CONFIGURED' end)
                 order by kind, slug) from public.demo_provider_configs), '[]'::jsonb),
    'note', case when v_dns > 0 and v_ssl > 0 and v_dep > 0 then null
      else 'No demo can be provisioned until DNS, SSL and a deployment runtime all authenticate. '
        || 'A demo record can be prepared and its hostname reserved, but it cannot reach LIVE.' end);
end;
$$;

/* --------------------------------------------------- 5. slug generation */

-- A safe, unique hostname label for a product.
--
-- Lowercase, URL-safe, length-limited, never a reserved name, and never one
-- already claimed by an active demo. A collision appends a number rather than
-- overwriting anybody.
create or replace function public.mm_demo_slug(p_product uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_name text; v_base text; v_try text; i integer := 1;
begin
  select name into v_name from public.marketplace_products where id = p_product;
  if v_name is null then
    return jsonb_build_object('ok', false, 'reason','unknown_product');
  end if;

  v_base := lower(btrim(v_name));
  v_base := regexp_replace(v_base, '[^a-z0-9]+', '-', 'g');
  v_base := regexp_replace(v_base, '(^-+|-+$)', '', 'g');
  v_base := regexp_replace(v_base, '-{2,}', '-', 'g');
  v_base := left(v_base, 48);
  v_base := regexp_replace(v_base, '-+$', '', 'g');

  if coalesce(v_base,'') = '' then
    v_base := 'product-' || left(replace(p_product::text,'-',''), 10);
  end if;
  -- A label may not begin with a digit or a hyphen.
  if v_base ~ '^[0-9-]' then v_base := 'p-' || v_base; end if;

  v_try := v_base;
  loop
    exit when not exists (select 1 from public.demo_reserved_slugs where slug = v_try)
          and not exists (select 1 from public.demo_domains
                           where slug = v_try
                             and status not in ('disabled','expired','failed'));
    i := i + 1;
    if i > 50 then
      return jsonb_build_object('ok', false, 'reason','could_not_generate');
    end if;
    v_try := left(v_base, 45) || '-' || i::text;
  end loop;

  return jsonb_build_object('ok', true, 'slug', v_try, 'base', v_base,
    'collisions', i - 1);
end;
$$;

/* ------------------------------------------- 21/22/20. eligibility gates */

-- May this product have a live demo at all?
--
-- Three gates, each owned by another module and read here rather than
-- re-implemented: Product Moderation decides publication, Upload Security
-- decides whether any asset is blocked, Brand Protection decides whether the
-- listing's branding is compliant.
create or replace function public.mm_demo_eligibility(p_product uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_p record; v_gates jsonb; v_blocked integer; v_brand integer;
begin
  select * into v_p from public.marketplace_products where id = p_product;
  if not found then
    return jsonb_build_object('ok', false, 'reason','unknown_product');
  end if;

  select count(*) into v_blocked from public.security_assets
   where product_id = p_product and status in ('blocked','quarantined');

  select count(*) into v_brand from public.brand_violation_cases
   where product_id = p_product and status in ('open','escalated','failed');

  v_gates := jsonb_build_array(
    jsonb_build_object('key','moderation','label','Product Moderation',
      'passed', v_p.moderation_status = 'approved' and v_p.visible,
      'detail', format('moderation_status is %s, visible is %s',
                       v_p.moderation_status, v_p.visible),
      'owner','Product Moderation Center'),
    jsonb_build_object('key','not_deleted','label','Not deleted or merged',
      'passed', v_p.deleted_at is null and v_p.merged_into is null,
      'detail', case when v_p.deleted_at is not null then 'this listing is deleted'
                     when v_p.merged_into is not null then 'this listing was merged into another'
                     else 'standalone and present' end,
      'owner','Product Moderation Center'),
    jsonb_build_object('key','security','label','No blocked or quarantined asset',
      'passed', v_blocked = 0,
      'detail', format('%s asset(s) blocked or quarantined', v_blocked),
      'owner','Upload Security Scanner'),
    jsonb_build_object('key','branding','label','No open branding violation',
      'passed', v_brand = 0,
      'detail', format('%s open branding case(s)', v_brand),
      'owner','Favicon & Branding Protection'),
    jsonb_build_object('key','legal','label','No unresolved legal record',
      'passed', not exists (select 1 from public.legal_violations v
                             where v.violator_id = p_product::text
                               and coalesce(v.status,'open') not in ('resolved','dismissed')),
      'detail','read from Legal Manager', 'owner','Legal Manager'));

  return jsonb_build_object(
    'ok', true, 'product_id', p_product,
    'gates', v_gates,
    'eligible', not exists (select 1 from jsonb_array_elements(v_gates) g
                             where not (g->>'passed')::boolean),
    'blocked_by', coalesce((select jsonb_agg(g->>'key') from jsonb_array_elements(v_gates) g
                             where not (g->>'passed')::boolean), '[]'::jsonb));
end;
$$;

/* -------------------------------------------------- 2/4. the lifecycle */

-- Prepare a demo record and reserve its hostname.
--
-- This is deliberately not called "provision": with no DNS, SSL or deployment
-- provider authenticating, nothing can be provisioned. What it does is real —
-- it generates a unique hostname, reserves it so no other product can take it,
-- runs the eligibility gates, and leaves the demo in the state the pipeline
-- actually reached. It never reports LIVE.
create or replace function public.mm_demo_provision(
  p_product uuid, p_pattern text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_s record; v_slug jsonb; v_elig jsonb; v_prov jsonb;
  v_host text; v_ref text; v_demo jsonb; v_job uuid; v_key text; v_existing record;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;
  select * into v_s from public.demo_access_settings where id;
  v_prov := public.mm_demo_provider_status();

  -- 22. Publication eligibility first. Nothing is reserved for a product that
  -- may not have a demo.
  v_elig := public.mm_demo_eligibility(p_product);
  if not (v_elig->>'ok')::boolean then return v_elig; end if;
  if not (v_elig->>'eligible')::boolean then
    return jsonb_build_object('ok', false, 'reason','not_eligible',
      'message','This product cannot have a demo yet.',
      'blocked_by', v_elig->'blocked_by', 'gates', v_elig->'gates');
  end if;

  -- 29. One active demo per product; asking twice does not build two.
  select * into v_existing from public.demo_domains
   where product_id = p_product and status <> 'expired';
  if found then
    return jsonb_build_object('ok', false, 'reason','already_provisioned',
      'message', format('This product already has a demo at %s (%s).',
                        v_existing.hostname, v_existing.status),
      'demo_id', v_existing.id);
  end if;

  v_slug := public.mm_demo_slug(p_product);
  if not (v_slug->>'ok')::boolean then return v_slug; end if;

  v_host := case coalesce(p_pattern, v_s.default_pattern)
              when 'shared' then v_s.base_domain
              else (v_slug->>'slug') || '.' || v_s.base_domain end;
  -- Unique per demo, not per product-and-transaction. Deriving it from
  -- md5(product || now()) collided when a failed demo was provisioned again,
  -- because now() is the transaction timestamp and does not move.
  v_ref := 'DEMO-' || upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 10));

  insert into public.demo_domains
    (product_id, demo_ref, slug, hostname, pattern, environment,
     password_protected, allow_indexing, expires_at, grace_until,
     status, dns_status, ssl_status, created_by)
  values (p_product, v_ref, v_slug->>'slug', v_host,
          coalesce(p_pattern, v_s.default_pattern), 'demo',
          v_s.password_protect_by_default, not v_s.block_search_indexing,
          now() + (v_s.default_ttl_days || ' days')::interval,
          now() + ((v_s.default_ttl_days + v_s.grace_days) || ' days')::interval,
          -- The state the pipeline actually reaches. With no DNS provider
          -- nothing is attempted, so this is a prepared draft rather than a
          -- failure — and its hostname is reserved either way.
          case when (v_prov->>'dns') = 'CONNECTED' then 'provisioning' else 'draft' end,
          'dns_pending', 'pending', auth.uid())
  returning to_jsonb(demo_domains) into v_demo;

  if (v_prov->>'dns') <> 'CONNECTED' then
    update public.demo_domains
       set failure_reason = format('DNS is %s. %s',
             v_prov->>'dns',
             (select last_error from public.demo_provider_configs where slug='cloudflare_dns'))
     where id = (v_demo->>'id')::uuid
    returning to_jsonb(demo_domains) into v_demo;
  end if;

  v_key := 'demo_provision:' || p_product::text || ':' || v_ref;
  insert into public.demo_provision_jobs
    (demo_id, operation, status, idempotency_key, actor_id, started_at, finished_at,
     error_category, error_detail, provider)
  values ((v_demo->>'id')::uuid, 'provision',
          case when (v_prov->>'dns')='CONNECTED' then 'queued' else 'blocked' end,
          v_key, auth.uid(), now(),
          case when (v_prov->>'dns')='CONNECTED' then null else now() end,
          case when (v_prov->>'dns')='CONNECTED' then null else 'provider_not_configured' end,
          case when (v_prov->>'dns')='CONNECTED' then null
               else 'DNS, SSL and a deployment runtime must all authenticate before a demo can be provisioned.' end,
          'cloudflare')
  returning id into v_job;

  -- 17. The QR target is the real hostname, whatever state it is in.
  insert into public.demo_qr_codes (demo_id, target_url)
  values ((v_demo->>'id')::uuid, 'https://' || v_host);

  insert into public.demo_domain_events
    (demo_id, job_id, product_id, event, actor_id, new_state, reason, detail)
  values ((v_demo->>'id')::uuid, v_job, p_product, 'demo.prepared', auth.uid(),
          v_demo->>'status',
          case when (v_prov->>'dns')='CONNECTED' then 'Provisioning started.'
               else 'Hostname reserved; provisioning cannot start without a DNS provider.' end,
          jsonb_build_object('hostname', v_host, 'providers', v_prov));

  perform public.mm_audit('demo.prepared','demo_domain', (v_demo->>'id'), null, v_demo, null);

  return jsonb_build_object('ok', true, 'demo', v_demo, 'job_id', v_job,
    'hostname', v_host, 'url', 'https://' || v_host,
    'providers', v_prov,
    'provisioned', (v_prov->>'dns') = 'CONNECTED',
    'note', case when (v_prov->>'dns') = 'CONNECTED' then null
      else 'The hostname is reserved and nobody else can take it, but nothing was provisioned: '
        || 'no DNS, SSL or deployment provider authenticates. The demo is recorded as failed with the reason.' end);
end;
$$;

/* -------------------------------------------------- 11/12/13. operations */

create or replace function public.mm_demo_operation(
  p_demo uuid, p_op text, p_reason text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_d record; v_after jsonb; v_prov jsonb; v_allowed boolean;
  v_job uuid; v_key text; v_owner uuid; v_to text;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;
  if p_op not in ('enable','disable','reset','regenerate','renew','destroy') then
    return jsonb_build_object('ok', false, 'reason','unknown_operation');
  end if;

  select * into v_d from public.demo_domains where id = p_demo for update;
  if not found then return jsonb_build_object('ok', false, 'reason','unknown_demo'); end if;
  v_prov := public.mm_demo_provider_status();

  if p_op in ('disable','reset','regenerate','destroy')
     and coalesce(btrim(p_reason),'') = '' then
    return jsonb_build_object('ok', false, 'reason','reason_required',
      'message','This changes live infrastructure. Say why; it is recorded permanently.');
  end if;

  -- 11. Disabling never destroys DNS or the deployment.
  v_allowed := case p_op
    when 'disable'    then v_d.status not in ('disabled')
    when 'enable'     then v_d.status in ('disabled','expired')
    when 'reset'      then v_d.status in ('live','disabled','degraded')
    -- A prepared draft is the commonest thing to regenerate: it is the retry
    -- after provisioning could not start.
    when 'regenerate' then v_d.status in ('draft','live','disabled','failed','expired')
    when 'renew'      then v_d.status in ('live','disabled','expired')
    when 'destroy'    then true
    else false end;
  if not v_allowed then
    return jsonb_build_object('ok', false, 'reason','invalid_operation',
      'message', format('A %s demo cannot be %sd.', v_d.status, p_op));
  end if;

  -- Enable, reset and regenerate all need infrastructure. Without a provider
  -- they are refused rather than reported as done.
  if p_op in ('enable','reset','regenerate') and not (v_prov->>'can_provision')::boolean then
    v_key := 'demo_'||p_op||':'||p_demo::text||':'||extract(epoch from now())::bigint::text;
    insert into public.demo_provision_jobs
      (demo_id, operation, status, idempotency_key, actor_id, started_at, finished_at,
       error_category, error_detail)
    values (p_demo, case p_op when 'enable' then 'enable' when 'reset' then 'reset'
                              else 'regenerate' end,
            'blocked', v_key, auth.uid(), now(), now(), 'provider_not_configured',
            'DNS, SSL and a deployment runtime must all authenticate first.');

    insert into public.demo_domain_events
      (demo_id, job_id, product_id, event, actor_id, reason, detail)
    values (p_demo, null, v_d.product_id, 'operation.blocked', auth.uid(),
            format('%s was refused: no provider is configured.', p_op), v_prov);

    return jsonb_build_object('ok', false, 'reason','provider_not_configured',
      'message', format('%s needs DNS, SSL and a deployment runtime. None of them authenticates, so nothing was changed.', initcap(p_op)),
      'providers', v_prov);
  end if;

  v_to := case p_op
    when 'disable' then 'disabled'
    when 'enable' then 'health_check'
    when 'reset' then 'resetting'
    when 'regenerate' then 'provisioning'
    when 'renew' then v_d.status
    when 'destroy' then 'disabled'
    else v_d.status end;

  update public.demo_domains
     set status = v_to,
         -- 16. Renewing pushes the dates out from the settings, never silently.
         expires_at = case when p_op='renew'
                           then now() + ((select default_ttl_days from public.demo_access_settings where id) || ' days')::interval
                           else expires_at end,
         grace_until = case when p_op='renew'
                            then now() + (((select default_ttl_days from public.demo_access_settings where id)
                                         + (select grace_days from public.demo_access_settings where id)) || ' days')::interval
                            else grace_until end,
         failure_reason = case when p_op in ('enable','reset','regenerate') then null
                               else failure_reason end,
         updated_at = now()
   where id = p_demo returning to_jsonb(demo_domains) into v_after;

  if p_op = 'renew' then
    insert into public.demo_expiry_events (demo_id, kind, days_out)
    values (p_demo, 'renewed', null) on conflict do nothing;
  end if;

  insert into public.demo_domain_events
    (demo_id, product_id, event, actor_id, previous_state, new_state, reason)
  values (p_demo, v_d.product_id, 'demo.'||p_op, auth.uid(), v_d.status, v_to, p_reason);

  perform public.mm_audit('demo.'||p_op,'demo_domain', p_demo::text,
                          to_jsonb(v_d), v_after, p_reason);

  select s.owner_user_id into v_owner
    from public.marketplace_products p
    join public.marketplace_sellers s on s.id = p.seller_id
   where p.id = v_d.product_id;
  if v_owner is not null and p_op in ('disable','destroy') then
    perform public.mm_notify('demo.'||p_op,
      format('Your demo at %s was %sd', v_d.hostname, p_op),
      coalesce(p_reason,''), v_owner, null, '/author-manager', 'Open', 5, 'warning');
  end if;

  return jsonb_build_object('ok', true, 'demo', v_after,
    'note', case when p_op='disable'
      then 'The demo is unavailable. DNS, the certificate and the deployment were left in place, so enabling it again does not rebuild anything.'
      else null end);
end;
$$;
