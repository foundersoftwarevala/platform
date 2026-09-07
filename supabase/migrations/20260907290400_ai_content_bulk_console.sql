-- AI Content Generator — bulk generation, settings and the console read model.
--
-- Bulk work is queued in the database and drawn down a batch at a time by the
-- server. Section 28 rules out firing thousands of requests from a browser, and
-- the catalogue is large enough that it matters: 5,533 products, of which 2,705
-- have no description at all. A job therefore records every product it intends
-- to touch before it starts, so it can be paused, resumed, retried and counted
-- honestly, and a product that already succeeded is never generated twice.

/* ----------------------------------------------------- 28. build a bulk job */

create or replace function public.mm_ai_bulk_create(
  p_scope text,
  p_types text[],
  p_filters jsonb default '{}'::jsonb,
  p_language text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  v_job uuid;
  v_lang text;
  v_types text[] := '{}';
  v_type text;
  v_total integer;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_authorized');
  end if;
  select * into s from public.ai_content_settings where id;
  v_lang := coalesce(p_language, s.default_language);

  foreach v_type in array coalesce(p_types, array[]::text[]) loop
    if coalesce((s.blocks ->> v_type)::boolean, false) then v_types := v_types || v_type; end if;
  end loop;
  if array_length(v_types, 1) is null then
    return jsonb_build_object('ok', false, 'reason','no_enabled_blocks');
  end if;

  insert into public.ai_content_jobs (scope, filters, content_types, language, created_by)
  values (p_scope, coalesce(p_filters,'{}'::jsonb), v_types, v_lang, auth.uid())
  returning id into v_job;

  -- The product set, resolved once and written down. Every scope excludes
  -- deleted and hidden products: there is no point writing copy for a page
  -- nobody can reach.
  insert into public.ai_content_job_items (job_id, product_id)
  select v_job, p.id
    from public.marketplace_products p
   where p.deleted_at is null
     and p.visible
     and case p_scope
           when 'selected' then p.id = any (
             coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(p_filters -> 'ids') x),
                      array[]::uuid[]))
           when 'category' then p.category_id = nullif(p_filters ->> 'category_id','')::uuid
           when 'missing_description' then coalesce(p.description,'') = ''
           when 'missing_seo' then not exists (
             select 1 from public.seo_pages sp
              where sp.product_id = p.id and coalesce(sp.meta_description,'') <> '')
           when 'rejected_content' then exists (
             select 1 from public.ai_content_items i
              where i.product_id = p.id and i.status = 'REJECTED')
           when 'stale' then exists (
             select 1 from public.ai_content_items i
              where i.product_id = p.id and i.stale)
           when 'all_eligible' then p.moderation_status = 'approved'
           else false
         end
     -- 29. A product whose requested blocks are all already published is not
     -- queued at all, rather than queued and then skipped.
     and not (
       select bool_and(exists (
         select 1 from public.ai_content_items i
          where i.product_id = p.id and i.content_type = t and i.language = v_lang
            and i.status = 'PUBLISHED' and not i.stale))
         from unnest(v_types) t)
  on conflict (job_id, product_id) do nothing;

  select count(*) into v_total from public.ai_content_job_items where job_id = v_job;
  update public.ai_content_jobs set total = v_total,
         status = case when v_total = 0 then 'COMPLETED' else 'QUEUED' end,
         finished_at = case when v_total = 0 then now() else null end
   where id = v_job;

  perform public.mm_audit('ai_content.bulk.create', 'ai_content_job', v_job::text, null,
    jsonb_build_object('scope', p_scope, 'types', to_jsonb(v_types), 'total', v_total,
                       'language', v_lang),
    format('Bulk generation queued for %s products', v_total));

  return jsonb_build_object('ok', true, 'job_id', v_job, 'total', v_total,
    'types', to_jsonb(v_types), 'language', v_lang,
    'batch_size', s.bulk_batch_size,
    'detail', case when v_total = 0
                   then 'Nothing matched, or every match already has this content published.'
                   else null end);
end;
$$;

