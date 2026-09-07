-- Product Moderation Center, part five: what the console reads.

create or replace function public.mm_moderation(p_query jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tab    text := coalesce(p_query->>'tab','queue');
  v_search text := nullif(btrim(coalesce(p_query->>'search','')),'');
  v_status text := nullif(p_query->>'status','');
  v_cat    text := nullif(p_query->>'category','');
  v_limit  integer := least(greatest(coalesce((p_query->>'limit')::int,50),1),200);
  v_offset integer := greatest(coalesce((p_query->>'offset')::int,0),0);
  v_policy record;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;
  select * into v_policy from public.product_moderation_policy where id;

  return jsonb_build_object(
    'ok', true, 'tab', v_tab,

    -- The four metric cards, every one counted.
    'awaiting', (select count(*) from public.marketplace_products
                  where moderation_status in ('submitted','under_review','changes_requested')),
    'duplicates', (select count(*) from public.product_duplicate_candidates where status='open'),
    'reported_this_week', (select count(*) from public.product_reports
                            where created_at >= now() - interval '7 days'),
    'clean', (select count(*) from public.marketplace_products p
               where p.deleted_at is null and p.moderation_status='approved'
                 and not exists (select 1 from public.product_reports r
                                  where r.product_id=p.id
                                    and r.status in ('reported','under_review','action_required'))
                 and not exists (select 1 from public.product_duplicate_candidates d
                                  where (d.product_a=p.id or d.product_b=p.id) and d.status='open')),

    'by_status', coalesce((select jsonb_object_agg(moderation_status, n)
                             from (select moderation_status, count(*) n
                                     from public.marketplace_products group by moderation_status) t),
                          '{}'::jsonb),
    'total_catalog', (select count(*) from public.marketplace_products),
    'policy', to_jsonb(v_policy),

    -- Moderation analytics, from the audit log rather than a counter.
    'analytics', jsonb_build_object(
      'approved_30d', (select count(*) from public.marketplace_audit_logs
                        where action='product.approved' and created_at >= now()-interval '30 days'),
      'rejected_30d', (select count(*) from public.marketplace_audit_logs
                        where action='product.rejected' and created_at >= now()-interval '30 days'),
      'suspended_30d', (select count(*) from public.marketplace_audit_logs
                         where action='product.suspended' and created_at >= now()-interval '30 days'),
      'reports_open', (select count(*) from public.product_reports
                        where status in ('reported','under_review','action_required')),
      'reports_resolved_30d', (select count(*) from public.product_reports
                                where status in ('resolved','dismissed')
                                  and resolved_at >= now()-interval '30 days'),
      'merges_30d', (select count(*) from public.product_merge_operations
                      where performed_at >= now()-interval '30 days')),

    'total', (select count(*) from public.marketplace_products p
               where case v_tab
                 when 'queue'     then p.moderation_status in ('draft','submitted','under_review','changes_requested')
                 when 'archived'  then p.moderation_status = 'archived'
                 when 'deleted'   then p.moderation_status = 'soft_deleted'
                 when 'trash'     then p.moderation_status = 'trash'
                 else true end),

    'products', case when v_tab in ('duplicates','reports') then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'name', p.name, 'slug', p.slug,
               'status', p.moderation_status, 'content_status', p.content_status,
               'visible', p.visible, 'lock', p.moderation_lock,
               'seller_id', p.seller_id,
               'owner', (select s.display_name from public.marketplace_sellers s where s.id=p.seller_id),
               'owner_status', (select s.status from public.marketplace_sellers s where s.id=p.seller_id),
               'category', (select c.name from public.marketplace_categories c where c.id=p.category_id),
               'created_at', p.created_at, 'updated_at', p.updated_at,
               'approved_at', p.approved_at,
               'deleted_at', p.deleted_at, 'delete_reason', p.delete_reason,
               'purge_after', p.purge_after,
               'merged_into', p.merged_into,
               'reports', (select count(*) from public.product_reports r
                            where r.product_id=p.id
                              and r.status in ('reported','under_review','action_required')),
               'duplicate_of', (select count(*) from public.product_duplicate_candidates d
                                 where (d.product_a=p.id or d.product_b=p.id) and d.status='open'),
               'checks_failing', (public.mm_product_checks(p.id)->>'mandatory_failed')::int)
             order by p.updated_at desc)
        from (select * from public.marketplace_products p2
               where case v_tab
                 when 'queue'    then p2.moderation_status in ('draft','submitted','under_review','changes_requested')
                 when 'archived' then p2.moderation_status = 'archived'
                 when 'deleted'  then p2.moderation_status = 'soft_deleted'
                 when 'trash'    then p2.moderation_status = 'trash'
                 else true end
                 and (v_status is null or p2.moderation_status = v_status)
                 and (v_cat is null or p2.category_id = v_cat::uuid)
                 and (v_search is null
                      or p2.name ilike '%'||v_search||'%'
                      or p2.slug ilike '%'||v_search||'%'
                      or p2.id::text = v_search)
               order by p2.updated_at desc
               limit v_limit offset v_offset) p), '[]'::jsonb) end,

    'duplicate_pairs', case when v_tab <> 'duplicates' then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', d.id, 'match', d.match_percent, 'reasons', d.reasons,
               'status', d.status, 'scanned_at', d.scanned_at,
               'a', jsonb_build_object('id', a.id, 'name', a.name, 'status', a.moderation_status,
                      'owner', (select s.display_name from public.marketplace_sellers s where s.id=a.seller_id),
                      'orders', (select count(*) from public.marketplace_order_items i where i.product_id=a.id),
                      'reviews', (select count(*) from public.marketplace_reviews r where r.product_id=a.id),
                      'rating', a.rating, 'downloads', a.downloads, 'price', a.price_label),
               'b', jsonb_build_object('id', b.id, 'name', b.name, 'status', b.moderation_status,
                      'owner', (select s.display_name from public.marketplace_sellers s where s.id=b.seller_id),
                      'orders', (select count(*) from public.marketplace_order_items i where i.product_id=b.id),
                      'reviews', (select count(*) from public.marketplace_reviews r where r.product_id=b.id),
                      'rating', b.rating, 'downloads', b.downloads, 'price', b.price_label))
             order by d.match_percent desc)
        from (select * from public.product_duplicate_candidates
               where status='open' order by match_percent desc limit v_limit) d
        join public.marketplace_products a on a.id = d.product_a
        join public.marketplace_products b on b.id = d.product_b), '[]'::jsonb) end,

    'reports', case when v_tab <> 'reports' then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'report_no', r.report_no, 'reason', r.reason,
               'detail', r.detail, 'severity', r.severity, 'status', r.status,
               'created_at', r.created_at, 'resolution', r.resolution,
               'legal_reference', r.legal_reference,
               'product_id', r.product_id,
               'product', (select name from public.marketplace_products where id=r.product_id))
             order by r.created_at desc)
        from (select * from public.product_reports order by created_at desc limit v_limit) r),
      '[]'::jsonb) end);
