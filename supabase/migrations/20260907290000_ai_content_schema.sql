-- AI Content Generator — schema.
--
-- What was checked before this was written, because it decides what the module
-- can honestly claim.
--
-- There is no usable AI credential on this system. api_keys holds 15 rows and
-- not one carries a secret of plausible length; no provider environment
-- variable is set on the server. So generation is built for real and reports
-- AI_PROVIDER_NOT_CONFIGURED until a credential exists. Nothing is simulated.
--
-- The provider registry already exists and belongs to the AI API Manager
-- (ai_providers, ai_models, api_keys). This module reads it rather than keeping
-- a second list of providers or a second copy of a key. Two additive columns
-- are added there so a provider can say which wire protocol it speaks and which
-- server-side environment variable carries its credential — the same pattern
-- already used by security_provider_configs and demo_provider_configs.
--
-- The product facts are real and uneven: of 5,533 products, 3,701 carry a
-- feature list, 3,660 a target audience, 2,828 a description — but exactly one
-- carries benefits, modules or integrations. That unevenness is the reason for
-- section 25: where a fact is absent the model is required to say so rather
-- than invent it, and the context builder records which fields were available.
--
-- Where a canonical consumer already exists, publishing writes into it instead
-- of creating a rival store: a short description into
-- marketplace_products.description (which the product page's server-rendered
-- head already uses), an SEO description into seo_pages (which the SEO Manager
-- owns and the page reads), keywords into marketplace_products.search_keywords,
-- an FAQ into faqs. Long-form copy has no existing consumer, so it is served
-- from this module's own published rows.

/* ---------------------------------------- 51/52. provider binding (additive) */

alter table public.ai_providers add column if not exists api_kind text;
alter table public.ai_providers add column if not exists credential_env text;
alter table public.ai_providers add column if not exists content_generation_enabled boolean not null default false;

-- Which wire protocol each provider speaks, and the server-side variable that
-- would carry its key. No credential value is stored here or anywhere else.
update public.ai_providers set api_kind = 'openai_compatible', credential_env = 'OPENAI_API_KEY',
       content_generation_enabled = true where slug = 'openai';
update public.ai_providers set api_kind = 'anthropic', credential_env = 'ANTHROPIC_API_KEY',
       content_generation_enabled = true where slug = 'anthropic';
update public.ai_providers set api_kind = 'openai_compatible', credential_env = 'GOOGLE_AI_API_KEY',
       content_generation_enabled = true where slug = 'google-ai';
-- Lovable was removed from this project deliberately and is not a candidate.
update public.ai_providers set api_kind = 'openai_compatible', credential_env = null,
       content_generation_enabled = false where slug = 'lovable-ai';

/* -------------------------------------------------- 4/19/35/37. settings */

