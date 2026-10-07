-- Connect Chat × AI CEO agents.
--
-- Chat does not get agents of its own. It reads the AI CEO registry
-- (public.ai_agents) and talks through the agents an operator has opened to
-- customers. "Opened to customers" is the registry's own channels column: its
-- constraint exists so an agent can only list a channel the platform can really
-- reach, and customer chat is now one, so it is added to that list.
--
-- chat_ai_events is the Chat Manager's view of what the AI did in a
-- conversation (which agent, which run, what was decided). The run itself is
-- recorded where it always is, in ai_agent_runs through fa_agent_run_open/close.

begin;

alter table public.ai_agents drop constraint if exists ai_agents_channels_are_connected;
alter table public.ai_agents
  add constraint ai_agents_channels_are_connected
  check (channels <@ array['email', 'internal_message', 'lead_followup', 'customer_chat']::text[]);

create table if not exists public.chat_ai_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid references public.messages(id) on delete set null,
  agent_key text,
  agent_run_id uuid,
  domain text,
  language text,
  outcome text not null check (outcome in ('replied', 'escalated', 'failed')),
  escalated boolean not null default false,
  lead_id uuid,
  error text,
  latency_ms integer,
  created_at timestamptz not null default now()
);
create index if not exists chat_ai_events_conversation_idx
  on public.chat_ai_events (conversation_id, created_at desc);

alter table public.chat_ai_events enable row level security;
revoke all on public.chat_ai_events from anon, authenticated;
grant select on public.chat_ai_events to authenticated;
grant all on public.chat_ai_events to service_role;

-- Internal control data: Chat Manager only, never the customer.
drop policy if exists "chat managers read ai events" on public.chat_ai_events;
create policy "chat managers read ai events" on public.chat_ai_events
  for select to authenticated
  using (public.has_permission(auth.uid(), 'chat.manage'));

commit;
