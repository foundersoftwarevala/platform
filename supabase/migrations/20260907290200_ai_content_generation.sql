-- AI Content Generator — the generation, review and publishing lifecycle.
--
-- Publishing is the part that decides whether any of this is real, so it is
-- worth saying exactly what it writes. Four of the nine content types already
-- have a consumer on the live site, and publishing writes into that consumer
-- rather than into a store of its own:
--
--   short description -> marketplace_products.description, which the product
--                        page's server-rendered head already uses and which
--                        sitemap-products already reads
--   SEO description   -> seo_pages, which the SEO Manager owns and which
--                        getPublicProduct already loads for the page
--   meta keywords     -> marketplace_products.search_keywords, minus the
--                        country: routing markers, which are preserved
--   FAQ               -> faqs, the FAQ Manager's own table
--
-- The other five have no existing consumer, so they are served from this
-- module's published rows, which anonymous readers may select for a visible
-- product and for nothing else.
--
-- Nothing overwrites copy a person already wrote unless an operator has turned
-- that on. A publish that reaches some targets and not others reports PARTIAL
-- and says which, because a status of "published" that is only half true is
-- worse than an error.

/* ------------------------------------------------------ 16/19. who may approve */

-- Operator covers everyone who may run the module. Approval under
-- ROLE_BASED_APPROVAL is narrower: it excludes the marketing and SEO roles that
-- may generate and edit but may not sign content off.
create or replace function public.mm_ai_can_approve()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.mm_is_operator() and (
    -- A service-role or migration context is already trusted by mm_is_operator.
    auth.uid() is null
    or exists (select 1 from public.user_roles ur
                where ur.user_id = auth.uid()
                  and ur.role in ('admin','boss','founder','super_admin','boss_owner'))
  );
$$;

/* --------------------------------------------------- 51. the provider binding */

-- What this module would call, drawn from the AI API Manager's registry. The
-- credential itself is not here and cannot be: it lives in a server-side
-- environment variable, and only the server can say whether it is present.
create or replace function public.mm_ai_provider_binding()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare s record; p record; m record;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_authorized');
  end if;
  select * into s from public.ai_content_settings where id;
  select * into p from public.ai_providers where slug = s.provider_slug;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'provider_not_registered',
                              'provider_slug', s.provider_slug);
  end if;

  select * into m from public.ai_models
   where provider_id = p.id and (model_id = s.model_id or s.model_id is null)
   order by (model_id = s.model_id) desc, is_default desc limit 1;

  return jsonb_build_object(
    'ok', true,
    'provider_slug', p.slug,
    'provider_name', p.name,
    'provider_status', p.status,
    'content_generation_enabled', p.content_generation_enabled,
    'base_url', p.base_url,
    'api_kind', p.api_kind,
    -- The NAME of the variable, never its value.
    'credential_env', p.credential_env,
    'model_id', coalesce(s.model_id, m.model_id),
    'model_name', m.name,
    'context_window', m.context_window,
    'input_cost_per_1k', m.input_cost_per_1k,
    'output_cost_per_1k', m.output_cost_per_1k,
    'temperature', s.temperature,
    'max_output_tokens', s.max_output_tokens,
    'timeout_ms', s.request_timeout_ms,
    -- 41/49. Whether the AI API Manager holds a stored key for this provider.
    -- Presence only; no prefix, no fingerprint, no value.
    'stored_key_present', exists (
      select 1 from public.api_keys k
       where k.provider_id = p.id and k.status = 'active'
         and coalesce(length(k.secret_encrypted), 0) >= 20));
end;
$$;

/* --------------------------------------------------------- 3/26. start a run */

