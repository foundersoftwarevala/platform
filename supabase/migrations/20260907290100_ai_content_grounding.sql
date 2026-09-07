-- AI Content Generator — grounding, validation and the generation lifecycle.
--
-- The single rule this file exists to enforce is section 25: the model is given
-- the product's own record and is told that the record outranks anything it
-- knows. Every fact the context carries is named, and every fact the product
-- does not carry is named too, so the model is asked to say "not available in
-- verified product data" instead of filling the gap. That matters here more
-- than it would elsewhere: of 5,533 products only one carries benefits,
-- modules or integrations, so a model left to itself would invent them for
-- 5,532 products.
--
-- Generation is split in two on purpose. mm_ai_generation_start assembles the
-- context and the prompt and hands them to the server, which is the only place
-- an AI credential exists; mm_ai_generation_finish takes the response back,
-- validates it, versions it and applies the publishing policy. The database
-- never makes an outbound call and the browser never sees a prompt.

/* ------------------------------------------------- 23/49. the system prompt */

-- The prompt lives in the AI API Manager's own prompt table, readable only by
-- an operator, and is never returned to a browser.
insert into public.ai_prompts (key, name, prompt, model, config, status)
values (
  'marketplace.product.content.v1',
  'Marketplace product content generator',
  $prompt$You write marketplace copy for Software Vala, a software marketplace.

ABSOLUTE RULES

1. The VERIFIED PRODUCT DATA block below outranks anything you know or believe.
   If the two disagree, the block is right and you are wrong.
2. Never state a capability, integration, module, certification, compliance,
   platform, price, licence or support commitment that is not in the block.
3. Where the block does not carry a fact you would need, write exactly:
   "Information not available in verified product data."
   Do not guess, infer from the product name, or reason from the category.
4. Never write a guarantee, a percentage of saving or revenue, a market
   position, a certification, a regulatory approval, or a clinical claim.
5. Do not copy the product's existing description back. Write it properly.
6. Follow the brand voice for tone only. Tone never changes a fact.

OUTPUT

Reply with one JSON object and nothing else. No prose before or after it, no
markdown fence. Include only the keys listed in REQUESTED BLOCKS.

  {
    "summary": "string",
    "shortDescription": "string",
    "longDescription": "string, may use \n\n between sections",
    "seoDescription": "string",
    "keywords": ["string"],
    "faq": [{"question": "string", "answer": "string"}],
    "features": [{"text": "string", "source": "PRODUCT_DATA" | "AI_SUGGESTION"}],
    "benefits": ["string"],
    "useCases": [{"title": "string", "description": "string", "verified": false}]
  }

For "features", mark an entry PRODUCT_DATA only when it restates something in
the verified block; anything you propose yourself is AI_SUGGESTION. For
"useCases", "verified" is always false: these are suggestions, not customer
references.$prompt$,
  'gpt-4o-mini',
  jsonb_build_object('version', 1, 'response_format', 'json_object'),
  'active'
)
on conflict (key) do update
  set prompt = excluded.prompt, config = excluded.config, updated_at = now();

/* --------------------------------------------------- 2/25. verified context */

