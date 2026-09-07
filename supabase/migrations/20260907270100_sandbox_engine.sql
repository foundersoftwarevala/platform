-- Demo Sandbox Controls, part two: the engine.

/* -------------------------------------------------- capability reporting */

-- What this system can actually do to a sandbox right now.
--
-- Split deliberately: some of it is real regardless of infrastructure, and some
-- of it needs a runtime that does not exist. Reporting them together as one
-- "sandbox status" would hide which is which.
create or replace function public.mm_sandbox_capabilities()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_dep jsonb;
begin
  v_dep := public.mm_demo_provider_status();

  return jsonb_build_object(
    'isolation', jsonb_build_object(
      'state','NOT_IMPLEMENTED',
      'detail','No sandbox container, schema or tenant is created, because no deployment runtime exists. Section 4 forbids claiming isolation that has not been implemented, so no sandbox records one.'),
    'database_reset', jsonb_build_object(
      'state','BLOCKED',
      'detail','A real database reset needs the sandbox runtime that would own the sandbox database. Reset jobs are recorded as blocked, never as done.'),
    'uploads_reset', jsonb_build_object(
      'state','BLOCKED',
      'detail','Same runtime. No sandbox-scoped storage exists to clear.'),
    'infrastructure_cleanup', jsonb_build_object(
      'state','BLOCKED',
      'detail','Temporary deployments, servers and DNS records cannot be released because none are created.'),
    'credential_rotation', jsonb_build_object(
      'state','CONNECTED',
      'detail','Generation, hashing, invalidation of the previous credential and the audit entry are all real and run here. Applying a credential to a running demo needs the runtime.'),
    'activity_tracking', jsonb_build_object('state','CONNECTED',
      'detail','Hits are recorded against the sandbox and drive the idle expiry.'),
    'expiry_engine', jsonb_build_object('state','CONNECTED',
      'detail','Warnings and expiry are computed from each sandbox''s own timestamps.'),
    'record_cleanup', jsonb_build_object('state','CONNECTED',
      'detail','Expired sessions and stale jobs are cleared. Audit, product, legal and deployment history are never touched.'),
    'health_checks', jsonb_build_object('state','PARTIALLY_CONNECTED',
      'detail','Domain and HTTPS reachability come from the demo monitor that already runs. Application, database and authentication checks need the runtime and are recorded as skipped rather than passed.'),
    'deployment_provider', v_dep->'deployment',
    'can_operate_infrastructure', false);
end;
$$;

/* --------------------------------------------------- 1. sandbox creation */