create table if not exists public.ai_content_settings (
  id boolean primary key default true check (id),

  -- 4. Which blocks may be generated at all. Every one is independently
  -- switchable and the switch is honoured by the generator, not just drawn.
  blocks jsonb not null default jsonb_build_object(
    'summary', true, 'short_description', true, 'long_description', true,
    'seo_description', true, 'meta_keywords', true, 'faq', true,
    'features', true, 'benefits', true, 'use_cases', true),

  -- 6/30. Length rules, enforced by validation before anything can be approved.
  limits jsonb not null default jsonb_build_object(
    'summary', jsonb_build_object('min', 60, 'max', 320),
    'short_description', jsonb_build_object('min', 80, 'max', 300),
    'long_description', jsonb_build_object('min', 400, 'max', 6000),
    'seo_description', jsonb_build_object('min', 70, 'max', 160),
    'meta_keywords', jsonb_build_object('min', 3, 'max', 15),
    'faq', jsonb_build_object('min', 3, 'max', 12),
    'features', jsonb_build_object('min', 3, 'max', 20),
    'benefits', jsonb_build_object('min', 3, 'max', 12),
    'use_cases', jsonb_build_object('min', 2, 'max', 10)),

  -- 19. Governance. The default is the safe one.
  publish_policy text not null default 'MANUAL_APPROVAL'
    check (publish_policy in ('MANUAL_APPROVAL','AUTO_PUBLISH','ROLE_BASED_APPROVAL','LEGAL_REVIEW_REQUIRED')),
  -- 20. Content types that always take a legal review whatever the policy says.
  legal_review_types text[] not null default array['long_description','faq','benefits'],
  -- 50. Even under AUTO_PUBLISH, content the legal scan blocked never publishes
  -- itself. This is not configurable, and the column records that.
  legal_block_is_absolute boolean not null default true,

  -- 35. Brand voice. Guidance about how to write, never about what is true.
  brand_voice jsonb not null default jsonb_build_object(
    'tone', array['professional','trustworthy','concise'],
    'audience', 'business buyers in India and neighbouring markets',
    'required_terms', array['Software Vala'],
    'prohibited_phrases', array[
      'guaranteed income','guaranteed returns','100% secure','risk free','risk-free',
      'best in the world','number one in the world','cheapest in the market',
      'unlimited everything','lifetime free support','instant profit'],
    'reading_level', 'plain business English'),

  default_language text not null default 'en',
  allowed_languages text[] not null default array['en','hi'],

  -- 51. Which provider and model this module would use. Both are looked up in
  -- the AI API Manager's registry; nothing about a credential lives here.
  provider_slug text,
  model_id text,
  temperature numeric not null default 0.2 check (temperature between 0 and 2),
  max_output_tokens integer not null default 2400 check (max_output_tokens between 256 and 32000),
  request_timeout_ms integer not null default 60000 check (request_timeout_ms between 5000 and 300000),

  -- 27. A ceiling this module will not generate past in one day.
  daily_request_cap integer not null default 500 check (daily_request_cap between 0 and 100000),
  -- 28/48. How many products one bulk batch touches.
  bulk_batch_size integer not null default 10 check (bulk_batch_size between 1 and 100),

  -- 31. Above this trigram similarity a description counts as a duplicate.
  duplicate_threshold numeric not null default 0.82 check (duplicate_threshold between 0.3 and 1),
  high_similarity_threshold numeric not null default 0.65 check (high_similarity_threshold between 0.3 and 1),

  -- 31. Publishing never silently replaces copy a human already wrote.
  overwrite_existing_product_copy boolean not null default false,

  updated_by uuid,
  updated_at timestamptz not null default now()
);
insert into public.ai_content_settings (id) values (true) on conflict (id) do nothing;

-- 51. Point the module at a provider that at least exists in the registry.
update public.ai_content_settings
   set provider_slug = 'openai', model_id = 'gpt-4o-mini'
 where provider_slug is null;

/* ------------------------------------------------------------ 37. templates */

create table if not exists public.ai_content_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  -- Which kind of product this template suits. Matched against the product's
  -- own category, tags and tech stack.
  match_terms text[] not null default '{}',
  -- Structure only. A template may say "cover deployment and roles"; it may
  -- never say what the deployment is.
  structure jsonb not null default '{}'::jsonb,
  guidance text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.ai_content_templates (key, label, match_terms, structure, guidance) values
 ('saas','SaaS / Cloud Platform', array['saas','cloud','subscription','platform'],
  jsonb_build_object('long_sections', array['Overview','Key capabilities','How it works','Who it is for','Deployment and access','Benefits']),
  'Lead with the operational problem the platform removes. State deployment and access model only where the product record supplies it.'),
 ('erp','ERP / Business Suite', array['erp','accounting','inventory','finance','business suite'],
  jsonb_build_object('long_sections', array['Overview','Modules','Workflow','Roles and permissions','Reporting','Implementation']),
  'Name only the modules present in the product record. Do not claim statutory or tax compliance unless the record states it.'),
 ('pos','POS / Retail', array['pos','retail','billing','counter','restaurant'],
  jsonb_build_object('long_sections', array['Overview','Billing workflow','Inventory','Payments','Reports','Hardware and deployment']),
  'Do not claim support for a payment method, printer or tax regime the record does not list.'),
 ('crm','CRM / Sales', array['crm','sales','lead','pipeline','marketing'],
  jsonb_build_object('long_sections', array['Overview','Pipeline','Automation','Communication channels','Reporting']),
  'Only list a communication channel the record confirms.'),
 ('school','School / Education', array['school','education','student','madrasa','academy','learning','college'],
  jsonb_build_object('long_sections', array['Overview','Academic modules','Attendance and assessment','Fees','Parent communication','Reports']),
  'Never state board affiliation, accreditation or examination compliance unless the record says so.'),
 ('hospital','Hospital / Clinic', array['hospital','clinic','health','patient','medical','pharmacy','diagnostic'],
  jsonb_build_object('long_sections', array['Overview','Clinical workflow','Records','Billing and insurance','Pharmacy and inventory','Reports']),
  'Never state medical certification, regulatory clearance or clinical outcomes, and never imply a diagnostic claim.'),
 ('industry','Industry / Operations', array['manufacturing','logistics','industry','fleet','construction','agriculture','warehouse'],
  jsonb_build_object('long_sections', array['Overview','Operational modules','Workflow','Tracking','Reporting','Deployment']),
  'Describe operations in the terms the record uses. No productivity or cost-saving percentages.'),
 ('mobile','Mobile Application', array['mobile','android','ios','app','pwa'],
  jsonb_build_object('long_sections', array['Overview','Core screens','Offline behaviour','Notifications','Platforms']),
  'State a platform only where the record lists it. Do not claim store availability.'),
 ('desktop','Desktop Software', array['desktop','windows','offline','standalone'],
  jsonb_build_object('long_sections', array['Overview','Core capabilities','Local data','Reporting','System requirements']),
  'Do not invent system requirements. Say they are not published when the record has none.')
