-- Author Approval Workflow.
--
-- What already existed and is reused rather than rebuilt:
--
--   marketplace_products          the thing being approved, with its own
--                                 moderation_status, content_status, visible,
--                                 approved_at and approved_by columns
--   marketplace_product_versions  revisions, so section 19 needs no new table
--   marketplace_sellers           the author; Author Manager stays the source
--                                 of truth for identity, status and trust
--   legal_product_bindings /      the legal gate in section 24, canonical and
--   legal_violations              read-only from here
--   marketplace_audit_logs        the audit trail every module writes to
--   user_notifications / mm_notify  the notification engine
--   /api/internal/author-review   an operator-guarded endpoint that already
--                                 flips the two status columns and visibility
--
-- What was missing is the workflow itself. There was no submission record, no
-- state machine, no risk score, no SLA, no rules, no evidence and no history —
-- and the console showed ten invented counts over five invented submissions
-- from authors that do not exist, with invented risk numbers.

/* ------------------------------------------------------------- submissions */

create table if not exists public.author_submissions (
  id uuid primary key default gen_random_uuid(),
  -- A short human reference, so a reviewer and an author can talk about one.
  submission_no text not null unique,
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  seller_id uuid references public.marketplace_sellers(id) on delete set null,
  version_id uuid references public.marketplace_product_versions(id) on delete set null,
  submission_type text not null default 'new' check (submission_type in ('new','update')),

  status text not null default 'draft' check (status in
    ('draft','pending_review','verifying','changes_requested',
     'approved','rejected','suspended','archived')),

  -- Bumped every time the author resubmits. The history keeps each one.
  revision integer not null default 1,

  risk_score integer not null default 0 check (risk_score between 0 and 100),
  risk_level text not null default 'low' check (risk_level in ('low','medium','high','critical')),
  risk_reasons jsonb not null default '[]'::jsonb,

  reviewer_id uuid,
  review_started_at timestamptz,
  submitted_at timestamptz,
  decided_at timestamptz,
  decided_by uuid,

  -- Computed from the SLA configuration at submission time, so changing the
  -- policy later does not silently re-date work already in the queue.
  sla_due_at timestamptz,
  escalate_at timestamptz,
  escalated_at timestamptz,

  -- Optimistic concurrency. A reviewer sends the number they read; if another
  -- reviewer has acted since, the transition is refused rather than silently
  -- overwriting their decision.
  lock_version integer not null default 1,

  last_action text,
  last_reason text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One open submission per product. A second one would let two revisions race
  -- each other to publication.
  constraint author_submissions_one_open
    exclude (product_id with =) where (status in
      ('draft','pending_review','verifying','changes_requested'))
);

create index if not exists author_submissions_status_idx on public.author_submissions (status, submitted_at);
create index if not exists author_submissions_seller_idx on public.author_submissions (seller_id);
create index if not exists author_submissions_sla_idx on public.author_submissions (sla_due_at)
  where status in ('pending_review','verifying');

-- Immutable. Never updated, never deleted — the policies below allow neither.
create table if not exists public.author_approval_history (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.author_submissions(id) on delete cascade,
  revision integer not null,
  action text not null,
  from_status text,
  to_status text,
  actor_id uuid,
  actor_role text,
  reason text,
  comment text,
  evidence jsonb not null default '[]'::jsonb,
  ai_recommendation jsonb,
  created_at timestamptz not null default now()
);
create index if not exists author_approval_history_sub_idx
  on public.author_approval_history (submission_id, created_at desc);

create table if not exists public.author_approval_evidence (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.author_submissions(id) on delete cascade,
  kind text not null check (kind in
    ('screenshot','document','package','url','verification','legal','security','note')),
  label text not null,
  -- A storage path for a private file, or a URL for a public reference. Never
  -- both, so it is unambiguous which one to resolve.
  storage_path text,
  url text,
  detail text,
  added_by uuid,
  created_at timestamptz not null default now(),
  constraint author_evidence_one_target check (
    (storage_path is not null and url is null) or
    (storage_path is null and url is not null) or
    (storage_path is null and url is null and detail is not null))
);
create index if not exists author_evidence_sub_idx on public.author_approval_evidence (submission_id);

/* ------------------------------------------------------------------ rules */