create or replace function public.mm_sandbox_create(p_demo uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_d record; v_s record; v_ref text; v_row jsonb; v_job uuid; v_cap jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;
  select * into v_d from public.demo_domains where id = p_demo;
  if not found then return jsonb_build_object('ok', false, 'reason','unknown_demo'); end if;

  -- 20. Product Moderation decides whether a sandbox may exist at all.
  if not exists (select 1 from public.marketplace_products
                  where id = v_d.product_id and moderation_status='approved' and visible) then
    return jsonb_build_object('ok', false, 'reason','product_not_published',
      'message','Only an approved, published product may have a sandbox.');
  end if;

  if exists (select 1 from public.demo_sandboxes
              where demo_id = p_demo and status not in ('cleaned','failed')) then
    return jsonb_build_object('ok', false, 'reason','already_exists',
      'message','This demo already has a sandbox.');
  end if;

  select * into v_s from public.demo_sandbox_settings where id;
  v_cap := public.mm_sandbox_capabilities();
  v_ref := 'SBX-' || upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 10));

  insert into public.demo_sandboxes
    (sandbox_ref, demo_id, product_id, server_instance_id,
     status, isolation_strategy, next_reset_at, expires_at, cleanup_after,
     failure_reason, created_by)
  values (v_ref, p_demo, v_d.product_id, v_d.server_instance_id,
          -- Without a runtime the sandbox is a record, not an environment.
          'provisioning', 'none',
          now() + (v_s.auto_reset_hours || ' hours')::interval,
          now() + (v_s.expire_after_idle_hours || ' hours')::interval,
          now() + ((v_s.expire_after_idle_hours + v_s.grace_hours) || ' hours')::interval,
          'No deployment runtime exists, so no sandbox environment was created. '
          || 'The record, its credentials, activity tracking and expiry are real; the environment is not.',
          auth.uid())
  returning to_jsonb(demo_sandboxes) into v_row;

  insert into public.demo_sandbox_jobs
    (sandbox_id, operation, status, idempotency_key, actor_id,
     started_at, finished_at, error_category, error_detail)
  values ((v_row->>'id')::uuid, 'create', 'blocked',
          'sandbox_create:' || v_ref, auth.uid(), now(), now(),
          'runtime_not_configured',
          'A sandbox environment needs a deployment runtime. None is configured.')
  returning id into v_job;

  -- 23. The baseline is recorded but explicitly not captured: there is nothing
  -- to capture from.
  insert into public.demo_sandbox_snapshots
    (sandbox_id, version, captured, note)
  values ((v_row->>'id')::uuid, 'baseline-1', false,
          'No baseline has been captured. A reset cannot restore a baseline that was never taken, which is why reset is blocked rather than reported as done.');

  insert into public.demo_domain_events
    (demo_id, product_id, event, actor_id, new_state, reason, detail)
  values (p_demo, v_d.product_id, 'sandbox.created', auth.uid(), 'provisioning',
          'Sandbox record created; no environment was provisioned.', v_cap);

  perform public.mm_audit('sandbox.created','demo_sandbox', (v_row->>'id'), null, v_row, null);

  return jsonb_build_object('ok', true, 'sandbox', v_row, 'job_id', v_job,
    'capabilities', v_cap,
    'note','The sandbox record exists and its lifecycle is real. No environment was created, so it is not active and cannot be.');
end;
$$;

/* ------------------------------------------------ 6. activity and last hit */

