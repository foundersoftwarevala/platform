-- Marketing: the parts that are real without a provider.
--
-- No channel can send anything in this environment - there is no SMTP,
-- SendGrid, Twilio, WhatsApp, Telegram, Discord, VAPID or social credential
-- configured. Building twelve channel screens over that would produce the dead
-- buttons the brief forbids.
--
-- But three pieces of this suite need no provider at all, and all three are
-- prerequisites for the day one is connected:
--
--   the campaign lifecycle and its approval gate - pure state, pure audit
--   consent                                      - the gate every send must pass
--   audience segmentation                        - computed from real customers
--
-- Those are built here. marketing_campaigns and marketing_approvals already
-- exist and are reused; only marketing_consents is created, because nothing in
-- this database records whether a customer agreed to be contacted.

/* ---------------------------------------------------------- the lifecycle */

-- The states the brief describes. 'active' is kept alongside 'running' because
-- existing rows use it and renaming them would rewrite history for no gain.
alter table public.marketing_campaigns
  drop constraint if exists marketing_campaigns_status_ck;
alter table public.marketing_campaigns
  add constraint marketing_campaigns_status_ck
  check (status in ('draft','review','approved','scheduled','running','active',
                    'paused','completed','cancelled','archived'));

alter table public.marketing_campaigns add column if not exists submitted_at timestamptz;
alter table public.marketing_campaigns add column if not exists approved_at timestamptz;
alter table public.marketing_campaigns add column if not exists approved_by uuid;
alter table public.marketing_campaigns add column if not exists updated_by uuid;

create index if not exists marketing_campaigns_status_idx on public.marketing_campaigns (status);

-- Which moves are allowed. A state machine written down once, so the screen
-- cannot offer a transition the database will refuse.
create or replace function public.mm_campaign_allowed(p_from text, p_to text)
returns boolean
language sql
immutable
as $$
  select case p_from
    when 'draft'     then p_to in ('review','cancelled','archived')
    when 'review'    then p_to in ('approved','draft','cancelled')
    when 'approved'  then p_to in ('scheduled','running','draft','cancelled')
    when 'scheduled' then p_to in ('running','paused','cancelled','draft')
    when 'running'   then p_to in ('paused','completed','cancelled')
    when 'active'    then p_to in ('paused','completed','cancelled')
    when 'paused'    then p_to in ('running','completed','cancelled')
    when 'completed' then p_to in ('archived')
    when 'cancelled' then p_to in ('archived','draft')
    when 'archived'  then false
    else false
  end;
$$;

create or replace function public.mm_campaign_transition(
  p_id uuid, p_to text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare c record; v_before jsonb; v_after jsonb; v_problems text[] := '{}';
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  select * into c from public.marketing_campaigns where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_campaign');
  end if;
  v_before := to_jsonb(c);

  if not public.mm_campaign_allowed(coalesce(c.status,'draft'), p_to) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_transition',
      'message', format('A campaign cannot go from %s to %s.',
                        coalesce(c.status,'draft'), p_to));
  end if;

  -- Going live is the transition that would spend money and contact people, so
  -- it is the one that is validated.
  if p_to in ('running','scheduled') then
    if coalesce(c.is_seed, false) then
      v_problems := v_problems || 'This is demonstration data and cannot be run.'::text;
    end if;
    if coalesce(btrim(c.name), '') = '' then
      v_problems := v_problems || 'The campaign needs a name.'::text;
    end if;
    if coalesce(btrim(c.channel), '') = '' then
      v_problems := v_problems || 'The campaign needs a channel.'::text;
    end if;
    if c.end_date is not null and c.end_date < current_date then
      v_problems := v_problems || 'The campaign window has already closed.'::text;
    end if;
    if coalesce(c.budget, 0) > 0 and coalesce(c.spend, 0) > c.budget then
      v_problems := v_problems || 'Spend already exceeds the budget.'::text;
    end if;
    -- The approval gate. A campaign reaches 'approved' only through review.
    if coalesce(c.status,'draft') not in ('approved','scheduled','paused') then
      v_problems := v_problems || 'The campaign must be approved before it can run.'::text;
    end if;
  end if;

  if array_length(v_problems, 1) > 0 then
    return jsonb_build_object('ok', false, 'reason', 'validation_failed',
                              'problems', to_jsonb(v_problems));
  end if;

  update public.marketing_campaigns set
    status       = p_to,
    submitted_at = case when p_to = 'review'    then coalesce(submitted_at, now()) else submitted_at end,
    approved_at  = case when p_to = 'approved'  then now() else approved_at end,
    approved_by  = case when p_to = 'approved'  then auth.uid() else approved_by end,
    updated_by   = auth.uid(), updated_at = now()
  where id = p_id
  returning to_jsonb(marketing_campaigns) into v_after;

  -- Submitting for review raises a real approval record, which is what the
  -- Approvals screen reads.
  if p_to = 'review' then
    insert into public.marketing_approvals
      (item_type, item_name, requested_by, requested_at, status, priority, is_seed)
    values ('campaign', c.name,
            coalesce((select email from auth.users where id = auth.uid()), 'operator'),
            now(), 'pending', 'normal', false);
  end if;

  if p_to in ('approved','cancelled') then
    update public.marketing_approvals
       set status = case when p_to = 'approved' then 'approved' else 'rejected' end,
           decided_at = now(), decided_by = auth.uid(),
           approver = coalesce((select email from auth.users where id = auth.uid()), 'operator'),
           notes = coalesce(p_reason, notes)
     where item_type = 'campaign' and item_name = c.name and status = 'pending';
  end if;

  perform public.mm_audit('campaign.' || p_to, 'marketing_campaign', p_id::text,
                          v_before, v_after, p_reason);

  return jsonb_build_object('ok', true, 'campaign', v_after);
