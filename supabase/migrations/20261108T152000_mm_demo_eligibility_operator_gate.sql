-- Restrict internal demo diagnostics and sandbox lifecycle mutations to
-- Marketplace operators. No sandbox runtime consumer is currently wired in
-- the repository; public activity needs a separate capability contract before
-- it can safely renew lifecycle expiry.
-- Idempotent and safe for both database environments.

begin;

create or replace function public.mm_demo_eligibility(p_product uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_p record;
  v_gates jsonb;
  v_blocked integer;
  v_brand integer;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select * into v_p from public.marketplace_products where id = p_product;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_product');
  end if;

  select count(*) into v_blocked from public.security_assets
   where product_id = p_product and status in ('blocked', 'quarantined');

  select count(*) into v_brand from public.brand_violation_cases
   where product_id = p_product and status in ('open', 'escalated', 'failed');

  v_gates := jsonb_build_array(
    jsonb_build_object('key', 'moderation', 'label', 'Product Moderation',
      'passed', v_p.moderation_status = 'approved' and v_p.visible,
      'detail', format('moderation_status is %s, visible is %s',
                       v_p.moderation_status, v_p.visible),
      'owner', 'Product Moderation Center'),
    jsonb_build_object('key', 'not_deleted', 'label', 'Not deleted or merged',
      'passed', v_p.deleted_at is null and v_p.merged_into is null,
      'detail', case when v_p.deleted_at is not null then 'this listing is deleted'
                     when v_p.merged_into is not null then 'this listing was merged into another'
                     else 'standalone and present' end,
      'owner', 'Product Moderation Center'),
    jsonb_build_object('key', 'security', 'label', 'No blocked or quarantined asset',
      'passed', v_blocked = 0,
      'detail', format('%s asset(s) blocked or quarantined', v_blocked),
      'owner', 'Upload Security Scanner'),
    jsonb_build_object('key', 'branding', 'label', 'No open branding violation',
      'passed', v_brand = 0,
      'detail', format('%s open branding case(s)', v_brand),
      'owner', 'Favicon & Branding Protection'),
    jsonb_build_object('key', 'legal', 'label', 'No unresolved legal record',
      'passed', not exists (select 1 from public.legal_violations v
                             where v.violator_id = p_product::text
                               and coalesce(v.status, 'open') not in ('resolved', 'dismissed')),
      'detail', 'read from Legal Manager', 'owner', 'Legal Manager'));

  return jsonb_build_object(
    'ok', true,
    'product_id', p_product,
    'gates', v_gates,
    'eligible', not exists (select 1 from jsonb_array_elements(v_gates) g
                             where not (g->>'passed')::boolean),
    'blocked_by', coalesce((select jsonb_agg(g->>'key') from jsonb_array_elements(v_gates) g
                             where not (g->>'passed')::boolean), '[]'::jsonb));
end;
$$;

revoke all on function public.mm_demo_eligibility(uuid) from public, anon;
grant execute on function public.mm_demo_eligibility(uuid) to authenticated, service_role;

create or replace function public.mm_sandbox_activity(
  p_sandbox uuid,
  p_kind text default 'http',
  p_path text default null,
  p_status integer default null,
  p_latency integer default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_s record;
  v_set record;
  v_q boolean;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select * into v_s from public.demo_sandboxes where id = p_sandbox;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_sandbox');
  end if;
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
           status = case when status = 'expiring' then 'active' else status end,
           updated_at = now()
     where id = p_sandbox;
  end if;

  return jsonb_build_object(
    'ok', true,
    'qualifies', v_q,
    'note', case when v_q then null
      else 'A heartbeat was recorded but does not extend the sandbox. Only a real request, an authenticated action or an interaction does.' end);
end;
$$;

revoke all on function public.mm_sandbox_activity(uuid, text, text, integer, integer)
  from public, anon;
grant execute on function public.mm_sandbox_activity(uuid, text, text, integer, integer)
  to authenticated, service_role;

commit;
