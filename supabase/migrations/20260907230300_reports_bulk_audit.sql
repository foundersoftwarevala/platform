-- Product Moderation Center, part four: reports, bulk, the audit, the console.

/* ------------------------------------------------------ 14/15. reports */

create or replace function public.mm_product_report(
  p_product uuid, p_reason text, p_detail text default null,
  p_severity text default 'normal')
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_no text; v_row jsonb; v_name text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason','sign_in_required');
  end if;
  if p_reason not in ('copyright','trademark','fraudulent_claims','misleading','security',
                      'malware','duplicate','policy_violation','broken_product',
                      'illegal_content','other') then
    return jsonb_build_object('ok', false, 'reason','unknown_reason');
  end if;
  select name into v_name from public.marketplace_products where id = p_product;
  if v_name is null then
    return jsonb_build_object('ok', false, 'reason','unknown_product');
  end if;

  v_no := 'PR-' || lpad(((select count(*) from public.product_reports) + 1)::text, 5, '0');

  insert into public.product_reports
    (report_no, product_id, reporter_id, reason, detail, severity,
     reporter_kind, status)
  values (v_no, p_product, auth.uid(), p_reason, nullif(btrim(p_detail),''),
          case when p_reason in ('malware','illegal_content','security') then 'critical'
               when p_reason in ('copyright','trademark') then 'high'
               else coalesce(nullif(p_severity,''),'normal') end,
          case when public.mm_is_operator() then 'manager' else 'user' end,
          'reported')
  returning to_jsonb(product_reports) into v_row;

  perform public.mm_audit('product.reported','marketplace_product', p_product::text,
                          null, v_row, p_reason);

  -- A serious report reaches the operators immediately.
  if (v_row->>'severity') in ('high','critical') then
    perform public.mm_notify('product.reported',
      format('%s reported: %s', v_no, replace(p_reason,'_',' ')),
      format('%s — %s', v_name, coalesce(nullif(btrim(p_detail),''),'no detail given')),
      null, array['admin','boss'], '/marketplace-manager', 'Review', 5, 'danger');
  end if;

  return jsonb_build_object('ok', true, 'report', v_row);
end;
$$;

create or replace function public.mm_report_transition(
  p_report uuid, p_to text, p_resolution text default null,
  p_escalate_legal boolean default false)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_r record; v_after jsonb; v_allowed boolean; v_ref text;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;
  if p_to not in ('under_review','action_required','resolved','dismissed') then
    return jsonb_build_object('ok', false, 'reason','unknown_status');
  end if;

  select * into v_r from public.product_reports where id = p_report for update;
  if not found then return jsonb_build_object('ok', false, 'reason','unknown_report'); end if;

  v_allowed := case v_r.status
    when 'reported'        then p_to in ('under_review','dismissed')
    when 'under_review'    then p_to in ('action_required','resolved','dismissed')
    when 'action_required' then p_to in ('resolved','dismissed')
    else false end;
  if not v_allowed then
    return jsonb_build_object('ok', false, 'reason','invalid_transition',
      'message', format('A %s report cannot become %s.', v_r.status, p_to));
  end if;

  if p_to in ('resolved','dismissed') and coalesce(btrim(p_resolution),'') = '' then
    return jsonb_build_object('ok', false, 'reason','resolution_required',
      'message','Record the finding. A report is closed with a reason, not silently.');
  end if;

  -- Escalation to Legal Manager records the reference here; the legal record
  -- itself is created and owned there.
  if p_escalate_legal then
    v_ref := 'LEGAL-' || upper(substr(md5(p_report::text), 1, 8));
  end if;

  update public.product_reports
     set status = p_to,
         resolution = coalesce(nullif(btrim(p_resolution),''), resolution),
         assigned_to = case when p_to='under_review' then coalesce(assigned_to, auth.uid())
                            else assigned_to end,
         resolved_by = case when p_to in ('resolved','dismissed') then auth.uid() else resolved_by end,
         resolved_at = case when p_to in ('resolved','dismissed') then now() else resolved_at end,
         legal_reference = coalesce(v_ref, legal_reference),
         updated_at = now()
   where id = p_report returning to_jsonb(product_reports) into v_after;

  perform public.mm_audit('product.report_'||p_to,'product_report', p_report::text,
                          to_jsonb(v_r), v_after, p_resolution);

  return jsonb_build_object('ok', true, 'report', v_after,
    'legal_reference', v_ref,
    'note', case when p_escalate_legal
      then 'A legal reference was recorded here. The legal record itself belongs to Legal Manager and must be raised there.'
      else null end);
