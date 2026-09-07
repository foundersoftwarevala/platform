-- Product Moderation Center, part three: duplicates, merge, deletion.

/* ------------------------------------------------------ 12. duplicate scan */

-- Find likely duplicate listings, with the evidence for each match.
--
-- The comparison is real: trigram similarity on the name and the description,
-- plus shared category, owner, demo URL and repository. Every contribution is
-- named in `reasons` so a reviewer can see why a pair scored what it did, and
-- nothing is merged by this function — it only proposes.
create or replace function public.mm_duplicate_scan(p_threshold numeric default 60)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp, extensions
as $$
declare v_found integer := 0; v_new integer := 0; r record; v_pct numeric; v_reasons jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  for r in
    select a.id a_id, a.name a_name, a.description a_desc, a.category_id a_cat,
           a.seller_id a_seller, a.demo_url a_demo, a.public_repo_url a_repo,
           b.id b_id, b.name b_name, b.description b_desc, b.category_id b_cat,
           b.seller_id b_seller, b.demo_url b_demo, b.public_repo_url b_repo,
           similarity(a.name, b.name) name_sim,
           case when a.description is null or b.description is null then 0
                else similarity(left(a.description,1000), left(b.description,1000)) end desc_sim
      from public.marketplace_products a
      join public.marketplace_products b
        on b.id > a.id
       and a.deleted_at is null and b.deleted_at is null
       and a.merged_into is null and b.merged_into is null
       -- The trigram index does the work; only close names are considered.
       and a.name % b.name
     where similarity(a.name, b.name) >= 0.45
     -- Ordered before the cut. Taking an arbitrary 500 rows meant the closest
     -- pair in the catalogue could be missed entirely while weaker ones were
     -- recorded, which is exactly what a duplicate scan must not do.
     order by similarity(a.name, b.name) desc,
              case when a.description is null or b.description is null then 0
                   else similarity(left(a.description,1000), left(b.description,1000)) end desc
     limit 500
  loop
    -- Name similarity carries most of the weight, description the rest, with
    -- shared attributes adding confidence.
    v_pct := round((r.name_sim * 60 + r.desc_sim * 25)::numeric, 2);
    v_reasons := jsonb_build_array(
      jsonb_build_object('factor','name_similarity','weight', round((r.name_sim*60)::numeric,1),
        'evidence', format('"%s" and "%s" are %s%% alike.', r.a_name, r.b_name,
                           round((r.name_sim*100)::numeric,0))),
      jsonb_build_object('factor','description_similarity','weight', round((r.desc_sim*25)::numeric,1),
        'evidence', case when r.desc_sim = 0 then 'One of them has no description to compare.'
                         else format('Descriptions are %s%% alike.', round((r.desc_sim*100)::numeric,0)) end));

    if r.a_cat is not null and r.a_cat = r.b_cat then
      v_pct := v_pct + 5;
      v_reasons := v_reasons || jsonb_build_object('factor','same_category','weight',5,
        'evidence','Both are in the same category.');
    end if;
    if r.a_seller is not null and r.a_seller = r.b_seller then
      v_pct := v_pct + 5;
      v_reasons := v_reasons || jsonb_build_object('factor','same_owner','weight',5,
        'evidence','Both belong to the same seller.');
    end if;
    if coalesce(r.a_demo,'') <> '' and r.a_demo = r.b_demo then
      v_pct := v_pct + 3;
      v_reasons := v_reasons || jsonb_build_object('factor','same_demo','weight',3,
        'evidence', format('Both point at the same demo: %s', r.a_demo));
    end if;
    if coalesce(r.a_repo,'') <> '' and r.a_repo = r.b_repo then
      v_pct := v_pct + 2;
      v_reasons := v_reasons || jsonb_build_object('factor','same_repository','weight',2,
        'evidence','Both point at the same repository.');
    end if;

    v_pct := least(v_pct, 100);
    if v_pct < p_threshold then continue; end if;
    v_found := v_found + 1;

    insert into public.product_duplicate_candidates
      (product_a, product_b, match_percent, reasons)
    values (r.a_id, r.b_id, v_pct, v_reasons)
    on conflict (product_a, product_b) do update
      set match_percent = excluded.match_percent,
          reasons = excluded.reasons,
          scanned_at = now()
      -- A pair somebody has already ruled on is not reopened by a rescan.
      where public.product_duplicate_candidates.status = 'open';
    if found then v_new := v_new + 1; end if;
  end loop;

  perform public.mm_audit('product.duplicate_scan','marketplace_product', null, null,
    jsonb_build_object('threshold', p_threshold, 'matches', v_found), null);

  return jsonb_build_object('ok', true, 'threshold', p_threshold,
    'matches', v_found, 'recorded', v_new,
    'open', (select count(*) from public.product_duplicate_candidates where status='open'),
    'note','Advisory. Nothing is merged by a scan; every pair needs a person to decide.');
