-- Connect Chat: stored translations, one row per (message, language).
--
-- The message row is never touched: messages.body stays the original, exactly as
-- sent. A translation is a separate row, so the original, the English canonical
-- text and every recipient language can sit side by side with their metadata.
--
--   target_language = 'en'  the English canonical text of the message (also the
--                           place the detected source language is recorded);
--   any other code          the message as one recipient language reads it,
--                           made from the English canonical text.
--
-- Rows are written only by the server (service role), through the two functions
-- below, so that two instances never translate the same message twice:
--
--   chat_translation_claim   makes the row if needed and hands the work to ONE
--                            caller (status processing). A row that is completed,
--                            or being worked on, or waiting for its retry time is
--                            returned unclaimed. A claim that was never finished
--                            (a worker died) is re-claimable after 90 s.
--   chat_translation_finish  records the result: completed, or retrying with the
--                            next attempt time, or failed once the attempt budget
--                            (4) is spent.
--
-- Readers: people in the conversation, and Chat Manager. A message Chat Manager
-- hid or corrected is withheld from everyone else, so a translation cannot
-- reveal what moderation removed.

begin;

create table if not exists public.chat_message_translations (
  message_id uuid not null references public.messages(id) on delete cascade,
  target_language text not null,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'retrying')),
  source_language text,
  source_confidence real,
  translated_text text,
  identity boolean not null default false,
  attempts integer not null default 0,
  next_attempt_at timestamptz,
  claimed_at timestamptz,
  last_error text,
  provider text,
  model text,
  quality_score real,
  latency_ms integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (message_id, target_language),
  check (status <> 'completed' or translated_text is not null)
);
create index if not exists chat_message_translations_conversation_idx
  on public.chat_message_translations (conversation_id, status);
create index if not exists chat_message_translations_recent_idx
  on public.chat_message_translations (created_at desc);

alter table public.chat_message_translations enable row level security;
revoke all on public.chat_message_translations from anon, authenticated;
grant select on public.chat_message_translations to authenticated;
grant all on public.chat_message_translations to service_role;

drop policy if exists "participants read translations" on public.chat_message_translations;
create policy "participants read translations" on public.chat_message_translations
  for select to authenticated
  using (
    public.has_permission(auth.uid(), 'chat.manage')
    or (
      public.is_participant(conversation_id, auth.uid())
      and not exists (
        select 1 from public.chat_message_moderation mm where mm.message_id = chat_message_translations.message_id
      )
    )
  );