-- 28/48. One batch. The server calls this, generates for what it gets back, and
-- calls again; nothing holds a transaction open across an AI request.
create or replace function public.mm_ai_bulk_claim(p_job uuid, p_limit integer default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare s record; j record; v_rows jsonb; v_limit integer;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_authorized');
  end if;
  select * into s from public.ai_content_settings where id;
  select * into j from public.ai_content_jobs where id = p_job;
  if not found then return jsonb_build_object('ok', false, 'reason','job_not_found'); end if;
  if j.status in ('CANCELLED','COMPLETED') then
    return jsonb_build_object('ok', true, 'done', true, 'status', j.status, 'products', '[]'::jsonb);
  end if;

  v_limit := least(coalesce(p_limit, s.bulk_batch_size), 100);

  update public.ai_content_jobs
     set status = 'PROCESSING', started_at = coalesce(started_at, now())
   where id = p_job;

  with picked as (
    select ji.id from public.ai_content_job_items ji
     where ji.job_id = p_job and ji.status = 'QUEUED'
     order by ji.id
     limit v_limit
     -- Two workers on the same job never take the same product.
     for update skip locked)
  update public.ai_content_job_items ji
     set status = 'PROCESSING', attempts = ji.attempts + 1, updated_at = now()
    from picked
   where ji.id = picked.id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'product_id', ji.product_id, 'product', p.name, 'slug', p.slug,
           'attempts', ji.attempts)), '[]'::jsonb)
    into v_rows
    from public.ai_content_job_items ji
    join public.marketplace_products p on p.id = ji.product_id
   where ji.job_id = p_job and ji.status = 'PROCESSING';

  return jsonb_build_object('ok', true, 'job_id', p_job,
    'types', to_jsonb(j.content_types), 'language', j.language,
    'products', v_rows,
    'done', jsonb_array_length(v_rows) = 0,
    'remaining', (select count(*) from public.ai_content_job_items
                   where job_id = p_job and status in ('QUEUED','PROCESSING')));
end;
$$;