create table if not exists public.author_approval_rules (
  key text primary key,
  label text not null,
  description text not null,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.author_approval_rules (key, label, description, enabled, config) values
  ('manual_review_new_authors', 'Require manual review for new authors',
   'A seller with no previously approved submission always goes to a human, whatever the risk score says.',
   true, '{}'::jsonb),
  ('auto_verify_trusted_updates', 'Auto-verify updates from trusted authors',
   'An update from a seller above the trust threshold moves straight to verifying, skipping the initial triage. It still requires a human decision to be approved.',
   false, '{"min_approved": 3, "max_violations": 0}'::jsonb),
  ('skip_review_security_patch', 'Skip review for security-only patches',
   'An update marked as a security patch goes straight to verifying so a fix is not held up behind a queue.',
   false, '{}'::jsonb),
  ('notify_author_on_change', 'Notify the author on every status change',
   'Sends through the notification engine on each transition. Off means only decisions are announced.',
   true, '{}'::jsonb)
on conflict (key) do nothing;

-- One row. The SLA is configuration, not a constant in code.
create table if not exists public.author_approval_sla (
  id boolean primary key default true check (id),
  response_hours integer not null default 24 check (response_hours between 1 and 720),
  escalate_hours integer not null default 48 check (escalate_hours between 1 and 2160),
  stale_draft_days integer not null default 30 check (stale_draft_days between 1 and 365),
  updated_by uuid,
  updated_at timestamptz not null default now()
);
insert into public.author_approval_sla (id) values (true) on conflict (id) do nothing;

/* -------------------------------------------------------------------- RLS */

alter table public.author_submissions        enable row level security;
alter table public.author_approval_history   enable row level security;
alter table public.author_approval_evidence  enable row level security;
alter table public.author_approval_rules     enable row level security;
alter table public.author_approval_sla       enable row level security;

-- An author sees their own submissions through their seller record, and
-- nothing of anybody else's. Operators see the queue.
drop policy if exists author_submissions_own on public.author_submissions;
create policy author_submissions_own on public.author_submissions
  for select to authenticated
  using (public.mm_is_operator()
         or public.marketplace_is_seller_member(seller_id));

drop policy if exists author_submissions_operator on public.author_submissions
;create policy author_submissions_operator on public.author_submissions
  for all to authenticated
  using (public.mm_is_operator()) with check (public.mm_is_operator());

drop policy if exists author_history_read on public.author_approval_history;
create policy author_history_read on public.author_approval_history
  for select to authenticated
  using (public.mm_is_operator()
         or exists (select 1 from public.author_submissions s
                     where s.id = author_approval_history.submission_id
                       and public.marketplace_is_seller_member(s.seller_id)));

-- Insert only. There is deliberately no update or delete policy for anybody,
-- including operators, so the history cannot be rewritten from the application
-- at all — which is what section 18 means by immutable.
drop policy if exists author_history_append on public.author_approval_history;
create policy author_history_append on public.author_approval_history
  for insert to authenticated with check (public.mm_is_operator());

drop policy if exists author_evidence_read on public.author_approval_evidence;
create policy author_evidence_read on public.author_approval_evidence
  for select to authenticated
  using (public.mm_is_operator()
         or exists (select 1 from public.author_submissions s
                     where s.id = author_approval_evidence.submission_id
                       and public.marketplace_is_seller_member(s.seller_id)));

drop policy if exists author_evidence_operator on public.author_approval_evidence;
create policy author_evidence_operator on public.author_approval_evidence
  for all to authenticated
  using (public.mm_is_operator()) with check (public.mm_is_operator());

drop policy if exists author_rules_read on public.author_approval_rules;
create policy author_rules_read on public.author_approval_rules
  for select to authenticated using (public.mm_is_operator());
drop policy if exists author_rules_write on public.author_approval_rules;
create policy author_rules_write on public.author_approval_rules
  for all to authenticated
  using (public.mm_is_operator()) with check (public.mm_is_operator());

drop policy if exists author_sla_read on public.author_approval_sla;
create policy author_sla_read on public.author_approval_sla
  for select to authenticated using (public.mm_is_operator());
drop policy if exists author_sla_write on public.author_approval_sla;
create policy author_sla_write on public.author_approval_sla
  for all to authenticated
  using (public.mm_is_operator()) with check (public.mm_is_operator());

do $$
declare t text;
begin
  foreach t in array array['author_submissions','author_approval_history',
                           'author_approval_evidence','author_approval_rules',
                           'author_approval_sla'] loop
    execute format('drop policy if exists %I on public.%I', t||'_anon', t);
    execute format($f$create policy %I on public.%I as restrictive for all to anon
                      using (false) with check (false)$f$, t||'_anon', t);
  end loop;
end;
$$;

-- A last line of defence under the missing-policy rule: even a future
-- permissive policy cannot make the history editable.
drop policy if exists author_history_no_update on public.author_approval_history;
create policy author_history_no_update on public.author_approval_history
  as restrictive for update to public using (false) with check (false);
drop policy if exists author_history_no_delete on public.author_approval_history;
create policy author_history_no_delete on public.author_approval_history
  as restrictive for delete to public using (false);

/* ---------------------------------------------- product status vocabulary */

-- The endpoint at /api/internal/author-review already writes submitted,
-- under_review and changes_requested into moderation_status, and the column had
-- no constraint at all, so a typo would have been stored happily. The
-- vocabulary is now stated, including every value already present.
do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname='marketplace_products_moderation_check') then
    alter table public.marketplace_products
      add constraint marketplace_products_moderation_check
      check (moderation_status in
        ('draft','submitted','under_review','changes_requested',
         'approved','rejected','suspended','archived'));
  end if;
end;
$$;
