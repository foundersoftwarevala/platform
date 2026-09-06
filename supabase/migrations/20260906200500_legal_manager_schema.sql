-- Legal Manager: the source tables, plus what a legal record actually needs.
--
-- Every table and column from the source repository is carried over unchanged,
-- because the fifteen screens read them by name. What is added is the part the
-- source has no room for, and on a legal module it is the part that matters.
--
-- Version control (section 12). The source keeps a single `version` string on a
-- policy row and overwrites it. Legal history cannot be overwritten: a published
-- agreement that somebody accepted has to remain readable exactly as it was on
-- the day they accepted it, or the acceptance means nothing. Versions are now
-- their own rows, and the text of each is frozen.
--
-- Acceptance (section 13). There is no acceptance table at all in the source, so
-- nothing records that a person agreed to anything. Acceptances are immutable
-- rows carrying the account, the exact version, the hash of the text they saw,
-- and how they accepted it.
--
-- Evidence (sections 16, 17, 19, 35). The source stores a registration number
-- as a plain string with nothing behind it. Section 35 is emphatic: never invent
-- statutes, cases, regulations, registration numbers or authorities, and mark
-- anything unverified as unverified. Every claim of that kind now carries its
-- own verification state, defaulting to unverified, with somewhere to record the
-- source it came from.
--
-- Nothing is seeded except jurisdictions and policy types, which are
-- configuration. The source seeds policies with compliance scores and trademark
-- assets with registration numbers; inventing a registration number is exactly
-- what section 35 forbids.