end;
$$;

/* ---------------------------------------------------------- 13. the merge */

-- Merge a duplicate into a canonical product.
--
-- Nothing is destroyed. Orders, order lines, licences and reviews are moved to
-- the canonical product so no purchase or rating is lost, and the duplicate row
-- stays behind pointing at the canonical one, so old links and old order
-- references still resolve. The counts moved are recorded on the operation.
create or replace function public.mm_product_merge(
  p_canonical uuid, p_duplicate uuid, p_reason text, p_candidate uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_c record; v_d record; v_moved jsonb; v_op jsonb;
  v_items integer; v_reviews integer; v_licences integer; v_commissions integer;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if coalesce(btrim(p_reason),'') = '' then
    return jsonb_build_object('ok', false, 'reason', 'reason_required',
      'message','A merge changes which product owns real orders and reviews. Say why.');
  end if;
  if p_canonical = p_duplicate then
    return jsonb_build_object('ok', false, 'reason', 'same_product');
  end if;

  select * into v_c from public.marketplace_products where id = p_canonical for update;
  if not found then return jsonb_build_object('ok', false, 'reason','unknown_canonical'); end if;
  select * into v_d from public.marketplace_products where id = p_duplicate for update;
  if not found then return jsonb_build_object('ok', false, 'reason','unknown_duplicate'); end if;

  if v_d.merged_into is not null then
    return jsonb_build_object('ok', false, 'reason','already_merged',
      'message','That listing has already been merged into another product.');
  end if;
  if v_c.merged_into is not null then
    return jsonb_build_object('ok', false, 'reason','canonical_is_merged',
      'message','The canonical product you chose was itself merged into another one.');
  end if;

  -- Move the history that belongs to the buyer, not to the listing.
  update public.marketplace_order_items set product_id = p_canonical
   where product_id = p_duplicate;
  get diagnostics v_items = row_count;

  update public.marketplace_reviews set product_id = p_canonical, updated_at = now()
   where product_id = p_duplicate;
  get diagnostics v_reviews = row_count;

  update public.marketplace_licenses set product_id = p_canonical
   where product_id = p_duplicate;
  get diagnostics v_licences = row_count;

  select count(*) into v_commissions from public.marketplace_commissions c
    join public.marketplace_order_items i on i.id = c.order_item_id
   where i.product_id = p_canonical;

  -- The duplicate stays, pointing home, and comes off the storefront.
  update public.marketplace_products
     set merged_into = p_canonical,
         moderation_status = 'archived', content_status = 'archived',
         visible = false, moderation_lock = moderation_lock + 1, updated_at = now()
   where id = p_duplicate;

  -- The canonical product's rating is recomputed from the reviews it now holds.
  perform public.mm_product_rating_refresh(p_canonical);

  v_moved := jsonb_build_object(
    'order_items', v_items, 'reviews', v_reviews, 'licenses', v_licences,
    'commissions_now_on_canonical', v_commissions);

  insert into public.product_merge_operations
    (candidate_id, canonical_id, merged_id, moved, reason, performed_by)
  values (p_candidate, p_canonical, p_duplicate, v_moved, btrim(p_reason), auth.uid())
  returning to_jsonb(product_merge_operations) into v_op;

  if p_candidate is not null then
    update public.product_duplicate_candidates
       set status='merged', decided_by=auth.uid(), decided_at=now(),
           decision_reason=btrim(p_reason)
     where id = p_candidate;
  end if;

  perform public.mm_audit('product.merged','marketplace_product', p_duplicate::text,
    to_jsonb(v_d), jsonb_build_object('merged_into', p_canonical, 'moved', v_moved),
    btrim(p_reason));

  return jsonb_build_object('ok', true, 'operation', v_op, 'moved', v_moved,
    'note','The duplicate row was kept and now points at the canonical product, so existing links and order references still resolve.');
end;
$$;

create or replace function public.mm_duplicate_decide(
  p_candidate uuid, p_decision text, p_reason text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_row jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if p_decision not in ('not_duplicate','dismissed') then
    return jsonb_build_object('ok', false, 'reason', 'unknown_decision',
      'message','Merging is done through mm_product_merge, which needs a canonical product.');
  end if;

  update public.product_duplicate_candidates
     set status = p_decision, decided_by = auth.uid(), decided_at = now(),
         decision_reason = nullif(btrim(p_reason),'')
   where id = p_candidate and status = 'open'
  returning to_jsonb(product_duplicate_candidates) into v_row;

  if v_row is null then
    return jsonb_build_object('ok', false, 'reason','not_open',
      'message','That pair has already been decided.');
  end if;

  perform public.mm_audit('product.duplicate_'||p_decision,'product_duplicate',
                          p_candidate::text, null, v_row, p_reason);
  return jsonb_build_object('ok', true, 'candidate', v_row);
end;
$$;

/* -------------------------------------------------- 23. permanent deletion */

-- Ask for a permanent deletion. Under dual approval this only records the
-- request; a different person has to confirm it.
create or replace function public.mm_product_purge_request(p_id uuid, p_reason text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_p record; v_row jsonb; v_policy record;
begin
  if not (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'boss')
          or public.has_role(auth.uid(),'super_admin')) then
    return jsonb_build_object('ok', false, 'reason','not_permitted',
      'message','Permanent deletion is restricted to an admin or the boss.');
  end if;
  if coalesce(btrim(p_reason),'') = '' then
    return jsonb_build_object('ok', false, 'reason','reason_required');
  end if;

  select * into v_p from public.marketplace_products where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'reason','unknown_product'); end if;
  if v_p.moderation_status <> 'trash' then
    return jsonb_build_object('ok', false, 'reason','not_in_trash',
      'message','Only a product already in the trash can be permanently deleted.');
  end if;

  select * into v_policy from public.product_moderation_policy where id;
  if v_p.purge_after is not null and v_p.purge_after > now() then
    return jsonb_build_object('ok', false, 'reason','recovery_window_open',
      'message', format('The %s day recovery window closes %s. It cannot be purged before then.',
                        v_policy.recovery_days, to_char(v_p.purge_after,'DD Mon YYYY')));
  end if;

  insert into public.product_purge_requests (product_id, reason, requested_by, status)
  values (p_id, btrim(p_reason), auth.uid(),
          case when v_policy.dual_approval then 'pending' else 'approved' end)
  returning to_jsonb(product_purge_requests) into v_row;

  if not v_policy.dual_approval then
    update public.product_purge_requests set approved_by = auth.uid(), approved_at = now()
     where id = (v_row->>'id')::uuid returning to_jsonb(product_purge_requests) into v_row;
  end if;

  perform public.mm_audit('product.purge_requested','marketplace_product', p_id::text,
                          null, v_row, btrim(p_reason));

  return jsonb_build_object('ok', true, 'request', v_row,
    'dual_approval_required', v_policy.dual_approval);
end;
$$;

-- Carry it out. Financial, licence and review records are kept whatever the
-- request says: the product's content is removed, the evidence of what was
-- bought is not.
create or replace function public.mm_product_purge_execute(p_request uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_r record; v_p record; v_policy record; v_outcome jsonb;
  v_orders integer; v_licences integer; v_reviews integer;
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

  -- The second pair of eyes. The person who asked cannot also confirm.
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

  select count(*) into v_orders from public.marketplace_order_items where product_id = v_p.id;
  select count(*) into v_licences from public.marketplace_licenses where product_id = v_p.id;
  select count(*) into v_reviews from public.marketplace_reviews where product_id = v_p.id;

  -- Where a purchase exists, the row has to survive for the order and the
  -- licence to mean anything. The listing's content is removed instead, which
  -- is what section 23 asks for.
  if (v_orders > 0 and v_policy.preserve_orders)
     or (v_licences > 0 and v_policy.preserve_licenses) then
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
      'why','This product has purchases behind it, and the policy preserves orders and licences. Its content was removed; the record remains so the orders and licences still resolve.',
      'orders_kept', v_orders, 'licences_kept', v_licences, 'reviews_kept', v_reviews);
  else
    -- Nothing was ever bought. The row can go.
    delete from public.marketplace_products where id = v_p.id;
    v_outcome := jsonb_build_object(
      'mode','deleted',
      'why','No order or licence referenced this product, so the record was removed outright.',
      'orders_kept', 0, 'licences_kept', 0, 'reviews_kept', 0);
  end if;

  update public.product_purge_requests
     set status='executed', executed_at=now(), outcome=v_outcome
   where id = p_request;

  perform public.mm_audit('product.purged','marketplace_product', v_p.id::text,
                          to_jsonb(v_p), v_outcome, v_r.reason);

  return jsonb_build_object('ok', true, 'outcome', v_outcome);
end;
$$;
