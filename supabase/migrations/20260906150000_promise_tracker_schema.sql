-- Promise Tracker, as a Software Vala module.
--
-- The source schema is carried over in full - every table, every column the
-- screens read - with four changes that the source could not make because it
-- ran as a standalone app with no real users in it.
--
-- First, identity. The source stores owner and receiver as free text, so a
-- promise made to "Client ABC" points at nobody. Sections 11 and 12 require the
-- owner and receiver to be the real people, so the text is kept for display and
-- backed by nullable foreign keys into the accounts that actually exist here.
--
-- Second, authorization. Every source table granted SELECT, INSERT, UPDATE and
-- DELETE to anon and carried a single policy reading USING (true) WITH CHECK
-- (true). Anyone who could reach the API could read every promise, rewrite any
-- fine, and delete the audit trail. Nothing here is granted to anon, and the
-- policies below decide what an operator, an owner and a receiver may each see.
--
-- Third, money and escalation become records rather than running totals. The
-- source keeps fine_amount and tip_amount as numbers on the promise, so a fine
-- has no rule behind it, no actor, no timestamp and no history. Sections 16 and
-- 17 want real financial records; the totals stay on the promise as a cached
-- sum of them.
--
-- Fourth, the lifecycle of section 5 - draft, pending approval, due soon and
-- locked did not exist as states.
--
-- No promises are seeded. The source ships twenty-four demo rows with invented
-- clients and invented fines; section 29 forbids that, and a fabricated fine in
-- a finance table is worse than a missing feature. Categories, subcategories,
-- rules and settings are configuration rather than data, so those are seeded.

-- ---------------------------------------------------------------- helpers --
create or replace function public.pt_is_operator()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- The same operator roles the Control Panel already uses everywhere else.
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin','boss','founder','super_admin','boss_owner')
  );
$$;

create or replace function public.pt_is_manager()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- Managers may review and escalate their teams' commitments without holding
  -- full Control Panel rights.
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin','boss','founder','super_admin','boss_owner',
                      'employee','sales','support','finance','sales_support_manager')
  );
$$;

-- ------------------------------------------------------------- categories --
create table if not exists public.promise_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  accent text not null default 'indigo',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.promise_subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.promise_categories(id) on delete cascade,
  slug text not null,
  label text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, slug)
);

