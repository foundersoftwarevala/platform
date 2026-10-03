-- AMS write guards: rewards claims, tickets and the ticket's messages.
--
-- Proven on sv_platform (2026-10-02) in rolled-back transactions with real
-- accounts:
--
--  1. claims "clm_self_insert" let a user insert their own claim directly,
--     past ams_request_claim: an already approved claim at cost 0, a
--     "fulfilled" one decided by an admin, and two pending claims for one
--     reward. An admin approving the forged pending claim then charged its
--     cost of 0. Claims are now created only by ams_request_claim (SECURITY
--     DEFINER, which prices the claim from the reward and checks the wallet),
--     and one pending claim per reward per user, which also closes the
--     check-then-insert race in ams_request_claim.
--  2. ams_chat_messages, ams_events, ams_comments, ams_attachments insert
--     policies checked only the author column (chat even allowed no author):
--     a developer posted a "support" reply, forged a resolved status event and
--     added an internal note on a ticket they could not even read. Writing now
--     needs the same ticket membership as reading; a message has its author;
--     only the ticket's assignee or an admin speaks as staff or writes
--     internal notes.
--  3. ams_tickets update (creator, assignee or admin; any column): the creator
--     assigned the ticket to themselves, resolved it, and handed created_by and
--     customer_id to other people; a support user self-assigning and resolving
--     their own ticket earned 8 AMS awards through ams_on_ams_ticket. Now
--     created_by and customer_id stay as raised; the person who raised a
--     ticket does not assign it and moves it only along the requester's path
--     (the same table as REQUESTER_TRANSITIONS in tickets.types.ts) unless an
--     admin; and resolving a ticket you raised and assigned to yourself earns
--     nothing.
--  4. The requester never heard back: a staff reply or a status change by
--     someone else now notifies the person who raised the ticket through
--     mm_notify, as claim decisions already do.
--
-- Who counts as AMS support staff (developers today) is left as it is: that is
-- the owner's decision.

-- 1 ---------------------------------------------------------------------------
drop policy if exists clm_self_insert on public.claims;

create unique index if not exists claims_one_pending_per_reward
  on public.claims (user_id, reward_id)
  where status = 'pending';

-- 2 ---------------------------------------------------------------------------
create or replace function public.ams_ticket_member(p_ticket uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.ams_tickets t
    where t.id = p_ticket
      and (t.created_by = auth.uid() or t.assignee_id = auth.uid()
           or t.customer_id = auth.uid() or public.is_admin(auth.uid()))
  );
$$;

