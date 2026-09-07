-- AI Content Generator — review, publishing and the flows out of publishing.
--
-- One correction to an existing bug is included here, because publishing SEO
-- content depends on it. getPublicProduct asks seo_pages for a column named
-- schema_json, and seo_pages has no such column; PostgREST answers that select
-- with an error, the loader swallows it and returns null, so the product page
-- has never received anything from seo_pages at all. The column is added rather
-- than the select narrowed, because section 22 wants structured data
-- regenerated on publication and this is where it belongs.

alter table public.seo_pages add column if not exists schema_json jsonb;

/* ---------------------------------------------------------- 33. human edit */

-- An edit changes the working copy and nothing else. ai_original is never
-- touched, so the model's own words remain available for comparison for as long
-- as the item exists.
create or replace function public.mm_ai_item_edit(
  p_item uuid, p_content text default null, p_json jsonb default null, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare i record; v_version integer; v_validation jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_authorized');
  end if;
  select * into i from public.ai_content_items where id = p_item;
  if not found then return jsonb_build_object('ok', false, 'reason','item_not_found'); end if;
  if i.status in ('GENERATING','ARCHIVED') then
    return jsonb_build_object('ok', false, 'reason','not_editable', 'status', i.status);
  end if;
  if p_content is null and p_json is null then
    return jsonb_build_object('ok', false, 'reason','nothing_to_save');
  end if;

  v_version := i.current_version + 1;

  insert into public.ai_content_versions (
    item_id, version, kind, content, content_json,
    previous_content, previous_content_json, status_before, status_after,
    context_hash, actor, actor_role, note)
  values (p_item, v_version, 'HUMAN_EDIT', coalesce(p_content, i.content), coalesce(p_json, i.content_json),
          i.content, i.content_json, i.status, 'IN_REVIEW', i.context_hash, auth.uid(),
          (select ur.role::text from public.user_roles ur where ur.user_id = auth.uid() limit 1),
          coalesce(p_note, 'Edited by hand.'));

  update public.ai_content_items
     set content = coalesce(p_content, content),
         content_json = coalesce(p_json, content_json),
         human_edited = true,
         edited_by = auth.uid(),
         edited_at = now(),
         provenance = 'HUMAN_EDITED',
         current_version = v_version,
         -- An edit re-opens the question, so an approval given to the previous
         -- text does not carry over to this one.
         status = case when status = 'PUBLISHED' then 'PUBLISHED' else 'IN_REVIEW' end,
         approved_at = null, approved_by = null,
         validation_state = 'PENDING',
         -- The text changed, so a legal clearance given to the old text is
         -- withdrawn and the question is put again.
         legal_reviewed_at = null, legal_reviewed_by = null,
         rejection_code = null, rejection_reason = null
   where id = p_item;

  v_validation := public.mm_ai_validate(p_item);

  perform public.mm_audit('ai_content.edit', 'ai_content_item', p_item::text,
    jsonb_build_object('version', i.current_version, 'content', left(coalesce(i.content,''), 500)),
    jsonb_build_object('version', v_version, 'content', left(coalesce(p_content, i.content, ''), 500)),
    coalesce(p_note, 'Human edit'));

  return jsonb_build_object('ok', true, 'version', v_version, 'validation', v_validation);
end;
$$;

/* --------------------------------------------------- 16/54. review decisions */

create or replace function public.mm_ai_item_submit(p_item uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare i record; v_validation jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_authorized');
  end if;
  select * into i from public.ai_content_items where id = p_item;
  if not found then return jsonb_build_object('ok', false, 'reason','item_not_found'); end if;
  if i.status not in ('DRAFT','GENERATED','REJECTED') then
    return jsonb_build_object('ok', false, 'reason','not_submittable', 'status', i.status);
  end if;

  v_validation := public.mm_ai_validate(p_item);
  update public.ai_content_items set status = 'IN_REVIEW', submitted_at = now() where id = p_item;
  insert into public.ai_content_reviews (item_id, version, decision, reason, reviewer, reviewer_role)
  values (p_item, i.current_version, 'SUBMITTED', p_note, auth.uid(),
          (select ur.role::text from public.user_roles ur where ur.user_id = auth.uid() limit 1));

  perform public.mm_audit('ai_content.submit', 'ai_content_item', p_item::text,
    jsonb_build_object('status', i.status), jsonb_build_object('status','IN_REVIEW'), p_note);

  return jsonb_build_object('ok', true, 'status','IN_REVIEW', 'validation', v_validation);
end;
$$;

-- 16/19/20/50. Approval is the gate everything else depends on, so every
-- precondition is checked here rather than at the point of publication.
create or replace function public.mm_ai_item_approve(p_item uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare i record; s record; v_validation jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_authorized');
  end if;
  select * into s from public.ai_content_settings where id;
  if s.publish_policy = 'ROLE_BASED_APPROVAL' and not public.mm_ai_can_approve() then
    return jsonb_build_object('ok', false, 'reason','not_authorized',
      'detail','The policy is ROLE_BASED_APPROVAL and your role may generate and edit but not approve.');
  end if;

  select * into i from public.ai_content_items where id = p_item;
  if not found then return jsonb_build_object('ok', false, 'reason','item_not_found'); end if;
  if i.status not in ('IN_REVIEW','GENERATED') then
    return jsonb_build_object('ok', false, 'reason','not_approvable', 'status', i.status);
  end if;

  -- 30. Validation is re-run at the moment of approval, not trusted from
  -- whenever it last happened; the catalogue may have changed underneath.
  v_validation := public.mm_ai_validate(p_item);
  select * into i from public.ai_content_items where id = p_item;

  if i.validation_state <> 'PASSED' then
    return jsonb_build_object('ok', false, 'reason','validation_failed',
      'validation', i.validation, 'detail','Only valid content can be approved.');
  end if;
  -- 50. A legal block is absolute. No policy and no role gets past it; it has
  -- to be cleared by a legal decision first, which is its own recorded act.
  if i.legal_state = 'BLOCKED' then
    return jsonb_build_object('ok', false, 'reason','legal_blocked',
      'findings', i.legal_findings,
      'detail','The legal scan blocked this content. Clear it in the legal review before approving.');
  end if;
  if i.legal_state = 'REVIEW_REQUIRED' then
    return jsonb_build_object('ok', false, 'reason','legal_review_required',
      'findings', i.legal_findings,
      'detail','This content type requires a legal decision before approval.');
  end if;

  update public.ai_content_items
     set status = 'APPROVED', approved_at = now(), approved_by = auth.uid()
   where id = p_item;
  insert into public.ai_content_reviews (item_id, version, decision, reason, reviewer, reviewer_role)
  values (p_item, i.current_version, 'APPROVED', p_note, auth.uid(),
          (select ur.role::text from public.user_roles ur where ur.user_id = auth.uid() limit 1));

  perform public.mm_audit('ai_content.approve', 'ai_content_item', p_item::text,
    jsonb_build_object('status', i.status), jsonb_build_object('status','APPROVED'), p_note);

  return jsonb_build_object('ok', true, 'status','APPROVED', 'validation', v_validation);
end;
$$;

-- 34. A rejection keeps the content and the reason. Nothing is deleted.
create or replace function public.mm_ai_item_reject(
  p_item uuid, p_code text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare i record;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_authorized');
  end if;
  if p_code is null or p_code = '' then
    return jsonb_build_object('ok', false, 'reason','reason_required',
      'detail','A rejection must say why.');
  end if;
  select * into i from public.ai_content_items where id = p_item;
  if not found then return jsonb_build_object('ok', false, 'reason','item_not_found'); end if;
  if i.status in ('ARCHIVED','GENERATING') then
    return jsonb_build_object('ok', false, 'reason','not_rejectable', 'status', i.status);
  end if;

  insert into public.ai_content_versions (
    item_id, version, kind, content, content_json, previous_content, previous_content_json,
    status_before, status_after, context_hash, actor, actor_role, note)
  values (p_item, i.current_version + 1, 'REJECTED', i.content, i.content_json,
          i.content, i.content_json, i.status, 'REJECTED', i.context_hash, auth.uid(),
          (select ur.role::text from public.user_roles ur where ur.user_id = auth.uid() limit 1),
          coalesce(p_reason, p_code));

  update public.ai_content_items
     set status = 'REJECTED', rejection_code = p_code, rejection_reason = p_reason,
         current_version = i.current_version + 1,
         approved_at = null, approved_by = null
   where id = p_item;

  insert into public.ai_content_reviews (item_id, version, decision, reason_code, reason, reviewer, reviewer_role)
  values (p_item, i.current_version, 'REJECTED', p_code, p_reason, auth.uid(),
          (select ur.role::text from public.user_roles ur where ur.user_id = auth.uid() limit 1));

  perform public.mm_audit('ai_content.reject', 'ai_content_item', p_item::text,
    jsonb_build_object('status', i.status), jsonb_build_object('status','REJECTED','code',p_code), p_reason);

  return jsonb_build_object('ok', true, 'status','REJECTED');
end;
$$;

-- 20. The legal decision, kept separate from the editorial one because it is a
-- different question answered by a different person.
create or replace function public.mm_ai_legal_decide(
  p_item uuid, p_to text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare i record;
begin
  if not public.mm_ai_can_approve() then
    return jsonb_build_object('ok', false, 'reason','not_authorized',
      'detail','A legal decision requires an approving role.');
  end if;
  if p_to not in ('CLEARED','BLOCKED') then
    return jsonb_build_object('ok', false, 'reason','bad_decision');
  end if;
  select * into i from public.ai_content_items where id = p_item;
  if not found then return jsonb_build_object('ok', false, 'reason','item_not_found'); end if;

  update public.ai_content_items
     set legal_state = p_to,
         legal_reviewed_by = auth.uid(),
         legal_reviewed_at = now(),
         provenance = case when p_to = 'CLEARED' and provenance <> 'PUBLISHED'
                           then 'LEGAL_APPROVED' else provenance end
   where id = p_item;

  insert into public.ai_content_reviews (item_id, version, decision, reason_code, reason, reviewer, reviewer_role)
  values (p_item, i.current_version,
          case when p_to = 'CLEARED' then 'LEGAL_CLEARED' else 'LEGAL_BLOCKED' end,
          'legal_concern', p_reason, auth.uid(),
          (select ur.role::text from public.user_roles ur where ur.user_id = auth.uid() limit 1));

  -- A block on content that is already live takes it down; leaving it up while
  -- recording that it is blocked would be the worst of both.
  if p_to = 'BLOCKED' and i.status = 'PUBLISHED' then
    perform public.mm_ai_item_unpublish(p_item, coalesce(p_reason, 'Blocked by legal review.'));
  end if;

  perform public.mm_audit('ai_content.legal_decision', 'ai_content_item', p_item::text,
    jsonb_build_object('legal_state', i.legal_state), jsonb_build_object('legal_state', p_to), p_reason);

  return jsonb_build_object('ok', true, 'legal_state', p_to);
end;
$$;

/* ------------------------------------------ 8/16/22/44/55. publish */

create or replace function public.mm_ai_item_publish(p_item uuid, p_auto boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i record;
  s record;
  p record;
  v_targets jsonb := '{}'::jsonb;
  v_written integer := 0;
  v_failed integer := 0;
  v_state text;
  v_url text;
  v_country text[];
  v_generated text[];
  v_keywords text[];
  v_slug text;
  v_faq jsonb;
  v_faq_count integer := 0;
  v_existing text;
  v_seo_desc text;
  v_detail text;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_authorized');
  end if;

  select * into s from public.ai_content_settings where id;
  select * into i from public.ai_content_items where id = p_item;
  if not found then return jsonb_build_object('ok', false, 'reason','item_not_found'); end if;

  if i.status <> 'APPROVED' then
    return jsonb_build_object('ok', false, 'reason','not_approved', 'status', i.status,
      'detail','Content must be approved before it can be published.');
  end if;
  -- 50. Restated at the point of publication, because this is the act that
  -- makes content public and it must not depend on an earlier check.
  if i.legal_state = 'BLOCKED' then
    return jsonb_build_object('ok', false, 'reason','legal_blocked',
      'detail','Blocked content cannot be published.');
  end if;
  if i.validation_state <> 'PASSED' then
    return jsonb_build_object('ok', false, 'reason','validation_failed', 'validation', i.validation);
  end if;

  select * into p from public.marketplace_products where id = i.product_id;
  if p.deleted_at is not null then
    return jsonb_build_object('ok', false, 'reason','product_deleted',
      'detail','A deleted product does not get published content.');
  end if;

  v_url := '/marketplace/product/' || p.slug;

  -- Each target is attempted on its own and reports its own outcome, so a
  -- failure in one does not silently take the others down with it.

  if i.content_type = 'short_description' then
    begin
      v_existing := coalesce(p.description, '');
      if v_existing <> '' and not s.overwrite_existing_product_copy then
        v_targets := v_targets || jsonb_build_object('marketplace_products.description',
          jsonb_build_object('state','skipped',
            'detail','The product already has a description and overwriting is switched off.'));
      else
        update public.marketplace_products set description = i.content, updated_at = now()
         where id = p.id;
        v_written := v_written + 1;
        v_targets := v_targets || jsonb_build_object('marketplace_products.description',
          jsonb_build_object('state','written', 'detail','Used by the product page head and the sitemap.'));
      end if;
    exception when others then
      v_failed := v_failed + 1;
      v_targets := v_targets || jsonb_build_object('marketplace_products.description',
        jsonb_build_object('state','failed','detail', left(sqlerrm, 300)));
    end;
  end if;

  if i.content_type = 'seo_description' then
    -- 8/22. The SEO Manager owns the metadata; this writes the description into
    -- its record and regenerates the structured data alongside it, rather than
    -- keeping a second copy anywhere.
    begin
      v_seo_desc := left(i.content, 320);
      insert into public.seo_pages (url, product_id, title, meta_title, meta_description,
                                    canonical_url, page_type, index_status, schema_json, updated_at)
      values (v_url, p.id, p.name, p.name || ' | Software Vala', v_seo_desc,
              'https://softwarevala.net' || v_url, 'product', 'indexable',
              jsonb_build_object(
                '@context','https://schema.org', '@type','SoftwareApplication',
                'name', p.name, 'applicationCategory','BusinessApplication',
                'operatingSystem', coalesce(nullif(p.deployment,''),'Web'),
                'description', v_seo_desc,
                'url', 'https://softwarevala.net' || v_url,
                'brand', jsonb_build_object('@type','Brand','name','Software Vala')),
              now())
      on conflict (url) do update set
        product_id = excluded.product_id,
        meta_description = excluded.meta_description,
        meta_title = coalesce(nullif(public.seo_pages.meta_title,''), excluded.meta_title),
        canonical_url = coalesce(nullif(public.seo_pages.canonical_url,''), excluded.canonical_url),
        schema_json = excluded.schema_json,
        page_type = 'product',
        updated_at = now();
      v_written := v_written + 1;
      v_targets := v_targets || jsonb_build_object('seo_pages',
        jsonb_build_object('state','written','url', v_url,
          'detail','Meta description and SoftwareApplication structured data regenerated.'));
    exception when others then
      v_failed := v_failed + 1;
      v_targets := v_targets || jsonb_build_object('seo_pages',
        jsonb_build_object('state','failed','detail', left(sqlerrm, 300)));
    end;
  end if;

  if i.content_type = 'meta_keywords' then
    begin
      -- 9. The country markers are routing data the SEO work depends on and are
      -- carried through untouched; only the descriptive keywords are replaced.
      select array_agg(k) into v_country
        from unnest(coalesce(p.search_keywords, '{}')) k where k like 'country:%';
      select array_agg(distinct btrim(x)) into v_generated
        from jsonb_array_elements_text(i.content_json) x
       where btrim(x) <> '' and length(btrim(x)) <= 120;

      -- Generated keywords are added to what the product already ranks for,
      -- never swapped in for it. Replacing the list cost the test product 45 of
      -- its 51 existing keywords, which is exactly the silent overwrite that
      -- section 31 forbids. Only an explicit overwrite setting replaces them.
      select array_agg(distinct k) into v_keywords from (
        select unnest(coalesce(v_country, '{}'::text[])) as k
        union
        select unnest(coalesce(v_generated, '{}'::text[]))
        union
        select unnest(case when s.overwrite_existing_product_copy then '{}'::text[]
                           else coalesce(p.search_keywords, '{}'::text[]) end)) u
       where btrim(k) <> '';

      update public.marketplace_products
         set search_keywords = coalesce(v_keywords, '{}'), updated_at = now()
       where id = p.id;
      v_written := v_written + 1;
      v_targets := v_targets || jsonb_build_object('marketplace_products.search_keywords',
        jsonb_build_object('state','written',
          'kept_existing', coalesce(array_length(p.search_keywords, 1), 0),
          'added', coalesce(array_length(v_generated, 1), 0),
          'total_now', coalesce(array_length(v_keywords, 1), 0),
          'detail','Merged into the product keywords, which the page renders as its keywords meta tag.'));
    exception when others then
      v_failed := v_failed + 1;
      v_targets := v_targets || jsonb_build_object('marketplace_products.search_keywords',
        jsonb_build_object('state','failed','detail', left(sqlerrm, 300)));
    end;
  end if;

  if i.content_type = 'faq' then
    -- 10/21. The FAQ Manager's own table, so a published FAQ is managed there
    -- from then on like any other and is not a private copy.
    begin
      for v_faq in select * from jsonb_array_elements(i.content_json) loop
        v_slug := left(regexp_replace(lower(coalesce(v_faq ->> 'question','')),
                                      '[^a-z0-9]+', '-', 'g'), 90);
        v_slug := btrim(v_slug, '-');
        if v_slug = '' then continue; end if;
        v_slug := p.slug || '-' || v_slug;

        insert into public.faqs (question, answer, slug, language, related_product_ids,
                                 status, ai_generated, ai_sources, published_at, author_id, keywords)
        values (btrim(v_faq ->> 'question'), btrim(v_faq ->> 'answer'), v_slug, i.language,
                array[p.id], 'published', true,
                jsonb_build_array(jsonb_build_object(
                  'source','ai_content_generator', 'item', p_item, 'product', p.id,
                  'context_hash', i.context_hash)),
                now(), auth.uid(), '{}')
        on conflict (slug) do update set
          question = excluded.question, answer = excluded.answer,
          related_product_ids = excluded.related_product_ids,
          status = 'published', published_at = now(), updated_at = now();
        v_faq_count := v_faq_count + 1;
      end loop;
      v_written := v_written + 1;
      v_targets := v_targets || jsonb_build_object('faqs',
        jsonb_build_object('state','written','entries', v_faq_count,
          'detail','Published into the FAQ Manager against this product.'));
    exception when others then
      v_failed := v_failed + 1;
      v_targets := v_targets || jsonb_build_object('faqs',
        jsonb_build_object('state','failed','detail', left(sqlerrm, 300)));
    end;
  end if;

  if i.content_type in ('summary','long_description','features','benefits','use_cases') then
    -- No other store holds these, so the published row is the store, and the
    -- product page reads it directly.
    v_written := v_written + 1;
    v_targets := v_targets || jsonb_build_object('ai_content_items',
      jsonb_build_object('state','written',
        'detail','Served to the product page from this module''s published row.'));
  end if;

  -- 22. Publishing anything that changes what a search engine sees invalidates
  -- the page's SEO record, so it is stamped rather than left looking fresh.
  if i.content_type in ('short_description','seo_description','meta_keywords') then
    begin
      update public.seo_pages set updated_at = now(), last_crawled_at = null
       where product_id = p.id;
      -- seo_activity_log constrains action to INSERT/UPDATE/DELETE, so what
      -- happened is carried in the context rather than bent into the action.
      insert into public.seo_activity_log (table_name, record_id, action, actor, context)
      values ('seo_pages', p_item, 'UPDATE',
              coalesce((select u.email from auth.users u where u.id = auth.uid()), 'system'),
              jsonb_build_object('event','seo_invalidated_by_content_publish',
                                 'product', p.id, 'url', v_url, 'content_type', i.content_type));
      v_targets := v_targets || jsonb_build_object('seo_invalidation',
        jsonb_build_object('state','written',
          'detail','SEO record marked for recrawl. sitemap-products reads the product row directly, so the sitemap is current without a rebuild.'));
    exception when others then
      -- Failing to log the invalidation must not undo a correct publication.
      v_targets := v_targets || jsonb_build_object('seo_invalidation',
        jsonb_build_object('state','failed','detail', left(sqlerrm, 300)));
    end;
  end if;

  -- A publication that wrote nothing because policy told it not to is not a
  -- failure and must not be reported as one. It is not a success either, so it
  -- keeps its own name, and the content stays approved and retryable.
  v_state := case when v_failed = 0 and v_written > 0 then 'COMPLETE'
                  when v_written > 0 then 'PARTIAL'
                  when v_failed = 0 then 'SKIPPED'
                  else 'FAILED' end;

  insert into public.ai_content_versions (
    item_id, version, kind, content, content_json, previous_content, previous_content_json,
    status_before, status_after, context_hash, actor, actor_role, note)
  values (p_item, i.current_version + 1, 'PUBLISHED', i.content, i.content_json,
          i.content, i.content_json, i.status,
          case when v_state in ('FAILED','SKIPPED') then 'APPROVED' else 'PUBLISHED' end,
          i.context_hash, auth.uid(),
          (select ur.role::text from public.user_roles ur where ur.user_id = auth.uid() limit 1),
          case when p_auto then 'Published automatically under the AUTO_PUBLISH policy.'
               else 'Published.' end);

  update public.ai_content_items
     set status = case when v_state in ('FAILED','SKIPPED') then 'APPROVED' else 'PUBLISHED' end,
         provenance = case when v_state in ('FAILED','SKIPPED') then provenance else 'PUBLISHED' end,
         published_at = case when v_state in ('FAILED','SKIPPED') then null else now() end,
         published_by = case when v_state in ('FAILED','SKIPPED') then null else auth.uid() end,
         current_version = i.current_version + 1,
         publish_targets = v_targets,
         publish_state = v_state
   where id = p_item;

  insert into public.ai_content_reviews (item_id, version, decision, reason, reviewer, reviewer_role)
  values (p_item, i.current_version + 1, 'PUBLISHED',
          case when v_state = 'COMPLETE' then 'Published to every target.'
               when v_state = 'PARTIAL' then 'Published, but at least one target failed. Retry is available.'
               when v_state = 'SKIPPED' then 'Nothing was written: the target already holds copy and overwriting is switched off.'
               else 'Publication failed. The content stays approved and can be retried.' end,
          auth.uid(),
          (select ur.role::text from public.user_roles ur where ur.user_id = auth.uid() limit 1));

  perform public.mm_audit('ai_content.publish', 'ai_content_item', p_item::text,
    jsonb_build_object('status', i.status),
    jsonb_build_object('publish_state', v_state, 'targets', v_targets),
    case when p_auto then 'Auto-published' else 'Published' end);

  -- 43/55. A partial or failed publication never reports success.
  return jsonb_build_object(
    'ok', v_state in ('COMPLETE','PARTIAL'),
    'publish_state', v_state,
    'status', case when v_state in ('FAILED','SKIPPED') then 'APPROVED' else 'PUBLISHED' end,
    'targets', v_targets,
    'detail', case when v_state = 'SKIPPED'
                   then 'Nothing was written. The target already holds copy and "overwrite existing product copy" is off.'
                   else null end,
    'retryable', v_state in ('PARTIAL','FAILED','SKIPPED'));
end;
$$;

/* ------------------------------------------------------ 43/46. take it down */

create or replace function public.mm_ai_item_unpublish(p_item uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare i record;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_authorized');
  end if;
  select * into i from public.ai_content_items where id = p_item;
  if not found then return jsonb_build_object('ok', false, 'reason','item_not_found'); end if;
  if i.status <> 'PUBLISHED' then
    return jsonb_build_object('ok', false, 'reason','not_published','status', i.status);
  end if;

  -- 10/46. An FAQ published from here is archived rather than deleted, so the
  -- FAQ Manager keeps its history and no orphan stays live on the site.
  if i.content_type = 'faq' then
    update public.faqs set status = 'archived', updated_at = now()
     where status = 'published'
       and ai_generated
       and ai_sources @> jsonb_build_array(jsonb_build_object('item', p_item));
  end if;

  insert into public.ai_content_versions (
    item_id, version, kind, content, content_json, previous_content, previous_content_json,
    status_before, status_after, context_hash, actor, note)
  values (p_item, i.current_version + 1, 'UNPUBLISHED', i.content, i.content_json,
          i.content, i.content_json, 'PUBLISHED', 'APPROVED', i.context_hash, auth.uid(),
          coalesce(p_reason, 'Unpublished.'));

  update public.ai_content_items
     set status = 'APPROVED', published_at = null, published_by = null,
         publish_state = 'NONE', provenance = 'LEGAL_APPROVED',
         current_version = i.current_version + 1
   where id = p_item;

  insert into public.ai_content_reviews (item_id, version, decision, reason, reviewer)
  values (p_item, i.current_version + 1, 'UNPUBLISHED', p_reason, auth.uid());

  perform public.mm_audit('ai_content.unpublish', 'ai_content_item', p_item::text,
    jsonb_build_object('status','PUBLISHED'), jsonb_build_object('status','APPROVED'), p_reason);

  return jsonb_build_object('ok', true, 'status','APPROVED');
end;
$$;

create or replace function public.mm_ai_item_archive(p_item uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare i record;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_authorized');
  end if;
  select * into i from public.ai_content_items where id = p_item;
  if not found then return jsonb_build_object('ok', false, 'reason','item_not_found'); end if;
  if i.status = 'PUBLISHED' then
    perform public.mm_ai_item_unpublish(p_item, coalesce(p_reason, 'Archived.'));
    select * into i from public.ai_content_items where id = p_item;
  end if;

  insert into public.ai_content_versions (
    item_id, version, kind, content, content_json, previous_content, previous_content_json,
    status_before, status_after, actor, note)
  values (p_item, i.current_version + 1, 'ARCHIVED', i.content, i.content_json,
          i.content, i.content_json, i.status, 'ARCHIVED', auth.uid(),
          coalesce(p_reason, 'Archived.'));

  update public.ai_content_items
     set status = 'ARCHIVED', archived_at = now(), current_version = i.current_version + 1
   where id = p_item;

  perform public.mm_audit('ai_content.archive', 'ai_content_item', p_item::text,
    jsonb_build_object('status', i.status), jsonb_build_object('status','ARCHIVED'), p_reason);

  return jsonb_build_object('ok', true, 'status','ARCHIVED');
end;
$$;

/* --------------------------------------------------------- 32. rollback */

create or replace function public.mm_ai_version_rollback(p_item uuid, p_version integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare i record; v record;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_authorized');
  end if;
  select * into i from public.ai_content_items where id = p_item;
  if not found then return jsonb_build_object('ok', false, 'reason','item_not_found'); end if;
  select * into v from public.ai_content_versions where item_id = p_item and version = p_version;
  if not found then return jsonb_build_object('ok', false, 'reason','version_not_found'); end if;

  -- A rollback is itself a new version. The trail only ever grows.
  insert into public.ai_content_versions (
    item_id, version, kind, content, content_json, previous_content, previous_content_json,
    status_before, status_after, context_hash, actor, note)
  values (p_item, i.current_version + 1, 'ROLLBACK', v.content, v.content_json,
          i.content, i.content_json, i.status, 'IN_REVIEW', v.context_hash, auth.uid(),
          format('Restored version %s.', p_version));

  update public.ai_content_items
     set content = v.content, content_json = v.content_json,
         current_version = i.current_version + 1,
         status = case when status = 'PUBLISHED' then 'PUBLISHED' else 'IN_REVIEW' end,
         approved_at = null, approved_by = null, validation_state = 'PENDING',
         legal_reviewed_at = null, legal_reviewed_by = null
   where id = p_item;

  perform public.mm_ai_validate(p_item);
  perform public.mm_audit('ai_content.rollback', 'ai_content_item', p_item::text,
    jsonb_build_object('version', i.current_version), jsonb_build_object('restored', p_version),
    format('Rolled back to version %s', p_version));

  return jsonb_build_object('ok', true, 'restored_from', p_version, 'version', i.current_version + 1);
end;
$$;

/* -------------------------------------------------- 45/46. product lifecycle */

-- When the facts a piece of content was written from change, the content is
-- marked stale and says so in the console. It is not silently regenerated and
-- it is not silently left alone either.
create or replace function public.ai_content_mark_stale()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_hash text;
begin
  -- 46. A deleted or archived product takes its content down with it, so
  -- nothing published is left pointing at a product that no longer exists.
  if new.deleted_at is not null and old.deleted_at is null then
    update public.ai_content_items
       set status = 'ARCHIVED', archived_at = now(),
           published_at = null, publish_state = 'NONE',
           stale = true, stale_reason = 'The product was deleted.', stale_since = now()
     where product_id = new.id and status <> 'ARCHIVED';
    update public.faqs set status = 'archived', updated_at = now()
     where ai_generated and status = 'published' and related_product_ids @> array[new.id];
    return new;
  end if;

  if new.visible = false and old.visible = true then
    -- Row-level security already hides published content for an invisible
    -- product; the flag is set so the console can explain why.
    update public.ai_content_items
       set stale = true, stale_reason = 'The product was hidden from the marketplace.',
           stale_since = now()
     where product_id = new.id and status = 'PUBLISHED' and not stale;
    return new;
  end if;

  v_hash := public.mm_ai_context_hash(new.id);
  update public.ai_content_items
     set stale = true,
         stale_reason = 'The product record changed after this content was written.',
         stale_since = now()
   where product_id = new.id
     and context_hash is not null
     and context_hash <> v_hash
     and status in ('GENERATED','IN_REVIEW','APPROVED','PUBLISHED')
     and not stale;
  return new;
end;
$$;

drop trigger if exists ai_content_product_changed on public.marketplace_products;
create trigger ai_content_product_changed
  after update on public.marketplace_products
  for each row execute function public.ai_content_mark_stale();

/* ------------------------------------------------- the storefront's read */

-- What the product page is allowed to show. Published rows only, for a visible
-- product only, and every block carries what it is so the page can label AI
-- content as AI content rather than implying it was verified.
create or replace function public.mm_product_content(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(i.content_type, jsonb_build_object(
           'content', i.content,
           'items', i.content_json,
           'provenance', i.provenance,
           'human_edited', i.human_edited,
           'published_at', i.published_at)), '{}'::jsonb)
    from public.ai_content_items i
    join public.marketplace_products p on p.id = i.product_id
   where p.slug = p_slug
     and p.visible
     and p.deleted_at is null
     and i.status = 'PUBLISHED'
     and i.language = 'en';
$$;

grant execute on function public.mm_product_content(text) to anon, authenticated, service_role;