end;
$$;

/* ------------------------------------------------------ 16-19. bulk work */

-- Bulk moderation, category change and reassignment.
--
-- Every record is validated on its own and gets its own audit entry. One
-- invalid record is skipped with its reason; it never silently spoils the rest.
create or replace function public.mm_products_bulk(
  p_ids uuid[], p_op text, p_reason text default null, p_target uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid; v_res jsonb; v_out jsonb := '[]'::jsonb;
  v_done integer := 0; v_skipped integer := 0;
  v_p record; v_checks jsonb; v_before jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;
  if p_ids is null or array_length(p_ids,1) is null then
    return jsonb_build_object('ok', false, 'reason','nothing_selected');
  end if;
  if array_length(p_ids,1) > 200 then
    return jsonb_build_object('ok', false, 'reason','too_many',
      'message','Bulk operations are limited to 200 products at a time.');
  end if;
  if p_op not in ('approved','rejected','suspended','archived','soft_deleted',
                  'publish','unpublish','category','author') then
    return jsonb_build_object('ok', false, 'reason','unknown_operation');
  end if;

  -- Reassignment is never silent: it needs a reason and a real target.
  if p_op in ('category','author') then
    if p_target is null then
      return jsonb_build_object('ok', false, 'reason','target_required');
    end if;
    if coalesce(btrim(p_reason),'') = '' then
      return jsonb_build_object('ok', false, 'reason','reason_required',
        'message','Changing the category or the owner of a listing has to say why.');
    end if;
    if p_op='category' and not exists (select 1 from public.marketplace_categories where id=p_target) then
      return jsonb_build_object('ok', false, 'reason','unknown_category');
    end if;
    if p_op='author' and not exists (select 1 from public.marketplace_sellers
                                      where id=p_target and status='approved') then
      return jsonb_build_object('ok', false, 'reason','unknown_or_unapproved_owner',
        'message','A listing can only be reassigned to an approved seller.');
    end if;
  end if;

  foreach v_id in array p_ids loop
    select * into v_p from public.marketplace_products where id = v_id;
    if not found then
      v_skipped := v_skipped + 1;
      v_out := v_out || jsonb_build_object('id', v_id, 'ok', false, 'reason','unknown_product');
      continue;
    end if;
    v_before := to_jsonb(v_p);

    if p_op in ('approved','rejected','suspended','archived','soft_deleted') then
      v_res := public.mm_product_moderate(v_id, p_op, p_reason, null);
      if (v_res->>'ok')::boolean then v_done := v_done + 1; else v_skipped := v_skipped + 1; end if;
      v_out := v_out || jsonb_build_object('id', v_id, 'product', v_p.name,
        'ok', (v_res->>'ok')::boolean, 'reason', v_res->>'reason', 'message', v_res->>'message');

    elsif p_op = 'publish' then
      -- Publication is only allowed where the product would pass on its own.
      v_checks := public.mm_product_checks(v_id);
      if v_p.moderation_status <> 'approved' then
        v_skipped := v_skipped + 1;
        v_out := v_out || jsonb_build_object('id', v_id, 'product', v_p.name, 'ok', false,
          'reason','not_approved',
          'message', format('This product is %s. Only an approved product can be published.',
                            v_p.moderation_status));
      elsif (v_checks->>'blocking')::boolean then
        v_skipped := v_skipped + 1;
        v_out := v_out || jsonb_build_object('id', v_id, 'product', v_p.name, 'ok', false,
          'reason','checks_failed',
          'message', format('%s mandatory check(s) failing.', v_checks->>'mandatory_failed'));
      else
        update public.marketplace_products
           set visible = true, content_status='published',
               moderation_lock = moderation_lock + 1, updated_at = now()
         where id = v_id;
        v_done := v_done + 1;
        perform public.mm_audit('product.published','marketplace_product', v_id::text,
                                v_before, jsonb_build_object('visible', true), p_reason);
        v_out := v_out || jsonb_build_object('id', v_id, 'product', v_p.name, 'ok', true);
      end if;

    elsif p_op = 'unpublish' then
      update public.marketplace_products
         set visible = false, content_status='draft',
             moderation_lock = moderation_lock + 1, updated_at = now()
       where id = v_id;
      v_done := v_done + 1;
      perform public.mm_audit('product.unpublished','marketplace_product', v_id::text,
                              v_before, jsonb_build_object('visible', false), p_reason);
      v_out := v_out || jsonb_build_object('id', v_id, 'product', v_p.name, 'ok', true);

    elsif p_op = 'category' then
      update public.marketplace_products
         set category_id = p_target, moderation_lock = moderation_lock + 1, updated_at = now()
       where id = v_id;
      v_done := v_done + 1;
      perform public.mm_audit('product.category_changed','marketplace_product', v_id::text,
        jsonb_build_object('category_id', v_p.category_id),
        jsonb_build_object('category_id', p_target), p_reason);
      v_out := v_out || jsonb_build_object('id', v_id, 'product', v_p.name, 'ok', true,
        'from', v_p.category_id, 'to', p_target);

    elsif p_op = 'author' then
      update public.marketplace_products
         set seller_id = p_target, moderation_lock = moderation_lock + 1, updated_at = now()
       where id = v_id;
      v_done := v_done + 1;
      perform public.mm_audit('product.owner_changed','marketplace_product', v_id::text,
        jsonb_build_object('seller_id', v_p.seller_id),
        jsonb_build_object('seller_id', p_target), p_reason);
      v_out := v_out || jsonb_build_object('id', v_id, 'product', v_p.name, 'ok', true,
        'from', v_p.seller_id, 'to', p_target);
    end if;
  end loop;

  perform public.mm_audit('product.bulk_'||p_op,'marketplace_product', null, null,
    jsonb_build_object('selected', array_length(p_ids,1), 'applied', v_done, 'skipped', v_skipped),
    p_reason);

  return jsonb_build_object('ok', true, 'operation', p_op,
    'selected', array_length(p_ids,1), 'applied', v_done, 'skipped', v_skipped,
    'results', v_out);
end;
$$;

/* --------------------------------------------------------- 25. full audit */

-- Inspect the whole catalogue and report what is wrong with it.
--
-- Read-only by design: section 25 says an audit must not make destructive
-- changes, so this counts and lists and changes nothing.
create or replace function public.mm_catalog_audit(p_limit integer default 25)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_total integer;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;
  select count(*) into v_total from public.marketplace_products where deleted_at is null;

  return jsonb_build_object(
    'ok', true, 'scanned', v_total, 'read_only', true,
    'findings', jsonb_build_array(
      jsonb_build_object('key','missing_description','severity','high',
        'label','No usable description',
        'count', (select count(*) from public.marketplace_products
                   where deleted_at is null and length(coalesce(btrim(description),'')) < 40),
        'examples', coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name))
                                from (select id,name from public.marketplace_products
                                       where deleted_at is null
                                         and length(coalesce(btrim(description),'')) < 40
                                       limit p_limit) t), '[]'::jsonb)),
      jsonb_build_object('key','no_category','severity','high',
        'label','No category assigned',
        'count', (select count(*) from public.marketplace_products
                   where deleted_at is null and category_id is null),
        'examples', coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name))
                                from (select id,name from public.marketplace_products
                                       where deleted_at is null and category_id is null
                                       limit p_limit) t), '[]'::jsonb)),
      jsonb_build_object('key','invalid_category','severity','critical',
        'label','Points at a category that does not exist',
        'count', (select count(*) from public.marketplace_products p
                   where p.deleted_at is null and p.category_id is not null
                     and not exists (select 1 from public.marketplace_categories c where c.id=p.category_id)),
        'examples','[]'::jsonb),
      jsonb_build_object('key','no_license','severity','high',
        'label','No licence stated',
        'count', (select count(*) from public.marketplace_products
                   where deleted_at is null and coalesce(btrim(license),'') = ''),
        'examples','[]'::jsonb),
      jsonb_build_object('key','no_media','severity','medium',
        'label','No thumbnail or cover image',
        'count', (select count(*) from public.marketplace_products
                   where deleted_at is null and coalesce(btrim(thumbnail_url),'')=''
                     and coalesce(btrim(cover_image),'')=''),
        'examples','[]'::jsonb),
      jsonb_build_object('key','no_demo','severity','medium',
        'label','No live demo',
        'count', (select count(*) from public.marketplace_products
                   where deleted_at is null and coalesce(btrim(demo_url),'')=''),
        'examples','[]'::jsonb),
      jsonb_build_object('key','published_unapproved','severity','critical',
        'label','Publicly visible without an approved moderation status',
        'count', (select count(*) from public.marketplace_products
                   where visible and moderation_status <> 'approved'),
        'examples', coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'status',moderation_status))
                                from (select id,name,moderation_status from public.marketplace_products
                                       where visible and moderation_status <> 'approved'
                                       limit p_limit) t), '[]'::jsonb)),
      jsonb_build_object('key','suspended_owner','severity','critical',
        'label','Visible but the owner is not approved',
        'count', (select count(*) from public.marketplace_products p
                   join public.marketplace_sellers s on s.id = p.seller_id
                  where p.visible and s.status <> 'approved'),
        'examples','[]'::jsonb),
      jsonb_build_object('key','legal_block','severity','critical',
        'label','Visible with an unresolved record in Legal Manager',
        'count', (select count(*) from public.marketplace_products p
                  where p.visible and exists (
                    select 1 from public.legal_violations v
                     where v.violator_id = p.id::text
                       and coalesce(v.status,'open') not in ('resolved','dismissed'))),
        'examples','[]'::jsonb),
      jsonb_build_object('key','open_duplicates','severity','medium',
        'label','Duplicate pairs waiting on a decision',
        'count', (select count(*) from public.product_duplicate_candidates where status='open'),
        'examples', coalesce((select jsonb_agg(jsonb_build_object(
                                 'a',(select name from public.marketplace_products where id=d.product_a),
                                 'b',(select name from public.marketplace_products where id=d.product_b),
                                 'match', d.match_percent))
                                from (select * from public.product_duplicate_candidates
                                       where status='open' order by match_percent desc
                                       limit p_limit) d), '[]'::jsonb)),
      jsonb_build_object('key','open_reports','severity','high',
        'label','Reports still open',
        'count', (select count(*) from public.product_reports
                   where status in ('reported','under_review','action_required')),
        'examples','[]'::jsonb),
      jsonb_build_object('key','orphan_merged','severity','medium',
        'label','Merged listings still marked visible',
        'count', (select count(*) from public.marketplace_products
                   where merged_into is not null and visible),
        'examples','[]'::jsonb),
      jsonb_build_object('key','purge_due','severity','medium',
        'label','Soft-deleted past the recovery window',
        'count', (select count(*) from public.marketplace_products
                   where moderation_status='soft_deleted' and purge_after is not null
                     and purge_after <= now()),
        'examples','[]'::jsonb)),
    'note','This audit only reports. It changes nothing, and no product is deleted, published or unpublished by running it.');
end;
$$;