create or replace function public.ams_ticket_worker(p_ticket uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin(auth.uid()) or exists (
    select 1 from public.ams_tickets t
    where t.id = p_ticket and t.assignee_id = auth.uid()
  );
$$;

revoke execute on function public.ams_ticket_member(uuid) from public, anon;
revoke execute on function public.ams_ticket_worker(uuid) from public, anon;
grant execute on function public.ams_ticket_member(uuid) to authenticated, service_role;
grant execute on function public.ams_ticket_worker(uuid) to authenticated, service_role;

alter policy "ams_chat insert" on public.ams_chat_messages
  with check (
    author_id = auth.uid()
    and public.ams_ticket_member(ticket_id)
    and (coalesce(role, 'user') = 'user' or public.ams_ticket_worker(ticket_id))
  );

alter policy "ams_events insert" on public.ams_events
  with check (actor_id = auth.uid() and public.ams_ticket_member(ticket_id));

alter policy "ams_comments insert" on public.ams_comments
  with check (
    author_id = auth.uid()
    and public.ams_ticket_member(ticket_id)
    and (not coalesce(is_internal, false) or public.ams_ticket_worker(ticket_id))
  );

alter policy "ams_att insert" on public.ams_attachments
  with check (uploader_id = auth.uid() and public.ams_ticket_member(ticket_id));

-- 3 ---------------------------------------------------------------------------
create or replace function public.ams_requester_may_move(p_from text, p_to text)
returns boolean
language sql
immutable
as $$
  select case p_from
    when 'draft'             then p_to in ('submitted', 'cancelled')
    when 'submitted'         then p_to = 'cancelled'
    when 'assigned'          then p_to = 'cancelled'
    when 'accepted'          then p_to = 'cancelled'
    when 'in_progress'       then p_to = 'cancelled'
    when 'waiting_customer'  then p_to = 'cancelled'
    when 'waiting_developer' then p_to = 'cancelled'
    when 'waiting_qa'        then p_to = 'cancelled'
    when 'testing'           then p_to = 'cancelled'
    when 'reopened'          then p_to = 'cancelled'
    when 'resolved'          then p_to in ('closed', 'reopened')
    when 'closed'            then p_to = 'reopened'
    else false
  end;
$$;

create or replace function public.ams_guard_ticket_update()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if current_user not in ('authenticated', 'anon') or v_uid is null or public.is_admin(v_uid) then
    return new;
  end if;

  if (new.created_by, new.customer_id) is distinct from (old.created_by, old.customer_id) then
    raise exception 'Who raised a ticket, and for whom, does not change'
      using errcode = '42501';
  end if;

  -- The person who raised the ticket (and is not its assignee) is the requester.
  if old.created_by = v_uid and old.assignee_id is distinct from v_uid then
    if new.assignee_id is distinct from old.assignee_id then
      raise exception 'The support team assigns a ticket, not the person who raised it'
        using errcode = '42501';
    end if;
    if new.status is distinct from old.status
       and not public.ams_requester_may_move(old.status::text, new.status::text)
       -- withdrawing (archive) and restoring one's own ticket
       and not (new.status::text = 'archived' and new.deleted_at is not null)
       and not (old.status::text = 'archived' and new.status::text = 'submitted') then
      raise exception 'A ticket cannot be moved from % to % by the person who raised it', old.status, new.status
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists ams_tickets_guard_update on public.ams_tickets;
create trigger ams_tickets_guard_update
  before update on public.ams_tickets
  for each row execute function public.ams_guard_ticket_update();

create or replace function public.ams_on_ams_ticket()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.status::text in ('resolved','closed')
     and coalesce(old.status::text,'') not in ('resolved','closed')
     and new.assignee_id is not null
     -- Resolving a ticket you raised yourself is not support work.
     and new.assignee_id is distinct from new.created_by then
    begin
      perform public.ams_ingest_event(
        new.assignee_id, 'support.resolved', 'ams_tickets', new.id::text, 1,
        coalesce(new.resolved_at, now()), 'trigger',
        jsonb_build_object('ticket_id', new.id, 'ams_role', 'support'));
    exception when others then
      -- Recognition never blocks the business event; the failure is recorded.
      perform public.ams_record_failure('ams_on_ams_ticket', sqlerrm,
        jsonb_build_object('table', tg_table_name, 'id', new.id));
    end;
  end if;
  return new;
end $function$;

-- 4 ---------------------------------------------------------------------------
create or replace function public.ams_notify_requester()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.ams_tickets;
begin
  if tg_table_name = 'ams_chat_messages' then
    select * into v_ticket from public.ams_tickets where id = new.ticket_id;
    if v_ticket.id is null or v_ticket.created_by is null
       or new.author_id is not distinct from v_ticket.created_by then
      return new;
    end if;
    begin
      perform public.mm_notify('ams.ticket_reply',
        format('Reply on %s', v_ticket.ticket_no),
        format('There is a new reply on your request "%s".', v_ticket.subject),
        v_ticket.created_by, null, null, null, 0, 'info');
    exception when others then null;  -- a notice never blocks the reply
    end;
  elsif tg_table_name = 'ams_tickets' then
    if new.status is not distinct from old.status or new.created_by is null
       or auth.uid() is not distinct from new.created_by then
      return new;
    end if;
    begin
      perform public.mm_notify('ams.ticket_status',
        format('%s is now %s', new.ticket_no, replace(new.status::text, '_', ' ')),
        format('Your request "%s" moved from %s to %s.', new.subject,
               replace(old.status::text, '_', ' '), replace(new.status::text, '_', ' ')),
        new.created_by, null, null, null, 0,
        case when new.status::text in ('resolved', 'closed') then 'success' else 'info' end);
    exception when others then null;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists ams_chat_notify_requester on public.ams_chat_messages;
create trigger ams_chat_notify_requester
  after insert on public.ams_chat_messages
  for each row execute function public.ams_notify_requester();

drop trigger if exists ams_tickets_notify_requester on public.ams_tickets;
create trigger ams_tickets_notify_requester
  after update of status on public.ams_tickets
  for each row execute function public.ams_notify_requester();