create or replace function public.mm_ai_bulk_mark(
  p_job uuid, p_product uuid, p_status text,
  p_generation uuid default null, p_error text default null, p_skip_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare j record;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_authorized');
  end if;
  if p_status not in ('COMPLETED','FAILED','SKIPPED','NEEDS_REVIEW') then
    return jsonb_build_object('ok', false, 'reason','bad_status');
  end if;

  update public.ai_content_job_items
     set status = p_status, generation_id = p_generation,
         error = left(p_error, 1000), skip_reason = p_skip_reason, updated_at = now()
   where job_id = p_job and product_id = p_product;

  -- The counters are recomputed from the items rather than incremented, so a
  -- retry or a double call cannot drift them away from the truth.
  -- The alias is deliberately not j: a plpgsql record of that name is in scope
  -- and would shadow the table inside the SET clause.
  update public.ai_content_jobs t set
    completed = c.completed, failed = c.failed, skipped = c.skipped, needs_review = c.needs_review,
    last_error = coalesce(left(p_error, 500), t.last_error),
    status = case when c.pending = 0 then
                    case when c.completed + c.needs_review = 0 then 'FAILED' else 'COMPLETED' end
                  else 'PROCESSING' end,
    finished_at = case when c.pending = 0 then now() else null end
  from (
    select count(*) filter (where status = 'COMPLETED') completed,
           count(*) filter (where status = 'FAILED') failed,
           count(*) filter (where status = 'SKIPPED') skipped,
           count(*) filter (where status = 'NEEDS_REVIEW') needs_review,
           count(*) filter (where status in ('QUEUED','PROCESSING')) pending
      from public.ai_content_job_items where job_id = p_job) c
  where t.id = p_job;

  select * into j from public.ai_content_jobs where id = p_job;
  return jsonb_build_object('ok', true, 'status', j.status, 'completed', j.completed,
    'failed', j.failed, 'skipped', j.skipped, 'needs_review', j.needs_review,
    'remaining', j.total - (j.completed + j.failed + j.skipped + j.needs_review));
end;
$$;

-- 29. Retry puts only the failures back. A product that succeeded is left alone.
create or replace function public.mm_ai_bulk_retry(p_job uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_authorized');
  end if;
  update public.ai_content_job_items
     set status = 'QUEUED', error = null, updated_at = now()
   where job_id = p_job and status = 'FAILED';
  get diagnostics v_count = row_count;

  update public.ai_content_jobs
     set status = case when v_count > 0 then 'QUEUED' else status end,
         finished_at = case when v_count > 0 then null else finished_at end,
         failed = greatest(failed - v_count, 0)
   where id = p_job;

  perform public.mm_audit('ai_content.bulk.retry', 'ai_content_job', p_job::text, null,
    jsonb_build_object('requeued', v_count), 'Failed items requeued');

  return jsonb_build_object('ok', true, 'requeued', v_count);
end;
$$;

create or replace function public.mm_ai_bulk_cancel(p_job uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_authorized');
  end if;
  update public.ai_content_job_items set status = 'SKIPPED',
         skip_reason = coalesce(p_reason,'The job was cancelled.'), updated_at = now()
   where job_id = p_job and status in ('QUEUED','PROCESSING');
  update public.ai_content_jobs set status = 'CANCELLED', finished_at = now(),
         last_error = p_reason where id = p_job;
  perform public.mm_audit('ai_content.bulk.cancel', 'ai_content_job', p_job::text, null, null, p_reason);
  return jsonb_build_object('ok', true);
end;
$$;

/* -------------------------------------------------------- 4/19/35. settings */

create or replace function public.mm_ai_settings_set(p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare before record; after record; v_provider record;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_authorized');
  end if;
  select * into before from public.ai_content_settings where id;

  -- 19/50. Only an approving role may loosen the governance policy. Anyone who
  -- may run the module can tighten it.
  if p_patch ? 'publish_policy'
     and (p_patch ->> 'publish_policy') = 'AUTO_PUBLISH'
     and not public.mm_ai_can_approve() then
    return jsonb_build_object('ok', false, 'reason','not_authorized',
      'detail','Switching to AUTO_PUBLISH requires an approving role.');
  end if;

  if p_patch ? 'provider_slug' then
    select * into v_provider from public.ai_providers where slug = p_patch ->> 'provider_slug';
    if not found then
      return jsonb_build_object('ok', false, 'reason','provider_not_registered',
        'detail','Add the provider in the AI API Manager first.',
        'available', (select jsonb_agg(slug order by slug) from public.ai_providers
                       where content_generation_enabled));
    end if;
    if not v_provider.content_generation_enabled then
      return jsonb_build_object('ok', false, 'reason','provider_not_enabled',
        'detail', format('%s is registered but is not enabled for content generation.', v_provider.name));
    end if;
  end if;

  update public.ai_content_settings set
    blocks = coalesce(p_patch -> 'blocks', blocks),
    limits = coalesce(p_patch -> 'limits', limits),
    publish_policy = coalesce(p_patch ->> 'publish_policy', publish_policy),
    legal_review_types = coalesce(
      (select array_agg(x) from jsonb_array_elements_text(p_patch -> 'legal_review_types') x),
      legal_review_types),
    brand_voice = coalesce(p_patch -> 'brand_voice', brand_voice),
    default_language = coalesce(p_patch ->> 'default_language', default_language),
    allowed_languages = coalesce(
      (select array_agg(x) from jsonb_array_elements_text(p_patch -> 'allowed_languages') x),
      allowed_languages),
    provider_slug = coalesce(p_patch ->> 'provider_slug', provider_slug),
    model_id = coalesce(p_patch ->> 'model_id', model_id),
    temperature = coalesce((p_patch ->> 'temperature')::numeric, temperature),
    max_output_tokens = coalesce((p_patch ->> 'max_output_tokens')::int, max_output_tokens),
    request_timeout_ms = coalesce((p_patch ->> 'request_timeout_ms')::int, request_timeout_ms),
    daily_request_cap = coalesce((p_patch ->> 'daily_request_cap')::int, daily_request_cap),
    bulk_batch_size = coalesce((p_patch ->> 'bulk_batch_size')::int, bulk_batch_size),
    duplicate_threshold = coalesce((p_patch ->> 'duplicate_threshold')::numeric, duplicate_threshold),
    high_similarity_threshold = coalesce((p_patch ->> 'high_similarity_threshold')::numeric, high_similarity_threshold),
    overwrite_existing_product_copy = coalesce((p_patch ->> 'overwrite_existing_product_copy')::boolean,
                                               overwrite_existing_product_copy),
    updated_by = auth.uid()
  where id;

  select * into after from public.ai_content_settings where id;
  perform public.mm_audit('ai_content.settings', 'ai_content_settings', 'singleton',
    to_jsonb(before), to_jsonb(after), p_patch ->> 'reason');

  return jsonb_build_object('ok', true, 'settings', to_jsonb(after));
end;
$$;

/* ---------------------------------------- 14/17/18/27/29/47/48. the console */

create or replace function public.mm_ai_content_console(p_query jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s record;
  v_limit integer := least(greatest(coalesce((p_query ->> 'limit')::int, 25), 1), 200);
  v_offset integer := greatest(coalesce((p_query ->> 'offset')::int, 0), 0);
  v_search text := nullif(btrim(coalesce(p_query ->> 'search','')), '');
  v_product uuid := nullif(p_query ->> 'product_id','')::uuid;
  v_type text := nullif(p_query ->> 'content_type','');
  v_status text := nullif(p_query ->> 'status','');
  v_lang text := nullif(p_query ->> 'language','');
  v_legal text := nullif(p_query ->> 'legal_state','');
  v_from timestamptz := nullif(p_query ->> 'from','')::timestamptz;
  v_to timestamptz := nullif(p_query ->> 'to','')::timestamptz;
  v_total integer;
  v_rows jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_authorized');
  end if;
  select * into s from public.ai_content_settings where id;

  -- 47/48. Filtering and paging happen here, in the database. The browser never
  -- receives the catalogue.
  select count(*) into v_total
    from public.ai_content_items i
    join public.marketplace_products p on p.id = i.product_id
   where (v_product is null or i.product_id = v_product)
     and (v_type is null or i.content_type = v_type)
     and (v_status is null or i.status = v_status)
     and (v_lang is null or i.language = v_lang)
     and (v_legal is null or i.legal_state = v_legal)
     and (v_from is null or i.updated_at >= v_from)
     and (v_to is null or i.updated_at <= v_to)
     and (v_search is null or p.name ilike '%' || v_search || '%' or p.slug ilike '%' || v_search || '%');

  select coalesce(jsonb_agg(r order by r ->> 'updated_at' desc), '[]'::jsonb) into v_rows from (
    select jsonb_build_object(
      'id', i.id, 'product_id', i.product_id, 'product', p.name, 'slug', p.slug,
      'content_type', i.content_type, 'language', i.language, 'status', i.status,
      'provenance', i.provenance, 'human_edited', i.human_edited,
      'version', i.current_version,
      'content', left(coalesce(i.content,''), 4000),
      'items', i.content_json,
      'ai_original', left(coalesce(i.ai_original,''), 4000),
      'ai_original_items', i.ai_original_json,
      'validation_state', i.validation_state, 'validation', i.validation,
      'legal_state', i.legal_state, 'legal_findings', i.legal_findings,
      'duplicate_state', i.duplicate_state, 'duplicate_score', i.duplicate_score,
      'duplicate_of', (select mp.name from public.marketplace_products mp where mp.id = i.duplicate_of),
      'stale', i.stale, 'stale_reason', i.stale_reason,
      'rejection_code', i.rejection_code, 'rejection_reason', i.rejection_reason,
      'publish_state', i.publish_state, 'publish_targets', i.publish_targets,
      'generated_at', i.generated_at, 'approved_at', i.approved_at, 'published_at', i.published_at,
      'updated_at', i.updated_at,
      'versions', (select count(*) from public.ai_content_versions v where v.item_id = i.id)) as r
      from public.ai_content_items i
      join public.marketplace_products p on p.id = i.product_id
     where (v_product is null or i.product_id = v_product)
       and (v_type is null or i.content_type = v_type)
       and (v_status is null or i.status = v_status)
       and (v_lang is null or i.language = v_lang)
       and (v_legal is null or i.legal_state = v_legal)
       and (v_from is null or i.updated_at >= v_from)
       and (v_to is null or i.updated_at <= v_to)
       and (v_search is null or p.name ilike '%' || v_search || '%' or p.slug ilike '%' || v_search || '%')
     order by i.updated_at desc
     limit v_limit offset v_offset) q;

  return jsonb_build_object(
    'ok', true,
    'settings', to_jsonb(s),
    'binding', public.mm_ai_provider_binding(),
    'can_approve', public.mm_ai_can_approve(),

    -- 18. Every one of these is a count of rows, not a number in the markup.
    'stats', jsonb_build_object(
      'generated_today', (select count(*) from public.ai_content_generations
                           where status = 'SUCCEEDED' and created_at >= date_trunc('day', now())),
      'failed_today', (select count(*) from public.ai_content_generations
                        where status in ('FAILED','REJECTED_OUTPUT','NOT_CONFIGURED')
                          and created_at >= date_trunc('day', now())),
      'awaiting_review', (select count(*) from public.ai_content_items where status = 'IN_REVIEW'),
      'approved_waiting_publish', (select count(*) from public.ai_content_items where status = 'APPROVED'),
      'auto_published', (select count(*) from public.ai_content_reviews r
                          where r.decision = 'APPROVED'
                            and r.reason = 'Approved automatically under the AUTO_PUBLISH policy.'),
      'published', (select count(*) from public.ai_content_items where status = 'PUBLISHED'),
      'rejected', (select count(*) from public.ai_content_items where status = 'REJECTED'),
      'failed', (select count(*) from public.ai_content_items where status = 'FAILED'),
      'archived', (select count(*) from public.ai_content_items where status = 'ARCHIVED'),
      'stale', (select count(*) from public.ai_content_items where stale and status <> 'ARCHIVED'),
      'legal_blocked', (select count(*) from public.ai_content_items where legal_state = 'BLOCKED'),
      'legal_review', (select count(*) from public.ai_content_items where legal_state = 'REVIEW_REQUIRED'),
      'duplicates', (select count(*) from public.ai_content_items where duplicate_state = 'DUPLICATE'),
      'products_total', (select count(*) from public.marketplace_products
                          where visible and deleted_at is null),
      'products_with_content', (select count(distinct product_id) from public.ai_content_items),
      'products_missing_description', (select count(*) from public.marketplace_products
                                        where visible and deleted_at is null
                                          and coalesce(description,'') = ''),
      'products_missing_seo', (select count(*) from public.marketplace_products p
                                where p.visible and p.deleted_at is null
                                  and not exists (select 1 from public.seo_pages sp
                                                   where sp.product_id = p.id
                                                     and coalesce(sp.meta_description,'') <> ''))),

    -- 17. The status breakdown the dashboard draws from.
    'by_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                    from (select status, count(*) n from public.ai_content_items group by status) x),
    'by_type', (select coalesce(jsonb_object_agg(content_type, n), '{}'::jsonb)
                  from (select content_type, count(*) n from public.ai_content_items group by content_type) x),

    'total', v_total,
    'rows', v_rows,

    -- 54. The approval queue, oldest first, because that is the order it should
    -- be worked in.
    'queue', (select coalesce(jsonb_agg(jsonb_build_object(
                'id', i.id, 'product', p.name, 'slug', p.slug,
                'content_type', i.content_type, 'language', i.language,
                'version', i.current_version, 'human_edited', i.human_edited,
                'validation_state', i.validation_state,
                'legal_state', i.legal_state,
                'duplicate_state', i.duplicate_state,
                'stale', i.stale,
                'submitted_at', i.submitted_at,
                'preview', left(coalesce(i.content, i.content_json::text, ''), 240)) order by i.submitted_at), '[]'::jsonb)
                from public.ai_content_items i
                join public.marketplace_products p on p.id = i.product_id
               where i.status = 'IN_REVIEW' limit 100),

    -- 29. Bulk jobs with their real item counts.
    'jobs', (select coalesce(jsonb_agg(jsonb_build_object(
               'id', j.id, 'scope', j.scope, 'status', j.status,
               'types', to_jsonb(j.content_types), 'language', j.language,
               'total', j.total, 'completed', j.completed, 'failed', j.failed,
               'skipped', j.skipped, 'needs_review', j.needs_review,
               'queued', (select count(*) from public.ai_content_job_items ji
                           where ji.job_id = j.id and ji.status = 'QUEUED'),
               'processing', (select count(*) from public.ai_content_job_items ji
                               where ji.job_id = j.id and ji.status = 'PROCESSING'),
               'last_error', j.last_error,
               'created_at', j.created_at, 'finished_at', j.finished_at) order by j.created_at desc), '[]'::jsonb)
               from (select * from public.ai_content_jobs order by created_at desc limit 10) j),

    -- 27. Usage exactly as the provider reported it, and a flag saying whether
    -- it reported anything at all.
    'usage', jsonb_build_object(
      'today', (select coalesce(jsonb_agg(to_jsonb(u)), '[]'::jsonb)
                  from public.ai_content_usage u where u.usage_date = current_date),
      'last_30_days', (select jsonb_build_object(
          'requests', coalesce(sum(requests),0), 'succeeded', coalesce(sum(succeeded),0),
          'failed', coalesce(sum(failed),0), 'not_configured', coalesce(sum(not_configured),0),
          'tokens_in', coalesce(sum(tokens_in),0), 'tokens_out', coalesce(sum(tokens_out),0),
          'cost_usd', coalesce(sum(cost_usd),0),
          'usage_available', coalesce(bool_or(usage_available), false),
          'cost_available', coalesce(bool_or(cost_available), false))
        from public.ai_content_usage where usage_date >= current_date - 30)),

    -- 26. The generation record, which is the only place a failure explains
    -- itself.
    'generations', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', g.id, 'product', p.name, 'types', to_jsonb(g.content_types),
        'status', g.status, 'provider', g.provider_slug, 'model', g.model_id,
        'prompt_key', g.prompt_key, 'prompt_version', g.prompt_version,
        'error_code', g.error_code, 'error_detail', left(coalesce(g.error_detail,''), 400),
        'http_status', g.http_status,
        'tokens_in', g.tokens_in, 'tokens_out', g.tokens_out,
        'usage_available', g.usage_available, 'cost_available', g.cost_available,
        'latency_ms', g.latency_ms,
        'context_fields', to_jsonb(g.context_fields), 'missing_fields', to_jsonb(g.missing_fields),
        'blocks_returned', to_jsonb(g.blocks_returned),
        'created_at', g.created_at) order by g.created_at desc), '[]'::jsonb)
      from (select * from public.ai_content_generations order by created_at desc limit 25) g
      join public.marketplace_products p on p.id = g.product_id),

    'templates', (select coalesce(jsonb_agg(jsonb_build_object(
        'key', key, 'label', label, 'active', active,
        'sections', structure -> 'long_sections', 'guidance', guidance) order by key), '[]'::jsonb)
      from public.ai_content_templates),

    'legal_rules', (select coalesce(jsonb_agg(jsonb_build_object(
        'code', code, 'label', label, 'category', category, 'severity', severity,
        'action', action, 'active', active) order by severity desc, code), '[]'::jsonb)
      from public.ai_content_legal_rules),

    -- 39. The audit trail, through the module's own window onto it.
    'audit', (select coalesce(jsonb_agg(jsonb_build_object(
        'at', created_at, 'action', action, 'actor', actor, 'role', actor_role,
        'entity', entity_type, 'reason', reason) order by created_at desc), '[]'::jsonb)
      from (select * from public.ai_content_audit_logs order by created_at desc limit 40) a));
end;
$$;

-- 47. The product picker. Server-side search and paging, because the catalogue
-- is 5,533 rows and growing.
create or replace function public.mm_ai_products(p_query jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_search text := nullif(btrim(coalesce(p_query ->> 'search','')), '');
  v_category uuid := nullif(p_query ->> 'category_id','')::uuid;
  v_filter text := coalesce(p_query ->> 'filter', 'all');
  v_limit integer := least(greatest(coalesce((p_query ->> 'limit')::int, 20), 1), 100);
  v_offset integer := greatest(coalesce((p_query ->> 'offset')::int, 0), 0);
  v_total integer;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_authorized');
  end if;

  select count(*) into v_total from public.marketplace_products p
   where p.deleted_at is null and p.visible
     and (v_search is null or p.name ilike '%'||v_search||'%' or p.slug ilike '%'||v_search||'%')
     and (v_category is null or p.category_id = v_category)
     and case v_filter
           when 'missing_description' then coalesce(p.description,'') = ''
           when 'has_content' then exists (select 1 from public.ai_content_items i where i.product_id = p.id)
           when 'no_content' then not exists (select 1 from public.ai_content_items i where i.product_id = p.id)
           when 'stale' then exists (select 1 from public.ai_content_items i where i.product_id = p.id and i.stale)
           else true end;

  return jsonb_build_object('ok', true, 'total', v_total,
    'rows', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'slug', p.slug,
        'category', c.name, 'industry', p.industry_label,
        'has_description', coalesce(p.description,'') <> '',
        'feature_count', case when jsonb_typeof(p.features)='array' then jsonb_array_length(p.features) else 0 end,
        'content_items', (select count(*) from public.ai_content_items i where i.product_id = p.id),
        'published_items', (select count(*) from public.ai_content_items i
                             where i.product_id = p.id and i.status = 'PUBLISHED'),
        'stale_items', (select count(*) from public.ai_content_items i
                         where i.product_id = p.id and i.stale)) order by p.name), '[]'::jsonb)
      from (select * from public.marketplace_products p
             where p.deleted_at is null and p.visible
               and (v_search is null or p.name ilike '%'||v_search||'%' or p.slug ilike '%'||v_search||'%')
               and (v_category is null or p.category_id = v_category)
               and case v_filter
                     when 'missing_description' then coalesce(p.description,'') = ''
                     when 'has_content' then exists (select 1 from public.ai_content_items i where i.product_id = p.id)
                     when 'no_content' then not exists (select 1 from public.ai_content_items i where i.product_id = p.id)
                     when 'stale' then exists (select 1 from public.ai_content_items i where i.product_id = p.id and i.stale)
                     else true end
             order by p.name limit v_limit offset v_offset) p
      left join public.marketplace_categories c on c.id = p.category_id));
