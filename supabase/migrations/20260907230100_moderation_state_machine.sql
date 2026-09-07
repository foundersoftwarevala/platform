-- Product Moderation Center, part two: the operations.

/* --------------------------------------------------- 4. the state machine */

-- Move one product through its moderation lifecycle.
--
-- The transition table is the specification's, and an invalid move changes
-- nothing. Approval runs the same mandatory checks the author approval
-- workflow uses — one gate, not two — so a product cannot be published here
-- that would be blocked there.
create or replace function public.mm_product_moderate(
  p_id uuid, p_to text, p_reason text default null,
  p_lock integer default null, p_evidence jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_p record; v_after jsonb; v_allowed boolean; v_checks jsonb;
  v_owner uuid; v_policy record; v_sub uuid;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if p_to not in ('draft','submitted','under_review','changes_requested',
                  'approved','rejected','suspended','archived','soft_deleted','trash') then
    return jsonb_build_object('ok', false, 'reason', 'unknown_status');
  end if;

  select * into v_p from public.marketplace_products where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_product');
  end if;

  if p_lock is not null and p_lock <> v_p.moderation_lock then
    return jsonb_build_object('ok', false, 'reason', 'stale',
      'message', 'Product changed by another reviewer. Refresh before continuing.',
      'current_status', v_p.moderation_status, 'current_lock', v_p.moderation_lock);
  end if;

  v_allowed := case v_p.moderation_status
    when 'draft'             then p_to in ('submitted','archived','soft_deleted')
    when 'submitted'         then p_to in ('under_review','approved','rejected','changes_requested','archived','soft_deleted')
    when 'under_review'      then p_to in ('approved','rejected','changes_requested','suspended','archived','soft_deleted')
    when 'changes_requested' then p_to in ('submitted','rejected','archived','soft_deleted')
    when 'approved'          then p_to in ('suspended','archived','soft_deleted','under_review')
    when 'rejected'          then p_to in ('draft','archived','soft_deleted')
    when 'suspended'         then p_to in ('approved','archived','soft_deleted','under_review')
    when 'archived'          then p_to in ('approved','draft','soft_deleted')
    when 'soft_deleted'      then p_to in ('trash','draft','archived','approved')
    when 'trash'             then p_to in ('soft_deleted')
    else false end;

  if not v_allowed then
    return jsonb_build_object('ok', false, 'reason', 'invalid_transition',
      'message', format('A %s product cannot become %s.', v_p.moderation_status, p_to));
  end if;

  if p_to in ('rejected','suspended','soft_deleted','trash','changes_requested')
     and coalesce(btrim(p_reason),'') = '' then
    return jsonb_build_object('ok', false, 'reason', 'reason_required',
      'message', 'Say why. The owner is told and this is recorded permanently.');
  end if;

  -- Restoring is not blind. A product coming back out of deletion, archive or
  -- suspension has to be publishable before it can be approved again.
  if p_to = 'approved' then
    v_checks := public.mm_product_checks(p_id);
    if (v_checks->>'blocking')::boolean then
      return jsonb_build_object('ok', false, 'reason', 'checks_failed',
        'message', format('%s mandatory check(s) are failing. This product cannot be published.',
                          v_checks->>'mandatory_failed'),
        'checks', v_checks->'checks');
    end if;
  end if;

  select * into v_policy from public.product_moderation_policy where id;

  update public.marketplace_products
     set moderation_status = p_to,
         -- Public visibility follows the decision, never the other way round.
         visible = (p_to = 'approved'),
         content_status = case p_to
           when 'approved' then 'published'
           when 'archived' then 'archived'
           else 'draft' end,
         approved_at = case when p_to='approved' then now() else approved_at end,
         approved_by = case when p_to='approved' then auth.uid() else approved_by end,
         deleted_at = case when p_to in ('soft_deleted','trash') then coalesce(deleted_at, now())
                           when p_to in ('draft','approved','archived') then null
                           else deleted_at end,
         deleted_by = case when p_to in ('soft_deleted','trash') then coalesce(deleted_by, auth.uid())
                           when p_to in ('draft','approved','archived') then null
                           else deleted_by end,
         delete_reason = case when p_to in ('soft_deleted','trash') then coalesce(nullif(btrim(p_reason),''), delete_reason)
                              when p_to in ('draft','approved','archived') then null
                              else delete_reason end,
         purge_after = case when p_to = 'soft_deleted'
                            then coalesce(deleted_at, now()) + (v_policy.recovery_days || ' days')::interval
                            when p_to in ('draft','approved','archived') then null
                            else purge_after end,
         moderation_lock = moderation_lock + 1,
         updated_at = now()
   where id = p_id returning to_jsonb(marketplace_products) into v_after;

  -- An open submission follows the product, so the two consoles never disagree.
  select id into v_sub from public.author_submissions
   where product_id = p_id
     and status in ('draft','pending_review','verifying','changes_requested')
   limit 1;
  if v_sub is not null and p_to in ('rejected','suspended','archived','soft_deleted','trash') then
    update public.author_submissions
       set status = case p_to when 'rejected' then 'rejected' else 'archived' end,
           last_action = p_to, last_reason = p_reason,
           lock_version = lock_version + 1, updated_at = now()
     where id = v_sub;
    insert into public.author_approval_history
      (submission_id, revision, action, from_status, to_status, actor_id, actor_role, reason)
    select v_sub, revision, 'moderation:'||p_to, status,
           case p_to when 'rejected' then 'rejected' else 'archived' end,
           auth.uid(), 'marketplace_manager',
           coalesce(p_reason,'Closed by the Product Moderation Center.')
      from public.author_submissions where id = v_sub;
  end if;

  perform public.mm_audit('product.'||p_to, 'marketplace_product', p_id::text,
                          to_jsonb(v_p), v_after,
                          coalesce(p_reason, format('Moderation: %s.', p_to)));

  select s.owner_user_id into v_owner
    from public.marketplace_sellers s where s.id = v_p.seller_id;
  if v_owner is not null then
    perform public.mm_notify('product.'||p_to,
      case p_to
        when 'approved' then 'Your product is approved and live'
        when 'rejected' then 'Your product was rejected'
        when 'suspended' then 'Your product has been suspended'
        when 'archived' then 'Your product has been archived'
        when 'soft_deleted' then 'Your product has been removed'
        else format('Your product is now %s', replace(p_to,'_',' ')) end,
      coalesce(p_reason, v_p.name),
      v_owner, null, '/author-manager', 'Open', 5,
      case p_to when 'approved' then 'success'
                when 'rejected' then 'warning'
                when 'suspended' then 'danger'
                when 'soft_deleted' then 'danger'
                when 'trash' then 'danger' else 'info' end);
  end if;

  return jsonb_build_object('ok', true, 'product', v_after,
    'public', p_to = 'approved',
    'recoverable_until', v_after->>'purge_after');
end;
$$;

-- The publishing checks, shared with the author approval workflow so the two
-- consoles cannot disagree about whether a product may go public.
create or replace function public.mm_product_checks(p_product uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_p record; v_seller record; v_checks jsonb;
begin
  select * into v_p from public.marketplace_products where id = p_product;
  if not found then
    return jsonb_build_object('ok', false, 'reason','unknown_product','blocking', true);
  end if;
  select * into v_seller from public.marketplace_sellers where id = v_p.seller_id;

  v_checks := jsonb_build_array(
    jsonb_build_object('key','name','label','Product name','mandatory',true,
      'passed', coalesce(btrim(v_p.name),'') <> '', 'detail', coalesce(v_p.name,'missing')),
    jsonb_build_object('key','description','label','Description','mandatory',true,
      'passed', length(coalesce(btrim(v_p.description),'')) >= 40,
      'detail', case when coalesce(btrim(v_p.description),'')='' then 'missing'
                     else format('%s characters', length(btrim(v_p.description))) end),
    jsonb_build_object('key','category','label','Category','mandatory',true,
      'passed', v_p.category_id is not null,
      'detail', coalesce((select name from public.marketplace_categories c where c.id=v_p.category_id),'no category')),
    jsonb_build_object('key','pricing','label','Price','mandatory',true,
      'passed', coalesce(btrim(v_p.price_label),'') <> '',
      'detail', coalesce(nullif(btrim(v_p.price_label),''),'missing')),
    jsonb_build_object('key','license','label','Licence','mandatory',true,
      'passed', coalesce(btrim(v_p.license),'') <> '',
      'detail', coalesce(nullif(btrim(v_p.license),''),'missing')),
    jsonb_build_object('key','demo','label','Live demo','mandatory',false,
      'passed', coalesce(btrim(v_p.demo_url),'') <> '',
      'detail', coalesce(nullif(btrim(v_p.demo_url),''),'no demo URL')),
    jsonb_build_object('key','media','label','Imagery','mandatory',false,
      'passed', coalesce(btrim(v_p.thumbnail_url),'') <> '' or coalesce(btrim(v_p.cover_image),'') <> '',
      'detail', case when coalesce(btrim(v_p.thumbnail_url),'') <> ''
                       or coalesce(btrim(v_p.cover_image),'') <> '' then 'present'
                     else 'no thumbnail or cover image' end),
    -- Author Manager and Vendor Manager decide this, not moderation.
    jsonb_build_object('key','owner','label','Owner is in good standing','mandatory', v_seller.id is not null,
      'passed', v_seller.id is null or v_seller.status = 'approved',
      'detail', case when v_seller.id is null then 'first-party product, no seller'
                     else format('%s is %s', v_seller.display_name, v_seller.status) end),
    -- Legal Manager's record, read only.
    jsonb_build_object('key','legal','label','No blocking legal record','mandatory',true,
      'passed', not exists (select 1 from public.legal_violations v
                             where v.violator_id = p_product::text
                               and coalesce(v.status,'open') not in ('resolved','dismissed')),
      'detail', case when exists (select 1 from public.legal_violations v
                                   where v.violator_id = p_product::text
                                     and coalesce(v.status,'open') not in ('resolved','dismissed'))
                     then 'Legal Manager has an unresolved violation against this product.'
                     else 'No unresolved violation in Legal Manager.' end),
    -- An unresolved serious report stops publication until somebody closes it.
    jsonb_build_object('key','reports','label','No unresolved serious report','mandatory',true,
      'passed', not exists (select 1 from public.product_reports r
                             where r.product_id = p_product
                               and r.status in ('reported','under_review','action_required')
                               and r.severity in ('high','critical')),
      'detail', format('%s open report(s), %s of them serious',
        (select count(*) from public.product_reports r where r.product_id=p_product
          and r.status in ('reported','under_review','action_required')),
        (select count(*) from public.product_reports r where r.product_id=p_product
          and r.status in ('reported','under_review','action_required')
          and r.severity in ('high','critical')))),
    jsonb_build_object('key','not_merged','label','Not merged into another product','mandatory',true,
      'passed', v_p.merged_into is null,
      'detail', case when v_p.merged_into is null then 'standalone'
                     else 'this listing was merged into another and should not be republished' end));

  return jsonb_build_object('ok', true, 'checks', v_checks,
    'mandatory_failed', (select count(*) from jsonb_array_elements(v_checks) c
                          where (c->>'mandatory')::boolean and not (c->>'passed')::boolean),
    'blocking', (select count(*) from jsonb_array_elements(v_checks) c
                  where (c->>'mandatory')::boolean and not (c->>'passed')::boolean) > 0);
end;
$$;

/* ----------------------------------------------------------- 11. clone */

-- Copy the listing, and nothing that belongs to the original's history.
--
-- Orders, licences, reviews, moderation history and financial records are all
-- deliberately absent: they belong to the product that earned them.
create or replace function public.mm_product_clone(p_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_new uuid; v_slug text; v_p record;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  select * into v_p from public.marketplace_products where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_product');
  end if;

  v_slug := left(v_p.slug, 60) || '-copy-' || substr(md5(random()::text), 1, 6);

  insert into public.marketplace_products (
    slug, name, industry_label, icon, price_label, price_period,
    badge, category_id, sort_order, description, thumbnail_url, cover_image,
    tags, tech_stack, features, software_type, deployment, license, version,
    technology, frontend, backend, database, authentication, api, mobile, pwa,
    cloud, offline, roles, languages, currency, tax, reports, dashboard,
    analytics, ai, whatsapp, email, sms, payment_gateway, integrations, modules,
    benefits, target_audience, search_keywords, logo, favicon, subcategory,
    seller_id,
    -- A clone starts as an unapproved draft. It has never been reviewed.
    moderation_status, content_status, visible,
    -- And it carries none of the original's standing.
    rating, downloads, is_featured, is_trending, is_new_release, is_best_seller)
  select
    v_slug, v_p.name || ' (copy)', industry_label, icon, price_label, price_period,
    badge, category_id, sort_order, description, thumbnail_url, cover_image,
    tags, tech_stack, features, software_type, deployment, license, version,
    technology, frontend, backend, database, authentication, api, mobile, pwa,
    cloud, offline, roles, languages, currency, tax, reports, dashboard,
    analytics, ai, whatsapp, email, sms, payment_gateway, integrations, modules,
    benefits, target_audience, search_keywords, logo, favicon, subcategory,
    seller_id,
    'draft', 'draft', false,
    0, 0, false, false, false, false
  from public.marketplace_products where id = p_id
  returning id into v_new;

  perform public.mm_audit('product.cloned','marketplace_product', v_new::text, null,
    jsonb_build_object('cloned_from', p_id, 'new_product', v_new, 'slug', v_slug),
    'Cloned as an unreviewed draft. No orders, licences, reviews or history were copied.');

  return jsonb_build_object('ok', true, 'product_id', v_new, 'slug', v_slug,
    'note','A clone starts as an unapproved draft with no rating, downloads, orders, licences, reviews or moderation history.');
end;
$$;