on conflict (key) do nothing;

/* -------------------------------------- 20. legal rules for the content scan */

create table if not exists public.ai_content_legal_rules (
  code text primary key,
  label text not null,
  -- A case-insensitive regular expression run against generated text.
  pattern text not null,
  category text not null check (category in
    ('income_claim','guarantee','certification','compliance','copyright','trademark','prohibited_marketing','medical','superlative')),
  severity text not null default 'high' check (severity in ('low','medium','high','critical')),
  action text not null default 'review' check (action in ('review','block')),
  note text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.ai_content_legal_rules (code, label, pattern, category, severity, action, note) values
 ('income_guarantee','Guaranteed income or return',
  '(guarantee[a-z]*|assured|promis[a-z]*)\s+(income|return|profit|roi|revenue|earning)',
  'income_claim','critical','block','A guaranteed financial outcome cannot be substantiated and is a consumer-law exposure.'),
 ('roi_number','Numeric ROI or revenue promise',
  '(increase|boost|grow|save)\s+(your\s+)?(revenue|sales|profit|income|cost)[^.]{0,40}\d+\s*%',
  'income_claim','high','block','A quantified financial outcome requires evidence this catalogue does not hold.'),
 ('money_back','Unconditional money-back promise',
  '(100%|unconditional|no questions asked)\s+(money[- ]back|refund)',
  'guarantee','high','block','Refund terms are set by policy, not by product copy.'),
 ('absolute_security','Absolute security claim',
  '(100%\s*(secure|safe)|unhackable|impenetrable|zero\s+risk|risk[- ]free)',
  'guarantee','critical','block','No system is absolutely secure, so the claim is indefensible.'),
 ('uptime_promise','Uptime promise',
  '(guaranteed|assured)\s+\d+(\.\d+)?\s*%\s*uptime',
  'guarantee','high','block','An availability guarantee is a contractual commitment, not marketing copy.'),
 ('certification','Certification claim',
  '(iso\s*\d{4,5}|soc\s*2|pci[- ]dss|hipaa|gdpr)\s*(certified|compliant|accredited)',
  'certification','critical','block','A certification claim must come from the certificate, never from a model.'),
 ('gov_approval','Government or regulator approval',
  '(government|govt|rbi|sebi|irdai|fda|ce)\s+(approved|certified|authoris?zed|licenced|licensed)',
  'compliance','critical','block','Regulatory approval cannot be asserted from a product record.'),
 ('tax_compliance','Statutory or tax compliance claim',
  '(gst|vat|tds|e[- ]?invoic\w*|income tax)\s+(compliant|certified|approved|ready)',
  'compliance','high','review','Allowed only where the product record itself states the capability.'),
 ('medical_claim','Clinical or diagnostic claim',
  '(diagnos\w+|treat\w+|cure[sd]?|clinically\s+proven)',
  'medical','critical','block','Health software copy must not imply clinical capability.'),
 ('trademark','Third-party trademark used as an endorsement',
  '(official|authoris?zed)\s+(partner|reseller|distributor)\s+of\s+[A-Z]',
  'trademark','high','block','A partnership claim needs a signed agreement on file.'),
 ('copyright_lift','Copyright notice carried into generated copy',
  '(all rights reserved|copyright\s*(\(c\)|©)\s*\d{4})',
  'copyright','medium','review','Generated copy should not carry another party''s notice.'),
 ('world_superlative','Unqualified market-position superlative',
  '(world''?s|india''?s)\s+(number\s*one|no\.?\s*1|best|leading|largest)',
  'superlative','medium','review','A market-position claim needs a source.'),
 ('cheapest','Price superlative',
  '(cheapest|lowest price|unbeatable price)',
  'prohibited_marketing','medium','review','Price claims change with the price list and cannot be fixed in copy.'),
 ('free_forever','Perpetual free commitment',
  '(free\s+forever|lifetime\s+free\s+(support|updates?))',
  'prohibited_marketing','high','block','A perpetual commitment binds the business indefinitely.')
on conflict (code) do nothing;

/* ------------------------------------------------------ 17/40. content items */

create table if not exists public.ai_content_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  content_type text not null check (content_type in
    ('summary','short_description','long_description','seo_description','meta_keywords',
     'faq','features','benefits','use_cases')),
  language text not null default 'en',

  -- 17. The real lifecycle. Every value here is reached through a transition
  -- that checks its precondition; nothing writes a status directly.
  status text not null default 'DRAFT' check (status in
    ('DRAFT','GENERATING','GENERATED','IN_REVIEW','APPROVED','PUBLISHED','REJECTED','FAILED','ARCHIVED')),

  -- The working copy. Prose in content, structured blocks in content_json.
  content text,
  content_json jsonb,

  -- 33/38. The model's own output, kept beside any human edit for ever, so the
  -- two can be compared and so an edit never destroys the original.
  ai_original text,
  ai_original_json jsonb,
  human_edited boolean not null default false,
  edited_by uuid,
  edited_at timestamptz,

  -- 38. What this content actually is. AI output is never labelled verified.
  provenance text not null default 'AI_GENERATED' check (provenance in
    ('VERIFIED','AI_GENERATED','HUMAN_EDITED','LEGAL_APPROVED','PUBLISHED')),

  current_version integer not null default 0,

  -- 45. The fingerprint of the product facts this content was written from.
  -- When the product changes the fingerprint stops matching and the content is
  -- marked stale rather than left quietly live.
  context_hash text,
  stale boolean not null default false,
  stale_reason text,
  stale_since timestamptz,

  -- 30/53. The last validation result, and whether it allows approval.
  validation_state text not null default 'PENDING'
    check (validation_state in ('PENDING','PASSED','FAILED')),
  validation jsonb not null default '{}'::jsonb,

  -- 20. The legal scan verdict.
  legal_state text not null default 'NOT_REQUIRED'
    check (legal_state in ('NOT_REQUIRED','PENDING','CLEARED','REVIEW_REQUIRED','BLOCKED')),
  legal_findings jsonb not null default '[]'::jsonb,
  legal_reviewed_by uuid,
  legal_reviewed_at timestamptz,

  -- 31. Duplicate standing against the rest of the catalogue.
  duplicate_state text not null default 'UNCHECKED'
    check (duplicate_state in ('UNCHECKED','UNIQUE','HIGH_SIMILARITY','DUPLICATE')),
  duplicate_of uuid references public.marketplace_products(id) on delete set null,
  duplicate_score numeric,

  rejection_code text,
  rejection_reason text,

  -- 55. What publishing actually managed to do. A partial publish says so.
  publish_targets jsonb not null default '{}'::jsonb,
  publish_state text not null default 'NONE'
    check (publish_state in ('NONE','PARTIAL','COMPLETE','FAILED')),

  generated_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  published_at timestamptz,
  published_by uuid,
  archived_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One current row per product, content type and language. Every earlier state
  -- lives in ai_content_versions.
  unique (product_id, content_type, language)
);