-- --------------------------------------------------------- source tables ---
create table if not exists public.legal_records (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  ref_code text,
  name text not null,
  record_type text,
  status text not null default 'active',
  details jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legal_policies (
  id uuid primary key default gen_random_uuid(),
  ref_code text not null,
  name text not null,
  policy_type text not null,
  status text not null default 'draft',
  version text not null,
  last_updated date not null default current_date,
  updated_by text not null,
  compliance_score integer not null default 0,
  content text,
  -- Whether that score came from a person or a model, and never presented as
  -- fact when it is the latter (section 21).
  compliance_source text not null default 'unassessed',
  compliance_assessed_at timestamptz,
  compliance_assessed_by uuid,
  owner_user_id uuid,
  effective_from date,
  review_due date,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.legal_policies drop constraint if exists legal_policies_compliance_source_check;
alter table public.legal_policies add constraint legal_policies_compliance_source_check
  check (compliance_source in ('unassessed','ai_assessment','human_review'));

create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  ref_code text not null,
  name text not null,
  doc_type text not null,
  uploaded_at date not null default current_date,
  uploaded_by text not null default 'LM-A1B2',
  uploaded_by_user_id uuid,
  size_label text not null default '0 KB',
  size_bytes bigint not null default 0,
  encrypted boolean not null default true,
  access_level text not null default 'legal_only',
  expiry_date date,
  storage_path text,
  checksum text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legal_alerts (
  id uuid primary key default gen_random_uuid(),
  ref_code text not null,
  alert_type text not null,
  severity text not null,
  title text not null,
  description text not null,
  detected_in text not null,
  confidence integer not null default 0,
  detected_at timestamptz not null default now(),
  status text not null default 'pending',
  ai_suggestion text not null default '',
  -- Section 23: an alert is advisory until a person decides on it.
  reviewed_by uuid,
  reviewed_at timestamptz,
  decision text,
  decision_note text,
  ai_request_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legal_violations (
  id uuid primary key default gen_random_uuid(),
  ref_code text not null,
  violator_type text not null,
  violator_id text not null,
  violator_user_id uuid,
  violation_type text not null,
  severity text not null,
  description text not null,
  evidence text[] not null default '{}',
  detected_at timestamptz not null default now(),
  status text not null default 'pending',
  previous_violations integer not null default 0,
  action_notes text,
  assigned_to uuid,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legal_trademark_assets (
  id uuid primary key default gen_random_uuid(),
  ref_code text not null,
  name text not null,
  asset_type text not null,
  registration_number text not null,
  status text not null default 'pending',
  expiry_date text not null default '-',
  violations integer not null default 0,
  -- Section 35: a registration number is a claim about a public register. It
  -- stays unverified until somebody checks it against that register.
  registration_verified boolean not null default false,
  registration_source text,
  registration_checked_at timestamptz,
  registration_checked_by uuid,
  jurisdiction text,
  owner_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legal_misuse_alerts (
  id uuid primary key default gen_random_uuid(),
  ref_code text not null,
  asset_ref text not null,
  asset_name text not null,
  detected_in text not null,
  severity text not null,
  status text not null default 'open',
  description text,
  evidence text[] not null default '{}',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legal_logs (
  id uuid primary key default gen_random_uuid(),
  ref_code text,
  actor text not null default 'system',
  actor_user_id uuid,
  actor_role text not null default 'system',
  action text not null,
  entity_type text,
  entity_id text,
  old_state jsonb,
  new_state jsonb,
  reason text,
  severity text not null default 'info',
  result text not null default 'success',
  created_at timestamptz not null default now()
);

-- ------------------------------------------------- agreements and versions --
-- Section 12: a version is a row, not a string, and its text is frozen.
create table if not exists public.legal_agreements (
  id uuid primary key default gen_random_uuid(),
  ref_code text not null unique,
  name text not null,
  agreement_type text not null,
  scope text not null default 'general',
  product_id uuid,
  applies_to_role text,
  country_code text,
  jurisdiction text,
  language_code text not null default 'en',
  language_detected text,
  language_confirmed_by uuid,
  requires_acceptance boolean not null default true,
  gate_on_login boolean not null default false,
  status text not null default 'draft',
  current_version_id uuid,
  owner_user_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legal_agreement_versions (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.legal_agreements(id) on delete cascade,
  version text not null,
  status text not null default 'draft',
  body text not null,
  -- What the person actually saw, fixed at publication so an acceptance can be
  -- checked against it later.
  body_sha256 text,
  change_summary text,
  reason text,
  ai_generated boolean not null default false,
  ai_request_id uuid,
  created_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  published_by uuid,
  published_at timestamptz,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agreement_id, version)
);

alter table public.legal_agreement_versions drop constraint if exists legal_agreement_versions_status_check;
alter table public.legal_agreement_versions add constraint legal_agreement_versions_status_check
  check (status in ('draft','review','pending_approval','approved','published','superseded','archived'));

-- Section 13: an acceptance is a fact about a moment. It is never edited.
create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.legal_agreements(id) on delete restrict,
  version_id uuid not null references public.legal_agreement_versions(id) on delete restrict,
  version_label text not null,
  body_sha256 text,
  user_id uuid not null,
  user_email text,
  user_role text,
  decision text not null default 'accepted',
  method text not null default 'login_gate',
  ip_address text,
  user_agent text,
  session_reference text,
  scrolled_to_end boolean not null default false,
  accepted_at timestamptz not null default now(),
  unique (version_id, user_id, decision)
);

alter table public.legal_acceptances drop constraint if exists legal_acceptances_decision_check;
alter table public.legal_acceptances add constraint legal_acceptances_decision_check
  check (decision in ('accepted','rejected'));

-- ------------------------------------------------------------ jurisdiction --
-- Section 10 and 19: legal rules are data, never conditionals in a component.
create table if not exists public.legal_jurisdictions (
  id uuid primary key default gen_random_uuid(),
  country_code text not null unique,
  country_name text not null,
  default_language text not null default 'en',
  electronic_acceptance_recognised boolean,
  notes text,
  source_reference text,
  verified boolean not null default false,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.legal_regulations (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  country_code text,
  applies_to text,
  status text not null default 'under_review',
  -- Section 35 again: a regulation reference without a source is a claim
  -- nobody can check.
  source_reference text,
  source_url text,
  published_on date,
  retrieved_on date,
  relevant_section text,
  evidence_excerpt text,
  verified boolean not null default false,
  reviewed_by uuid,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (code, country_code)
);

-- --------------------------------------------------- product legal binding --
create table if not exists public.legal_product_bindings (
  id uuid primary key default gen_random_uuid(),
  product_id uuid,
  product_name text,
  agreement_id uuid references public.legal_agreements(id) on delete cascade,
  version_id uuid references public.legal_agreement_versions(id) on delete set null,
  country_code text,
  user_type text,
  acceptance_required boolean not null default true,
  status text not null default 'active',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------- AI requests --
-- Section 27: every AI call is a record, so an assessment can be traced back to
-- the run that produced it.
create table if not exists public.legal_ai_requests (
  id uuid primary key default gen_random_uuid(),
  ai_type text not null,
  module text not null default 'legal_manager',
  requested_by uuid,
  jurisdiction text,
  input_reference text,
  provider text,
  model text,
  status text not null default 'running',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  latency_ms integer,
  error text,
  output text,
  review_status text not null default 'unreviewed',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.legal_ai_requests drop constraint if exists legal_ai_requests_type_check;
alter table public.legal_ai_requests add constraint legal_ai_requests_type_check
  check (ai_type in ('legal_chat','contract_draft','compliance_check','risk_analysis',
                     'clause_suggest','nda_review','dispute_guide'));

alter table public.legal_ai_requests drop constraint if exists legal_ai_requests_review_check;
alter table public.legal_ai_requests add constraint legal_ai_requests_review_check
  check (review_status in ('unreviewed','accepted','rejected','superseded'));

-- ---------------------------------------------------------------- indexes ---
create index if not exists legal_records_category_idx      on public.legal_records(category, position);
create index if not exists legal_policies_status_idx       on public.legal_policies(status);
create index if not exists legal_documents_type_idx        on public.legal_documents(doc_type);
create index if not exists legal_alerts_status_idx         on public.legal_alerts(status, severity);
create index if not exists legal_violations_status_idx     on public.legal_violations(status, severity);
create index if not exists legal_violations_entity_idx     on public.legal_violations(violator_type, violator_id);
create index if not exists legal_logs_entity_idx           on public.legal_logs(entity_type, entity_id, created_at desc);
create index if not exists legal_agreements_status_idx     on public.legal_agreements(status);
create index if not exists legal_agreements_gate_idx       on public.legal_agreements(gate_on_login) where gate_on_login;
create index if not exists legal_versions_agreement_idx    on public.legal_agreement_versions(agreement_id, status);
create index if not exists legal_acceptances_user_idx      on public.legal_acceptances(user_id);
create index if not exists legal_acceptances_version_idx   on public.legal_acceptances(version_id);
create index if not exists legal_bindings_product_idx      on public.legal_product_bindings(product_id);
create index if not exists legal_ai_requests_type_idx      on public.legal_ai_requests(ai_type, created_at desc);

-- --------------------------------------------------------------- touching ---
create or replace function public.legal_touch_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at = now(); return new; end; $$;

do $$
declare t text;
begin
  foreach t in array array['legal_records','legal_policies','legal_documents','legal_alerts',
                           'legal_violations','legal_trademark_assets','legal_misuse_alerts',
                           'legal_agreements','legal_agreement_versions','legal_product_bindings',
                           'legal_regulations']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format('create trigger %I before update on public.%I
                    for each row execute function public.legal_touch_updated_at()', t || '_touch', t);
  end loop;
end $$;
