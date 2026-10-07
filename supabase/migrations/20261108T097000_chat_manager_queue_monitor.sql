-- Chat Manager: the queue and the monitor, as database functions.
--
-- Both are SECURITY INVOKER, so row-level security still applies to the caller,
-- and both refuse anyone without chat.manage. Nothing here stores new data: the
-- queue reads the canonical conversations/messages, the monitor reads tables
-- that already exist (chat_ai_events, ai_agent_runs, chat_message_translations,
-- usage_events, fa_jobs, i18n_translation_jobs). Optional tables are read only if
-- they exist, so a missing source shows up as absent, never as a made-up zero.
--
-- chat_manager_queue : cursor-paginated (last_message_at, id) conversation list
--   with filters and search, served by messages_conversation_cursor_idx,
--   conversations_activity_idx and the existing full-text index on messages.body.
-- chat_manager_monitor : live counts, AI, provider, worker, translation and SLA
--   figures for a time window.

begin;

create or replace function public.chat_manager_queue(
  p_filters jsonb default '{}'::jsonb,
  p_limit integer default 30,
  p_cursor_at timestamptz default null,
  p_cursor_id uuid default null
)
returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 30), 100));
  v_view text := coalesce(p_filters ->> 'view', 'all');
  v_q text := nullif(btrim(coalesce(p_filters ->> 'q', '')), '');
  v_uuid uuid;
  v_wait integer := nullif(p_filters ->> 'waiting_over_minutes', '')::integer;
  v_rows jsonb;
  v_cursor_at timestamptz;
  v_cursor_id uuid;
  v_more boolean;