create index if not exists ai_content_items_product_idx on public.ai_content_items (product_id);
create index if not exists ai_content_items_status_idx on public.ai_content_items (status, content_type);
create index if not exists ai_content_items_review_idx on public.ai_content_items (status)
  where status in ('IN_REVIEW','GENERATED');
create index if not exists ai_content_items_stale_idx on public.ai_content_items (stale) where stale;
create index if not exists ai_content_items_language_idx on public.ai_content_items (language);
create index if not exists ai_content_items_updated_idx on public.ai_content_items (updated_at desc);
create index if not exists ai_content_items_legal_idx on public.ai_content_items (legal_state)
  where legal_state in ('REVIEW_REQUIRED','BLOCKED');

/* --------------------------------------------------------- 15/32. versions */

create table if not exists public.ai_content_versions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.ai_content_items(id) on delete cascade,
  version integer not null,
  kind text not null check (kind in
    ('AI_DRAFT','HUMAN_EDIT','REGENERATED','SUBMITTED','APPROVED','PUBLISHED','REJECTED','ROLLBACK','ARCHIVED','UNPUBLISHED')),
  content text,
  content_json jsonb,
  -- The state this version replaced, so a rollback has something to restore.
  previous_content text,
  previous_content_json jsonb,
  status_before text,
  status_after text,
  generation_id uuid,
  context_hash text,
  actor uuid,
  actor_role text,
  note text,
  created_at timestamptz not null default now(),
  unique (item_id, version)
);
create index if not exists ai_content_versions_item_idx on public.ai_content_versions (item_id, version desc);

