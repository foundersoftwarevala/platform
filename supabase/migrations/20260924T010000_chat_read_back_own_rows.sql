-- A person can read back what they have just written.
--
-- Creating a conversation, joining it and sending a message are all inserts
-- that return the new row, and a returning clause is checked against the read
-- policy as well as the write one. The read policies asked whether the caller
-- was already a participant - which, at the moment of creating the thing that
-- makes them one, they are not. So every one of those three came back
-- "violates row-level security policy" and the chat could not be started at
-- all, although each write on its own was permitted.
--
-- Each read now also admits the person's own row: the conversation they
-- started, the membership that is theirs, the message they sent. Nobody gains
-- sight of anyone else's.

drop policy if exists "participants read conversations" on public.conversations;
create policy "participants read conversations" on public.conversations
  for select to authenticated
  using (public.is_participant(id, auth.uid()) or created_by = auth.uid());

drop policy if exists "read own conversation memberships" on public.conversation_participants;
create policy "read own conversation memberships" on public.conversation_participants
  for select to authenticated
  using (user_id = auth.uid() or public.is_participant(conversation_id, auth.uid()));

drop policy if exists "participants read messages" on public.messages;
create policy "participants read messages" on public.messages
  for select to authenticated
  using (sender_id = auth.uid() or public.is_participant(conversation_id, auth.uid()));
