-- Product Moderation Center.
--
-- Section 42 is the constraint that shapes all of this: one canonical product
-- identity. marketplace_products stays the product, marketplace_sellers stays
-- the author and vendor, marketplace_reviews stays the reviews,
-- legal_violations stays Legal Manager's, marketplace_orders and
-- marketplace_licenses stay the money. Moderation controls the *state* of those
-- records; it does not keep copies of them.
--
-- Section 41 lists ten tables. Four are created. The rest already exist:
--
--   product_moderation_records / _reviews   marketplace_products already carries
--                                           moderation_status, content_status,
--                                           visible, approved_at and approved_by
--   product_moderation_history              marketplace_audit_logs is the audit
--                                           trail every module in this project
--                                           already writes to, and a second one
--                                           would fragment the record
--   product_moderation_audits               the same
--
-- The screen this replaces showed "14 awaiting", "6 duplicates", "9 reported"
-- and "1,284 clean". None of those numbers came from anywhere.

create extension if not exists pg_trgm;

/* ---------------------------------------------- 4/21. the state vocabulary */

-- Soft deletion, on the product itself, so nothing has to be moved to a
-- shadow table and every foreign key from orders, licences and reviews keeps
-- pointing at a row that still exists.
alter table public.marketplace_products add column if not exists deleted_at timestamptz;
alter table public.marketplace_products add column if not exists deleted_by uuid;
alter table public.marketplace_products add column if not exists delete_reason text;
-- When the recovery window closes. Reaching it does not delete anything: it
-- makes the product eligible for a purge somebody has to authorise.
alter table public.marketplace_products add column if not exists purge_after timestamptz;
-- Where a merged duplicate now points. The row stays, so old orders and links
-- still resolve, and the storefront follows this to the canonical product.
alter table public.marketplace_products add column if not exists merged_into uuid
  references public.marketplace_products(id);
-- Optimistic concurrency for moderation decisions.
alter table public.marketplace_products add column if not exists moderation_lock integer not null default 1;

create index if not exists marketplace_products_deleted_idx
  on public.marketplace_products (deleted_at) where deleted_at is not null;
create index if not exists marketplace_products_merged_idx
  on public.marketplace_products (merged_into) where merged_into is not null;
create index if not exists marketplace_products_moderation_idx
  on public.marketplace_products (moderation_status);

-- Trigram indexes, so duplicate scanning over five and a half thousand
-- listings is a real query rather than a cross join.
create index if not exists marketplace_products_name_trgm
  on public.marketplace_products using gin (name gin_trgm_ops);
create index if not exists marketplace_products_desc_trgm
  on public.marketplace_products using gin (description gin_trgm_ops);

-- The two deletion states the specification adds. The rest were already
-- constrained in the previous migration.
alter table public.marketplace_products
  drop constraint if exists marketplace_products_moderation_check;
alter table public.marketplace_products
  add constraint marketplace_products_moderation_check
  check (moderation_status in
    ('draft','submitted','under_review','changes_requested',
     'approved','rejected','suspended','archived',
     'soft_deleted','trash'));

/* --------------------------------------------------------- 14. reports */