end;
$$;

create or replace function public.mm_moderation_policy_set(p_patch jsonb)
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
  select to_jsonb(p) into v_before from public.product_moderation_policy p where p.id;

  update public.product_moderation_policy set
    recovery_days = coalesce((p_patch->>'recovery_days')::int, recovery_days),
    dual_approval = coalesce((p_patch->>'dual_approval')::boolean, dual_approval),
    auto_purge = coalesce((p_patch->>'auto_purge')::boolean, auto_purge),
    preserve_orders = coalesce((p_patch->>'preserve_orders')::boolean, preserve_orders),
    preserve_licenses = coalesce((p_patch->>'preserve_licenses')::boolean, preserve_licenses),
    preserve_reviews = coalesce((p_patch->>'preserve_reviews')::boolean, preserve_reviews),
    updated_by = auth.uid(), updated_at = now()
  where id returning to_jsonb(product_moderation_policy) into v_after;

  perform public.mm_audit('product.policy_changed','product_moderation_policy','policy',
                          v_before, v_after, nullif(p_patch->>'reason',''));
  return jsonb_build_object('ok', true, 'policy', v_after);
end;
$$;

-- The full review packet for one product (§5).
create or replace function public.mm_product_moderation_detail(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_p record;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;
  select * into v_p from public.marketplace_products where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'reason','unknown_product'); end if;

  return jsonb_build_object(
    'ok', true,
    'product', to_jsonb(v_p),
    'checks', public.mm_product_checks(p_id),
    'owner', (select jsonb_build_object('id', s.id, 'name', s.display_name,
                'status', s.status, 'kind', s.seller_kind,
                'violations', (select count(*) from public.legal_violations v
                                where v.violator_id = s.id::text
                                  and coalesce(v.status,'open') not in ('resolved','dismissed')))
                from public.marketplace_sellers s where s.id = v_p.seller_id),
    'category', (select jsonb_build_object('id', c.id, 'name', c.name)
                   from public.marketplace_categories c where c.id = v_p.category_id),

    -- Read from Review Manager. Never altered here: archiving a product does
    -- not delete its reviews.
    'reviews', jsonb_build_object(
      'published', (select count(*) from public.marketplace_reviews
                     where product_id=p_id and status='published'),
      'total', (select count(*) from public.marketplace_reviews where product_id=p_id),
      'rating', v_p.rating),

    'commerce', jsonb_build_object(
      'order_items', (select count(*) from public.marketplace_order_items where product_id=p_id),
      'licenses', (select count(*) from public.marketplace_licenses where product_id=p_id)),

    'versions', coalesce((select jsonb_agg(jsonb_build_object(
                            'version', v.version, 'status', v.status,
                            'published_at', v.published_at) order by v.created_at desc)
                            from public.marketplace_product_versions v
                           where v.product_id = p_id), '[]'::jsonb),

    'reports', coalesce((select jsonb_agg(jsonb_build_object(
                           'id', r.id, 'report_no', r.report_no, 'reason', r.reason,
                           'severity', r.severity, 'status', r.status,
                           'detail', r.detail, 'created_at', r.created_at)
                         order by r.created_at desc)
                          from public.product_reports r where r.product_id = p_id), '[]'::jsonb),

    'duplicates', coalesce((select jsonb_agg(jsonb_build_object(
                              'id', d.id, 'match', d.match_percent, 'status', d.status,
                              'reasons', d.reasons,
                              'other', (select name from public.marketplace_products
                                         where id = case when d.product_a=p_id then d.product_b
                                                         else d.product_a end)))
                             from public.product_duplicate_candidates d
                            where d.product_a=p_id or d.product_b=p_id), '[]'::jsonb),

    -- Legal Manager's own records, read only.
    'legal', coalesce((select jsonb_agg(jsonb_build_object(
                          'ref', v.ref_code, 'type', v.violation_type,
                          'severity', v.severity, 'status', v.status))
                         from public.legal_violations v
                        where v.violator_id = p_id::text), '[]'::jsonb),

    'history', coalesce((select jsonb_agg(jsonb_build_object(
                           'action', a.action, 'at', a.created_at, 'actor', a.actor_id,
                           'reason', a.reason)
                         order by a.created_at desc)
                          from (select * from public.marketplace_audit_logs
                                 where entity_id = p_id order by created_at desc limit 50) a),
                        '[]'::jsonb));
end;
$$;