begin
  if auth.uid() is null or not public.has_permission(auth.uid(), 'chat.manage') then
    raise exception 'You do not have permission to manage chat.' using errcode = '42501';
  end if;
  if v_q is not null and v_q ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_uuid := v_q::uuid;
  end if;

  with page as (
    select c.*
      from public.conversations c
     where (p_cursor_at is null or (c.last_message_at, c.id) < (p_cursor_at, p_cursor_id))
       and (p_filters ->> 'status' is null or c.status = p_filters ->> 'status')
       and (p_filters ->> 'priority' is null or c.priority = p_filters ->> 'priority')
       and (p_filters ->> 'handler' is null or c.assigned_agent_id = (p_filters ->> 'handler')::uuid)
       and (p_filters ->> 'ai' is null
            or (p_filters ->> 'ai' = 'on' and c.ai_enabled)
            or (p_filters ->> 'ai' = 'off' and not c.ai_enabled))
       and (p_filters ->> 'from' is null or c.last_message_at >= (p_filters ->> 'from')::timestamptz)
       and (p_filters ->> 'to' is null or c.last_message_at <= (p_filters ->> 'to')::timestamptz)
       and (v_view <> 'unassigned' or (c.assigned_agent_id is null and c.status not in ('closed', 'resolved')))
       and (v_view <> 'ai' or c.ai_enabled)
       and (v_view <> 'human' or not c.ai_enabled)
       and (v_view <> 'active' or c.status = 'open')
       and (v_view <> 'pending' or c.status = 'pending'
            or exists (select 1 from public.chat_handoffs h where h.conversation_id = c.id and h.status = 'pending'))
       and (v_view <> 'escalated' or c.status = 'escalated')
       and (v_view <> 'high' or c.priority in ('high', 'urgent'))
       and (v_view <> 'closed' or c.status in ('closed', 'resolved'))
       and (v_view <> 'reopened' or exists (
              select 1 from public.audit_logs a
               where a.entity_id = c.id::text and a.action = 'chat.conversation.status'
                 and a.metadata ->> 'from' in ('closed', 'resolved') and a.metadata ->> 'to' = 'open'))
       and (v_view <> 'failed' or coalesce((
              select e.outcome = 'failed' from public.chat_ai_events e
               where e.conversation_id = c.id order by e.created_at desc limit 1), false))
       and (v_view <> 'translation_failed' or exists (
              select 1 from public.chat_message_translations t
               where t.conversation_id = c.id and t.status = 'failed'))
       and (v_view <> 'translation_pending' or exists (
              select 1 from public.chat_message_translations t
               where t.conversation_id = c.id and t.status in ('pending', 'processing', 'retrying')))
       and (v_view <> 'waiting' or coalesce((
              select m.sender_id = c.created_by from public.messages m
               where m.conversation_id = c.id order by m.created_at desc, m.id desc limit 1), false))
       and (v_wait is null or coalesce((
              select m.sender_id = c.created_by and m.created_at < now() - make_interval(mins => v_wait)
                from public.messages m where m.conversation_id = c.id
               order by m.created_at desc, m.id desc limit 1), false))
       and (p_filters ->> 'lead' is null or (p_filters ->> 'lead')::boolean = exists (
              select 1 from public.chat_conversation_links l where l.conversation_id = c.id and l.entity_type = 'lead'))
       and (p_filters ->> 'task' is null or (p_filters ->> 'task')::boolean = exists (
              select 1 from public.chat_conversation_links l where l.conversation_id = c.id and l.entity_type = 'task'))
       and (p_filters ->> 'agent' is null or exists (
              select 1 from public.chat_ai_events e
               where e.conversation_id = c.id and e.agent_key = p_filters ->> 'agent'))
       and (p_filters ->> 'language' is null or exists (
              select 1 from public.chat_message_translations t
               where t.conversation_id = c.id and t.target_language = 'en' and t.source_language = p_filters ->> 'language'))
       and (v_q is null
            or c.subject ilike '%' || v_q || '%'
            or c.reference_code ilike '%' || v_q || '%'
            or (v_uuid is not null and (c.id = v_uuid or c.created_by = v_uuid or exists (
                  select 1 from public.messages m where m.id = v_uuid and m.conversation_id = c.id) or exists (
                  select 1 from public.chat_conversation_links l where l.conversation_id = c.id and l.entity_id = v_uuid)))
            or exists (select 1 from public.profiles pr where pr.id = c.created_by
                        and (pr.display_name ilike '%' || v_q || '%' or pr.email ilike '%' || v_q || '%' or pr.handle ilike '%' || v_q || '%'))
            or exists (select 1 from public.messages m where m.conversation_id = c.id
                        and to_tsvector('simple', m.body) @@ plainto_tsquery('simple', v_q)))
     order by c.last_message_at desc, c.id desc
     limit v_limit + 1
  ), shown as (
    select * from page order by last_message_at desc, id desc limit v_limit
  )
  select coalesce(jsonb_agg(row_to_json(r)::jsonb order by r.last_message_at desc, r.id desc), '[]'::jsonb),
         (select count(*) from page) > v_limit
    into v_rows, v_more
    from (
      select s.id, s.subject, s.kind, s.status, s.priority, s.department, s.ai_enabled, s.assigned_agent_id,
             s.created_by as customer_id, s.created_at, s.last_message_at,
             (select coalesce(p.display_name, p.full_name, p.handle) from public.profiles p where p.id = s.created_by) as customer_name,
             (select coalesce(p.display_name, p.full_name, p.handle) from public.profiles p where p.id = s.assigned_agent_id) as handler_name,
             (select left(m.body, 140) from public.messages m where m.conversation_id = s.id order by m.created_at desc, m.id desc limit 1) as last_body,
             (select m.kind from public.messages m where m.conversation_id = s.id order by m.created_at desc, m.id desc limit 1) as last_kind,
             coalesce((select m.sender_id = s.created_by from public.messages m where m.conversation_id = s.id order by m.created_at desc, m.id desc limit 1), false) as customer_last,
             (select count(*) from public.conversation_participants cp where cp.conversation_id = s.id) as participants,
             (select min(m.created_at) from public.messages m where m.conversation_id = s.id and m.sender_id = s.created_by) as first_customer_at,
             (select min(m.created_at) from public.messages m where m.conversation_id = s.id and m.sender_id <> s.created_by and m.kind in ('text', 'ai', 'file')) as first_reply_at,
             (select e.agent_key from public.chat_ai_events e where e.conversation_id = s.id and e.agent_key is not null order by e.created_at desc limit 1) as agent_key,
             (select e.outcome from public.chat_ai_events e where e.conversation_id = s.id order by e.created_at desc limit 1) as last_ai_outcome,
             exists (select 1 from public.chat_handoffs h where h.conversation_id = s.id and h.status = 'pending') as pending_handoff,
             exists (select 1 from public.chat_message_translations t where t.conversation_id = s.id and t.status = 'failed') as translation_failed,
             (select count(*) from public.chat_conversation_links l where l.conversation_id = s.id and l.entity_type = 'task') as tasks,
             (select count(*) from public.chat_conversation_links l where l.conversation_id = s.id and l.entity_type = 'lead') as leads
        from shown s
    ) r;

  if v_more then
    select c.last_message_at, c.id into v_cursor_at, v_cursor_id
      from public.conversations c
     where c.id = ((v_rows -> (jsonb_array_length(v_rows) - 1)) ->> 'id')::uuid;
  end if;

  return jsonb_build_object(
    'rows', v_rows,
    'next_cursor', case when v_more then jsonb_build_object('at', v_cursor_at, 'id', v_cursor_id) else null end
  );