-- Record a hit against a sandbox and push its idle expiry out.
--
-- A heartbeat does not qualify: section 6 is explicit that a page merely being
-- open must not keep a sandbox alive unless the policy says so.
create or replace function public.mm_sandbox_activity(
  p_sandbox uuid, p_kind text default 'http', p_path text default null,
  p_status integer default null, p_latency integer default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_s record; v_set record; v_q boolean;
begin
  select * into v_s from public.demo_sandboxes where id = p_sandbox;
  if not found then return jsonb_build_object('ok', false, 'reason','unknown_sandbox'); end if;
  select * into v_set from public.demo_sandbox_settings where id;

  v_q := p_kind <> 'heartbeat';

  insert into public.demo_sandbox_activity
    (sandbox_id, kind, qualifies, path, status_code, latency_ms)
  values (p_sandbox, p_kind, v_q, p_path, p_status, p_latency);

  if v_q then
    update public.demo_sandboxes
       set last_activity_at = now(),
           expires_at = now() + (v_set.expire_after_idle_hours || ' hours')::interval,
           cleanup_after = now() + ((v_set.expire_after_idle_hours + v_set.grace_hours) || ' hours')::interval,
           -- A hit on an expiring sandbox brings it back.
           status = case when status='expiring' then 'active' else status end,
           updated_at = now()
     where id = p_sandbox;
  end if;

  return jsonb_build_object('ok', true, 'qualifies', v_q,
    'note', case when v_q then null
      else 'A heartbeat was recorded but does not extend the sandbox. Only a real request, an authenticated action or an interaction does.' end);
end;
$$;

/* ------------------------------------------------ 10/13. credentials */

-- Generate or rotate a sandbox credential.
--
-- The plaintext is returned exactly once, to the operator who asked. Only a
-- bcrypt hash is stored, the previous credential is deactivated in the same
-- statement, and the rotation is audited. Applying the new credential to a
-- running demo needs the runtime, and that is reported rather than assumed.
create or replace function public.mm_sandbox_rotate_credential(
  p_sandbox uuid, p_role text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp, extensions
as $$
declare
  v_s record; v_set record; v_alphabet constant text :=
    'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  v_pw text := ''; v_bytes bytea; i integer; v_user text; v_prev integer := 0;
  v_row jsonb; v_cap jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;
  if p_role not in ('demo_user','demo_admin') then
    return jsonb_build_object('ok', false, 'reason','unknown_role');
  end if;
  select * into v_s from public.demo_sandboxes where id = p_sandbox for update;
  if not found then return jsonb_build_object('ok', false, 'reason','unknown_sandbox'); end if;
  select * into v_set from public.demo_sandbox_settings where id;

  -- 20 characters over a mixed alphabet with no look-alike glyphs.
  v_bytes := gen_random_bytes(20);
  for i in 0..19 loop
    v_pw := v_pw || substr(v_alphabet, (get_byte(v_bytes, i) % length(v_alphabet)) + 1, 1);
  end loop;

  v_user := case p_role when 'demo_admin' then 'admin' else 'demo' end
            || '@' || lower(left(v_s.sandbox_ref, 14));

  select coalesce(max(version),0) into v_prev
    from public.demo_sandbox_credentials where sandbox_id = p_sandbox and role_type = p_role;

  -- The previous credential stops working in the same statement that creates
  -- the new one, so there is never a window where both are valid.
  update public.demo_sandbox_credentials
     set active = false, rotated_at = now(), rotated_by = auth.uid()
   where sandbox_id = p_sandbox and role_type = p_role and active;

  insert into public.demo_sandbox_credentials
    (sandbox_id, role_type, username, password_hash, version, active, expires_at)
  values (p_sandbox, p_role, v_user, crypt(v_pw, gen_salt('bf', 10)),
          v_prev + 1, true,
          case when v_set.rotate_credentials
               then now() + (v_set.rotate_credentials_days || ' days')::interval
               else null end)
  returning to_jsonb(demo_sandbox_credentials) into v_row;

  insert into public.demo_sandbox_jobs
    (sandbox_id, operation, status, idempotency_key, actor_id, started_at, finished_at,
     error_category, error_detail)
  values (p_sandbox, 'rotate_credentials', 'succeeded',
          'sandbox_rotate:' || p_sandbox::text || ':' || p_role || ':' || (v_prev + 1)::text,
          auth.uid(), now(), now(), null, null);

  -- The audit records that a rotation happened, never what was generated.
  perform public.mm_audit('sandbox.credential_rotated','demo_sandbox', p_sandbox::text,
    jsonb_build_object('role', p_role, 'previous_version', v_prev),
    jsonb_build_object('role', p_role, 'version', v_prev + 1, 'username', v_user),
    null);

  v_cap := public.mm_sandbox_capabilities();

  return jsonb_build_object('ok', true,
    'username', v_user,
    -- Shown once. Nothing stores it and no read returns it again.
    'password', v_pw,
    'version', v_prev + 1,
    'previous_invalidated', v_prev > 0,
    'applied_to_demo', false,
    'note','Copy this now: only a bcrypt hash is stored and this password is never shown again. '
        || 'The credential is recorded and the previous one is already invalid, but it has not been applied to a running demo — no deployment runtime exists to apply it to.');
end;
$$;

/* --------------------------------------------------------- 5/24. reset */

-- Reset a sandbox to its baseline.
--
-- The lock is taken first, so repeated clicks cannot start two resets. Each
-- stage records what it actually did; with no runtime the database and uploads
-- stages are blocked and the reset is recorded as blocked, never as succeeded.
create or replace function public.mm_sandbox_reset(
  p_sandbox uuid, p_trigger text default 'manual')
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_s record; v_set record; v_cap jsonb; v_job uuid; v_reset uuid;
  v_snapshot record; v_stages jsonb; v_outcome text; v_brand jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;
  select * into v_s from public.demo_sandboxes where id = p_sandbox for update;
  if not found then return jsonb_build_object('ok', false, 'reason','unknown_sandbox'); end if;

  -- 24. One job at a time. A second click finds the lock held.
  if exists (select 1 from public.demo_sandbox_jobs
              where sandbox_id = p_sandbox and holds_lock) then
    return jsonb_build_object('ok', false, 'reason','locked',
      'message','Another operation is already running on this sandbox. Wait for it to finish.');
  end if;

  select * into v_set from public.demo_sandbox_settings where id;
  v_cap := public.mm_sandbox_capabilities();

  insert into public.demo_sandbox_jobs
    (sandbox_id, operation, status, idempotency_key, actor_id, started_at, holds_lock)
  values (p_sandbox, 'reset', 'running',
          'sandbox_reset:' || p_sandbox::text || ':' || extract(epoch from clock_timestamp())::bigint::text,
          auth.uid(), now(), true)
  returning id into v_job;

  update public.demo_sandboxes set status='resetting', updated_at=now() where id=p_sandbox;

  select * into v_snapshot from public.demo_sandbox_snapshots
   where sandbox_id = p_sandbox order by created_at desc limit 1;

  -- 22. Branding is the one stage that can genuinely run: it operates on the
  -- product's listing branding, which lives in this database.
  v_brand := public.mm_brand_detect(v_s.product_id);

  v_stages := jsonb_build_object(
    'lock', 'acquired',
    'baseline', case when v_snapshot.captured then 'restored'
                     else 'unavailable — no baseline has ever been captured' end,
    'database_reset', case when v_set.auto_reset_db then 'blocked — no sandbox runtime' else 'disabled by policy' end,
    'uploads_reset', case when v_set.auto_reset_uploads then 'blocked — no sandbox runtime' else 'disabled by policy' end,
    'branding', case when (v_brand->>'non_compliant')::int = 0
                     then 'verified compliant' else 'non-compliant listing branding found' end,
    'health_check', 'skipped — nothing is deployed to check');

  v_outcome := 'blocked';

  insert into public.demo_sandbox_resets
    (sandbox_id, job_id, trigger, stages, database_reset, uploads_reset,
     branding_reapplied, health_passed, outcome, failure_reason, finished_at)
  values (p_sandbox, v_job, p_trigger, v_stages, false, false,
          (v_brand->>'non_compliant')::int = 0, false, v_outcome,
          'No deployment runtime exists, so nothing could be reset. The sandbox was not changed.',
          now())
  returning id into v_reset;

  -- 28. A blocked or partial reset never leaves the sandbox looking active.
  update public.demo_sandboxes
     set status = case when v_outcome = 'succeeded' then 'active' else 'failed' end,
         last_reset_at = case when v_outcome='succeeded' then now() else last_reset_at end,
         next_reset_at = now() + (v_set.auto_reset_hours || ' hours')::interval,
         failure_reason = case when v_outcome='succeeded' then null
                               else 'The last reset could not run: no deployment runtime exists.' end,
         updated_at = now()
   where id = p_sandbox;

  update public.demo_sandbox_jobs
     set status = case when v_outcome='succeeded' then 'succeeded' else 'blocked' end,
         holds_lock = false, finished_at = now(),
         error_category = case when v_outcome='succeeded' then null else 'runtime_not_configured' end,
         error_detail = case when v_outcome='succeeded' then null
                             else 'A sandbox reset needs the runtime that owns the sandbox database and storage.' end
   where id = v_job;

  perform public.mm_audit('sandbox.reset_'||v_outcome,'demo_sandbox', p_sandbox::text,
                          to_jsonb(v_s), jsonb_build_object('stages', v_stages), p_trigger);

  return jsonb_build_object('ok', v_outcome = 'succeeded',
    'outcome', v_outcome, 'reset_id', v_reset, 'job_id', v_job,
    'stages', v_stages,
    'reason', case when v_outcome='succeeded' then null else 'runtime_not_configured' end,
    'message','Nothing was reset. The stages above record exactly what ran and what could not, and the sandbox is marked failed rather than active.');
end;
$$;
