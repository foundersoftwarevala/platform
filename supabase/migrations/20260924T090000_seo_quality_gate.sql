-- The SEO safety gate: what a page's content actually is, and whether it may
-- be indexed.
--
-- Two tables, both additive, both genuinely missing. Everything else the gate
-- needs already exists and is reused rather than rebuilt:
--
--   seo_audits           the run: score, pages crawled, issues found, breakdown
--   seo_issues           one row per finding, with severity and a fix
--   seo_pages            the per-URL SEO record the Manager already edits
--   seo_technical_checks named checks with a status and a count of URLs
--
-- seo_indexing_records is deliberately NOT touched. It records what a search
-- engine did with a URL - its source, crawl status, HTTP status and the date it
-- was indexed - which is an observation from outside. What this adds is the
-- opposite: the decision this platform makes about its own page before anyone
-- outside sees it. Mixing the two would leave neither readable.
--
-- The rule both tables serve is fail closed. A URL with no decision row is not
-- eligible for the sitemap, because a page nobody has checked is a page nobody
-- can vouch for.

-- ----------------------------------------------------------- fingerprints
-- What a page's content is, layer by layer.
--
-- body_masked is the layer that matters at this scale: the page with its own
-- country, category and product names replaced by placeholders. Two pages
-- whose masked hashes match differ only by those names, which is the
-- country-swap pattern - and that is true however long the pages are and
-- however different their raw text looks.
create table if not exists public.seo_fingerprints (
  id uuid primary key default gen_random_uuid(),

  url text not null,
  entity_type text not null,
  entity_id uuid,

  layer text not null,
  algorithm text not null default 'sha256+simhash64',
  -- sha256 of the normalised text: equal hashes mean identical content.
  hash text not null,
  -- 64-bit simhash as 16 hex characters, for near-duplicate distance.
  simhash text,
  token_count integer not null default 0,
  -- The opening of the normalised text, so a report reads as evidence rather
  -- than as a pair of hashes.
  sample text,

  audit_version text not null default 'v1',
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint seo_fingerprints_layer_known check (layer in (
    'url', 'title', 'h1', 'description', 'intro', 'h2_structure',
    'faq', 'features', 'entities', 'body', 'body_masked'
  )),
  constraint seo_fingerprints_one_per_layer unique (url, layer)
);

create index if not exists seo_fingerprints_hash_idx on public.seo_fingerprints (hash);
create index if not exists seo_fingerprints_layer_hash_idx on public.seo_fingerprints (layer, hash);
create index if not exists seo_fingerprints_simhash_idx on public.seo_fingerprints (simhash);
create index if not exists seo_fingerprints_entity_idx on public.seo_fingerprints (entity_type, entity_id);
create index if not exists seo_fingerprints_url_idx on public.seo_fingerprints (url);

-- ------------------------------------------------------ indexing decisions
-- One row per URL: may it be indexed, and if not, exactly why.
--
-- No page decides this for itself. The sitemap reads sitemap_eligible and
-- nothing else, so a page that fails any required check cannot reach a crawler
-- by a route that forgot to ask.
create table if not exists public.seo_indexing_decisions (
  id uuid primary key default gen_random_uuid(),

  url text not null,
  entity_type text not null,
  entity_id uuid,

  -- The state machine. Only READY_FOR_INDEX and INDEX are indexable; every
  -- other value, including the ones that mean "we do not know", is not.
  state text not null default 'UNVERIFIED',
  indexable boolean not null default false,
  sitemap_eligible boolean not null default false,

  -- Each dimension's own verdict, so a failure names its cause.
  quality_status text not null default 'UNVERIFIED',
  quality_score integer,
  fingerprint_class text not null default 'UNVERIFIED',
  canonical_status text not null default 'UNVERIFIED',
  schema_status text not null default 'UNVERIFIED',
  hreflang_status text not null default 'UNVERIFIED',
  content_status text not null default 'UNVERIFIED',
  http_status integer,

  -- The first failing required check, in words an operator can act on.
  blocking_reason text,
  -- Every check that ran, with its result. Kept whole so a decision can be
  -- re-read later without re-running the audit.
  checks jsonb not null default '[]'::jsonb,
  duplicate_of text,

  audit_version text not null default 'v1',
  evaluated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint seo_indexing_decisions_state_known check (state in (
    'READY_FOR_INDEX', 'INDEX', 'NOINDEX', 'CONTENT_NOT_READY',
    'DRAFT', 'TEST', 'ARCHIVED', 'BLOCKED', 'UNVERIFIED', 'ERROR'
  )),
  -- The fail-closed rule, enforced by the database rather than trusted to the
  -- code that writes the row: nothing outside the two indexable states may be
  -- marked indexable, and nothing that is not indexable may reach a sitemap.
  constraint seo_indexing_decisions_only_ready_indexes check (
    indexable = false or state in ('READY_FOR_INDEX', 'INDEX')
  ),
  constraint seo_indexing_decisions_sitemap_follows_index check (
    sitemap_eligible = false or indexable = true
  ),
  constraint seo_indexing_decisions_one_per_url unique (url)
);

create index if not exists seo_indexing_decisions_sitemap_idx
  on public.seo_indexing_decisions (sitemap_eligible) where sitemap_eligible;
create index if not exists seo_indexing_decisions_state_idx
  on public.seo_indexing_decisions (state);
create index if not exists seo_indexing_decisions_entity_idx
  on public.seo_indexing_decisions (entity_type, entity_id);
create index if not exists seo_indexing_decisions_evaluated_idx
  on public.seo_indexing_decisions (evaluated_at desc);
-- The sitemap pages the URLs in order, so the order is indexed with the filter.
create index if not exists seo_indexing_decisions_sitemap_url_idx
  on public.seo_indexing_decisions (url) where sitemap_eligible;

drop trigger if exists trg_seo_fingerprints_updated on public.seo_fingerprints;
create trigger trg_seo_fingerprints_updated
  before update on public.seo_fingerprints
  for each row execute function public.update_updated_at_column();

drop trigger if exists trg_seo_indexing_decisions_updated on public.seo_indexing_decisions;
create trigger trg_seo_indexing_decisions_updated
  before update on public.seo_indexing_decisions
  for each row execute function public.update_updated_at_column();

alter table public.seo_fingerprints enable row level security;
alter table public.seo_indexing_decisions enable row level security;

-- Written by the audit job and read by the operator consoles, both through the
-- service role. No policy grants a browser anything: a visitor has no business
-- reading which of this site's pages were held back, or why.
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'seo_fingerprints'
       and policyname = 'seo_fingerprints_service_role'
  ) then
    create policy seo_fingerprints_service_role on public.seo_fingerprints
      for all to service_role using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'seo_indexing_decisions'
       and policyname = 'seo_indexing_decisions_service_role'
  ) then
    create policy seo_indexing_decisions_service_role on public.seo_indexing_decisions
      for all to service_role using (true) with check (true);
  end if;
end $$;

comment on table public.seo_fingerprints is
  'Content fingerprints per URL and layer. body_masked replaces the page''s own country, category and product names, so two pages that differ only by those names share its hash.';
comment on table public.seo_indexing_decisions is
  'One decision per URL: may it be indexed, may it enter the sitemap, and if not, exactly why. A URL with no row here is not eligible for anything.';
comment on column public.seo_indexing_decisions.blocking_reason is
  'The first failing required check, in words. Null only when the page passed.';
