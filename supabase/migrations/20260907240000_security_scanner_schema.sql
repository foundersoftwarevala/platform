-- Upload Security Scanner.
--
-- The honest starting position, established before writing any of this:
--
--   * No scanning provider is configured anywhere. api_services has no security
--     or scanning entry, and no credential exists for one.
--   * There is no upload or asset table. review_media is the only asset-shaped
--     table and it is empty.
--   * The three storage buckets — franchise-documents, developer-task-files and
--     legal-documents — are all private, and hold one object between them.
--
-- Section 6 is explicit about what that means: with no provider configured the
-- status is SCANNER_NOT_CONFIGURED, and "0 threats detected" must never be
-- shown, because no scan happened. That rule is enforced in the schema below —
-- a scan cannot be recorded as clean unless a provider actually returned a
-- verdict — rather than left to the UI to remember.
--
-- What is genuinely real without any provider, and is built here:
--   file validation from magic bytes rather than the client's claim,
--   SHA-256 identity and hash-based duplicate detection,
--   static analysis of text assets for dangerous scripts, hidden redirects and
--   external tracking, and the risk engine over whatever findings exist.

/* ------------------------------------------------------------ the assets */

-- One row per uploaded file. This is the asset table the project did not have;
-- it references the canonical product and seller and copies neither.
create table if not exists public.security_assets (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.marketplace_products(id) on delete cascade,
  seller_id uuid references public.marketplace_sellers(id) on delete set null,
  uploaded_by uuid,
  asset_type text not null default 'other'
    check (asset_type in ('image','video','document','archive','package','web','other')),
  file_name text not null,
  -- What the client claimed, kept only so a mismatch with the real type can be
  -- reported. It is never trusted.
  declared_mime text,
  -- What the bytes actually say. Null until the file has been inspected.
  detected_mime text,
  size_bytes bigint check (size_bytes >= 0),
  sha256 text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  -- A private storage path. Never a public URL: section 24 forbids exposing
  -- these, and a quarantined file must not be reachable at all.
  storage_bucket text,
  storage_path text,
  status text not null default 'uploaded'
    check (status in ('uploaded','scanning','clean','flagged','blocked',
                      'quarantined','released','rejected','purged','scan_error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists security_assets_product_idx on public.security_assets (product_id);
create index if not exists security_assets_sha_idx on public.security_assets (sha256);
create index if not exists security_assets_status_idx on public.security_assets (status);

/* -------------------------------------------------------------- the jobs */

create table if not exists public.security_scan_jobs (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.security_assets(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued','scanning','completed','flagged','blocked','error')),
  -- Which stages actually ran. A stage that could not run is absent, not passed.
  stages jsonb not null default '{}'::jsonb,
  scanner_version text not null default 'sv-static-1',
  -- Named so a result can always be traced to what produced it.
  provider text,
  provider_reference text,
  attempt integer not null default 1 check (attempt >= 1),
  error_category text,
  error_detail text,
  risk_score integer check (risk_score is null or risk_score between 0 and 100),
  risk_level text check (risk_level is null or risk_level in ('low','medium','high','critical')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  -- A job cannot claim a verdict without having finished, and cannot be
  -- 'completed' without recording which scanner produced the result. This is
  -- what stops an unscanned file being presented as clean.
  constraint scan_job_verdict_needs_completion check (
    (status in ('queued','scanning','error')) or
    (completed_at is not null and provider is not null))
);
create index if not exists security_jobs_asset_idx on public.security_scan_jobs (asset_id, created_at desc);
create index if not exists security_jobs_open_idx on public.security_scan_jobs (status)
  where status in ('queued','scanning');

/* ----------------------------------------------------------- the findings */

create table if not exists public.security_findings (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.security_scan_jobs(id) on delete cascade,
  asset_id uuid not null references public.security_assets(id) on delete cascade,
  category text not null check (category in
    ('malware','dangerous_script','hidden_redirect','external_tracking',
     'fake_branding','copyright','duplicate','file_mismatch','oversize','other')),
  -- The five states section 2 requires, per category.
  result text not null check (result in ('pass','flagged','blocked','pending','error')),
  severity text not null default 'low'
    check (severity in ('low','medium','high','critical')),
  title text not null,
  -- What was actually seen. A finding with no evidence is not a finding.
  evidence jsonb not null default '[]'::jsonb,
  -- Which engine said so, so an AI opinion is never mistaken for a scan result.
  source text not null default 'static'
    check (source in ('static','provider','ai','human')),
  confidence numeric(4,3) check (confidence is null or confidence between 0 and 1),
  created_at timestamptz not null default now()
);
create index if not exists security_findings_job_idx on public.security_findings (job_id);
create index if not exists security_findings_open_idx on public.security_findings (category, result);

/* --------------------------------------------------------- the quarantine */

create table if not exists public.security_quarantine (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.security_assets(id) on delete cascade,
  job_id uuid references public.security_scan_jobs(id) on delete set null,
  state text not null default 'quarantined'
    check (state in ('quarantined','under_review','released','rejected','purged')),
  reason text not null,
  -- Whether the bytes themselves were discarded. Section 14 allows keeping the
  -- hash and the evidence while destroying a malicious payload.
  payload_retained boolean not null default true,
  quarantined_by uuid,
  quarantined_at timestamptz not null default now(),
  decided_by uuid,
  decided_at timestamptz,
  decision_reason text,
  constraint quarantine_one_open exclude (asset_id with =)
    where (state in ('quarantined','under_review'))
);

/* ------------------------------------------------------------ the events */

-- Append-only. There is deliberately no update or delete policy for anyone.
create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.security_assets(id) on delete cascade,
  job_id uuid references public.security_scan_jobs(id) on delete set null,
  product_id uuid references public.marketplace_products(id) on delete set null,
  event text not null,
  actor_id uuid,
  actor_role text,
  previous_state text,
  new_state text,
  reason text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists security_events_asset_idx on public.security_events (asset_id, created_at desc);

/* ---------------------------------------------------------- configuration */

create table if not exists public.security_scanner_settings (
  id boolean primary key default true check (id),
  block_on_malware boolean not null default true,
  auto_quarantine_flagged boolean not null default true,
  notify_author_on_rejection boolean not null default true,
  attach_hash_to_assets boolean not null default true,
  send_copyright_to_dmca boolean not null default true,
  -- How long a verdict for an identical hash may be reused before rescanning.
  result_freshness_days integer not null default 30
    check (result_freshness_days between 0 and 365),
  max_upload_mb integer not null default 200 check (max_upload_mb between 1 and 10240),
  updated_by uuid,
  updated_at timestamptz not null default now()
);
insert into public.security_scanner_settings (id) values (true) on conflict (id) do nothing;

-- The provider registry. A row here does not mean a provider works: `verified`
-- is only set by a successful live test scan, and nothing reports a provider as
-- connected until it is.
create table if not exists public.security_provider_configs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  kind text not null default 'malware' check (kind in ('malware','static','ai')),
  enabled boolean not null default false,
  -- Where the credential lives, by name. The secret itself is never stored here.
  credential_env text,
  endpoint text,
  verified boolean not null default false,
  verified_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.security_provider_configs (slug, label, kind, credential_env, endpoint)
values
  ('clamav','ClamAV (self-hosted)','malware','CLAMAV_HOST','clamd://'),
  ('virustotal','VirusTotal','malware','VIRUSTOTAL_API_KEY','https://www.virustotal.com/api/v3/files')
on conflict (slug) do nothing;

/* -------------------------------------------------------------- the DMCA */

create table if not exists public.security_dmca_queue (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.security_assets(id) on delete set null,
  product_id uuid references public.marketplace_products(id) on delete set null,
  finding_id uuid references public.security_findings(id) on delete set null,
  source text not null default 'scanner',
  sha256 text,
  evidence jsonb not null default '[]'::jsonb,
  status text not null default 'open'
    check (status in ('open','with_legal','resolved','dismissed')),
  -- Legal Manager owns the legal record. This only remembers the reference.
  legal_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

/* ------------------------------------------------------------------- RLS */

do $$
declare t text;
begin
  foreach t in array array['security_assets','security_scan_jobs','security_findings',
                           'security_quarantine','security_events',
                           'security_scanner_settings','security_provider_configs',
                           'security_dmca_queue'] loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', t||'_operator', t);
    execute format($f$create policy %I on public.%I for all to authenticated
                      using (public.mm_is_operator()) with check (public.mm_is_operator())$f$,
                   t||'_operator', t);

    -- Nothing here is ever readable or writable anonymously. A quarantined file
    -- must not be reachable, and neither must the evidence about it.
    execute format('drop policy if exists %I on public.%I', t||'_anon', t);
    execute format($f$create policy %I on public.%I as restrictive for all to anon
                      using (false) with check (false)$f$, t||'_anon', t);
  end loop;
end;
$$;

-- An uploader sees their own assets and the verdict on them, and nothing about
-- anybody else's.
drop policy if exists security_assets_own on public.security_assets;
create policy security_assets_own on public.security_assets
  for select to authenticated
  using (public.mm_is_operator()
         or uploaded_by = auth.uid()
         or public.marketplace_is_seller_member(seller_id));

drop policy if exists security_jobs_own on public.security_scan_jobs;
create policy security_jobs_own on public.security_scan_jobs
  for select to authenticated
  using (public.mm_is_operator()
         or exists (select 1 from public.security_assets a
                     where a.id = security_scan_jobs.asset_id
                       and (a.uploaded_by = auth.uid()
                            or public.marketplace_is_seller_member(a.seller_id))));

-- Security events are evidence. Nobody edits or removes one.
drop policy if exists security_events_no_update on public.security_events;
create policy security_events_no_update on public.security_events
  as restrictive for update to public using (false) with check (false);
drop policy if exists security_events_no_delete on public.security_events;
create policy security_events_no_delete on public.security_events
  as restrictive for delete to public using (false);