end;
$$;

-- 32. The full version trail for one item, for the compare view.
create or replace function public.mm_ai_item_versions(p_item uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_authorized');
  end if;
  return jsonb_build_object('ok', true,
    'versions', (select coalesce(jsonb_agg(jsonb_build_object(
        'version', v.version, 'kind', v.kind,
        'content', left(coalesce(v.content,''), 6000), 'items', v.content_json,
        'status_before', v.status_before, 'status_after', v.status_after,
        'note', v.note, 'actor_role', v.actor_role,
        'actor', (select u.email from auth.users u where u.id = v.actor),
        'created_at', v.created_at) order by v.version desc), '[]'::jsonb)
      from public.ai_content_versions v where v.item_id = p_item),
    'reviews', (select coalesce(jsonb_agg(jsonb_build_object(
        'decision', r.decision, 'reason_code', r.reason_code, 'reason', r.reason,
        'version', r.version, 'role', r.reviewer_role,
        'reviewer', (select u.email from auth.users u where u.id = r.reviewer),
        'created_at', r.created_at) order by r.created_at desc), '[]'::jsonb)
      from public.ai_content_reviews r where r.item_id = p_item));
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'mm_ai_bulk_create(text, text[], jsonb, text)',
    'mm_ai_bulk_claim(uuid, integer)',
    'mm_ai_bulk_mark(uuid, uuid, text, uuid, text, text)',
    'mm_ai_bulk_retry(uuid)',
    'mm_ai_bulk_cancel(uuid, text)',
    'mm_ai_settings_set(jsonb)',
    'mm_ai_content_console(jsonb)',
    'mm_ai_products(jsonb)',
    'mm_ai_item_versions(uuid)',
    'mm_ai_item_edit(uuid, text, jsonb, text)',
    'mm_ai_item_submit(uuid, text)',
    'mm_ai_item_approve(uuid, text)',
    'mm_ai_item_reject(uuid, text, text)',
    'mm_ai_item_publish(uuid, boolean)',
    'mm_ai_item_unpublish(uuid, text)',
    'mm_ai_item_archive(uuid, text)',
    'mm_ai_version_rollback(uuid, integer)',
    'mm_ai_legal_decide(uuid, text, text)',
    'mm_ai_generation_finish(uuid, text, jsonb, jsonb, jsonb, jsonb)',
    'mm_ai_provider_binding()',
    'mm_ai_can_approve()',
    'mm_ai_duplicate_check(uuid, text)',
    'mm_ai_legal_scan(text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end;
$$;
