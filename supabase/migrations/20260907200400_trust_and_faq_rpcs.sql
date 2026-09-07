/* ===================================================================== TRUST */

-- Whether each badge is earned for one product, and the evidence for it.
--
-- Nothing is stored: every badge is worked out from the canonical data at read
-- time, so a badge cannot outlive the fact behind it. A disabled badge never
-- shows, whatever the facts say, and a badge that fails its rule comes back
-- with the reason it failed rather than silently vanishing.
create or replace function public.trust_evaluate(
  p_product uuid, p_surface text default 'product_card')
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_p record; v_seller record; v_out jsonb := '[]'::jsonb; v_b record;
  v_pass boolean; v_why text; v_reviews integer; v_payment boolean;
begin
  select p.id, p.visible, p.moderation_status, p.seller_id, p.demo_url
    into v_p from public.marketplace_products p where p.id = p_product;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_product');
  end if;

  select s.id, s.status, s.seller_kind,
         (select count(*) from public.marketplace_products x
           where x.seller_id = s.id and x.visible) as published
    into v_seller
    from public.marketplace_sellers s where s.id = v_p.seller_id;

  select count(*) into v_reviews from public.marketplace_reviews
   where product_id = p_product and status = 'published';

  -- Is there a payment provider actually configured? Reported from the
  -- environment rather than assumed, because "Secure Purchase" is a claim.
  v_payment := coalesce(current_setting('app.payu_configured', true), '') = 'true'
               or exists (select 1 from public.payment_logs limit 1);

  for v_b in select * from public.trust_badges where enabled
              and p_surface = any(display_locations)
             order by priority
  loop
    v_pass := false; v_why := null;

    if v_b.key = 'verified_product' then
      v_pass := v_p.moderation_status = 'approved' and v_p.visible
                and v_seller.id is not null and v_seller.status = 'approved';
      v_why := case
        when v_p.moderation_status <> 'approved' then 'the product is not approved'
        when not v_p.visible then 'the product is not published'
        when v_seller.id is null then 'the product has no seller — it is first-party'
        when v_seller.status <> 'approved' then 'the seller is not approved'
        else null end;

    elsif v_b.key = 'verified_vendor' then
      v_pass := v_seller.id is not null and v_seller.seller_kind = 'vendor'
                and v_seller.status = 'approved' and v_seller.published > 0;
      v_why := case
        when v_seller.id is null then 'the product has no seller'
        when v_seller.seller_kind is distinct from 'vendor' then 'the seller is not a vendor'
        when v_seller.status <> 'approved' then 'the vendor is not approved'
        else 'the vendor has no published product' end;

    elsif v_b.key = 'verified_author' then
      v_pass := v_seller.id is not null and v_seller.seller_kind = 'author'
                and v_seller.status = 'approved' and v_seller.published > 0;
      v_why := case
        when v_seller.id is null then 'the product has no seller'
        when v_seller.seller_kind is distinct from 'author' then 'the seller is not an author'
        when v_seller.status <> 'approved' then 'the author is not approved'
        else 'the author has no published product' end;

    elsif v_b.key = 'verified_reviews' then
      -- Every review is bound to an order line by the schema, so any published
      -- review is a verified one. The badge is about there being some.
      v_pass := v_reviews > 0;
      v_why := 'this product has no published review yet';

    elsif v_b.key = 'instant_delivery' then
      v_pass := coalesce(btrim(v_p.demo_url),'') <> ''
                and exists (select 1 from pg_trigger where tgname = 'mm_order_paid_issue');
      v_why := case
        when coalesce(btrim(v_p.demo_url),'') = '' then 'the product has no live demo'
        else 'licence issuance on payment is not configured' end;

    elsif v_b.key = 'secure_purchase' then
      v_pass := v_payment
                and exists (select 1 from pg_trigger where tgname = 'mm_order_paid_issue');
      v_why := 'no payment has ever run through this environment, so the claim is not evidenced';
    end if;

    v_out := v_out || jsonb_build_object(
      'key', v_b.key, 'label', v_b.label, 'description', v_b.description,
      'icon', v_b.icon, 'priority', v_b.priority,
      'earned', v_pass,
      'reason', case when v_pass then null else v_why end);
  end loop;

  return jsonb_build_object('ok', true, 'product_id', p_product,
    'surface', p_surface,
    'badges', (select coalesce(jsonb_agg(b), '[]'::jsonb)
                 from jsonb_array_elements(v_out) b where (b->>'earned')::boolean),
    'all', v_out);
