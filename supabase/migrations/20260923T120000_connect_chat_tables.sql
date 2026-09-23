-- Connect Chat: the tables the chat screens have always asked for.
--
-- /chat and /chat-manager are built and shipped, and the chat button sits in
-- every dashboard's top bar, but nine of the eleven tables the chat service
-- reads do not exist in this database. Opening /chat therefore reaches
-- "connecting" and stops, with ten failed requests behind it.
--
-- This adds only what is missing. It does not recreate profiles, user_roles or
-- the app_role enum, all of which this project already has and uses, and it
-- does not touch the sign-up trigger. Everything here is guarded so it can be
-- run more than once without harm.

-- ---------------------------------------------------------------- profiles
-- The chat shows who is speaking, what they do and whether they are around.
-- The existing columns stay exactly as they are; these sit beside them, and
-- the two that have an obvious source are filled from it.
alter table public.profiles add column if not exists handle text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists job_title text;
alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles add column if not exists presence text not null default 'offline';
alter table public.profiles add column if not exists last_seen_at timestamptz not null default now();

update public.profiles
   set handle = coalesce(handle, username, 'user-' || substr(id::text, 1, 8)),
       display_name = coalesce(display_name, full_name, username, 'Member')
 where handle is null or display_name is null;

create unique index if not exists profiles_handle_key on public.profiles(handle);

-- ------------------------------------------------------- role permissions
create table if not exists public.role_permissions (
  role public.app_role not null,
  permission text not null,
  primary key (role, permission)
);
grant select on public.role_permissions to authenticated;
grant all on public.role_permissions to service_role;
alter table public.role_permissions enable row level security;

do $$ begin
  create policy "permissions readable" on public.role_permissions
    for select to authenticated using (true);
exception when duplicate_object then null; end $$;

-- Everyone who holds a role may take part in a conversation.
insert into public.role_permissions (role, permission)
select r, p
  from unnest(enum_range(null::public.app_role)) r
 cross join unnest(array[
   'message.send','message.react','message.reply','message.bookmark',
   'attachment.upload','attachment.download','conversation.create',
   'mention.use','search.messages'
 ]) p
on conflict do nothing;

-- Running a conversation is not everyone's business.
insert into public.role_permissions (role, permission) values
  ('admin','conversation.manage'),
  ('boss','conversation.manage'),
  ('support','conversation.manage'),
  ('developer','conversation.manage'),
  ('sales_support_manager','conversation.manage'),
  ('admin','profile.manage_others'),
  ('boss','profile.manage_others')
on conflict do nothing;

create or replace function public.has_permission(_user_id uuid, _permission text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.user_roles ur
      join public.role_permissions rp on rp.role = ur.role
     where ur.user_id = _user_id and rp.permission = _permission
  )
$$;

-- ----------------------------------------------------------- conversations
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  kind text not null default 'direct',
  reference_code text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
grant select, insert, update on public.conversations to authenticated;
grant all on public.conversations to service_role;
alter table public.conversations enable row level security;

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_label text,
  favorite boolean not null default false,
  muted boolean not null default false,
  last_read_at timestamptz not null default 'epoch',
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
grant select, insert, update on public.conversation_participants to authenticated;
grant all on public.conversation_participants to service_role;
alter table public.conversation_participants enable row level security;

create or replace function public.is_participant(_conversation_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversation_participants
     where conversation_id = _conversation_id and user_id = _user_id
  )
$$;