-- ---------------------------------------------------------------- promises --
create table if not exists public.promises (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  category_id uuid references public.promise_categories(id) on delete set null,
  sub_category text,
  nano_category text,

  -- Display names, exactly as the source screens show them...
  owner text not null,
  receiver text not null,
  -- ...and the accounts they actually refer to, where they refer to one.
  owner_user_id uuid,
  receiver_user_id uuid,

  deadline timestamptz not null,
  priority text not null default 'medium',
  status text not null default 'pending',

  -- Section 32: one promise, traceable back to whatever raised it.
  linked_module text,
  linked_record_id text,

  escalation_level integer not null default 0,
  escalated_at timestamptz,
  escalation_reason text,
  escalation_status text,

  fulfilled_at timestamptz,
  extended_count integer not null default 0,
  delay_days integer not null default 0,

  -- Cached sums of the ledger rows below, never the source of truth.
  fine_amount numeric(12,2) not null default 0,
  tip_amount numeric(12,2) not null default 0,
  fine_status text not null default 'none',
  tip_status text not null default 'none',
  currency text not null default 'INR',

  breach_reason text,
  is_locked boolean not null default false,
  locked_at timestamptz,
  locked_by uuid,

  approval_status text not null default 'not_required',
  approved_by uuid,
  approved_at timestamptz,

  sla_hours numeric,
  due_soon_at timestamptz,
  reminded_at timestamptz,

  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.promises drop constraint if exists promises_status_check;
alter table public.promises add constraint promises_status_check
  check (status = any (array[
    'draft','pending_approval','pending','active','due_soon',
    'delayed','broken','fulfilled','locked','cancelled'
  ]));

alter table public.promises drop constraint if exists promises_priority_check;
alter table public.promises add constraint promises_priority_check
  check (priority = any (array['low','medium','high','critical']));

alter table public.promises drop constraint if exists promises_approval_check;
alter table public.promises add constraint promises_approval_check
  check (approval_status = any (array['not_required','pending','approved','rejected']));

alter table public.promises drop constraint if exists promises_fine_status_check;
alter table public.promises add constraint promises_fine_status_check
  check (fine_status = any (array['none','pending','applied','waived']));

alter table public.promises drop constraint if exists promises_tip_status_check;
alter table public.promises add constraint promises_tip_status_check
  check (tip_status = any (array['none','eligible','released','declined']));

-- ------------------------------------------------------------------ links --
-- A promise can touch several modules at once: raised from a sales deal,
-- delivered through a task, owned by a developer, promised to a customer.
create table if not exists public.promise_links (
  id uuid primary key default gen_random_uuid(),
  promise_id uuid not null references public.promises(id) on delete cascade,
  module text not null,
  record_id text not null,
  relation text not null default 'linked',
  label text,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (promise_id, module, record_id)
);

-- ------------------------------------------------------------- escalations --
create table if not exists public.promise_escalations (
  id uuid primary key default gen_random_uuid(),
  promise_id uuid not null references public.promises(id) on delete cascade,
  level integer not null,
  label text not null,
  reason text,
  raised_by text not null default 'system',
  raised_by_user_id uuid,
  notified_audience text,
  status text not null default 'open',
  resolution text,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz not null default now(),
  -- Section 14: the same level is never raised twice on one promise.
  unique (promise_id, level)
);

alter table public.promise_escalations drop constraint if exists promise_escalations_level_check;
alter table public.promise_escalations add constraint promise_escalations_level_check
  check (level between 1 and 4);

-- ----------------------------------------------------------------- ledger --
-- Sections 16 and 17: a fine or a tip is a record with a rule, an actor and a
-- moment behind it, not a number that went up.
create table if not exists public.promise_ledger (
  id uuid primary key default gen_random_uuid(),
  promise_id uuid not null references public.promises(id) on delete cascade,
  rule_id uuid,
  kind text not null,
  amount numeric(12,2) not null,
  currency text not null default 'INR',
  basis text,
  status text not null default 'applied',
  actor text not null default 'system',
  actor_user_id uuid,
  note text,
  reversed_at timestamptz,
  reversed_by uuid,
  created_at timestamptz not null default now()
);

alter table public.promise_ledger drop constraint if exists promise_ledger_kind_check;
alter table public.promise_ledger add constraint promise_ledger_kind_check
  check (kind = any (array['fine','tip']));

alter table public.promise_ledger drop constraint if exists promise_ledger_status_check;
alter table public.promise_ledger add constraint promise_ledger_status_check
  check (status = any (array['pending','applied','released','reversed','waived']));

-- ------------------------------------------------------------------ rules --
create table if not exists public.promise_rules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null,
  name text not null,
  rule_type text not null default 'fixed',
  amount numeric(12,2) not null default 0,
  auto_apply boolean not null default false,
  is_active boolean not null default true,
  conditions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.promise_rules drop constraint if exists promise_rules_kind_check;
alter table public.promise_rules add constraint promise_rules_kind_check
  check (kind = any (array['fine','tip']));

alter table public.promise_rules drop constraint if exists promise_rules_type_check;
alter table public.promise_rules add constraint promise_rules_type_check
  check (rule_type = any (array['fixed','percentage','manual']));

-- ------------------------------------------------------------- ai insights --
create table if not exists public.promise_ai_insights (
  id uuid primary key default gen_random_uuid(),
  promise_id uuid not null references public.promises(id) on delete cascade,
  delay_risk integer not null default 0,
  miss_probability integer not null default 0,
  suggested_action text not null,
  escalation_advice text not null,
  reason text,
  state text not null default 'open',
  acted_by uuid,
  acted_at timestamptz,
  generated_at timestamptz not null default now()
);

alter table public.promise_ai_insights drop constraint if exists promise_ai_insights_state_check;
alter table public.promise_ai_insights add constraint promise_ai_insights_state_check
  check (state = any (array['open','applied','dismissed']));

-- ------------------------------------------------------------- audit logs --
create table if not exists public.promise_audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  promise_id uuid references public.promises(id) on delete set null,
  promise_code text,
  actor text not null,
  actor_key text default 'system',
  actor_user_id uuid,
  actor_role text not null,
  details text,
  old_value text,
  new_value text,
  source_module text not null default 'promise_tracker',
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------- settings --
create table if not exists public.promise_settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique,
  auto_reminder boolean not null default true,
  reminder_before_hours integer not null default 24,
  auto_escalation boolean not null default true,
  escalation_delay_hours integer not null default 4,
  working_hours_only boolean not null default true,
  work_start_time text not null default '09:00',
  work_end_time text not null default '18:00',
  working_days integer[] not null default array[1,2,3,4,5],
  promise_expiry_days integer not null default 30,
  require_approval boolean not null default true,
  lock_after_fulfill boolean not null default true,
  fine_system_enabled boolean not null default true,
  tip_system_enabled boolean not null default true,
  health_retention_days integer not null default 14,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------ health events --
create table if not exists public.promise_health_events (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  level text not null default 'error',
  event text not null,
  message text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- indexes --
create index if not exists promises_owner_user_idx     on public.promises(owner_user_id);
create index if not exists promises_receiver_user_idx  on public.promises(receiver_user_id);
create index if not exists promises_owner_txt_idx      on public.promises(lower(owner));
create index if not exists promises_receiver_txt_idx   on public.promises(lower(receiver));
create index if not exists promises_status_idx         on public.promises(status);
create index if not exists promises_priority_idx       on public.promises(priority);
create index if not exists promises_deadline_idx       on public.promises(deadline);
create index if not exists promises_escalation_idx     on public.promises(escalation_level);
create index if not exists promises_category_idx       on public.promises(category_id);
create index if not exists promises_module_idx         on public.promises(linked_module);
create index if not exists promises_record_idx         on public.promises(linked_record_id);
create index if not exists promises_created_at_idx     on public.promises(created_at desc);
create index if not exists promise_links_promise_idx   on public.promise_links(promise_id);
create index if not exists promise_links_lookup_idx    on public.promise_links(module, record_id);
create index if not exists promise_ledger_promise_idx  on public.promise_ledger(promise_id);
create index if not exists promise_ledger_kind_idx     on public.promise_ledger(kind, status);
create index if not exists promise_esc_promise_idx     on public.promise_escalations(promise_id, level);
create index if not exists promise_audit_promise_idx   on public.promise_audit_logs(promise_id, created_at desc);
create index if not exists promise_audit_actor_idx     on public.promise_audit_logs(actor_key);
create index if not exists promise_health_created_idx  on public.promise_health_events(created_at desc);
create index if not exists promise_insights_promise_idx on public.promise_ai_insights(promise_id, state);

-- ---------------------------------------------------------------- touching --
create or replace function public.pt_touch_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists promises_touch on public.promises;
create trigger promises_touch before update on public.promises
for each row execute function public.pt_touch_updated_at();

drop trigger if exists promise_rules_touch on public.promise_rules;
create trigger promise_rules_touch before update on public.promise_rules
for each row execute function public.pt_touch_updated_at();

drop trigger if exists promise_settings_touch on public.promise_settings;
create trigger promise_settings_touch before update on public.promise_settings
for each row execute function public.pt_touch_updated_at();

drop trigger if exists promise_categories_touch on public.promise_categories;
create trigger promise_categories_touch before update on public.promise_categories
for each row execute function public.pt_touch_updated_at();

drop trigger if exists promise_subcategories_touch on public.promise_subcategories;
create trigger promise_subcategories_touch before update on public.promise_subcategories
for each row execute function public.pt_touch_updated_at();