end;
$$;

create or replace function public.mm_trust_badges()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  return jsonb_build_object(
    'ok', true,
    'badges', coalesce((select jsonb_agg(to_jsonb(b) order by b.priority)
                          from public.trust_badges b), '[]'::jsonb),
    'audit', coalesce((select jsonb_agg(jsonb_build_object(
                          'badge', a.badge_key, 'action', a.action,
                          'at', a.created_at, 'reason', a.reason) order by a.created_at desc)
                         from (select * from public.trust_audit_logs
                                order by created_at desc limit 40) a), '[]'::jsonb),
    -- What each badge would look like on a real product right now, so an
    -- operator can see the rule working rather than trust the description.
    'sample', (select public.trust_evaluate(p.id, 'product_detail')
                 from public.marketplace_products p
                where p.visible order by p.updated_at desc limit 1));
end;
$$;

create or replace function public.mm_trust_badge_set(p_key text, p_patch jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_before jsonb; v_after jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  select to_jsonb(b) into v_before from public.trust_badges b where b.key = p_key;
  if v_before is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_badge');
  end if;

  update public.trust_badges set
    enabled = coalesce((p_patch->>'enabled')::boolean, enabled),
    label = coalesce(nullif(p_patch->>'label',''), label),
    description = coalesce(nullif(p_patch->>'description',''), description),
    priority = coalesce((p_patch->>'priority')::int, priority),
    display_locations = coalesce(
      (select array_agg(x)::text[] from jsonb_array_elements_text(p_patch->'display_locations') x),
      display_locations),
    updated_at = now()
  where key = p_key returning to_jsonb(trust_badges) into v_after;

  insert into public.trust_audit_logs (badge_key, action, actor_id, before_state, after_state, reason)
  values (p_key,
          case when (v_after->>'enabled')::boolean is distinct from (v_before->>'enabled')::boolean
               then (case when (v_after->>'enabled')::boolean then 'badge.enabled' else 'badge.disabled' end)
               else 'badge.rule_changed' end,
          auth.uid(), v_before, v_after, nullif(p_patch->>'reason',''));

  perform public.mm_audit('trust.badge_changed', 'trust_badge', p_key, v_before, v_after, null);
  return jsonb_build_object('ok', true, 'badge', v_after);
end;
$$;

/* ======================================================================= FAQ */

create or replace function public.mm_faqs(p_query jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_search text := nullif(btrim(coalesce(p_query->>'search','')),'');
  v_status text := nullif(p_query->>'status','');
  v_cat    text := nullif(p_query->>'category','');
  v_limit  integer := least(greatest(coalesce((p_query->>'limit')::int,200),1),500);
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  return jsonb_build_object(
    'ok', true,
    'total',        (select count(*) from public.faqs),
    'published',    (select count(*) from public.faqs where status='published'),
    'drafts',       (select count(*) from public.faqs where status='draft'),
    'pending',      (select count(*) from public.faqs where status='pending_review'),
    'scheduled',    (select count(*) from public.faqs where status='scheduled'),
    'archived',     (select count(*) from public.faqs where status='archived'),
    'ai_generated', (select count(*) from public.faqs where ai_generated),
    'categories',   (select count(*) from public.faq_categories where enabled),
    'recently_updated', (select count(*) from public.faqs
                          where updated_at > now() - interval '7 days'),
    'languages', coalesce((select jsonb_agg(distinct language) from public.faqs), '[]'::jsonb),

    'category_rows', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'slug', c.slug, 'name', c.name, 'position', c.position,
               'enabled', c.enabled,
               'faqs', (select count(*) from public.faqs f where f.category_id = c.id))
             order by c.position)
        from public.faq_categories c), '[]'::jsonb),

    'faqs', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', f.id, 'question', f.question, 'answer', f.answer,
               'category_id', f.category_id,
               'category', (select c.name from public.faq_categories c where c.id = f.category_id),
               'slug', f.slug, 'tags', f.tags, 'language', f.language,
               'status', f.status, 'ai_generated', f.ai_generated,
               'ai_sources', f.ai_sources,
               'seo_title', f.seo_title, 'seo_description', f.seo_description,
               'related_product_ids', f.related_product_ids,
               'scheduled_for', f.scheduled_for, 'published_at', f.published_at,
               'version', f.version, 'position', f.position,
               'updated_at', f.updated_at,
               'versions', (select count(*) from public.faq_versions v where v.faq_id = f.id))
             order by f.position, f.created_at)
        from (select * from public.faqs f2
               where (v_status is null or f2.status = v_status)
                 and (v_cat is null or f2.category_id = v_cat::uuid)
                 and (v_search is null
                      or f2.question ilike '%'||v_search||'%'
                      or f2.answer ilike '%'||v_search||'%'
                      or v_search = any(f2.tags))
               order by f2.position, f2.created_at limit v_limit) f), '[]'::jsonb));
