-- Favicon & Branding Protection, part three: exceptions, policy, the console.

/* --------------------------------------------------- 9. whitelist control */

-- Ask for an exception. A seller may raise one; nobody grants their own.
create or replace function public.mm_brand_whitelist_request(
  p_product uuid, p_rule text, p_reason text, p_expires timestamptz default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_row jsonb; v_seller uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason','sign_in_required');
  end if;
  if coalesce(btrim(p_reason),'') = '' then
    return jsonb_build_object('ok', false, 'reason','reason_required',
      'message','An exception to brand protection has to say why it is needed.');
  end if;
  if not exists (select 1 from public.brand_enforcement_rules where key = p_rule) then
    return jsonb_build_object('ok', false, 'reason','unknown_rule');
  end if;

  select seller_id into v_seller from public.marketplace_products where id = p_product;
  if not found then return jsonb_build_object('ok', false, 'reason','unknown_product'); end if;

  -- Only an operator or somebody who acts for the seller may ask.
  if not (public.mm_is_operator() or public.marketplace_is_seller_member(v_seller)) then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;

  insert into public.brand_whitelist_exceptions
    (product_id, seller_id, rule_key, reason, created_by, expires_at, status)
  values (p_product, v_seller, p_rule, btrim(p_reason), auth.uid(), p_expires, 'pending')
  returning to_jsonb(brand_whitelist_exceptions) into v_row;

  insert into public.brand_protection_events (product_id, event, actor_id, new_state, reason)
  values (p_product, 'whitelist.requested', auth.uid(), 'pending', btrim(p_reason));

  return jsonb_build_object('ok', true, 'exception', v_row,
    'note','Requested only. It has no effect until an authorised approver activates it.');
end;
$$;

-- Approve, revoke or expire one. Approval is restricted to an admin or the
-- boss: an exception suspends a protection rule, and section 9 requires
-- authorisation for that.
create or replace function public.mm_brand_whitelist_decide(
  p_id uuid, p_to text, p_reason text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_before jsonb; v_after jsonb; v_settings record;
begin
  if not (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'boss')
          or public.has_role(auth.uid(),'super_admin')) then
    return jsonb_build_object('ok', false, 'reason','not_permitted',
      'message','Only an admin or the boss can approve or revoke a branding exception.');
  end if;
  if p_to not in ('active','revoked','expired') then
    return jsonb_build_object('ok', false, 'reason','unknown_state');
  end if;
  if p_to = 'revoked' and coalesce(btrim(p_reason),'') = '' then
    return jsonb_build_object('ok', false, 'reason','reason_required');
  end if;

  select * into v_settings from public.brand_protection_settings where id;
  if p_to = 'active' and not v_settings.allow_whitelist_exceptions then
    return jsonb_build_object('ok', false, 'reason','exceptions_disabled',
      'message','Whitelist exceptions are switched off in the global policy.');
  end if;

  select to_jsonb(w) into v_before from public.brand_whitelist_exceptions w where w.id = p_id;
  if v_before is null then return jsonb_build_object('ok', false, 'reason','unknown_exception'); end if;

  update public.brand_whitelist_exceptions
     set status = p_to,
         approved_by = case when p_to='active' then auth.uid() else approved_by end,
         approved_at = case when p_to='active' then now() else approved_at end,
         revoked_by = case when p_to='revoked' then auth.uid() else revoked_by end,
         revoked_reason = case when p_to='revoked' then btrim(p_reason) else revoked_reason end
   where id = p_id returning to_jsonb(brand_whitelist_exceptions) into v_after;

  insert into public.brand_protection_events
    (product_id, event, actor_id, previous_state, new_state, reason)
  values ((v_after->>'product_id')::uuid, 'whitelist.'||p_to, auth.uid(),
          v_before->>'status', p_to, p_reason);

  perform public.mm_audit('brand.whitelist_'||p_to,'brand_whitelist', p_id::text,
                          v_before, v_after, p_reason);

  return jsonb_build_object('ok', true, 'exception', v_after,
    'note','An exception never bypasses security scanning or a legal restriction; it only suspends the branding rule it names.');
end;
$$;

-- Expire whatever has run out. Protection resumes the moment it does.
create or replace function public.mm_brand_whitelist_expire()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_n integer;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;

  with due as (
    select id, product_id from public.brand_whitelist_exceptions
     where status='active' and expires_at is not null and expires_at <= now())
  update public.brand_whitelist_exceptions w
     set status='expired' from due where w.id = due.id;
  get diagnostics v_n = row_count;

  if v_n > 0 then
    insert into public.brand_protection_events (event, actor_id, new_state, reason, detail)
    values ('whitelist.expired', auth.uid(), 'expired',
            'The exception window closed; protection resumed.',
            jsonb_build_object('expired', v_n));
  end if;

  return jsonb_build_object('ok', true, 'expired', v_n);
end;
$$;

/* ------------------------------------------------------- 25. the policy */

create or replace function public.mm_brand_policy_set(p_patch jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_before jsonb; v_after jsonb; v_to text := nullif(p_patch->>'policy_state','');
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;

  -- Turning protection off entirely needs elevated permission. An ordinary
  -- manager can move between monitor and enforce, and no further.
  if v_to = 'disabled'
     and not (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'boss')
              or public.has_role(auth.uid(),'super_admin')) then
    return jsonb_build_object('ok', false, 'reason','elevated_permission_required',
      'message','Only an admin or the boss can disable brand protection.');
  end if;
  if v_to = 'disabled' and coalesce(btrim(p_patch->>'reason'),'') = '' then
    return jsonb_build_object('ok', false, 'reason','reason_required',
      'message','Disabling brand protection has to say why. It is recorded permanently.');
  end if;

  select to_jsonb(s) into v_before from public.brand_protection_settings s where s.id;

  update public.brand_protection_settings set
    policy_state = coalesce(v_to, policy_state),
    block_third_party_favicons = coalesce((p_patch->>'block_third_party_favicons')::boolean, block_third_party_favicons),
    block_third_party_manifest = coalesce((p_patch->>'block_third_party_manifest')::boolean, block_third_party_manifest),
    block_external_logo_overrides = coalesce((p_patch->>'block_external_logo_overrides')::boolean, block_external_logo_overrides),
    replace_on_upload = coalesce((p_patch->>'replace_on_upload')::boolean, replace_on_upload),
    allow_whitelist_exceptions = coalesce((p_patch->>'allow_whitelist_exceptions')::boolean, allow_whitelist_exceptions),
    updated_by = auth.uid(), updated_at = now()
  where id returning to_jsonb(brand_protection_settings) into v_after;

  insert into public.brand_protection_events (event, actor_id, previous_state, new_state, reason)
  values ('policy.changed', auth.uid(), v_before->>'policy_state',
          v_after->>'policy_state', nullif(p_patch->>'reason',''));

  perform public.mm_audit('brand.policy_changed','brand_protection_settings','policy',
                          v_before, v_after, nullif(p_patch->>'reason',''));
  return jsonb_build_object('ok', true, 'settings', v_after);
end;
$$;

/* ------------------------------------------------- 16. legal escalation */

create or replace function public.mm_brand_case_escalate(
  p_case uuid, p_reason text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_c record; v_ref text; v_after jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;
  if coalesce(btrim(p_reason),'') = '' then
    return jsonb_build_object('ok', false, 'reason','reason_required');
  end if;
  select * into v_c from public.brand_violation_cases where id = p_case;
  if not found then return jsonb_build_object('ok', false, 'reason','unknown_case'); end if;

  v_ref := 'LEGAL-BR-' || upper(substr(md5(p_case::text),1,8));

  update public.brand_violation_cases
     set status='escalated', legal_reference = v_ref
   where id = p_case returning to_jsonb(brand_violation_cases) into v_after;

  insert into public.brand_protection_events
    (product_id, case_id, event, actor_id, previous_state, new_state, reason)
  values (v_c.product_id, p_case, 'legal.escalated', auth.uid(), v_c.status, 'escalated', btrim(p_reason));

  perform public.mm_notify('brand.legal_escalation',
    format('Branding case %s raised with Legal', v_c.case_no),
    btrim(p_reason), null, array['admin','boss'], '/legal-manager', 'Open', 5, 'warning');

  return jsonb_build_object('ok', true, 'case', v_after, 'legal_reference', v_ref,
    'note','The reference is recorded here. The legal record itself belongs to Legal Manager and must be raised there; legal_trademark_assets and legal_violations are not written by brand protection.');
end;
$$;

/* ----------------------------------------------------------- the console */

create or replace function public.mm_brand_protection(p_query jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tab text := coalesce(p_query->>'tab','cases');
  v_search text := nullif(btrim(coalesce(p_query->>'search','')),'');
  v_status text := nullif(p_query->>'status','');
  v_limit integer := least(greatest(coalesce((p_query->>'limit')::int,50),1),200);
  v_settings record; v_vision text;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;
  select * into v_settings from public.brand_protection_settings where id;

  -- 21. Vision analysis, stated honestly. No provider is configured in this
  -- environment, so no similarity percentage is ever produced.
  select case when exists (
    select 1 from public.security_provider_configs
     where kind='ai' and enabled and verified)
    then 'CONNECTED' else 'VISION_ANALYSIS_NOT_CONFIGURED' end into v_vision;

  return jsonb_build_object(
    'ok', true, 'tab', v_tab,
    'settings', to_jsonb(v_settings),
    'vision_analysis', v_vision,
    'vision_note', case when v_vision <> 'CONNECTED'
      then 'No vision-capable provider is configured, so logo and favicon images are not compared for similarity. Detection below is exact-reference matching only, and no confidence figure is produced.'
      else null end,

    -- The four metric cards. Every one counted.
    'protected_assets', (select count(*) from public.brand_assets where approved and active),
    'replaced_today', (select count(*) from public.brand_replacement_history
                        where verified and created_at >= date_trunc('day', now())),
    'violations_open', (select count(*) from public.brand_violation_cases
                         where status in ('open','escalated','failed')),
    'whitelist_active', (select count(*) from public.brand_whitelist_exceptions
                          where status='active' and (expires_at is null or expires_at > now())),

    -- The surfaces this actually governs, counted from the catalogue.
    'surfaces', jsonb_build_object(
      'products', (select count(*) from public.marketplace_products where deleted_at is null),
      'products_with_own_favicon', (select count(*) from public.marketplace_products
                                     where coalesce(btrim(favicon),'') <> ''),
      'products_with_own_logo', (select count(*) from public.marketplace_products
                                  where coalesce(btrim(logo),'') <> ''),
      'demos', (select count(*) from public.marketplace_products
                 where coalesce(btrim(demo_url),'') <> '')),

    'assets', coalesce((select jsonb_agg(jsonb_build_object(
                 'key', a.key, 'name', a.name, 'type', a.asset_type,
                 'path', a.public_path, 'sha256', a.sha256,
                 'width', a.width, 'height', a.height, 'bytes', a.size_bytes,
                 'version', a.version, 'approved', a.approved, 'active', a.active,
                 'usable', a.active,
                 'note', case when a.active then null
                              else 'No file is registered for this asset, so no rule can use it to replace anything.' end)
               order by a.asset_type, a.key)
                 from public.brand_assets a), '[]'::jsonb),

    'rules', coalesce((select jsonb_agg(jsonb_build_object(
                'key', r.key, 'label', r.label, 'target', r.target,
                'action', r.action, 'severity', r.severity, 'enabled', r.enabled,
                'canonical', r.canonical_asset_key, 'notes', r.notes,
                'enforceable', exists (select 1 from public.brand_assets a
                                        where a.key = r.canonical_asset_key and a.active))
              order by r.key) from public.brand_enforcement_rules r), '[]'::jsonb),

    'last_run', (select to_jsonb(x) from (select * from public.brand_enforcement_runs
                   order by started_at desc limit 1) x),

    'cases', case when v_tab <> 'cases' then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'case_no', c.case_no, 'rule', c.rule_key,
               'surface', c.surface, 'reference', c.asset_reference,
               'classification', c.classification, 'severity', c.severity,
               'status', c.status, 'evidence', c.evidence,
               'legal_reference', c.legal_reference, 'created_at', c.created_at,
               'product_id', c.product_id,
               'product', (select name from public.marketplace_products where id=c.product_id),
               'owner', (select display_name from public.marketplace_sellers where id=c.seller_id))
             order by c.created_at desc)
        from (select * from public.brand_violation_cases
               where (v_status is null or status = v_status)
               order by created_at desc limit v_limit) c), '[]'::jsonb) end,

    'whitelist', case when v_tab <> 'whitelist' then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', w.id, 'rule', w.rule_key, 'reason', w.reason,
               'status', w.status, 'expires_at', w.expires_at,
               'approved_by', w.approved_by, 'created_at', w.created_at,
               'product', (select name from public.marketplace_products where id=w.product_id))
             order by w.created_at desc)
        from (select * from public.brand_whitelist_exceptions
               order by created_at desc limit v_limit) w), '[]'::jsonb) end,

    'history', case when v_tab <> 'history' then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', h.id, 'surface', h.surface, 'rule', h.rule_key,
               'from', h.original_reference, 'to', h.replacement_reference,
               'sha256', h.replacement_sha256, 'verified', h.verified,
               'detail', h.verification_detail, 'at', h.created_at,
               'product', (select name from public.marketplace_products where id=h.product_id))
             order by h.created_at desc)
        from (select * from public.brand_replacement_history
               order by created_at desc limit v_limit) h), '[]'::jsonb) end,

    'events', coalesce((select jsonb_agg(jsonb_build_object(
                 'event', e.event, 'at', e.created_at, 'reason', e.reason,
                 'from', e.previous_state, 'to', e.new_state)
               order by e.created_at desc)
                 from (select * from public.brand_protection_events
                        order by created_at desc limit 25) e), '[]'::jsonb),

    'scope_note','Brand protection governs Software Vala marketplace surfaces only. It never reads or rewrites the contents of a downloadable software package, so a customer''s software keeps its own branding.');
end;
$$;