-- Everything the model is allowed to know about a product, drawn only from the
-- marketplace record, plus an explicit list of what is missing.
create or replace function public.mm_ai_context(p_product uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
  v_category text;
  v_facts jsonb := '{}'::jsonb;
  v_present text[] := '{}';
  v_missing text[] := '{}';
  v_demo boolean;
  v_template record;
  v_terms text;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_authorized');
  end if;

  select * into p from public.marketplace_products where id = p_product;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'product_not_found');
  end if;

  select c.name into v_category from public.marketplace_categories c where c.id = p.category_id;

  -- A demo is a fact about the product, so the copy may mention that one
  -- exists. The URL itself is not given to the model.
  select exists (
    select 1 from public.product_demo_urls d
     where d.product_id = p.id and d.status = 'active'
  ) into v_demo;

  -- Each fact is added only when the product actually carries it. A null field
  -- becomes an entry in missing_fields, which the prompt turns into a
  -- "not available" instruction rather than an invitation to invent.
  v_facts := jsonb_build_object('name', p.name, 'slug', p.slug);
  v_present := array['name'];

  if v_category is not null then
    v_facts := v_facts || jsonb_build_object('category', v_category);
    v_present := v_present || 'category'::text;
  else v_missing := v_missing || 'category'::text; end if;

  if coalesce(p.industry_label,'') <> '' then
    v_facts := v_facts || jsonb_build_object('industry', p.industry_label);
    v_present := v_present || 'industry'::text;
  else v_missing := v_missing || 'industry'::text; end if;

  if coalesce(p.subcategory,'') <> '' then
    v_facts := v_facts || jsonb_build_object('subcategory', p.subcategory);
    v_present := v_present || 'subcategory'::text;
  else v_missing := v_missing || 'subcategory'::text; end if;

  if coalesce(p.description,'') <> '' then
    v_facts := v_facts || jsonb_build_object('existing_description', p.description);
    v_present := v_present || 'existing_description'::text;
  else v_missing := v_missing || 'existing_description'::text; end if;

  if jsonb_typeof(p.features) = 'array' and jsonb_array_length(p.features) > 0 then
    v_facts := v_facts || jsonb_build_object('verified_features', p.features);
    v_present := v_present || 'verified_features'::text;
  else v_missing := v_missing || 'verified_features'::text; end if;

  if coalesce(p.benefits,'') <> '' then
    v_facts := v_facts || jsonb_build_object('verified_benefits', p.benefits);
    v_present := v_present || 'verified_benefits'::text;
  else v_missing := v_missing || 'verified_benefits'::text; end if;

  if coalesce(p.modules,'') <> '' then
    v_facts := v_facts || jsonb_build_object('modules', p.modules);
    v_present := v_present || 'modules'::text;
  else v_missing := v_missing || 'modules'::text; end if;

  if coalesce(p.integrations,'') <> '' then
    v_facts := v_facts || jsonb_build_object('integrations', p.integrations);
    v_present := v_present || 'integrations'::text;
  else v_missing := v_missing || 'integrations'::text; end if;

  if coalesce(p.target_audience,'') <> '' then
    v_facts := v_facts || jsonb_build_object('target_audience', p.target_audience);
    v_present := v_present || 'target_audience'::text;
  else v_missing := v_missing || 'target_audience'::text; end if;

  if coalesce(p.price_label,'') <> '' and lower(p.price_label) <> 'custom' then
    v_facts := v_facts || jsonb_build_object('price', p.price_label,
                                             'price_period', coalesce(p.price_period,'one-time'));
    v_present := v_present || 'price'::text;
  else v_missing := v_missing || 'price'::text; end if;

  if coalesce(p.license,'') <> '' then
    v_facts := v_facts || jsonb_build_object('licence', p.license);
    v_present := v_present || 'licence'::text;
  else v_missing := v_missing || 'licence'::text; end if;

  if coalesce(p.deployment,'') <> '' then
    v_facts := v_facts || jsonb_build_object('deployment', p.deployment);
    v_present := v_present || 'deployment'::text;
  else v_missing := v_missing || 'deployment'::text; end if;

  if array_length(p.tech_stack, 1) > 0 then
    v_facts := v_facts || jsonb_build_object('technology', to_jsonb(p.tech_stack));
    v_present := v_present || 'technology'::text;
  else v_missing := v_missing || 'technology'::text; end if;

  -- The platform columns, collapsed into one list of what the record confirms.
  v_terms := nullif(concat_ws(', ',
    nullif(p.frontend,''), nullif(p.backend,''), nullif(p.database,''),
    nullif(p.mobile,''), nullif(p.pwa,''), nullif(p.cloud,''), nullif(p.offline,'')), '');
  if v_terms is not null then
    v_facts := v_facts || jsonb_build_object('platform', v_terms);
    v_present := v_present || 'platform'::text;
  else v_missing := v_missing || 'platform'::text; end if;

  if array_length(p.tags, 1) > 0 then
    v_facts := v_facts || jsonb_build_object('tags', to_jsonb(p.tags));
    v_present := v_present || 'tags'::text;
  end if;

  if array_length(p.search_keywords, 1) > 0 then
    -- The country markers are routing data, not product facts.
    v_facts := v_facts || jsonb_build_object('existing_keywords',
      to_jsonb((select array_agg(k) from unnest(p.search_keywords) k where k not like 'country:%')));
    v_present := v_present || 'existing_keywords'::text;
  end if;

  v_facts := v_facts || jsonb_build_object('has_live_demo', v_demo);
  if not v_demo then v_missing := v_missing || 'live_demo'::text; end if;

  -- 37. Which template's structure suits this product. Structure only: a
  -- template never contributes a fact.
  -- The template with the most matching terms wins. Picking the first match
  -- alphabetically chose 'mobile' for a madrasa platform, because its tech
  -- stack reads "Web Application"; a count settles it in favour of the
  -- template that actually fits.
  select t.*, x.hits into v_template
    from public.ai_content_templates t
    join lateral (
      select count(*) as hits from unnest(t.match_terms) m
       where lower(coalesce(v_category,'') || ' ' || coalesce(p.industry_label,'') || ' ' ||
                   coalesce(p.subcategory,'') || ' ' || coalesce(array_to_string(p.tags,' '),'') || ' ' ||
                   coalesce(array_to_string(p.tech_stack,' '),'') || ' ' || p.name) like '%' || m || '%'
    ) x on x.hits > 0
   where t.active
   order by x.hits desc, t.key limit 1;

  return jsonb_build_object(
    'ok', true,
    'product_id', p.id,
    'product_name', p.name,
    'slug', p.slug,
    'visible', p.visible,
    'moderation_status', p.moderation_status,
    'deleted', p.deleted_at is not null,
    'facts', v_facts,
    'present_fields', to_jsonb(v_present),
    'missing_fields', to_jsonb(v_missing),
    'template_key', v_template.key,
    'template_label', v_template.label,
    'template_structure', coalesce(v_template.structure, '{}'::jsonb),
    'template_guidance', coalesce(v_template.guidance, ''),
    -- 45. The fingerprint. Recomputed whenever the product changes; content
    -- generated against a different fingerprint is stale by definition.
    'context_hash', md5(v_facts::text)
  );
