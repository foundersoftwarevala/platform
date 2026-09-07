-- A purge must not destroy a merge record.
--
-- The first version decided between deleting the row and anonymising it purely
-- on whether orders or licences existed. It missed a third thing that keeps a
-- product row alive: product_merge_operations points at both sides of every
-- merge, and that history is deliberately immutable. Trying to delete such a
-- product raised a foreign key error instead of taking the anonymise path.
--
-- The rule is now stated once: if any record that must be preserved still
-- refers to this product, its content is removed and the row stays.
create or replace function public.mm_product_purge_execute(p_request uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_r record; v_p record; v_policy record; v_outcome jsonb;
  v_orders integer; v_licences integer; v_reviews integer; v_merges integer;
  v_must_keep boolean;
begin
  if not (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'boss')
          or public.has_role(auth.uid(),'super_admin')) then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;

  select * into v_r from public.product_purge_requests where id = p_request for update;
  if not found then return jsonb_build_object('ok', false, 'reason','unknown_request'); end if;
  if v_r.status = 'executed' then
    return jsonb_build_object('ok', false, 'reason','already_executed');
  end if;

  select * into v_policy from public.product_moderation_policy where id;

  if v_policy.dual_approval and v_r.status = 'pending' then
    if v_r.requested_by = auth.uid() then
      return jsonb_build_object('ok', false, 'reason','second_approver_required',
        'message','Dual approval is on. A different admin has to confirm this deletion.');
    end if;
    update public.product_purge_requests
       set status='approved', approved_by=auth.uid(), approved_at=now()
     where id = p_request;
    select * into v_r from public.product_purge_requests where id = p_request;
  end if;

  select * into v_p from public.marketplace_products where id = v_r.product_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason','unknown_product'); end if;

  select count(*) into v_orders   from public.marketplace_order_items where product_id = v_p.id;
  select count(*) into v_licences from public.marketplace_licenses   where product_id = v_p.id;
  select count(*) into v_reviews  from public.marketplace_reviews    where product_id = v_p.id;
  select count(*) into v_merges   from public.product_merge_operations
   where canonical_id = v_p.id or merged_id = v_p.id;

  -- Anything that has to outlive the product keeps its row alive.
  v_must_keep :=
       (v_orders   > 0 and v_policy.preserve_orders)
    or (v_licences > 0 and v_policy.preserve_licenses)
    or (v_reviews  > 0 and v_policy.preserve_reviews)
    or v_merges > 0
    or exists (select 1 from public.marketplace_products x where x.merged_into = v_p.id);

  if v_must_keep then
    update public.marketplace_products
       set name = '[removed product ' || left(id::text,8) || ']',
           description = null, thumbnail_url = null, cover_image = null,
           demo_url = null, public_repo_url = null, logo = null, favicon = null,
           features = '{}'::jsonb, tags = '{}', tech_stack = '{}',
           search_keywords = '{}', search_text = null,
           visible = false, content_status = 'archived', moderation_status = 'trash',
           moderation_lock = moderation_lock + 1, updated_at = now()
     where id = v_p.id;

    v_outcome := jsonb_build_object(
      'mode','anonymised',
      'why', concat_ws(' ',
        'The listing content was removed and the record kept, because',
        case when v_orders > 0 or v_licences > 0
             then format('%s order line(s) and %s licence(s) depend on it;', v_orders, v_licences) end,
        case when v_reviews > 0 then format('%s review(s) reference it;', v_reviews) end,
        case when v_merges > 0 then format('%s merge record(s) reference it;', v_merges) end,
        'removing the row would have destroyed records that must be preserved.'),
      'orders_kept', v_orders, 'licences_kept', v_licences,
      'reviews_kept', v_reviews, 'merge_records_kept', v_merges);
  else
    delete from public.marketplace_products where id = v_p.id;
    v_outcome := jsonb_build_object(
      'mode','deleted',
      'why','Nothing referenced this product — no order, licence, review or merge record — so the row was removed outright.',
      'orders_kept', 0, 'licences_kept', 0, 'reviews_kept', 0, 'merge_records_kept', 0);
  end if;

  update public.product_purge_requests
     set status='executed', executed_at=now(), outcome=v_outcome
   where id = p_request;

  perform public.mm_audit('product.purged','marketplace_product', v_p.id::text,
                          to_jsonb(v_p), v_outcome, v_r.reason);

  return jsonb_build_object('ok', true, 'outcome', v_outcome);
end;
$$;