/* --------------------------------------------------- 26. generation history */

create table if not exists public.ai_content_generations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  content_types text[] not null,
  language text not null default 'en',

  provider_slug text,
  model_id text,
  api_kind text,
  -- 49. The prompt body is never copied here. Only which prompt was used.
  prompt_key text,
  prompt_version integer,
  prompt_hash text,
  template_key text,

  -- 25. The fingerprint of the facts the model was given, and which of them
  -- were actually present.
  context_hash text,
  context_fields text[],
  missing_fields text[],

  status text not null default 'QUEUED' check (status in
    ('QUEUED','RUNNING','SUCCEEDED','FAILED','REJECTED_OUTPUT','NOT_CONFIGURED','CANCELLED')),
  -- 43. Why it failed, in a form the console can act on.
  error_code text,
  error_detail text,
  http_status integer,

  -- 27. Usage as the provider reported it. Never invented: when the provider
  -- reports none, usage_available stays false and the console says UNAVAILABLE.
  usage_available boolean not null default false,
  tokens_in integer,
  tokens_out integer,
  cost_usd numeric,
  cost_available boolean not null default false,
  latency_ms integer,

  raw_output jsonb,
  parsed_output jsonb,
  blocks_returned text[],

  job_id uuid,
  actor uuid,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists ai_content_generations_product_idx on public.ai_content_generations (product_id, created_at desc);
create index if not exists ai_content_generations_status_idx on public.ai_content_generations (status, created_at desc);
create index if not exists ai_content_generations_job_idx on public.ai_content_generations (job_id);
create index if not exists ai_content_generations_day_idx on public.ai_content_generations (created_at desc);

/* ------------------------------------------------------ 34/54. review record */

create table if not exists public.ai_content_reviews (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.ai_content_items(id) on delete cascade,
  version integer,
  decision text not null check (decision in
    ('SUBMITTED','APPROVED','REJECTED','CHANGES_REQUESTED','LEGAL_BLOCKED','LEGAL_CLEARED','PUBLISHED','UNPUBLISHED')),
  -- 34. A rejection carries a reason from a fixed list plus free text.
  reason_code text check (reason_code in
    ('incorrect_information','unsupported_claim','poor_quality','legal_concern',
     'duplicate','seo_issue','brand_violation','out_of_date','other')),
  reason text,
  reviewer uuid,
  reviewer_role text,
  created_at timestamptz not null default now()
);
create index if not exists ai_content_reviews_item_idx on public.ai_content_reviews (item_id, created_at desc);
create index if not exists ai_content_reviews_decision_idx on public.ai_content_reviews (decision, created_at desc);

/* ---------------------------------------------------- 28/29. bulk generation */

create table if not exists public.ai_content_jobs (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in
    ('selected','category','missing_description','missing_seo','rejected_content','stale','all_eligible')),
  filters jsonb not null default '{}'::jsonb,
  content_types text[] not null,
  language text not null default 'en',
  status text not null default 'QUEUED' check (status in
    ('QUEUED','PROCESSING','COMPLETED','FAILED','CANCELLED')),
  total integer not null default 0,
  completed integer not null default 0,
  failed integer not null default 0,
  skipped integer not null default 0,
  needs_review integer not null default 0,
  last_error text,
  created_by uuid,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index if not exists ai_content_jobs_status_idx on public.ai_content_jobs (status, created_at desc);

create table if not exists public.ai_content_job_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.ai_content_jobs(id) on delete cascade,
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  status text not null default 'QUEUED' check (status in
    ('QUEUED','PROCESSING','COMPLETED','FAILED','SKIPPED','NEEDS_REVIEW')),
  -- 29. A successful item is never generated twice; a failed one may be retried.
  attempts integer not null default 0,
  generation_id uuid references public.ai_content_generations(id) on delete set null,
  skip_reason text,
  error text,
  updated_at timestamptz not null default now(),
  unique (job_id, product_id)
);
create index if not exists ai_content_job_items_job_idx on public.ai_content_job_items (job_id, status);

/* --------------------------------------------------------------- 27. usage */