end;
$$;

revoke all on function public.mm_ai_context(uuid) from public, anon;
grant execute on function public.mm_ai_context(uuid) to authenticated, service_role;

-- The same fingerprint, cheaply, for the staleness trigger. No authorisation
-- gate because it reads nothing a caller could not already see and is only
-- reachable from a trigger.
create or replace function public.mm_ai_context_hash(p_product uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select md5((
    jsonb_build_object('name', p.name, 'slug', p.slug)
    || case when c.name is not null then jsonb_build_object('category', c.name) else '{}'::jsonb end
    || case when coalesce(p.industry_label,'') <> '' then jsonb_build_object('industry', p.industry_label) else '{}'::jsonb end
    || case when coalesce(p.subcategory,'') <> '' then jsonb_build_object('subcategory', p.subcategory) else '{}'::jsonb end
    || case when coalesce(p.description,'') <> '' then jsonb_build_object('existing_description', p.description) else '{}'::jsonb end
    || case when jsonb_typeof(p.features) = 'array' and jsonb_array_length(p.features) > 0 then jsonb_build_object('verified_features', p.features) else '{}'::jsonb end
    || case when coalesce(p.benefits,'') <> '' then jsonb_build_object('verified_benefits', p.benefits) else '{}'::jsonb end
    || case when coalesce(p.modules,'') <> '' then jsonb_build_object('modules', p.modules) else '{}'::jsonb end
    || case when coalesce(p.integrations,'') <> '' then jsonb_build_object('integrations', p.integrations) else '{}'::jsonb end
    || case when coalesce(p.target_audience,'') <> '' then jsonb_build_object('target_audience', p.target_audience) else '{}'::jsonb end
    || case when coalesce(p.price_label,'') <> '' and lower(p.price_label) <> 'custom'
             then jsonb_build_object('price', p.price_label, 'price_period', coalesce(p.price_period,'one-time')) else '{}'::jsonb end
    || case when coalesce(p.license,'') <> '' then jsonb_build_object('licence', p.license) else '{}'::jsonb end
    || case when coalesce(p.deployment,'') <> '' then jsonb_build_object('deployment', p.deployment) else '{}'::jsonb end
    || case when array_length(p.tech_stack,1) > 0 then jsonb_build_object('technology', to_jsonb(p.tech_stack)) else '{}'::jsonb end
    || case when nullif(concat_ws(', ', nullif(p.frontend,''), nullif(p.backend,''), nullif(p.database,''),
                                  nullif(p.mobile,''), nullif(p.pwa,''), nullif(p.cloud,''), nullif(p.offline,'')),'') is not null
             then jsonb_build_object('platform', concat_ws(', ', nullif(p.frontend,''), nullif(p.backend,''), nullif(p.database,''),
                                                           nullif(p.mobile,''), nullif(p.pwa,''), nullif(p.cloud,''), nullif(p.offline,'')))
             else '{}'::jsonb end
    || case when array_length(p.tags,1) > 0 then jsonb_build_object('tags', to_jsonb(p.tags)) else '{}'::jsonb end
    || case when array_length(p.search_keywords,1) > 0 then jsonb_build_object('existing_keywords',
              to_jsonb((select array_agg(k) from unnest(p.search_keywords) k where k not like 'country:%'))) else '{}'::jsonb end
    || jsonb_build_object('has_live_demo', exists (
         select 1 from public.product_demo_urls d where d.product_id = p.id and d.status = 'active'))
  )::text)
  from public.marketplace_products p
  left join public.marketplace_categories c on c.id = p.category_id
  where p.id = p_product;
$$;

/* ------------------------------------------------------------ 20. legal scan */

-- Runs the configured rules over a piece of text. Nothing about this is a
-- judgement call by a model: they are regular expressions a person wrote and
-- can read, and each finding names the rule that produced it.
create or replace function public.mm_ai_legal_scan(p_text text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'code', r.code, 'label', r.label, 'category', r.category,
           'severity', r.severity, 'action', r.action, 'note', r.note,
           'match', substring(p_text from r.pattern))), '[]'::jsonb)
    from public.ai_content_legal_rules r
   where r.active
     and coalesce(p_text,'') <> ''
     and p_text ~* r.pattern;