create or replace function public.chat_translation_claim(
  p_message uuid,
  p_target text,
  p_retry boolean default false
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_conversation uuid;
  v_row public.chat_message_translations;
begin
  select conversation_id into v_conversation from public.messages where id = p_message;
  if v_conversation is null then
    raise exception 'Message not found.';
  end if;

  insert into public.chat_message_translations (message_id, target_language, conversation_id)
  values (p_message, p_target, v_conversation)
  on conflict (message_id, target_language) do nothing;

  -- An explicit retry gives a failed translation a fresh attempt budget.
  if p_retry then
    update public.chat_message_translations
       set status = 'pending', attempts = 0, next_attempt_at = null, last_error = null, updated_at = now()
     where message_id = p_message and target_language = p_target and status = 'failed';
  end if;

  update public.chat_message_translations
     set status = 'processing', claimed_at = now(), attempts = attempts + 1, updated_at = now()
   where message_id = p_message and target_language = p_target
     and (
       status = 'pending'
       or (status = 'retrying' and coalesce(next_attempt_at, now()) <= now())
       or (status = 'processing' and claimed_at < now() - interval '90 seconds')
     )
  returning * into v_row;

  if found then
    return jsonb_build_object('claimed', true, 'row', to_jsonb(v_row));
  end if;

  select * into v_row from public.chat_message_translations
   where message_id = p_message and target_language = p_target;
  return jsonb_build_object('claimed', false, 'row', to_jsonb(v_row));
end;
$$;
revoke all on function public.chat_translation_claim(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.chat_translation_claim(uuid, text, boolean) to service_role;

create or replace function public.chat_translation_finish(
  p_message uuid,
  p_target text,
  p_status text,
  p_text text default null,
  p_source text default null,
  p_confidence real default null,
  p_identity boolean default false,
  p_error text default null,
  p_provider text default null,
  p_model text default null,
  p_quality real default null,
  p_latency integer default null,
  p_retry_in_seconds integer default null,
  p_refund_attempt boolean default false
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_row public.chat_message_translations;
  v_status text := p_status;
begin
  if v_status not in ('completed', 'retrying', 'failed') then
    raise exception 'Unknown translation status %', v_status;
  end if;

  select * into v_row from public.chat_message_translations
   where message_id = p_message and target_language = p_target;
  if not found then
    raise exception 'Translation row not found.';
  end if;
  -- Only the worker that holds the claim finishes it.
  if v_row.status <> 'processing' then
    return jsonb_build_object('updated', false, 'row', to_jsonb(v_row));
  end if;
  if v_status = 'retrying' and v_row.attempts >= 4 and not p_refund_attempt then
    v_status := 'failed';
  end if;

  update public.chat_message_translations
     set status = v_status,
         translated_text = case when v_status = 'completed' then p_text else translated_text end,
         source_language = coalesce(p_source, source_language),
         source_confidence = coalesce(p_confidence, source_confidence),
         identity = case when v_status = 'completed' then p_identity else identity end,
         last_error = case when v_status = 'completed' then null else p_error end,
         provider = coalesce(p_provider, provider),
         model = coalesce(p_model, model),
         quality_score = coalesce(p_quality, quality_score),
         latency_ms = coalesce(p_latency, latency_ms),
         next_attempt_at = case when v_status = 'retrying'
                                then now() + make_interval(secs => greatest(coalesce(p_retry_in_seconds, 5), 1))
                                else null end,
         attempts = case when p_refund_attempt then greatest(attempts - 1, 0) else attempts end,
         claimed_at = null,
         updated_at = now()
   where message_id = p_message and target_language = p_target
  returning * into v_row;

  return jsonb_build_object('updated', true, 'row', to_jsonb(v_row));
end;
$$;
revoke all on function public.chat_translation_finish(uuid, text, text, text, text, real, boolean, text, text, text, real, integer, integer, boolean) from public, anon, authenticated;
grant execute on function public.chat_translation_finish(uuid, text, text, text, text, real, boolean, text, text, text, real, integer, integer, boolean) to service_role;

-- Chat Manager's translation health: counts and latency percentiles.
create or replace function public.chat_translation_health(p_hours integer default 24)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_since timestamptz := now() - make_interval(hours => greatest(least(coalesce(p_hours, 24), 168), 1));
begin
  if auth.uid() is null or not public.has_permission(auth.uid(), 'chat.manage') then
    raise exception 'You do not have permission to manage chat.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'since', v_since,
    'by_status', coalesce((
      select jsonb_object_agg(status, n)
        from (select status, count(*) n from public.chat_message_translations
               where created_at >= v_since group by status) s), '{}'::jsonb),
    'latency_ms', (
      select jsonb_build_object(
               'samples', count(latency_ms),
               'p50', percentile_cont(0.50) within group (order by latency_ms),
               'p95', percentile_cont(0.95) within group (order by latency_ms),
               'p99', percentile_cont(0.99) within group (order by latency_ms))
        from public.chat_message_translations
       where created_at >= v_since and status = 'completed' and latency_ms is not null and not identity),
    'top_errors', coalesce((
      select jsonb_agg(jsonb_build_object('error', last_error, 'count', n))
        from (select last_error, count(*) n from public.chat_message_translations
               where created_at >= v_since and last_error is not null
               group by last_error order by n desc limit 5) e), '[]'::jsonb),
    'languages', coalesce((
      select jsonb_agg(jsonb_build_object('language', source_language, 'count', n))
        from (select source_language, count(*) n from public.chat_message_translations
               where created_at >= v_since and target_language = 'en' and source_language is not null
               group by source_language order by n desc limit 10) l), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.chat_translation_health(integer) from public, anon;
grant execute on function public.chat_translation_health(integer) to authenticated, service_role;

commit;