end;
$$;

-- Create or update one FAQ, keeping the previous text as a version.
--
-- A version is written before the change, never after, so the history is what
-- the FAQ actually said rather than what it says now.
create or replace function public.mm_faq_save(p_patch jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid := nullif(p_patch->>'id','')::uuid; v_before record; v_after jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if coalesce(btrim(p_patch->>'question'),'') = '' then
    return jsonb_build_object('ok', false, 'reason', 'question_required');
  end if;
  if coalesce(btrim(p_patch->>'answer'),'') = '' then
    return jsonb_build_object('ok', false, 'reason', 'answer_required',
      'message', 'An FAQ without an answer cannot be saved. Source information required.');
  end if;

  if v_id is not null then
    select * into v_before from public.faqs where id = v_id;
    if not found then
      return jsonb_build_object('ok', false, 'reason', 'unknown_faq');
    end if;

    insert into public.faq_versions
      (faq_id, version, question, answer, status, change_summary, changed_by, snapshot)
    values (v_id, v_before.version, v_before.question, v_before.answer, v_before.status,
            nullif(p_patch->>'change_summary',''), auth.uid(), to_jsonb(v_before))
    on conflict (faq_id, version) do nothing;

    update public.faqs set
      question = btrim(p_patch->>'question'),
      answer = btrim(p_patch->>'answer'),
      category_id = coalesce(nullif(p_patch->>'category_id','')::uuid, category_id),
      tags = coalesce((select array_agg(x)::text[] from jsonb_array_elements_text(p_patch->'tags') x), tags),
      seo_title = coalesce(nullif(p_patch->>'seo_title',''), seo_title),
      seo_description = coalesce(nullif(p_patch->>'seo_description',''), seo_description),
      related_product_ids = coalesce(
        (select array_agg(x::uuid) from jsonb_array_elements_text(p_patch->'related_product_ids') x),
        related_product_ids),
      language = coalesce(nullif(p_patch->>'language',''), language),
      position = coalesce((p_patch->>'position')::int, position),
      version = version + 1,
      updated_at = now()
    where id = v_id returning to_jsonb(faqs) into v_after;

    perform public.mm_audit('faq.edited','faq', v_id::text,
                            to_jsonb(v_before), v_after, nullif(p_patch->>'change_summary',''));
  else
    insert into public.faqs
      (question, answer, category_id, tags, language, status, ai_generated, ai_sources,
       seo_title, seo_description, author_id, position)
    values (btrim(p_patch->>'question'), btrim(p_patch->>'answer'),
            nullif(p_patch->>'category_id','')::uuid,
            coalesce((select array_agg(x)::text[] from jsonb_array_elements_text(p_patch->'tags') x), '{}'),
            coalesce(nullif(p_patch->>'language',''),'en'),
            'draft',
            coalesce((p_patch->>'ai_generated')::boolean, false),
            coalesce(p_patch->'ai_sources','[]'::jsonb),
            nullif(p_patch->>'seo_title',''), nullif(p_patch->>'seo_description',''),
            auth.uid(),
            coalesce((p_patch->>'position')::int,
                     (select coalesce(max(position),0)+1 from public.faqs)))
    returning to_jsonb(faqs) into v_after;

    perform public.mm_audit('faq.created','faq', v_after->>'id', null, v_after, null);
  end if;

  return jsonb_build_object('ok', true, 'faq', v_after);
end;
$$;

create or replace function public.mm_faq_transition(
  p_id uuid, p_to text, p_when timestamptz default null, p_reason text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_before jsonb; v_after jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if p_to not in ('draft','pending_review','scheduled','published','archived') then
    return jsonb_build_object('ok', false, 'reason', 'unknown_status');
  end if;
  if p_to = 'scheduled' and p_when is null then
    return jsonb_build_object('ok', false, 'reason', 'schedule_time_required',
      'message', 'A scheduled FAQ needs a time, or it would never publish.');
  end if;

  select to_jsonb(f) into v_before from public.faqs f where f.id = p_id;
  if v_before is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_faq');
  end if;

  -- An AI draft stops being marked as AI-generated when a person publishes it:
  -- at that point a human has taken responsibility for what it says.
  update public.faqs set
    status = p_to,
    scheduled_for = case when p_to='scheduled' then p_when else scheduled_for end,
    published_at = case when p_to='published' then coalesce(published_at, now()) else published_at end,
    ai_generated = case when p_to='published' then false else ai_generated end,
    updated_at = now()
  where id = p_id returning to_jsonb(faqs) into v_after;

  perform public.mm_audit('faq.'||p_to, 'faq', p_id::text, v_before, v_after, p_reason);
  return jsonb_build_object('ok', true, 'faq', v_after);
end;
$$;

-- Roll an FAQ back to an earlier version. The current text becomes a version
-- first, so a rollback can itself be rolled back and nothing is destroyed.
create or replace function public.mm_faq_rollback(p_id uuid, p_version integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_v record; v_before record; v_after jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select * into v_v from public.faq_versions where faq_id = p_id and version = p_version;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_version');
  end if;
  select * into v_before from public.faqs where id = p_id;

  insert into public.faq_versions
    (faq_id, version, question, answer, status, change_summary, changed_by, snapshot)
  values (p_id, v_before.version, v_before.question, v_before.answer, v_before.status,
          format('replaced by a rollback to version %s', p_version), auth.uid(),
          to_jsonb(v_before))
  on conflict (faq_id, version) do nothing;

  update public.faqs
     set question = v_v.question, answer = v_v.answer,
         version = v_before.version + 1, updated_at = now()
   where id = p_id returning to_jsonb(faqs) into v_after;

  perform public.mm_audit('faq.rolled_back','faq', p_id::text,
                          to_jsonb(v_before), v_after,
                          format('rolled back to version %s', p_version));
  return jsonb_build_object('ok', true, 'faq', v_after);
end;
$$;

-- What the storefront reads. Published only, and it publishes anything whose
-- scheduled time has arrived, so a schedule works without a cron job.
create or replace function public.sf_faqs()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  update public.faqs
     set status='published', published_at = coalesce(published_at, now()), updated_at = now()
   where status='scheduled' and scheduled_for <= now();

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', f.id, 'question', f.question, 'answer', f.answer,
             'category', coalesce(c.name,'General'), 'slug', f.slug,
             'seo_title', f.seo_title, 'seo_description', f.seo_description)
           order by c.position, f.position)
      from public.faqs f
      left join public.faq_categories c on c.id = f.category_id
     where f.status='published' and f.language='en'), '[]'::jsonb);
end;
$$;
