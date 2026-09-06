-- AMS progression engine.
--
-- The blueprint's first rule is that AMS must not be a fake rewards page, and
-- the honest reading of that is a constraint on where earning can come from.
-- Today the only thing that grants XP is `rewards.engine.ts`, an in-memory
-- wallet in the browser whose `grant()` any page can call. That is the thing
-- section 15 forbids, so this file builds the server side it was waiting for
-- and nothing in it can be reached from a page.
--
-- Three ideas carry the whole design:
--
--   1. Earning starts from a *recorded event*, never from a request. A caller
--      cannot ask for XP; it can only report that something happened, and only
--      a trusted caller may do even that.
--   2. Events are deduplicated by a natural key, so replaying an import or
--      double-firing a trigger cannot pay twice.
--   3. Everything awarded is written to an append-only ledger that names the
--      event and the rule that produced it, so any balance can be explained.
--
-- Nothing here seeds a single earned achievement. The catalogue describes what
-- *can* be earned; what *has* been earned may only come from real activity.

-- ---------------------------------------------------------------------------
-- Role stages — section 06.
-- ---------------------------------------------------------------------------
-- `ranks` already holds the ten universal stage names and their XP floors, and
-- `trophies` already holds 180 role-specific stage trophies. What is missing is
-- the role-specific *title* for each stage, which the blueprint is emphatic
-- about: the engine is shared, the language is not.

create table if not exists public.ams_role_stages (
  id           uuid primary key default gen_random_uuid(),
  role         text not null,
  stage        int  not null check (stage between 1 and 10),
  title        text not null,
  tagline      text,
  -- Kept per row rather than joined from `ranks` so a role may later diverge
  -- without a schema change; seeded from `ranks` so they agree today.
  min_xp       bigint not null default 0,
  created_at   timestamptz not null default now(),
  unique (role, stage)
);

comment on table public.ams_role_stages is
  'Role-specific name for each of the ten universal progression stages.';

-- ---------------------------------------------------------------------------
-- Verified activity — section 30.
-- ---------------------------------------------------------------------------
-- The only door into the engine. `dedupe_key` is what makes replay safe: it is
-- derived from the thing that happened (table + row + kind), so the same real
-- occurrence can be reported any number of times and count once.

create table if not exists public.ams_activity_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null,
  event_key    text not null,
  entity_type  text,
  entity_id    text,
  -- Magnitude, where the event has one: order value, tickets resolved, etc.
  -- Rules that only count occurrences ignore it.
  value        numeric not null default 1,
  occurred_at  timestamptz not null default now(),
  source       text not null default 'system',
  dedupe_key   text not null,
  payload      jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (dedupe_key)
);

create index if not exists ams_events_user_idx
  on public.ams_activity_events (user_id, event_key, occurred_at desc);
create index if not exists ams_events_unprocessed_idx
  on public.ams_activity_events (processed_at) where processed_at is null;

comment on table public.ams_activity_events is
  'Verified platform activity. The sole input to the AMS engine; deduplicated by dedupe_key.';

-- Append-only. An event is a record of something that happened, and history
-- does not change.
create or replace function public.ams_events_immutable()
returns trigger language plpgsql as $$
begin
  -- The engine marks work done; nothing else about a recorded event may move.
  if tg_op = 'UPDATE'
     and (new.user_id, new.event_key, new.value, new.occurred_at, new.dedupe_key)
      is distinct from (old.user_id, old.event_key, old.value, old.occurred_at, old.dedupe_key)
  then
    raise exception 'ams_activity_events is append-only';
  end if;
  if tg_op = 'DELETE' then
    raise exception 'ams_activity_events is append-only';
  end if;
  return new;
end $$;

drop trigger if exists ams_events_no_rewrite on public.ams_activity_events;
create trigger ams_events_no_rewrite
  before update or delete on public.ams_activity_events
  for each row execute function public.ams_events_immutable();

-- ---------------------------------------------------------------------------
-- The ledger — section 31.
-- ---------------------------------------------------------------------------
-- Every grant, with the event and rule that caused it. `xp_transactions`
-- already exists for XP alone; this records the whole issuance including the
-- assets, so a passport can be explained line by line.

