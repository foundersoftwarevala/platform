-- Connect Chat: canonical source keys and the conversation links other managers use.
--
-- One conversation stays one conversation everywhere. Tasks and leads keep a
-- reference to it (conversation_id, optional message_id, source) in this table;
-- nothing is copied into Task Manager or Lead Manager, and neither of their
-- own tables is changed. Written only by the server, which checks the caller.

begin;

alter table public.conversations
  add column if not exists source text not null default 'chat_app';

alter table public.conversations drop constraint if exists conversations_source_check;
alter table public.conversations
  add constraint conversations_source_check
  check (source in ('chat_app', 'chat_manager', 'task_manager', 'lead_manager', 'support', 'ai_assistant'));

create table if not exists public.chat_conversation_links (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid references public.messages(id) on delete set null,
  entity_type text not null check (entity_type in ('task', 'lead')),
  entity_id uuid not null,
  source text not null default 'chat_app'
    check (source in ('chat_app', 'chat_manager', 'task_manager', 'lead_manager', 'support', 'ai_assistant')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (conversation_id, entity_type, entity_id)
);
create index if not exists chat_conversation_links_entity_idx
  on public.chat_conversation_links (entity_type, entity_id);

alter table public.chat_conversation_links enable row level security;
revoke all on public.chat_conversation_links from anon, authenticated;
grant select on public.chat_conversation_links to authenticated;
grant all on public.chat_conversation_links to service_role;

-- Who runs a conversation may see what is linked to it; customers never see
-- the internal task and lead references.
drop policy if exists "handlers read conversation links" on public.chat_conversation_links;
create policy "handlers read conversation links" on public.chat_conversation_links
  for select to authenticated
  using (
    public.has_permission(auth.uid(), 'chat.manage')
    or (
      public.has_permission(auth.uid(), 'conversation.manage')
      and public.is_participant(conversation_id, auth.uid())
    )
  );

commit;