$$;

/* ------------------------------------------------------ 31. duplicate check */

-- Compares a candidate description against the descriptions the catalogue
-- already carries, both the products' own and any this module has published.
-- Trigram similarity, not a model's opinion.
create or replace function public.mm_ai_duplicate_check(p_product uuid, p_text text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s record;
  v_best record;
begin
  select duplicate_threshold, high_similarity_threshold into s
    from public.ai_content_settings where id;

  if coalesce(p_text,'') = '' or length(p_text) < 40 then
    return jsonb_build_object('state','UNCHECKED','score',null,'product',null,
                              'reason','too short to compare');
  end if;

  select x.product_id, x.name, x.score into v_best from (
    select p.id as product_id, p.name,
           similarity(left(p.description, 1200), left(p_text, 1200)) as score
      from public.marketplace_products p
     where p.id <> p_product
       and p.deleted_at is null
       and coalesce(p.description,'') <> ''
       and length(p.description) >= 40
       -- The trigram index does the narrowing; similarity() then ranks.
       and left(p.description, 1200) % left(p_text, 1200)
    union all
    select i.product_id, mp.name,
           similarity(left(i.content, 1200), left(p_text, 1200)) as score
      from public.ai_content_items i
      join public.marketplace_products mp on mp.id = i.product_id
     where i.product_id <> p_product
       and i.status = 'PUBLISHED'
       and i.content_type in ('short_description','long_description','summary')
       and coalesce(i.content,'') <> ''
       and left(i.content, 1200) % left(p_text, 1200)
  ) x
  order by x.score desc
  limit 1;

  if v_best.score is null then
    return jsonb_build_object('state','UNIQUE','score',0,'product',null,'product_name',null);
  end if;

  return jsonb_build_object(
    'state', case
               when v_best.score >= s.duplicate_threshold then 'DUPLICATE'
               when v_best.score >= s.high_similarity_threshold then 'HIGH_SIMILARITY'
               else 'UNIQUE' end,
    'score', round(v_best.score::numeric, 4),
    'product', v_best.product_id,
    'product_name', v_best.name);
end;
$$;

-- Without this index the comparison above would read every description in the
-- catalogue for every check.
create index if not exists marketplace_products_description_trgm
  on public.marketplace_products using gin (left(description, 1200) gin_trgm_ops);

/* --------------------------------------------------------- 30/53. validation */

-- Everything a piece of content must satisfy before it may be approved. The
-- result is stored on the item, so the console shows the reason rather than a
-- bare refusal.
create or replace function public.mm_ai_validate(p_item uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i record;
  s record;
  v_limits jsonb;
  v_min integer; v_max integer;
  v_errors jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_len integer;
  v_count integer;
  v_text text;
  v_legal jsonb;
  v_dup jsonb;
  v_blocked boolean := false;
  v_review boolean := false;
  v_phrase text;
  v_element jsonb;
  v_grounding numeric := 1;
  v_completeness numeric := 1;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_authorized');
  end if;

  select * into i from public.ai_content_items where id = p_item;
  if not found then return jsonb_build_object('ok', false, 'reason','item_not_found'); end if;
  select * into s from public.ai_content_settings where id;

  v_limits := coalesce(s.limits -> i.content_type, '{}'::jsonb);
  v_min := coalesce((v_limits ->> 'min')::int, 0);
  v_max := coalesce((v_limits ->> 'max')::int, 100000);

  -- The text this content type is actually judged on.
  if i.content_type in ('summary','short_description','long_description','seo_description') then
    v_text := coalesce(i.content, '');
    v_len := length(v_text);
    if v_len = 0 then
      v_errors := v_errors || jsonb_build_object('code','empty','detail','No content was produced.');
    else
      if v_len < v_min then
        v_errors := v_errors || jsonb_build_object('code','too_short',
          'detail', format('%s characters, minimum %s.', v_len, v_min));
      end if;
      if v_len > v_max then
        v_errors := v_errors || jsonb_build_object('code','too_long',
          'detail', format('%s characters, maximum %s.', v_len, v_max));
      end if;
    end if;
  else
    -- The structured blocks. Shape is checked, not just presence.
    if jsonb_typeof(i.content_json) <> 'array' then
      v_errors := v_errors || jsonb_build_object('code','malformed',
        'detail','Expected a list and did not get one.');
      v_count := 0;
    else
      v_count := jsonb_array_length(i.content_json);
      if v_count < v_min then
        v_errors := v_errors || jsonb_build_object('code','too_few',
          'detail', format('%s entries, minimum %s.', v_count, v_min));
      end if;
      if v_count > v_max then
        v_warnings := v_warnings || jsonb_build_object('code','too_many',
          'detail', format('%s entries, maximum %s. The surplus will not be published.', v_count, v_max));
      end if;

      if i.content_type = 'faq' then
        for v_element in select * from jsonb_array_elements(i.content_json) loop
          if coalesce(v_element ->> 'question','') = '' or coalesce(v_element ->> 'answer','') = '' then
            v_errors := v_errors || jsonb_build_object('code','malformed_faq',
              'detail','An entry is missing its question or its answer.');
            exit;
          end if;
        end loop;
      elsif i.content_type = 'features' then
        for v_element in select * from jsonb_array_elements(i.content_json) loop
          if coalesce(v_element ->> 'text','') = '' then
            v_errors := v_errors || jsonb_build_object('code','malformed_feature',
              'detail','A feature has no text.');
            exit;
          end if;
          -- 11/38. A feature with no stated source is treated as a suggestion,
          -- never as verified product data.
          if coalesce(v_element ->> 'source','') not in ('PRODUCT_DATA','MANUAL','AI_SUGGESTION') then
            v_warnings := v_warnings || jsonb_build_object('code','unsourced_feature',
              'detail','A feature carries no source and is being treated as an AI suggestion.');
          end if;
        end loop;
      elsif i.content_type = 'use_cases' then
        for v_element in select * from jsonb_array_elements(i.content_json) loop
          if coalesce(v_element ->> 'title','') = '' then
            v_errors := v_errors || jsonb_build_object('code','malformed_use_case',
              'detail','A use case has no title.');
            exit;
          end if;
        end loop;
      end if;
    end if;
    -- The structured blocks are scanned as their flattened text, so a legal
    -- claim hidden inside an FAQ answer is caught exactly as one in a
    -- paragraph would be.
    if jsonb_typeof(i.content_json) = 'array' then
      select coalesce(string_agg(t.v, ' '), '') into v_text
        from jsonb_array_elements(i.content_json) e,
             lateral (select case
                        when jsonb_typeof(e.value) = 'string' then e.value #>> '{}'
                        when jsonb_typeof(e.value) = 'object' then
                          (select string_agg(x.value, ' ') from jsonb_each_text(e.value) x)
                        else e.value::text end as v) t;
    else
      v_text := coalesce(i.content_json::text, '');
    end if;
  end if;

  -- 35. Brand voice: a prohibited phrase is a hard failure, not a suggestion.
  for v_phrase in select jsonb_array_elements_text(s.brand_voice -> 'prohibited_phrases') loop
    if v_text ilike '%' || v_phrase || '%' then
      v_errors := v_errors || jsonb_build_object('code','prohibited_phrase',
        'detail', format('Contains the prohibited phrase "%s".', v_phrase));
    end if;
  end loop;

  -- 20. The legal scan.
  v_legal := public.mm_ai_legal_scan(v_text);
  if jsonb_array_length(v_legal) > 0 then
    v_blocked := exists (select 1 from jsonb_array_elements(v_legal) f where f ->> 'action' = 'block');
    v_review  := not v_blocked;
  end if;

  -- 31. Duplicate standing, for the prose types only.
  if i.content_type in ('summary','short_description','long_description') then
    v_dup := public.mm_ai_duplicate_check(i.product_id, coalesce(i.content,''));
  else
    v_dup := jsonb_build_object('state','UNCHECKED','score',null,'product',null);
  end if;
  if v_dup ->> 'state' = 'DUPLICATE' then
    v_errors := v_errors || jsonb_build_object('code','duplicate',
      'detail', format('Reads as a duplicate of "%s" (similarity %s).',
                       coalesce(v_dup ->> 'product_name','another product'), v_dup ->> 'score'));
  elsif v_dup ->> 'state' = 'HIGH_SIMILARITY' then
    v_warnings := v_warnings || jsonb_build_object('code','high_similarity',
      'detail', format('Similar to "%s" (similarity %s).',
                       coalesce(v_dup ->> 'product_name','another product'), v_dup ->> 'score'));
  end if;

  -- 53. Measured quantities, and each one is a measurement of the text or of
  -- the record — never a model's opinion about whether the copy is true.
  -- Grounding is the share of the fact fields that the product record actually
  -- supplied when this was generated: copy written from eight facts is better
  -- grounded than copy written from two, and that is all the number says.
  select case when coalesce(array_length(g.context_fields, 1), 0)
                 + coalesce(array_length(g.missing_fields, 1), 0) = 0
              then null
              else round(coalesce(array_length(g.context_fields, 1), 0)::numeric
                   / (coalesce(array_length(g.context_fields, 1), 0)
                      + coalesce(array_length(g.missing_fields, 1), 0)), 2)
         end
    into v_grounding
    from public.ai_content_generations g
   where g.product_id = i.product_id and g.status = 'SUCCEEDED'
   order by g.created_at desc limit 1;

  v_completeness := case when jsonb_array_length(v_errors) > 0 then 0.4
                         when jsonb_array_length(v_warnings) > 0 then 0.75
                         else 1.0 end;

  update public.ai_content_items
     set validation = jsonb_build_object(
           'checked_at', now(),
           'errors', v_errors,
           'warnings', v_warnings,
           'length', v_len,
           'entries', v_count,
           'scores', jsonb_build_object(
             'label','AI evaluation, not an independent verification',
             'completeness', v_completeness,
             'grounding', v_grounding,
             'duplicate_risk', coalesce((v_dup ->> 'score')::numeric, 0),
             'legal_risk', case when v_blocked then 1 when v_review then 0.5 else 0 end)),
         validation_state = case when jsonb_array_length(v_errors) > 0 then 'FAILED' else 'PASSED' end,
         legal_findings = v_legal,
         legal_state = case
           -- A new blocking finding always wins, whatever was decided before.
           when v_blocked then 'BLOCKED'
           when v_review then 'REVIEW_REQUIRED'
           -- A decision a reviewer already made about this text stands.
           -- Re-validation used to overturn it, so content could be cleared and
           -- then refused approval a moment later for want of the very
           -- clearance it had just been given. Every path that changes the text
           -- clears legal_reviewed_at, so this can only preserve a decision
           -- about the text actually in front of the reviewer.
           when i.legal_reviewed_at is not null and i.legal_state = 'CLEARED' then 'CLEARED'
           when i.content_type = any (s.legal_review_types) then 'REVIEW_REQUIRED'
           else 'CLEARED' end,
         duplicate_state = coalesce(v_dup ->> 'state', 'UNCHECKED'),
         duplicate_score = (v_dup ->> 'score')::numeric,
         duplicate_of = nullif(v_dup ->> 'product','')::uuid
   where id = p_item;

  return jsonb_build_object(
    'ok', jsonb_array_length(v_errors) = 0,
    'errors', v_errors,
    'warnings', v_warnings,
    'legal', v_legal,
    'legal_blocked', v_blocked,
    'duplicate', v_dup);
end;
$$;

revoke all on function public.mm_ai_validate(uuid) from public, anon;
grant execute on function public.mm_ai_validate(uuid) to authenticated, service_role;