create table if not exists public.ams_award_ledger (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null,
  event_id     uuid references public.ams_activity_events(id),
  rule_id      uuid,
  asset_kind   text not null check (asset_kind in
                 ('xp','achievement','badge','trophy','certificate','stage','rank')),
  asset_slug   text,
  xp_awarded   bigint not null default 0,
  reason       text,
  created_at   timestamptz not null default now()
);

create index if not exists ams_ledger_user_idx
  on public.ams_award_ledger (user_id, created_at desc);

create or replace function public.ams_ledger_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'ams_award_ledger is append-only';
end $$;

drop trigger if exists ams_ledger_no_rewrite on public.ams_award_ledger;
create trigger ams_ledger_no_rewrite
  before update or delete on public.ams_award_ledger
  for each row execute function public.ams_ledger_immutable();

-- ---------------------------------------------------------------------------
-- Passport — section 12 — and certificates — section 17.
-- ---------------------------------------------------------------------------
-- The passport number was being derived in TypeScript from the account id.
-- That is stable, but it means nothing issues a passport, nothing records when
-- it was issued, and it cannot be revoked. A credential needs a record.

create table if not exists public.ams_passports (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  role           text not null,
  passport_no    text not null unique,
  issued_at      timestamptz not null default now(),
  level          int  not null default 1,
  stage          int  not null default 1,
  verification   text not null default 'pending'
                   check (verification in ('verified','pending','unverified','expired','revoked')),
  updated_at     timestamptz not null default now()
);

create table if not exists public.ams_certificates (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  role           text not null,
  certificate_no text not null unique,
  title          text not null,
  stage          int,
  achievement_slug text,
  issued_at      timestamptz not null default now(),
  verification   text not null default 'verified'
                   check (verification in ('verified','pending','unverified','expired','revoked')),
  revoked_at     timestamptz,
  revoked_reason text
);

create index if not exists ams_certificates_user_idx
  on public.ams_certificates (user_id, issued_at desc);

-- ---------------------------------------------------------------------------
-- Authorization.
-- ---------------------------------------------------------------------------

create or replace function public.ams_is_operator()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = auth.uid()
      and r.role::text in ('admin','boss','manager','operator')
  );
$$;

alter table public.ams_role_stages     enable row level security;
alter table public.ams_activity_events enable row level security;
alter table public.ams_award_ledger    enable row level security;
alter table public.ams_passports       enable row level security;
alter table public.ams_certificates    enable row level security;

-- The catalogue of stages is reference data every signed-in person may read;
-- only operators change it.
drop policy if exists ams_stages_read on public.ams_role_stages;
create policy ams_stages_read on public.ams_role_stages
  for select to authenticated using (true);
drop policy if exists ams_stages_write on public.ams_role_stages;
create policy ams_stages_write on public.ams_role_stages
  for all to authenticated using (public.ams_is_operator()) with check (public.ams_is_operator());

-- Section 24: a role must never see another person's progression. Own rows, or
-- operator.
drop policy if exists ams_events_read on public.ams_activity_events;
create policy ams_events_read on public.ams_activity_events
  for select to authenticated using (user_id = auth.uid() or public.ams_is_operator());

drop policy if exists ams_ledger_read on public.ams_award_ledger;
create policy ams_ledger_read on public.ams_award_ledger
  for select to authenticated using (user_id = auth.uid() or public.ams_is_operator());

drop policy if exists ams_passport_read on public.ams_passports;
create policy ams_passport_read on public.ams_passports
  for select to authenticated using (user_id = auth.uid() or public.ams_is_operator());

drop policy if exists ams_cert_read on public.ams_certificates;
create policy ams_cert_read on public.ams_certificates
  for select to authenticated using (user_id = auth.uid() or public.ams_is_operator());

-- No INSERT or UPDATE policy exists for any of these on purpose. Writing is
-- done by the engine below, which runs as definer. There is deliberately no
-- path by which a signed-in person can write their own XP, achievement,
-- passport or certificate — that is section 15's requirement expressed as
-- permissions rather than as a promise.

-- Anonymous gets nothing, stated restrictively so it survives a stray
-- permissive policy added later.
do $$
declare t text;
begin
  foreach t in array array['ams_role_stages','ams_activity_events','ams_award_ledger',
                           'ams_passports','ams_certificates']
  loop
    execute format(
      'drop policy if exists %I on public.%I', t || '_anon_denied', t);
    execute format(
      'create policy %I on public.%I as restrictive to anon using (false) with check (false)',
      t || '_anon_denied', t);
  end loop;
end $$;