-- Assembles everything the server needs to make one real AI request. It does
-- not make the request: the database has no credential and no outbound network,
-- which is exactly why the split exists.
create or replace function public.mm_ai_generation_start(
  p_product uuid,
  p_types text[],
  p_language text default null,
  p_job uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  ctx jsonb;
  pr record;
  binding jsonb;
  v_types text[];
  v_lang text;
  v_gen uuid;
  v_today integer;
  v_type text;
  v_item uuid;
  v_enabled text[] := '{}';
  v_skipped text[] := '{}';
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_authorized');
  end if;

  select * into s from public.ai_content_settings where id;
  v_lang := coalesce(p_language, s.default_language);
  if not (v_lang = any (s.allowed_languages)) then
    return jsonb_build_object('ok', false, 'reason', 'language_not_allowed',
      'detail', format('%s is not in the allowed languages.', v_lang));
  end if;

  ctx := public.mm_ai_context(p_product);
  if not (ctx ->> 'ok')::boolean then return ctx; end if;
  if (ctx ->> 'deleted')::boolean then
    return jsonb_build_object('ok', false, 'reason', 'product_deleted');
  end if;

  -- 4. Only blocks that are switched on are generated, whatever was asked for.
  foreach v_type in array coalesce(p_types, array[]::text[]) loop
    if coalesce((s.blocks ->> v_type)::boolean, false) then
      v_enabled := v_enabled || v_type;
    else
      v_skipped := v_skipped || v_type;
    end if;
  end loop;
  if array_length(v_enabled, 1) is null then
    return jsonb_build_object('ok', false, 'reason', 'no_enabled_blocks',
      'skipped', to_jsonb(v_skipped),
      'detail', 'Every requested block is switched off in the settings.');
  end if;
  v_types := v_enabled;

  -- 27. The daily ceiling, counted from the real generation records.
  select count(*) into v_today from public.ai_content_generations
   where created_at >= date_trunc('day', now())
     and status in ('SUCCEEDED','FAILED','RUNNING','REJECTED_OUTPUT');
  if s.daily_request_cap > 0 and v_today >= s.daily_request_cap then
    return jsonb_build_object('ok', false, 'reason', 'daily_cap_reached',
      'detail', format('%s requests already made today, cap is %s.', v_today, s.daily_request_cap));
  end if;

  binding := public.mm_ai_provider_binding();
  select * into pr from public.ai_prompts where key = 'marketplace.product.content.v1';

  insert into public.ai_content_generations (
    product_id, content_types, language, provider_slug, model_id, api_kind,
    prompt_key, prompt_version, prompt_hash, template_key,
    context_hash, context_fields, missing_fields, status, job_id, actor)
  values (
    p_product, v_types, v_lang,
    binding ->> 'provider_slug', binding ->> 'model_id', binding ->> 'api_kind',
    pr.key, coalesce((pr.config ->> 'version')::int, 1), md5(coalesce(pr.prompt,'')),
    ctx ->> 'template_key',
    ctx ->> 'context_hash',
    array(select jsonb_array_elements_text(ctx -> 'present_fields')),
    array(select jsonb_array_elements_text(ctx -> 'missing_fields')),
    'RUNNING', p_job, auth.uid())
  returning id into v_gen;

  -- 17. Every requested block moves to GENERATING now, so the console shows
  -- work in progress rather than a stale draft.
  foreach v_type in array v_types loop
    insert into public.ai_content_items (product_id, content_type, language, status, created_by)
    values (p_product, v_type, v_lang, 'GENERATING', auth.uid())
    on conflict (product_id, content_type, language) do update
      set status = case
            -- Published content stays published until the new draft replaces it.
            when ai_content_items.status = 'PUBLISHED' then 'PUBLISHED'
            else 'GENERATING' end
    returning id into v_item;
  end loop;

  perform public.mm_audit('ai_content.generate.start', 'ai_content_generation', v_gen::text,
    null,
    jsonb_build_object('product', p_product, 'types', to_jsonb(v_types), 'language', v_lang,
                       'provider', binding ->> 'provider_slug', 'model', binding ->> 'model_id',
                       'context_hash', ctx ->> 'context_hash'),
    'AI content generation requested');

  return jsonb_build_object(
    'ok', true,
    'generation_id', v_gen,
    'product_id', p_product,
    'product_name', ctx ->> 'product_name',
    'types', to_jsonb(v_types),
    'skipped_disabled', to_jsonb(v_skipped),
    'language', v_lang,
    'context', ctx,
    'binding', binding,
    -- 49. The prompt travels to the server only. No route returns it to a
    -- browser; the console shows the prompt key and version instead.
    'system_prompt', pr.prompt,
    'brand_voice', s.brand_voice,
    'limits', s.limits,
    'requests_today', v_today,
    'daily_cap', s.daily_request_cap);
end;
$$;

revoke all on function public.mm_ai_generation_start(uuid, text[], text, uuid) from public, anon;
grant execute on function public.mm_ai_generation_start(uuid, text[], text, uuid) to authenticated, service_role;

/* -------------------------------------- 3/15/24/26/32. finish a run */

-- Takes the provider's answer back, and is the only place a draft is written.
-- A malformed or empty response is recorded as REJECTED_OUTPUT and the items
-- are marked FAILED: nothing is saved and nothing reports success.
create or replace function public.mm_ai_generation_finish(
  p_generation uuid,
  p_status text,
  p_parsed jsonb default null,
  p_raw jsonb default null,
  p_usage jsonb default null,
  p_error jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g record;
  s record;
  v_type text;
  v_item record;
  v_key text;
  v_value jsonb;
  v_content text;
  v_json jsonb;
  v_written text[] := '{}';
  v_empty text[] := '{}';
  v_version integer;
  v_policy text;
  v_next text;
  v_validation jsonb;
  v_results jsonb := '[]'::jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_authorized');
  end if;

  select * into g from public.ai_content_generations where id = p_generation;
  if not found then return jsonb_build_object('ok', false, 'reason','generation_not_found'); end if;
  if g.status <> 'RUNNING' then
    return jsonb_build_object('ok', false, 'reason','generation_not_running', 'status', g.status);
  end if;
  select * into s from public.ai_content_settings where id;

  -- 43. Anything that is not a success ends here, recorded with its cause.
  if p_status <> 'SUCCEEDED' then
    update public.ai_content_generations
       set status = p_status,
           error_code = p_error ->> 'code',
           error_detail = left(coalesce(p_error ->> 'detail',''), 2000),
           http_status = (p_error ->> 'http_status')::int,
           raw_output = p_raw,
           latency_ms = (p_usage ->> 'latency_ms')::int,
           finished_at = now()
     where id = p_generation;

    update public.ai_content_items
       set status = 'FAILED',
           validation_state = 'FAILED',
           validation = jsonb_build_object('checked_at', now(), 'errors',
             jsonb_build_array(jsonb_build_object(
               'code', coalesce(p_error ->> 'code','generation_failed'),
               'detail', coalesce(p_error ->> 'detail','The provider did not return content.'))))
     where product_id = g.product_id
       and language = g.language
       and content_type = any (g.content_types)
       and status = 'GENERATING';

    perform public.mm_ai_usage_record(g.provider_slug, g.model_id, p_status, p_usage);
    perform public.mm_audit('ai_content.generate.failed', 'ai_content_generation', p_generation::text,
      null, jsonb_build_object('status', p_status, 'code', p_error ->> 'code'),
      left(coalesce(p_error ->> 'detail',''), 400));

    return jsonb_build_object('ok', false, 'reason', coalesce(p_error ->> 'code', p_status),
      'detail', p_error ->> 'detail', 'generation_id', p_generation);
  end if;

  -- 24. A success with nothing usable in it is not a success.
  if p_parsed is null or jsonb_typeof(p_parsed) <> 'object' then
    return public.mm_ai_generation_finish(p_generation, 'REJECTED_OUTPUT', null, p_raw, p_usage,
      jsonb_build_object('code','malformed_response',
                         'detail','The response was not a JSON object matching the requested shape.'));
  end if;

  v_policy := s.publish_policy;

  foreach v_type in array g.content_types loop
    -- The JSON key each content type arrives under.
    v_key := case v_type
      when 'summary' then 'summary'
      when 'short_description' then 'shortDescription'
      when 'long_description' then 'longDescription'
      when 'seo_description' then 'seoDescription'
      when 'meta_keywords' then 'keywords'
      when 'faq' then 'faq'
      when 'features' then 'features'
      when 'benefits' then 'benefits'
      when 'use_cases' then 'useCases' end;

    v_value := p_parsed -> v_key;
    v_content := null; v_json := null;

    if v_value is null or v_value = 'null'::jsonb then
      v_empty := v_empty || v_type;
      continue;
    end if;

    if v_type in ('summary','short_description','long_description','seo_description') then
      if jsonb_typeof(v_value) <> 'string' then v_empty := v_empty || v_type; continue; end if;
      v_content := btrim(v_value #>> '{}');
      if v_content = '' then v_empty := v_empty || v_type; continue; end if;
    else
      if jsonb_typeof(v_value) <> 'array' or jsonb_array_length(v_value) = 0 then
        v_empty := v_empty || v_type; continue;
      end if;
      v_json := v_value;
    end if;

    select * into v_item from public.ai_content_items
     where product_id = g.product_id and content_type = v_type and language = g.language;

    v_version := v_item.current_version + 1;

    -- 15/32. The version that is about to be replaced is written down before it
    -- is replaced, with what it was, so nothing is ever lost to a regeneration.
    insert into public.ai_content_versions (
      item_id, version, kind, content, content_json,
      previous_content, previous_content_json, status_before, status_after,
      generation_id, context_hash, actor, actor_role, note)
    values (
      v_item.id, v_version,
      case when v_item.current_version = 0 then 'AI_DRAFT' else 'REGENERATED' end,
      v_content, v_json,
      v_item.content, v_item.content_json, v_item.status, 'GENERATED',
      p_generation, g.context_hash, auth.uid(),
      (select ur.role::text from public.user_roles ur where ur.user_id = auth.uid() limit 1),
      case when v_item.current_version = 0 then 'First AI draft.'
           else format('Regenerated over version %s.', v_item.current_version) end);

    update public.ai_content_items
       set content = v_content,
           content_json = v_json,
           -- 33. The model's own words, kept separately and never overwritten
           -- by an edit.
           ai_original = v_content,
           ai_original_json = v_json,
           human_edited = false,
           edited_by = null,
           edited_at = null,
           provenance = 'AI_GENERATED',
           status = 'GENERATED',
           current_version = v_version,
           context_hash = g.context_hash,
           stale = false, stale_reason = null, stale_since = null,
           validation_state = 'PENDING',
           -- New text, so any legal decision about the old text no longer
           -- applies and the question is asked again.
           legal_reviewed_at = null, legal_reviewed_by = null,
           rejection_code = null, rejection_reason = null,
           generated_at = now(),
           submitted_at = null, approved_at = null, approved_by = null
     where id = v_item.id;

    -- 30. Validation runs immediately, so nothing sits in the queue without a
    -- verdict and nothing invalid can be approved by accident.
    v_validation := public.mm_ai_validate(v_item.id);

    -- 16/19/20. The policy decides what happens next, and a legal block
    -- overrides every policy including AUTO_PUBLISH.
    select legal_state into v_next from public.ai_content_items where id = v_item.id;
    if v_next = 'BLOCKED' then
      update public.ai_content_items set status = 'IN_REVIEW', submitted_at = now()
       where id = v_item.id;
      insert into public.ai_content_reviews (item_id, version, decision, reason_code, reason, reviewer)
      values (v_item.id, v_version, 'LEGAL_BLOCKED', 'legal_concern',
              'The legal scan blocked this content. It cannot publish until a reviewer clears it.', auth.uid());
      v_next := 'IN_REVIEW';
    elsif v_policy = 'AUTO_PUBLISH'
      and (v_validation ->> 'ok')::boolean
      and v_next not in ('REVIEW_REQUIRED','PENDING')
      and not (v_type = any (s.legal_review_types)) then
      -- Auto-publish still goes through approval and publication properly; it
      -- simply does not wait for a person.
      update public.ai_content_items
         set status = 'APPROVED', approved_at = now(), approved_by = auth.uid(),
             submitted_at = now(), provenance = 'AI_GENERATED'
       where id = v_item.id;
      insert into public.ai_content_reviews (item_id, version, decision, reason, reviewer)
      values (v_item.id, v_version, 'APPROVED', 'Approved automatically under the AUTO_PUBLISH policy.', auth.uid());
      perform public.mm_ai_item_publish(v_item.id, true);
      select status into v_next from public.ai_content_items where id = v_item.id;
    else
      update public.ai_content_items set status = 'IN_REVIEW', submitted_at = now()
       where id = v_item.id;
      insert into public.ai_content_reviews (item_id, version, decision, reason, reviewer)
      values (v_item.id, v_version, 'SUBMITTED', 'Submitted for review after generation.', auth.uid());
      v_next := 'IN_REVIEW';
    end if;

    v_written := v_written || v_type;
    v_results := v_results || jsonb_build_object(
      'content_type', v_type, 'item_id', v_item.id, 'version', v_version,
      'status', v_next, 'validation', v_validation);
  end loop;

  -- 24. The provider answered, but with none of the blocks that were asked for.
  if array_length(v_written, 1) is null then
    return public.mm_ai_generation_finish(p_generation, 'REJECTED_OUTPUT', null, p_raw, p_usage,
      jsonb_build_object('code','no_blocks_returned',
        'detail','The response carried none of the requested content blocks.'));
  end if;

  update public.ai_content_generations
     set status = 'SUCCEEDED',
         parsed_output = p_parsed,
         raw_output = p_raw,
         blocks_returned = v_written,
         usage_available = coalesce((p_usage ->> 'usage_available')::boolean, false),
         tokens_in = (p_usage ->> 'tokens_in')::int,
         tokens_out = (p_usage ->> 'tokens_out')::int,
         cost_usd = (p_usage ->> 'cost_usd')::numeric,
         cost_available = coalesce((p_usage ->> 'cost_available')::boolean, false),
         latency_ms = (p_usage ->> 'latency_ms')::int,
         finished_at = now()
   where id = p_generation;

  -- Any requested block the provider did not return goes back to a draft state
  -- rather than sitting on GENERATING for ever.
  if array_length(v_empty, 1) > 0 then
    update public.ai_content_items
       set status = 'DRAFT',
           validation_state = 'FAILED',
           validation = jsonb_build_object('checked_at', now(), 'errors',
             jsonb_build_array(jsonb_build_object('code','not_returned',
               'detail','The provider did not return this block.')))
     where product_id = g.product_id and language = g.language
       and content_type = any (v_empty) and status = 'GENERATING';
  end if;

  perform public.mm_ai_usage_record(g.provider_slug, g.model_id, 'SUCCEEDED', p_usage);
  perform public.mm_audit('ai_content.generate.succeeded', 'ai_content_generation', p_generation::text,
    null, jsonb_build_object('product', g.product_id, 'written', to_jsonb(v_written),
                             'not_returned', to_jsonb(v_empty), 'policy', v_policy),
    'AI content generated');

  return jsonb_build_object('ok', true, 'generation_id', p_generation,
    'written', to_jsonb(v_written), 'not_returned', to_jsonb(v_empty),
    'policy', v_policy, 'results', v_results);
end;
$$;

/* --------------------------------------------------------------- 27. usage */

create or replace function public.mm_ai_usage_record(
  p_provider text, p_model text, p_status text, p_usage jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ai_content_usage (
    usage_date, provider_slug, model_id, requests, succeeded, failed, not_configured,
    tokens_in, tokens_out, cost_usd, usage_available, cost_available)
  values (
    current_date, coalesce(p_provider,'unconfigured'), coalesce(p_model,'unconfigured'),
    1,
    case when p_status = 'SUCCEEDED' then 1 else 0 end,
    case when p_status in ('FAILED','REJECTED_OUTPUT') then 1 else 0 end,
    case when p_status = 'NOT_CONFIGURED' then 1 else 0 end,
    coalesce((p_usage ->> 'tokens_in')::bigint, 0),
    coalesce((p_usage ->> 'tokens_out')::bigint, 0),
    coalesce((p_usage ->> 'cost_usd')::numeric, 0),
    coalesce((p_usage ->> 'usage_available')::boolean, false),
    coalesce((p_usage ->> 'cost_available')::boolean, false))
  on conflict (usage_date, provider_slug, model_id) do update set
    requests = ai_content_usage.requests + 1,
    succeeded = ai_content_usage.succeeded + excluded.succeeded,
    failed = ai_content_usage.failed + excluded.failed,
    not_configured = ai_content_usage.not_configured + excluded.not_configured,
    tokens_in = ai_content_usage.tokens_in + excluded.tokens_in,
    tokens_out = ai_content_usage.tokens_out + excluded.tokens_out,
    cost_usd = ai_content_usage.cost_usd + excluded.cost_usd,
    -- Once true it stays true for the day: some responses carry usage and some
    -- do not, and the console needs to know figures were reported at all.
    usage_available = ai_content_usage.usage_available or excluded.usage_available,
    cost_available = ai_content_usage.cost_available or excluded.cost_available,
    updated_at = now();
end;
$$;