do $$ begin
  create policy "participants read conversations" on public.conversations
    for select to authenticated using (public.is_participant(id, auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "members create conversations" on public.conversations
    for insert to authenticated
    with check (created_by = auth.uid() and public.has_permission(auth.uid(), 'conversation.create'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "managers update conversations" on public.conversations
    for update to authenticated
    using (public.is_participant(id, auth.uid()) and public.has_permission(auth.uid(), 'conversation.manage'))
    with check (public.is_participant(id, auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "read own conversation memberships" on public.conversation_participants
    for select to authenticated using (public.is_participant(conversation_id, auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "add participants to own conversations" on public.conversation_participants
    for insert to authenticated
    with check (
      user_id = auth.uid()
      or public.is_participant(conversation_id, auth.uid())
      or exists (select 1 from public.conversations c where c.id = conversation_id and c.created_by = auth.uid())
    );
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "update own membership" on public.conversation_participants
    for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- --------------------------------------------------------------- messages
-- What was said is a record. It is never edited and never deleted, by anyone,
-- from any screen - the triggers below refuse both outright.
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.messages(id) on delete restrict,
  kind text not null default 'text',
  body text not null default '',
  client_ref text,
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation_idx on public.messages(conversation_id, created_at);
create index if not exists messages_parent_idx on public.messages(parent_id);
create index if not exists messages_body_search_idx on public.messages using gin (to_tsvector('simple', body));
grant select, insert on public.messages to authenticated;
grant select, insert on public.messages to service_role;
alter table public.messages enable row level security;

do $$ begin
  create policy "participants read messages" on public.messages
    for select to authenticated using (public.is_participant(conversation_id, auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "participants send messages" on public.messages
    for insert to authenticated
    with check (
      sender_id = auth.uid()
      and public.is_participant(conversation_id, auth.uid())
      and public.has_permission(auth.uid(), 'message.send')
    );
exception when duplicate_object then null; end $$;

create or replace function public.block_message_mutation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  raise exception 'Messages are immutable enterprise records and cannot be modified or removed';
end;
$$;
drop trigger if exists messages_immutable_update on public.messages;
create trigger messages_immutable_update before update on public.messages
  for each row execute function public.block_message_mutation();
drop trigger if exists messages_immutable_delete on public.messages;
create trigger messages_immutable_delete before delete on public.messages
  for each row execute function public.block_message_mutation();

create or replace function public.touch_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;
drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation after insert on public.messages
  for each row execute function public.touch_conversation();

-- ----------------------------------------------- mentions, files, reactions
create table if not exists public.message_mentions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
grant select, insert on public.message_mentions to authenticated;
grant all on public.message_mentions to service_role;
alter table public.message_mentions enable row level security;
do $$ begin
  create policy "read mentions in own conversations" on public.message_mentions
    for select to authenticated
    using (exists (select 1 from public.messages m where m.id = message_id and public.is_participant(m.conversation_id, auth.uid())));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "create mentions on own messages" on public.message_mentions
    for insert to authenticated
    with check (exists (select 1 from public.messages m where m.id = message_id and m.sender_id = auth.uid()));
exception when duplicate_object then null; end $$;

create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  media_kind text not null default 'file',
  duration_seconds numeric,
  created_at timestamptz not null default now()
);
create index if not exists message_attachments_conversation_idx
  on public.message_attachments(conversation_id, created_at desc);
grant select, insert on public.message_attachments to authenticated;
grant all on public.message_attachments to service_role;
alter table public.message_attachments enable row level security;
do $$ begin
  create policy "participants read attachments" on public.message_attachments
    for select to authenticated using (public.is_participant(conversation_id, auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "participants create attachments" on public.message_attachments
    for insert to authenticated
    with check (
      public.is_participant(conversation_id, auth.uid())
      and public.has_permission(auth.uid(), 'attachment.upload')
      and exists (select 1 from public.messages m where m.id = message_id and m.sender_id = auth.uid())
    );
exception when duplicate_object then null; end $$;

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
grant select, insert, delete on public.message_reactions to authenticated;
grant all on public.message_reactions to service_role;
alter table public.message_reactions enable row level security;
do $$ begin
  create policy "participants read reactions" on public.message_reactions
    for select to authenticated
    using (exists (select 1 from public.messages m where m.id = message_id and public.is_participant(m.conversation_id, auth.uid())));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "participants add own reactions" on public.message_reactions
    for insert to authenticated
    with check (user_id = auth.uid() and exists (select 1 from public.messages m where m.id = message_id and public.is_participant(m.conversation_id, auth.uid())));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "remove own reactions" on public.message_reactions
    for delete to authenticated using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

create table if not exists public.message_receipts (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  delivered_at timestamptz not null default now(),
  read_at timestamptz,
  primary key (message_id, user_id)
);
grant select, insert, update on public.message_receipts to authenticated;
grant all on public.message_receipts to service_role;
alter table public.message_receipts enable row level security;
do $$ begin
  create policy "participants read receipts" on public.message_receipts
    for select to authenticated
    using (exists (select 1 from public.messages m where m.id = message_id and public.is_participant(m.conversation_id, auth.uid())));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "own receipts insert" on public.message_receipts
    for insert to authenticated
    with check (user_id = auth.uid() and exists (select 1 from public.messages m where m.id = message_id and public.is_participant(m.conversation_id, auth.uid())));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "own receipts update" on public.message_receipts
    for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

create table if not exists public.message_bookmarks (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
grant select, insert, update, delete on public.message_bookmarks to authenticated;
grant all on public.message_bookmarks to service_role;
alter table public.message_bookmarks enable row level security;
do $$ begin
  create policy "own bookmarks" on public.message_bookmarks
    for all to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid() and exists (select 1 from public.messages m where m.id = message_id and public.is_participant(m.conversation_id, auth.uid())));
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------- live updates
do $$
declare t text;
begin
  foreach t in array array[
    'messages','message_reactions','message_receipts','message_attachments',
    'conversations','conversation_participants','profiles'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; when others then null; end;
  end loop;
end $$;

-- ----------------------------------------------------------------- files
insert into storage.buckets (id, name, public)
values ('chat-files', 'chat-files', false)
on conflict (id) do nothing;

do $$ begin
  create policy "participants read chat files" on storage.objects
    for select to authenticated
    using (bucket_id = 'chat-files' and public.is_participant(((storage.foldername(name))[1])::uuid, auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "participants upload chat files" on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'chat-files'
      and public.is_participant(((storage.foldername(name))[1])::uuid, auth.uid())
      and public.has_permission(auth.uid(), 'attachment.upload')
    );
exception when duplicate_object then null; end $$;

-- --------------------------------------------------------------- execution
revoke all on function public.block_message_mutation() from public, anon, authenticated;
revoke all on function public.touch_conversation() from public, anon, authenticated;
revoke all on function public.has_permission(uuid, text) from public, anon;
revoke all on function public.is_participant(uuid, uuid) from public, anon;
grant execute on function public.has_permission(uuid, text) to authenticated;
grant execute on function public.is_participant(uuid, uuid) to authenticated;
