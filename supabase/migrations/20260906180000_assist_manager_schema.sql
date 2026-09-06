-- Assist Manager: the source schema, plus the identity it was missing.
--
-- Every table and column from the source repository is carried over unchanged,
-- because the fifteen screens read them by name. Three things are added, and
-- they are the difference between a demonstration and a remote-assistance
-- system somebody's device can safely be attached to.
--
-- First, identity. The source ties a session to `assist_end_users` and
-- `assist_agents`, two module-local tables whose rows are codes like
-- "USR-****42". Nothing in the entire schema references auth.users. That means
-- the person whose screen is being watched is not a person the platform knows,
-- their consent cannot be attributed to anyone, and no approval can be traced
-- to an account. Section 22B says the user remains the owner of their device
-- consent and section 25 says to use existing identities, so both tables gain a
-- link to a real account and sessions carry the target and the operator
-- directly.
--
-- Second, consent. The source has approval - a manager signing off - but no
-- record of the target agreeing. Watching somebody's screen because their
-- manager allowed it is not the same as watching it because they said yes.
--
-- Third, the trail. There is no audit table in the source at all: a session can
-- start, take control of a device, transfer files and end, leaving only the
-- session row itself.
--
-- No sessions, agents, end users, chat messages, file transfers or AI
-- suggestions are seeded. Section 27 forbids fake sessions, and a fabricated
-- remote-control session is a particularly bad thing to leave lying in a
-- console: it reads as somebody's screen having been watched.