create table if not exists public.ai_content_usage (
  usage_date date not null,
  provider_slug text not null,
  model_id text not null,
  requests integer not null default 0,
  succeeded integer not null default 0,
  failed integer not null default 0,
  not_configured integer not null default 0,
  tokens_in bigint not null default 0,
  tokens_out bigint not null default 0,
  cost_usd numeric not null default 0,
  -- False whenever the provider gave no figures. The console prints
  -- UNAVAILABLE rather than a number nobody measured.
  usage_available boolean not null default false,
  cost_available boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (usage_date, provider_slug, model_id)
);

/* --------------------------------------------------------------- 39. audit */

-- The marketplace already has one append-only audit table, and splitting the
-- trail in two would make neither half trustworthy. ai_content_audit_logs is
-- therefore this module's window onto it, not a second store.
create or replace view public.ai_content_audit_logs as
  select id, created_at, action, entity_type, entity_id, actor, actor_id, actor_role,
         before_state, after_state, reason, metadata
    from public.marketplace_audit_logs
   where module = 'marketplace_manager'
     and entity_type like 'ai_content%';

/* ------------------------------------------------------------------ 41. RLS */

do $$
declare t text;
begin
  foreach t in array array['ai_content_settings','ai_content_templates','ai_content_legal_rules',
                           'ai_content_items','ai_content_versions','ai_content_generations',
                           'ai_content_reviews','ai_content_jobs','ai_content_job_items',
                           'ai_content_usage'] loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', t||'_operator', t);
    execute format($f$create policy %I on public.%I for all to authenticated
                      using (public.mm_is_operator()) with check (public.mm_is_operator())$f$,
                   t||'_operator', t);

    -- 41. No anonymous write anywhere in this module, on any command.
    execute format('drop policy if exists %I on public.%I', t||'_anon_insert', t);
    execute format($f$create policy %I on public.%I as restrictive for insert to anon
                      with check (false)$f$, t||'_anon_insert', t);
    execute format('drop policy if exists %I on public.%I', t||'_anon_update', t);
    execute format($f$create policy %I on public.%I as restrictive for update to anon
                      using (false) with check (false)$f$, t||'_anon_update', t);
    execute format('drop policy if exists %I on public.%I', t||'_anon_delete', t);
    execute format($f$create policy %I on public.%I as restrictive for delete to anon
                      using (false)$f$, t||'_anon_delete', t);
  end loop;
end;
$$;

-- 38/41. Published content for a visible product is public, because the
-- storefront has to render it. Nothing else in this module is readable without
-- an operator role: not a draft, not a generation record, not the usage figures.
drop policy if exists ai_content_items_public on public.ai_content_items;
create policy ai_content_items_public on public.ai_content_items
  for select to anon, authenticated
  using (status = 'PUBLISHED'
         and exists (select 1 from public.marketplace_products p
                      where p.id = ai_content_items.product_id
                        and p.visible
                        and p.deleted_at is null));

-- A seller may read the content standing against their own product.
drop policy if exists ai_content_items_own on public.ai_content_items;
create policy ai_content_items_own on public.ai_content_items
  for select to authenticated
  using (public.mm_is_operator()
         or exists (select 1 from public.marketplace_products p
                     where p.id = ai_content_items.product_id
                       and public.marketplace_is_seller_member(p.seller_id)));

-- 32/39/50. History is the record. Nobody edits or deletes one, operator
-- included, so a version trail cannot be rewritten after the fact.
do $$
declare t text;
begin
  foreach t in array array['ai_content_versions','ai_content_reviews','ai_content_generations'] loop
    execute format('drop policy if exists %I on public.%I', t||'_no_update', t);
    execute format($f$create policy %I on public.%I as restrictive for update to public
                      using (false) with check (false)$f$, t||'_no_update', t);
    execute format('drop policy if exists %I on public.%I', t||'_no_delete', t);
    execute format($f$create policy %I on public.%I as restrictive for delete to public
                      using (false)$f$, t||'_no_delete', t);
  end loop;
end;
$$;

grant select on public.ai_content_items to anon, authenticated;

/* ---------------------------------------------------------- housekeeping */

create or replace function public.ai_content_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ai_content_items_touch on public.ai_content_items;
create trigger ai_content_items_touch before update on public.ai_content_items
  for each row execute function public.ai_content_touch();

drop trigger if exists ai_content_settings_touch on public.ai_content_settings;
create trigger ai_content_settings_touch before update on public.ai_content_settings
  for each row execute function public.ai_content_touch();
