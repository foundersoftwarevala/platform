-- Connect Chat: abuse limits and the conversation-insert guard, enforced in the
-- database so they hold for every instance and every client, including a
-- direct REST call that never touches the application.
--
-- Only calls made as a signed-in user are limited (auth.uid() is not null). The
-- platform's own writes (AI replies, the support-conversation function, imports)
-- run with the service role, have no auth.uid(), and are not limited here; the
-- AI and translation endpoints have their own server-side limits.
--
-- Numbers: a person typing and attaching files in a live chat sends a handful of
-- messages a minute. 40 messages / 60 s, 20 attachments / 60 s per conversation,
-- 10 new conversations / hour and 60 participant changes / minute leave room for
-- a fast typist, a paste of several files, or staff working a queue, and stop a
-- loop or script within a minute. Staff who run conversations are exempt from
-- the conversation-creation limit only.
--
-- A refused insert raises SQLSTATE 54000 with the message
-- 'chat_rate_limited:<kind>' and the seconds to wait in the hint.

begin;

create index if not exists messages_sender_recent_idx
  on public.messages (sender_id, created_at desc);
create index if not exists conversations_creator_recent_idx
  on public.conversations (created_by, created_at desc);

-- ------------------------------------------------------------ message sends
create or replace function public.chat_limit_message_insert()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and (select count(*) from public.messages m
           where m.sender_id = auth.uid() and m.created_at > now() - interval '60 seconds') >= 40 then
    raise exception 'chat_rate_limited:messages' using errcode = '54000', hint = '60';
  end if;
  return new;
end;
$$;
revoke all on function public.chat_limit_message_insert() from public, anon, authenticated;
drop trigger if exists messages_limit_insert on public.messages;
create trigger messages_limit_insert before insert on public.messages
  for each row execute function public.chat_limit_message_insert();

-- ------------------------------------------------------------ attachments
create or replace function public.chat_limit_attachment_insert()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and (select count(*)
            from public.message_attachments a
            join public.messages m on m.id = a.message_id
           where a.conversation_id = new.conversation_id
             and m.sender_id = auth.uid()
             and a.created_at > now() - interval '60 seconds') >= 20 then
    raise exception 'chat_rate_limited:attachments' using errcode = '54000', hint = '60';
  end if;
  return new;
end;
$$;
revoke all on function public.chat_limit_attachment_insert() from public, anon, authenticated;
drop trigger if exists attachments_limit_insert on public.message_attachments;
create trigger attachments_limit_insert before insert on public.message_attachments
  for each row execute function public.chat_limit_attachment_insert();

-- ------------------------------------------------------------ participants
create or replace function public.chat_limit_participant_insert()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and (select count(*) from public.conversation_participants p
           where p.joined_at > now() - interval '60 seconds'
             and p.conversation_id in (select c.id from public.conversations c where c.created_by = auth.uid())
          ) >= 60 then
    raise exception 'chat_rate_limited:participants' using errcode = '54000', hint = '60';
  end if;
  return new;
end;
$$;
revoke all on function public.chat_limit_participant_insert() from public, anon, authenticated;
drop trigger if exists participants_limit_insert on public.conversation_participants;
create trigger participants_limit_insert before insert on public.conversation_participants
  for each row execute function public.chat_limit_participant_insert();

-- ------------------------------------------------------------ conversations
-- Someone who does not run conversations can still start one the old way (a
-- channel, as the AMS screen does), but cannot make it a direct or group chat,
-- switch the AI on, escalate or prioritise it, or assign an agent; those are
-- handler decisions. And cannot open them in bulk.
create or replace function public.chat_guard_conversation_insert()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.chat_can_run_conversations(auth.uid()) then
    return new;
  end if;
  if new.kind in ('direct', 'group') then
    raise exception 'Only Software Vala staff can open this kind of conversation.' using errcode = '42501';
  end if;
  if (select count(*) from public.conversations c
       where c.created_by = auth.uid() and c.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'chat_rate_limited:conversations' using errcode = '54000', hint = '3600';
  end if;
  new.ai_enabled := false;
  new.status := 'open';
  new.priority := 'normal';
  new.assigned_agent_id := null;
  return new;
end;
$$;
revoke all on function public.chat_guard_conversation_insert() from public, anon, authenticated;
drop trigger if exists conversations_guard_insert on public.conversations;
create trigger conversations_guard_insert before insert on public.conversations
  for each row execute function public.chat_guard_conversation_insert();

commit;