-- ------------------------------------------------------------- who is who --
create table if not exists public.assist_agents (
  id uuid primary key default gen_random_uuid(),
  agent_code text not null unique,
  display_name text not null,
  specialisation text not null default 'Support',
  status text not null default 'available' check (status in ('available','in_session','offline')),
  -- The account behind the agent. Null only for a record kept for history.
  user_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.assist_end_users (
  id uuid primary key default gen_random_uuid(),
  user_code text not null unique,
  role text not null default 'client',
  device text not null default 'Unknown Device',
  operating_system text not null default 'Unknown',
  active_window text,
  user_id uuid,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------- the session --
create table if not exists public.assist_sessions (
  id uuid primary key default gen_random_uuid(),
  session_code text not null unique,
  end_user_id uuid references public.assist_end_users(id) on delete set null,
  agent_id uuid references public.assist_agents(id) on delete set null,
  assist_type text not null default 'support',
  access_mode text not null default 'view_only'
    check (access_mode in ('view_only','control_limited','control_full','file_transfer','chat_only')),
  status text not null default 'pending'
    check (status in ('pending','active','paused','completed','terminated','blocked')),
  purpose text,
  ai_score integer not null default 90 check (ai_score between 0 and 100),
  ai_involved boolean not null default false,
  permissions text[] not null default array['screen_view'],
  restrictions text[] not null default array['No System Access'],
  actions_count integer not null default 0,
  latency_ms integer not null default 30,
  resolution text not null default '1920x1080',
  frame_rate integer not null default 30,
  risk_level text not null default 'low' check (risk_level in ('low','medium','high')),
  started_at timestamptz,
  ended_at timestamptz,
  end_reason text,

  -- The accounts this session is actually about, carried on the session itself
  -- so authorization never has to trust a join through a code.
  target_user_id uuid,
  operator_user_id uuid,
  created_by uuid,

  -- Section 22B: the target's own agreement, separate from a manager's approval.
  consent_granted boolean not null default false,
  consent_at timestamptz,
  consent_by uuid,
  consent_revoked_at timestamptz,

  -- Section 24: references to the domain records this session serves. Each
  -- stays its own record; only the identifier is shared.
  support_ticket_id uuid,
  task_id uuid,
  promise_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------- requests, approvals --
create table if not exists public.assist_session_requests (
  id uuid primary key default gen_random_uuid(),
  request_code text not null unique,
  end_user_id uuid references public.assist_end_users(id) on delete set null,
  assist_type text not null default 'support',
  purpose text not null,
  requested_scope text not null default 'view_only',
  requested_duration_minutes integer not null default 30,
  priority text not null default 'normal' check (priority in ('normal','high','critical')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  ai_assist_enabled boolean not null default true,
  review_note text,
  reviewed_at timestamptz,
  requested_by uuid,
  reviewed_by uuid,
  target_user_id uuid,
  support_ticket_id uuid,
  task_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.assist_approvals (
  id uuid primary key default gen_random_uuid(),
  approval_code text not null unique,
  session_id uuid references public.assist_sessions(id) on delete cascade,
  request_id uuid references public.assist_session_requests(id) on delete set null,
  agent_id uuid references public.assist_agents(id) on delete set null,
  end_user_id uuid references public.assist_end_users(id) on delete set null,
  assist_type text not null default 'support',
  scope text not null default 'View + Chat',
  awaiting_role text not null default 'Manager',
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  submitted_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  decided_at timestamptz,
  decided_by uuid,
  decision_note text
);

-- ------------------------------------------------------ session components --
create table if not exists public.assist_chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.assist_sessions(id) on delete cascade,
  sender text not null check (sender in ('agent','user','ai')),
  sender_user_id uuid,
  body text not null,
  is_translation boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.assist_file_transfers (
  id uuid primary key default gen_random_uuid(),
  transfer_code text not null unique,
  session_id uuid references public.assist_sessions(id) on delete cascade,
  file_name text not null,
  size_bytes bigint not null default 0,
  direction text not null check (direction in ('send','receive')),
  status text not null default 'pending' check (status in ('pending','in_progress','completed','failed')),
  progress integer not null default 0 check (progress between 0 and 100),
  one_time_access boolean not null default true,
  auto_delete boolean not null default true,
  storage_path text,
  checksum text,
  expires_at timestamptz,
  deleted_at timestamptz,
  accessed_at timestamptz,
  initiated_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.assist_session_windows (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.assist_sessions(id) on delete cascade,
  title text not null,
  is_visible boolean not null default false,
  sort_order integer not null default 0
);

create table if not exists public.assist_ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  suggestion_code text not null unique,
  session_id uuid references public.assist_sessions(id) on delete cascade,
  suggestion_type text not null default 'fix'
    check (suggestion_type in ('fix','issue','guide','translate','summary')),
  message text not null,
  confidence integer not null default 80 check (confidence between 0 and 100),
  status text not null default 'open' check (status in ('open','accepted','dismissed')),
  acted_by uuid,
  acted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.assist_emergency_stops (
  id uuid primary key default gen_random_uuid(),
  stop_code text not null unique,
  session_code text not null,
  reason text not null,
  stopped_by text not null default 'Assist Manager',
  stopped_by_user_id uuid,
  stop_type text not null default 'force_single'
    check (stop_type in ('force_single','force_all','system')),
  sessions_affected integer not null default 1,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------------- policies --
create table if not exists public.assist_privacy_controls (
  id uuid primary key default gen_random_uuid(),
  control_key text not null unique,
  label text not null,
  description text not null,
  icon text not null default 'shield',
  enabled boolean not null default true,
  is_critical boolean not null default true,
  sort_order integer not null default 0,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.assist_access_modes (
  id uuid primary key default gen_random_uuid(),
  mode_key text not null unique,
  label text not null,
  description text not null,
  icon text not null default 'app-window',
  is_active boolean not null default false,
  sort_order integer not null default 0,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.assist_settings (
  id uuid primary key default gen_random_uuid(),
  section text not null,
  setting_key text not null unique,
  label text not null,
  control_type text not null check (control_type in ('toggle','number','select')),
  value text not null,
  sort_order integer not null default 0,
  is_locked boolean not null default false,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.assist_control_state (
  id uuid primary key default gen_random_uuid(),
  session_id uuid unique references public.assist_sessions(id) on delete cascade,
  control_mode text not null default 'view' check (control_mode in ('view','control','pause','freeze')),
  cursor_control boolean not null default false,
  keyboard_control boolean not null default false,
  window_specific boolean not null default true,
  resolution_lock boolean not null default true,
  is_paused boolean not null default false,
  voice_active boolean not null default false,
  microphone_enabled boolean not null default true,
  speaker_enabled boolean not null default true,
  auto_translate boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------- the record --
-- Section 22J and 17: a remote session that leaves no trail is not auditable,
-- and the source has no audit table whatsoever.
create table if not exists public.assist_audit_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid,
  session_code text,
  actor text not null,
  actor_user_id uuid,
  actor_role text not null default 'system',
  action text not null,
  target text,
  target_user_id uuid,
  old_state jsonb,
  new_state jsonb,
  reason text,
  result text not null default 'success',
  severity text not null default 'info',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- indexes --
create index if not exists assist_sessions_status_idx     on public.assist_sessions(status);
create index if not exists assist_sessions_target_idx     on public.assist_sessions(target_user_id);
create index if not exists assist_sessions_operator_idx   on public.assist_sessions(operator_user_id);
create index if not exists assist_sessions_task_idx       on public.assist_sessions(task_id);
create index if not exists assist_sessions_promise_idx    on public.assist_sessions(promise_id);
create index if not exists assist_sessions_ticket_idx     on public.assist_sessions(support_ticket_id);
create index if not exists assist_sessions_created_idx    on public.assist_sessions(created_at desc);
create index if not exists assist_requests_status_idx     on public.assist_session_requests(status);
create index if not exists assist_requests_target_idx     on public.assist_session_requests(target_user_id);
create index if not exists assist_approvals_status_idx    on public.assist_approvals(status, expires_at);
create index if not exists assist_chat_session_idx        on public.assist_chat_messages(session_id, created_at);
create index if not exists assist_transfers_session_idx   on public.assist_file_transfers(session_id, status);
create index if not exists assist_audit_session_idx       on public.assist_audit_logs(session_id, created_at desc);
create index if not exists assist_audit_actor_idx         on public.assist_audit_logs(actor_user_id);
create index if not exists assist_agents_user_idx         on public.assist_agents(user_id);
create index if not exists assist_end_users_user_idx      on public.assist_end_users(user_id);

-- ---------------------------------------------------------------- touching --
create or replace function public.assist_touch_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists assist_sessions_touch on public.assist_sessions;
create trigger assist_sessions_touch before update on public.assist_sessions
for each row execute function public.assist_touch_updated_at();

drop trigger if exists assist_control_touch on public.assist_control_state;
create trigger assist_control_touch before update on public.assist_control_state
for each row execute function public.assist_touch_updated_at();

drop trigger if exists assist_settings_touch on public.assist_settings;
create trigger assist_settings_touch before update on public.assist_settings
for each row execute function public.assist_touch_updated_at();