create table if not exists public.product_reports (
  id uuid primary key default gen_random_uuid(),
  report_no text not null unique,
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  reporter_id uuid,
  reporter_kind text not null default 'user'
    check (reporter_kind in ('user','manager','system','partner')),
  reason text not null check (reason in
    ('copyright','trademark','fraudulent_claims','misleading','security','malware',
     'duplicate','policy_violation','broken_product','illegal_content','other')),
  detail text,
  evidence jsonb not null default '[]'::jsonb,
  status text not null default 'reported'
    check (status in ('reported','under_review','action_required','resolved','dismissed')),
  severity text not null default 'normal' check (severity in ('low','normal','high','critical')),
  assigned_to uuid,
  resolution text,
  resolved_by uuid,
  resolved_at timestamptz,
  -- Set when a report is escalated to Legal Manager. The legal record itself
  -- lives there; this only remembers that it was raised.
  legal_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists product_reports_product_idx on public.product_reports (product_id);
create index if not exists product_reports_open_idx on public.product_reports (status)
  where status in ('reported','under_review','action_required');

/* ------------------------------------------------ 12/13. duplicates */

create table if not exists public.product_duplicate_candidates (
  id uuid primary key default gen_random_uuid(),
  product_a uuid not null references public.marketplace_products(id) on delete cascade,
  product_b uuid not null references public.marketplace_products(id) on delete cascade,
  -- 0 to 100. Computed by the scan, from real string similarity and shared
  -- attributes; never asserted.
  match_percent numeric(5,2) not null check (match_percent between 0 and 100),
  reasons jsonb not null default '[]'::jsonb,
  status text not null default 'open'
    check (status in ('open','merged','not_duplicate','dismissed')),
  decided_by uuid,
  decided_at timestamptz,
  decision_reason text,
  scanned_at timestamptz not null default now(),
  -- One pair, recorded once, whichever order it was found in.
  constraint product_duplicate_pair unique (product_a, product_b),
  constraint product_duplicate_ordered check (product_a < product_b)
);
create index if not exists product_duplicates_open_idx
  on public.product_duplicate_candidates (match_percent desc) where status = 'open';

create table if not exists public.product_merge_operations (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.product_duplicate_candidates(id) on delete set null,
  canonical_id uuid not null references public.marketplace_products(id),
  merged_id uuid not null references public.marketplace_products(id),
  -- What was moved, counted at the time, so the operation can be explained
  -- later without recounting a database that has since changed.
  moved jsonb not null default '{}'::jsonb,
  reason text not null,
  performed_by uuid,
  performed_at timestamptz not null default now()
);

/* --------------------------------------------------- 20. deletion policy */

create table if not exists public.product_moderation_policy (
  id boolean primary key default true check (id),
  -- Days a soft-deleted product stays recoverable before it may be purged.
  recovery_days integer not null default 30 check (recovery_days between 1 and 3650),
  -- Whether a permanent delete needs a second, different approver.
  dual_approval boolean not null default true,
  -- Whether a purge is ever allowed to run without a person asking for it.
  auto_purge boolean not null default false,
  -- Records that survive a purge whatever else happens.
  preserve_orders boolean not null default true,
  preserve_licenses boolean not null default true,
  preserve_reviews boolean not null default true,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
insert into public.product_moderation_policy (id) values (true) on conflict (id) do nothing;

-- A permanent deletion needs two people when the policy says so. This records
-- the first one asking, so the second can confirm.
create table if not exists public.product_purge_requests (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  reason text not null,
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  approved_by uuid,
  approved_at timestamptz,
  executed_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending','approved','executed','cancelled')),
  -- What the purge kept, and what it removed. Written at execution time.
  outcome jsonb,
  constraint purge_one_open exclude (product_id with =) where (status in ('pending','approved'))
);

/* ------------------------------------------------------------------- RLS */

alter table public.product_reports                enable row level security;
alter table public.product_duplicate_candidates   enable row level security;
alter table public.product_merge_operations       enable row level security;
alter table public.product_moderation_policy      enable row level security;
alter table public.product_purge_requests         enable row level security;

-- A person sees the reports they filed. Operators see all of them. Nobody else
-- sees who reported what.
drop policy if exists product_reports_own on public.product_reports;
create policy product_reports_own on public.product_reports
  for select to authenticated
  using (public.mm_is_operator() or reporter_id = auth.uid());

drop policy if exists product_reports_file on public.product_reports;
create policy product_reports_file on public.product_reports
  for insert to authenticated with check (reporter_id = auth.uid());

drop policy if exists product_reports_operator on public.product_reports;
create policy product_reports_operator on public.product_reports
  for all to authenticated
  using (public.mm_is_operator()) with check (public.mm_is_operator());

do $$
declare t text;
begin
  foreach t in array array['product_duplicate_candidates','product_merge_operations',
                           'product_moderation_policy','product_purge_requests'] loop
    execute format('drop policy if exists %I on public.%I', t||'_operator', t);
    execute format($f$create policy %I on public.%I for all to authenticated
                      using (public.mm_is_operator()) with check (public.mm_is_operator())$f$,
                   t||'_operator', t);
  end loop;

  foreach t in array array['product_reports','product_duplicate_candidates',
                           'product_merge_operations','product_moderation_policy',
                           'product_purge_requests'] loop
    execute format('drop policy if exists %I on public.%I', t||'_anon', t);
    execute format($f$create policy %I on public.%I as restrictive for all to anon
                      using (false) with check (false)$f$, t||'_anon', t);
  end loop;
end;
$$;

-- A merge record is history. Nobody edits or removes one, operators included.
drop policy if exists product_merge_no_change on public.product_merge_operations;
create policy product_merge_no_change on public.product_merge_operations
  as restrictive for update to public using (false) with check (false);
drop policy if exists product_merge_no_delete on public.product_merge_operations;
create policy product_merge_no_delete on public.product_merge_operations
  as restrictive for delete to public using (false);
