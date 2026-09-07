-- Favicon & Branding Protection, part two: detection and enforcement.

/* ------------------------------------------------------- 13/14. detection */

-- What is non-compliant about one product's branding, and why.
--
-- Detection reads the product's own branding columns and its demo origin. It
-- does not judge by filename: a reference is compared against the canonical
-- asset's path, and anything pointing off this application's own origin is
-- classified rather than assumed.
--
-- Section 5 is respected structurally: nothing here looks inside a downloadable
-- package, and nothing here can rewrite one.
create or replace function public.mm_brand_detect(p_product uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_p record; v_findings jsonb := '[]'::jsonb; r record;
  v_ref text; v_canonical record; v_class text; v_whitelisted boolean;
begin
  select * into v_p from public.marketplace_products where id = p_product;
  if not found then
    return jsonb_build_object('ok', false, 'reason','unknown_product');
  end if;

  for r in select * from public.brand_enforcement_rules where enabled order by key loop
    v_ref := case r.target
      when 'product_favicon'  then nullif(btrim(coalesce(v_p.favicon,'')),'')
      when 'product_logo'     then nullif(btrim(coalesce(v_p.logo,'')),'')
      when 'product_og_image' then nullif(btrim(coalesce(v_p.cover_image,'')),'')
      when 'demo_favicon'     then nullif(btrim(coalesce(v_p.demo_url,'')),'')
      else null end;

    select * into v_canonical from public.brand_assets
     where key = r.canonical_asset_key;

    -- An active exception is honoured, and recorded as such rather than
    -- silently skipping the check.
    select exists (
      select 1 from public.brand_whitelist_exceptions w
       where w.product_id = p_product and w.rule_key = r.key
         and w.status = 'active'
         and (w.expires_at is null or w.expires_at > now()))
      into v_whitelisted;

    v_class := case
      when v_ref is null then 'approved'
      when v_canonical.public_path is not null and v_ref = v_canonical.public_path then 'approved'
      when v_whitelisted then 'whitelisted'
      -- A reference to this application's own origin is ours; anything else is
      -- external and unknown until somebody classifies it.
      when v_ref ~ '^/' then 'unknown'
      when v_ref ~* '^https?://(www\.)?softwarevala\.net(/|$)' then 'approved'
      else 'unknown' end;

    v_findings := v_findings || jsonb_build_object(
      'rule', r.key, 'label', r.label, 'target', r.target,
      'action', r.action, 'severity', r.severity,
      'reference', v_ref,
      'classification', v_class,
      'whitelisted', v_whitelisted,
      'compliant', v_ref is null or v_class in ('approved','whitelisted'),
      'canonical', case when v_canonical.active
                        then jsonb_build_object('key', v_canonical.key,
                               'path', v_canonical.public_path, 'sha256', v_canonical.sha256)
                        else null end,
      -- A rule whose canonical asset does not exist cannot replace anything,
      -- and says so instead of pretending.
      'enforceable', v_canonical.active is true,
      'why', case
        when v_ref is null then 'Nothing is set, so the Software Vala default applies.'
        when v_class = 'approved' then 'Already the canonical Software Vala asset.'
        when v_whitelisted then 'An approved whitelist exception is in force for this product and rule.'
        when v_canonical.active is not true then
          format('Non-compliant, but no approved canonical asset exists for %s, so nothing can be substituted.',
                 r.canonical_asset_key)
        else 'Points at branding that is not the canonical Software Vala asset.' end);
  end loop;

  return jsonb_build_object(
    'ok', true, 'product_id', p_product, 'product', v_p.name,
    'findings', v_findings,
    'non_compliant', (select count(*) from jsonb_array_elements(v_findings) f
                       where not (f->>'compliant')::boolean),
    -- Named explicitly, because it is the rule most easily broken by accident.
    'scope_note','Only marketplace surface branding is inspected. The contents of a downloadable software package are never read or rewritten by brand protection.');
end;
$$;

/* --------------------------------------------------- 22/23. Enforce Now */

-- Run enforcement across the catalogue, or one product.
--
-- Under MONITOR nothing is changed: every non-compliant asset is recorded and
-- left alone. Under ENFORCE a replacement is applied only where an approved
-- canonical asset exists, and then read back — if the read-back does not match,
-- the case is recorded as failed rather than as replaced.
create or replace function public.mm_brand_enforce(
  p_product uuid default null, p_limit integer default 500)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_s record; v_run uuid; v_p record; v_det jsonb; f jsonb;
  v_scanned integer := 0; v_compliant integer := 0; v_replaced integer := 0;
  v_blocked integer := 0; v_flagged integer := 0; v_white integer := 0;
  v_failed integer := 0;
  v_case uuid; v_no text; v_canonical record; v_before text; v_after text;
  v_verified boolean; v_seller uuid;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;
  select * into v_s from public.brand_protection_settings where id;

  if v_s.policy_state = 'disabled' then
    return jsonb_build_object('ok', false, 'reason','protection_disabled',
      'message','Brand protection is disabled. An admin has to switch it back to monitor or enforce.');
  end if;

  insert into public.brand_enforcement_runs (scope, policy_state, started_by)
  values (coalesce(p_product::text,'all'), v_s.policy_state, auth.uid())
  returning id into v_run;

  for v_p in
    select * from public.marketplace_products
     where (p_product is null or id = p_product)
       and deleted_at is null
     order by updated_at desc
     limit greatest(least(p_limit, 5000), 1)
  loop
    v_scanned := v_scanned + 1;
    v_det := public.mm_brand_detect(v_p.id);

    for f in select * from jsonb_array_elements(v_det->'findings') loop
      if (f->>'compliant')::boolean then
        if (f->>'whitelisted')::boolean then v_white := v_white + 1;
        else v_compliant := v_compliant + 1; end if;
        continue;
      end if;

      v_no := 'BR-' || lpad(((select count(*) from public.brand_violation_cases) + 1)::text, 6, '0');

      insert into public.brand_violation_cases
        (case_no, product_id, seller_id, rule_key, surface, asset_reference,
         classification, severity, evidence, status)
      values (v_no, v_p.id, v_p.seller_id, f->>'rule',
              f->>'target', f->>'reference',
              f->>'classification', f->>'severity',
              jsonb_build_array(jsonb_build_object(
                'reference', f->>'reference',
                'why', f->>'why',
                'enforceable', (f->>'enforceable')::boolean)),
              'open')
      returning id into v_case;

      -- MONITOR records and changes nothing.
      if v_s.policy_state = 'monitor' then
        v_flagged := v_flagged + 1;
        update public.brand_violation_cases set status='open' where id=v_case;
        insert into public.brand_protection_events (product_id, case_id, event, actor_id, detail)
        values (v_p.id, v_case, 'violation.detected', auth.uid(),
                jsonb_build_object('policy','monitor','rule', f->>'rule'));
        continue;
      end if;

      -- ENFORCE. Only a rule with an approved canonical asset and the replace
      -- action can substitute anything.
      if (f->>'action') = 'replace' and (f->>'enforceable')::boolean then
        select * into v_canonical from public.brand_assets
         where key = (f->'canonical'->>'key');

        v_before := f->>'reference';

        if (f->>'target') = 'product_favicon' then
          update public.marketplace_products
             set favicon = v_canonical.public_path, updated_at = now()
           where id = v_p.id;
          select favicon into v_after from public.marketplace_products where id = v_p.id;
        elsif (f->>'target') = 'product_logo' then
          update public.marketplace_products
             set logo = v_canonical.public_path, updated_at = now()
           where id = v_p.id;
          select logo into v_after from public.marketplace_products where id = v_p.id;
        else
          v_after := null;
        end if;

        -- 23. Read back. A replacement is only a replacement if it took.
        v_verified := v_after is not null and v_after = v_canonical.public_path;

        insert into public.brand_replacement_history
          (case_id, product_id, rule_key, surface, original_reference,
           replacement_asset_key, replacement_reference, replacement_sha256,
           actor_id, actor_kind, reason, verified, verification_detail)
        values (v_case, v_p.id, f->>'rule', f->>'target', v_before,
                v_canonical.key, v_canonical.public_path, v_canonical.sha256,
                auth.uid(), 'system',
                'Automatic enforcement of the canonical Software Vala asset.',
                v_verified,
                case when v_verified then 'Read back and matches the canonical path.'
                     else format('Read back as %s, expected %s.',
                                 coalesce(v_after,'null'), v_canonical.public_path) end);

        if v_verified then
          v_replaced := v_replaced + 1;
          update public.brand_violation_cases set status='replaced',
                 resolved_by = auth.uid(), resolved_at = now() where id=v_case;
          insert into public.brand_protection_events
            (product_id, case_id, event, actor_id, previous_state, new_state, reason)
          values (v_p.id, v_case, 'asset.replaced', auth.uid(), v_before,
                  v_canonical.public_path, 'Canonical asset enforced.');
        else
          v_failed := v_failed + 1;
          update public.brand_violation_cases set status='failed' where id=v_case;
          insert into public.brand_protection_events
            (product_id, case_id, event, actor_id, new_state, reason)
          values (v_p.id, v_case, 'enforcement.failed', auth.uid(), 'ENFORCEMENT_FAILED',
                  'The replacement did not read back as the canonical asset.');
        end if;

      elsif (f->>'action') = 'block' then
        v_blocked := v_blocked + 1;
        update public.brand_violation_cases set status='blocked' where id=v_case;
        insert into public.brand_protection_events (product_id, case_id, event, actor_id, new_state)
        values (v_p.id, v_case, 'violation.blocked', auth.uid(), 'blocked');

      else
        -- Flag or monitor, or a replace rule with no canonical asset to use.
        v_flagged := v_flagged + 1;
        insert into public.brand_protection_events (product_id, case_id, event, actor_id, reason)
        values (v_p.id, v_case, 'violation.flagged', auth.uid(), f->>'why');
      end if;

      -- 15/16. A repeated or trademark-shaped violation is raised to the people
      -- who decide, through the notification engine.
      select seller_id into v_seller from public.marketplace_products where id = v_p.id;
      if (f->>'severity') in ('high','critical') then
        perform public.mm_notify('brand.violation',
          format('Branding violation on %s', v_p.name),
          format('%s — %s', f->>'label', f->>'why'),
          null, array['admin','boss'], '/marketplace-manager', 'Review', 60, 'warning');
      end if;
    end loop;
  end loop;

  update public.brand_enforcement_runs
     set scanned = v_scanned, compliant = v_compliant, replaced = v_replaced,
         blocked = v_blocked, flagged = v_flagged, whitelisted = v_white,
         failed = v_failed, completed_at = now(),
         detail = jsonb_build_object(
           'policy', v_s.policy_state,
           'note', case when v_s.policy_state='monitor'
             then 'Monitor mode: every non-compliant asset was recorded and nothing was changed.'
             else 'Enforce mode: replacements were applied only where an approved canonical asset exists, and each was read back.' end)
   where id = v_run;

  perform public.mm_audit('brand.enforcement_run','brand_enforcement_run', v_run::text, null,
    jsonb_build_object('scanned',v_scanned,'replaced',v_replaced,'failed',v_failed), null);

  return jsonb_build_object('ok', true, 'run_id', v_run,
    'policy', v_s.policy_state,
    'scanned', v_scanned, 'compliant', v_compliant, 'replaced', v_replaced,
    'blocked', v_blocked, 'flagged', v_flagged, 'whitelisted', v_white,
    'failed', v_failed,
    'note', case when v_s.policy_state='monitor'
      then 'Monitor mode. Nothing was changed; every non-compliant asset is recorded as a case.'
      else null end);
end;
$$;

/* ------------------------------------------------------- 12. hash integrity */

-- Verify the canonical assets are still what the registry says they are.
--
-- The digest itself is computed where the files are, on the server; this
-- records the comparison and raises a security event on a mismatch.
create or replace function public.mm_brand_asset_verify(
  p_key text, p_observed_sha text, p_observed_bytes bigint default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_a record;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;
  select * into v_a from public.brand_assets where key = p_key;
  if not found then return jsonb_build_object('ok', false, 'reason','unknown_asset'); end if;

  if v_a.sha256 is null then
    return jsonb_build_object('ok', true, 'state','no_baseline',
      'message','This asset has no recorded hash, so nothing can be compared.');
  end if;

  if v_a.sha256 = p_observed_sha then
    return jsonb_build_object('ok', true, 'state','intact', 'sha256', v_a.sha256);
  end if;

  -- A canonical asset that changed unexpectedly is a security event.
  insert into public.brand_protection_events (event, actor_id, previous_state, new_state, reason, detail)
  values ('asset.integrity_failed', auth.uid(), v_a.sha256, p_observed_sha,
          format('The canonical asset %s no longer matches its recorded hash.', p_key),
          jsonb_build_object('asset', p_key, 'expected', v_a.sha256,
                             'observed', p_observed_sha, 'observed_bytes', p_observed_bytes));

  perform public.mm_notify('brand.integrity',
    'A canonical brand asset changed unexpectedly',
    format('%s no longer matches its recorded SHA-256. Enforcement using it should be paused until this is explained.', p_key),
    null, array['admin','boss'], '/marketplace-manager', 'Review', 5, 'danger');

  return jsonb_build_object('ok', false, 'state','mismatch',
    'expected', v_a.sha256, 'observed', p_observed_sha,
    'message','The canonical asset does not match its recorded hash. A security event was raised.');
end;
$$;