end;
$$;
revoke all on function public.chat_manager_queue(jsonb, integer, timestamptz, uuid) from public, anon;
grant execute on function public.chat_manager_queue(jsonb, integer, timestamptz, uuid) to authenticated, service_role;

create or replace function public.chat_manager_monitor(p_hours integer default 24)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_hours integer := greatest(1, least(coalesce(p_hours, 24), 168));
  v_since timestamptz;
  v_out jsonb := '{}'::jsonb;
  v_part jsonb;
begin
  if auth.uid() is null or not public.has_permission(auth.uid(), 'chat.manage') then
    raise exception 'You do not have permission to manage chat.' using errcode = '42501';
  end if;
  v_since := now() - make_interval(hours => v_hours);

  -- conversations (live state, not windowed)
  select jsonb_build_object(
    'total', count(*),
    'open', count(*) filter (where status = 'open'),
    'pending', count(*) filter (where status = 'pending'),
    'escalated', count(*) filter (where status = 'escalated'),
    'closed', count(*) filter (where status in ('closed', 'resolved')),
    'ai', count(*) filter (where ai_enabled and status not in ('closed', 'resolved')),
    'human', count(*) filter (where not ai_enabled and status not in ('closed', 'resolved')),
    'unassigned', count(*) filter (where assigned_agent_id is null and status not in ('closed', 'resolved')),
    'stale_24h', count(*) filter (where status in ('open', 'pending') and last_message_at < now() - interval '24 hours'),
    'high_priority', count(*) filter (where priority in ('high', 'urgent') and status not in ('closed', 'resolved'))
  ) into v_part from public.conversations;
  v_out := v_out || jsonb_build_object('conversations', v_part);

  -- who is waiting for a reply right now
  select jsonb_build_object(
    'waiting', count(*),
    'oldest_waiting_at', min(w.last_at)
  ) into v_part
  from (
    select c.id, (select m.created_at from public.messages m where m.conversation_id = c.id order by m.created_at desc, m.id desc limit 1) as last_at,
           (select m.sender_id from public.messages m where m.conversation_id = c.id order by m.created_at desc, m.id desc limit 1) as last_sender,
           c.created_by
      from public.conversations c where c.status in ('open', 'pending', 'escalated')
  ) w where w.last_sender = w.created_by;
  v_out := v_out || jsonb_build_object('waiting', v_part);

  -- first response (conversations opened in the window), split by who answered
  select jsonb_build_object(
    'samples', count(*) filter (where first_reply_at is not null),
    'p50_s', percentile_cont(0.5) within group (order by extract(epoch from first_reply_at - first_customer_at)),
    'p95_s', percentile_cont(0.95) within group (order by extract(epoch from first_reply_at - first_customer_at)),
    'unanswered', count(*) filter (where first_customer_at is not null and first_reply_at is null)
  ) into v_part
  from (
    select (select min(m.created_at) from public.messages m where m.conversation_id = c.id and m.sender_id = c.created_by) first_customer_at,
           (select min(m.created_at) from public.messages m where m.conversation_id = c.id and m.sender_id <> c.created_by and m.kind in ('text', 'ai', 'file')) first_reply_at
      from public.conversations c where c.created_at >= v_since
  ) f;
  v_out := v_out || jsonb_build_object('first_response', v_part);

  -- AI activity in Chat
  if to_regclass('public.chat_ai_events') is not null then
    execute $q$
      select jsonb_build_object(
        'replied', count(*) filter (where outcome = 'replied'),
        'escalated', count(*) filter (where outcome = 'escalated'),
        'failed', count(*) filter (where outcome = 'failed'),
        'p50_ms', percentile_cont(0.5) within group (order by latency_ms) filter (where latency_ms is not null),
        'p95_ms', percentile_cont(0.95) within group (order by latency_ms) filter (where latency_ms is not null),
        'last_at', max(created_at),
        'agents', coalesce((
          select jsonb_agg(jsonb_build_object('agent_key', a.agent_key, 'events', a.n, 'failed', a.f, 'avg_ms', a.avg_ms, 'last_at', a.last_at) order by a.n desc)
            from (select coalesce(agent_key, 'general-assistant') agent_key, count(*) n,
                         count(*) filter (where outcome = 'failed') f, round(avg(latency_ms)) avg_ms, max(created_at) last_at
                    from public.chat_ai_events where created_at >= $1 group by 1 order by 2 desc limit 15) a), '[]'::jsonb))
        from public.chat_ai_events where created_at >= $1
    $q$ into v_part using v_since;
    v_out := v_out || jsonb_build_object('ai', v_part);
  end if;

  -- recorded agent runs for Chat
  if to_regclass('public.ai_agent_runs') is not null then
    execute $q$
      select jsonb_build_object(
        'by_state', coalesce((select jsonb_object_agg(state, n) from (select state, count(*) n from public.ai_agent_runs
                       where scope like 'chat:%' and started_at >= $1 group by state) s), '{}'::jsonb),
        'last_at', (select max(started_at) from public.ai_agent_runs where scope like 'chat:%'))
    $q$ into v_part using v_since;
    v_out := v_out || jsonb_build_object('agent_runs', v_part);
  end if;

  -- providers, as metered by the AI gateway
  if to_regclass('public.usage_events') is not null and to_regclass('public.api_services') is not null then
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object('service', p.name, 'calls', p.n, 'ok', p.ok, 'failed', p.n - p.ok,
               'avg_ms', p.avg_ms, 'last_at', p.last_at, 'last_ok_at', p.last_ok_at, 'last_status', p.last_status) order by p.n desc), '[]'::jsonb)
        from (select s.name, count(*) n, count(*) filter (where e.success) ok, round(avg(e.latency_ms)) avg_ms,
                     max(e.occurred_at) last_at, max(e.occurred_at) filter (where e.success) last_ok_at,
                     (array_agg(e.status_code order by e.occurred_at desc))[1] last_status
                from public.usage_events e join public.api_services s on s.id = e.service_id
               where e.occurred_at >= $1 group by s.name) p
    $q$ into v_part using v_since;
    v_out := v_out || jsonb_build_object('providers', v_part);
  end if;

  -- queue workers: the platform job queue
  if to_regclass('public.fa_jobs') is not null then
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object('job_type', j.job_type, 'queued', j.queued, 'running', j.running,
               'completed_window', j.completed, 'failed_window', j.failed, 'dead_letter', j.dead,
               'oldest_queued_at', j.oldest_queued, 'last_activity_at', j.last_activity, 'max_attempts_seen', j.max_attempts) order by j.job_type), '[]'::jsonb)
        from (select job_type,
                     count(*) filter (where status = 'queued') queued,
                     count(*) filter (where status in ('running', 'claimed')) running,
                     count(*) filter (where status = 'completed' and completed_at >= $1) completed,
                     count(*) filter (where status in ('failed', 'retrying') and coalesce(failed_at, updated_at) >= $1) failed,
                     count(*) filter (where status = 'dead_letter') dead,
                     min(created_at) filter (where status = 'queued') oldest_queued,
                     max(coalesce(completed_at, failed_at, started_at, updated_at)) last_activity,
                     max(attempts) max_attempts
                from public.fa_jobs group by job_type) j
    $q$ into v_part using v_since;
    v_out := v_out || jsonb_build_object('queue_workers', v_part);
  end if;
  if to_regclass('public.fa_job_limits') is not null then
    execute 'select coalesce(jsonb_agg(to_jsonb(l)), ''[]''::jsonb) from public.fa_job_limits l' into v_part;
    v_out := v_out || jsonb_build_object('queue_limits', v_part);
  end if;

  -- translation job worker (catalogue translation shares the engine with Chat)
  if to_regclass('public.i18n_translation_jobs') is not null then
    execute $q$
      select jsonb_build_object(
        'by_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from public.i18n_translation_jobs group by status) s), '{}'::jsonb),
        'last_activity_at', (select max(updated_at) from public.i18n_translation_jobs),
        'oldest_queued_at', (select min(created_at) from public.i18n_translation_jobs where status = 'queued'))
    $q$ into v_part;
    v_out := v_out || jsonb_build_object('translation_jobs', v_part);
  end if;

  -- Chat message translations
  if to_regclass('public.chat_message_translations') is not null then
    v_out := v_out || jsonb_build_object('chat_translation', public.chat_translation_health(v_hours));
  end if;

  return v_out || jsonb_build_object('window_hours', v_hours, 'generated_at', now());
end;
$$;
revoke all on function public.chat_manager_monitor(integer) from public, anon;
grant execute on function public.chat_manager_monitor(integer) to authenticated, service_role;

commit;