end;
$$;

/* -------------------------------------------------------------- consent */

-- Nothing in this database records whether a customer agreed to be contacted.
-- Every channel must check this before it sends, so it is created now rather
-- than when a provider arrives and the question becomes urgent.
create table if not exists public.marketing_consents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  channel     text not null check (channel in
                ('email','sms','whatsapp','push','telegram','discord')),
  granted     boolean not null default false,
  -- Where the agreement came from, so it can be evidenced later.
  source      text,
  granted_at  timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, channel)
);

create index if not exists marketing_consents_user_idx on public.marketing_consents (user_id);
create index if not exists marketing_consents_channel_idx on public.marketing_consents (channel, granted);

alter table public.marketing_consents enable row level security;

-- A person may see and change their own consent; operators may read all, which
-- is what an audience count needs. Never USING(true).
drop policy if exists marketing_consents_own on public.marketing_consents;
create policy marketing_consents_own on public.marketing_consents
  for select to authenticated
  using (user_id = auth.uid() or public.mm_is_operator());

drop policy if exists marketing_consents_self_write on public.marketing_consents;
create policy marketing_consents_self_write on public.marketing_consents
  for all to authenticated
  using (user_id = auth.uid() or public.mm_is_operator())
  with check (user_id = auth.uid() or public.mm_is_operator());

drop policy if exists marketing_consents_anon_sel on public.marketing_consents;
create policy marketing_consents_anon_sel on public.marketing_consents
  as restrictive for select to anon using (false);
drop policy if exists marketing_consents_anon_ins on public.marketing_consents;
create policy marketing_consents_anon_ins on public.marketing_consents
  as restrictive for insert to anon with check (false);
drop policy if exists marketing_consents_anon_upd on public.marketing_consents;
create policy marketing_consents_anon_upd on public.marketing_consents
  as restrictive for update to anon using (false) with check (false);
drop policy if exists marketing_consents_anon_del on public.marketing_consents;
create policy marketing_consents_anon_del on public.marketing_consents
  as restrictive for delete to anon using (false);

-- Recording a consent decision. Audited, because withdrawing consent is a
-- thing a customer may later need evidenced.
create or replace function public.mm_consent_set(
  p_user uuid, p_channel text, p_granted boolean, p_source text default 'manager')
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_before jsonb; v_after jsonb;
begin
  if not (public.mm_is_operator() or p_user = auth.uid()) then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if not exists (select 1 from auth.users where id = p_user) then
    return jsonb_build_object('ok', false, 'reason', 'unknown_user');
  end if;

  select to_jsonb(c) into v_before from public.marketing_consents c
   where c.user_id = p_user and c.channel = p_channel;

  insert into public.marketing_consents
    (user_id, channel, granted, source, granted_at, revoked_at)
  values (p_user, p_channel, p_granted, p_source,
          case when p_granted then now() end,
          case when not p_granted then now() end)
  on conflict (user_id, channel) do update set
    granted    = excluded.granted,
    source     = excluded.source,
    granted_at = case when excluded.granted then now() else public.marketing_consents.granted_at end,
    revoked_at = case when not excluded.granted then now() else null end,
    updated_at = now()
  returning to_jsonb(marketing_consents) into v_after;

  perform public.mm_audit(
    case when p_granted then 'consent.granted' else 'consent.revoked' end,
    'marketing_consent', p_user::text, v_before, v_after, p_channel);

  return jsonb_build_object('ok', true, 'consent', v_after);
end;
$$;

/* --------------------------------------------------- audience segmentation */

-- Who a campaign could actually reach, computed from real customers rather
-- than a stored list that goes stale.
--
-- The reachable count is the one that matters: it is the segment intersected
-- with consent for the channel. With no consent recorded yet, that is zero for
-- every segment - which is the correct answer, not a broken one.
create or replace function public.mm_audience(p_segment text default 'all',
                                              p_channel text default 'email')
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_total integer; v_reachable integer;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  with base as (
    select u.id,
           (select count(*) from public.marketplace_orders o
             where o.buyer_id = u.id and o.status::text = 'paid') as paid_orders,
           coalesce((select sum(o.total) from public.marketplace_orders o
                      where o.buyer_id = u.id and o.status::text = 'paid'), 0) as lifetime_value,
           u.last_sign_in_at
      from auth.users u
  ),
  segmented as (
    select b.* from base b
     where case p_segment
             when 'all'         then true
             when 'customers'   then b.paid_orders > 0
             when 'registered'  then b.paid_orders = 0
             when 'vip'         then b.paid_orders > 1 or b.lifetime_value > 249
             when 'inactive_30d' then b.last_sign_in_at is null
                                    or b.last_sign_in_at < now() - interval '30 days'
             else true
           end
  )
  select count(*),
         count(*) filter (where exists (
           select 1 from public.marketing_consents mc
            where mc.user_id = segmented.id and mc.channel = p_channel and mc.granted))
    into v_total, v_reachable
    from segmented;

  return jsonb_build_object(
    'ok', true,
    'segment', p_segment,
    'channel', p_channel,
    'in_segment', v_total,
    -- Consent is the gate. Nobody is reachable until they have agreed.
    'reachable', v_reachable,
    'blocked_by_consent', v_total - v_reachable,
    'consent_records', (select count(*) from public.marketing_consents),
    'note', case when v_reachable = 0
                 then 'No customer has recorded consent for this channel, so nothing may be sent to any of them.'
                 else null end);
end;
$$;
