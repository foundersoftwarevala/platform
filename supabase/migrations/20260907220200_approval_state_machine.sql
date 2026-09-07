-- Author Approval Workflow, part three: the state machine and the gate.

/* -------------------------------------------------------- creating one */

create or replace function public.mm_submission_create(
  p_product uuid, p_type text default 'new', p_version uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_p record; v_no text; v_sla record; v_row jsonb; v_rules jsonb; v_start text;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if p_type not in ('new','update') then
    return jsonb_build_object('ok', false, 'reason', 'unknown_type');
  end if;

  select * into v_p from public.marketplace_products where id = p_product;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_product');
  end if;

  if exists (select 1 from public.author_submissions
              where product_id = p_product
                and status in ('draft','pending_review','verifying','changes_requested')) then
    return jsonb_build_object('ok', false, 'reason', 'already_open',
      'message', 'This product already has an open submission. Finish or archive it first.');
  end if;

  select * into v_sla from public.author_approval_sla where id;
  v_no := 'SVA-' || lpad(((select count(*) from public.author_submissions) + 1)::text, 4, '0');

  -- The rules decide where a submission starts. Each is read from the table,
  -- never assumed, and the reason is written to the history below.
  v_start := 'pending_review';
  select jsonb_object_agg(key, jsonb_build_object('enabled', enabled, 'config', config))
    into v_rules from public.author_approval_rules;

  if p_type = 'update'
     and coalesce((v_rules->'auto_verify_trusted_updates'->>'enabled')::boolean, false)
     and v_p.seller_id is not null
     and (select count(*) from public.author_submissions
           where seller_id = v_p.seller_id and status = 'approved')
         >= coalesce((v_rules->'auto_verify_trusted_updates'->'config'->>'min_approved')::int, 3)
     and not exists (select 1 from public.legal_violations
                      where violator_id = v_p.seller_id::text
                        and coalesce(status,'open') not in ('resolved','dismissed'))
  then
    v_start := 'verifying';
  end if;

  insert into public.author_submissions
    (submission_no, product_id, seller_id, version_id, submission_type,
     status, submitted_at, sla_due_at, escalate_at, created_by)
  values (v_no, p_product, v_p.seller_id, p_version, p_type,
          v_start, now(),
          now() + (v_sla.response_hours || ' hours')::interval,
          now() + (v_sla.escalate_hours || ' hours')::interval,
          auth.uid())
  returning to_jsonb(author_submissions) into v_row;

  -- The product enters the workflow. It is not publicly visible again until a
  -- decision says so.
  update public.marketplace_products
     set moderation_status = 'submitted', updated_at = now()
   where id = p_product;

  perform public.mm_submission_risk_refresh((v_row->>'id')::uuid);

  insert into public.author_approval_history
    (submission_id, revision, action, from_status, to_status, actor_id, actor_role, reason)
  values ((v_row->>'id')::uuid, 1, 'submitted', null, v_start, auth.uid(), 'operator',
          case when v_start = 'verifying'
               then 'Trusted-author rule sent this update straight to verification.'
               else 'Submitted for review.' end);

  perform public.mm_audit('submission.created','author_submission', v_row->>'id',
                          null, v_row, null);

  return jsonb_build_object('ok', true,
    'submission', (select to_jsonb(s) from public.author_submissions s
                    where s.id = (v_row->>'id')::uuid));
end;
$$;

/* ------------------------------------------------------- the state machine */

-- Move a submission, or refuse to.
--
-- Four things have to hold before anything changes: the transition must be one
-- the machine allows, the caller must be an operator, the caller must be
-- holding the version they read, and — for an approval — every mandatory check
-- must pass. A failure at any of them changes nothing at all.
create or replace function public.mm_submission_transition(
  p_id uuid, p_to text, p_reason text default null,
  p_lock integer default null, p_comment text default null,
  p_override boolean default false)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_s record; v_after jsonb; v_allowed boolean; v_checks jsonb;
  v_owner uuid; v_rules jsonb; v_notify boolean; v_role text;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if p_to not in ('draft','pending_review','verifying','changes_requested',
                  'approved','rejected','suspended','archived') then
    return jsonb_build_object('ok', false, 'reason', 'unknown_status');
  end if;

  select * into v_s from public.author_submissions where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_submission');
  end if;

  -- Optimistic concurrency. Two reviewers cannot both act on what they read.
  if p_lock is not null and p_lock <> v_s.lock_version then
    return jsonb_build_object('ok', false, 'reason', 'stale',
      'message', 'Submission changed by another reviewer. Refresh before continuing.',
      'current_status', v_s.status, 'current_lock', v_s.lock_version);
  end if;

  v_allowed := case v_s.status
    when 'draft'              then p_to in ('pending_review','archived')
    when 'pending_review'     then p_to in ('verifying','changes_requested','rejected','archived')
    when 'verifying'          then p_to in ('approved','rejected','changes_requested')
    when 'changes_requested'  then p_to in ('pending_review','rejected','archived')
    when 'approved'           then p_to in ('suspended','archived')
    when 'rejected'           then p_to in ('archived')
    when 'suspended'          then p_to in ('approved','archived')
    when 'archived'           then false
    else false end;

  -- The boss override in section 34. It never skips the reason, the actor or
  -- the history — it only widens which transitions are legal.
  if not v_allowed and p_override then
    if not (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'boss')
            or public.has_role(auth.uid(),'super_admin')) then
      return jsonb_build_object('ok', false, 'reason', 'override_not_permitted',
        'message', 'Only the boss or an admin can override the workflow.');
    end if;
    if coalesce(btrim(p_reason),'') = '' then
      return jsonb_build_object('ok', false, 'reason', 'override_reason_required',
        'message', 'An override has to say why. It is recorded permanently.');
    end if;
    v_allowed := true;
  end if;

  if not v_allowed then
    return jsonb_build_object('ok', false, 'reason', 'invalid_transition',
      'message', format('A %s submission cannot become %s.', v_s.status, p_to));
  end if;

  -- Decisions that stop or change someone's work need a stated reason.
  if p_to in ('changes_requested','rejected','suspended')
     and coalesce(btrim(p_reason),'') = '' then
    return jsonb_build_object('ok', false, 'reason', 'reason_required',
      'message', 'Say why. The author is told, and this is recorded permanently.');
  end if;

  -- The publishing gate. Approval is refused outright while a mandatory check
  -- is failing, override or not: an unapproved product must never be public.
  if p_to = 'approved' then
    v_checks := public.mm_submission_checks(p_id);
    if (v_checks->>'blocking')::boolean then
      return jsonb_build_object('ok', false, 'reason', 'checks_failed',
        'message', format('%s mandatory check(s) are failing. Approval is blocked until they pass.',
                          v_checks->>'mandatory_failed'),
        'checks', v_checks->'checks');
    end if;
  end if;

  update public.author_submissions
     set status = p_to,
         reviewer_id = case when p_to = 'verifying' then coalesce(reviewer_id, auth.uid())
                            else reviewer_id end,
         review_started_at = case when p_to = 'verifying' then coalesce(review_started_at, now())
                                  else review_started_at end,
         -- A resubmission is a new revision. The previous one stays in history.
         revision = case when p_to = 'pending_review' and v_s.status = 'changes_requested'
                         then revision + 1 else revision end,
         decided_at = case when p_to in ('approved','rejected') then now() else decided_at end,
         decided_by = case when p_to in ('approved','rejected') then auth.uid() else decided_by end,
         last_action = p_to,
         last_reason = nullif(btrim(p_reason),''),
         lock_version = lock_version + 1,
         updated_at = now()
   where id = p_id returning to_jsonb(author_submissions) into v_after;

  /* ------------------------------------------------- the publishing gate */
  -- The product's public state follows the decision, never the other way round.
  if p_to = 'approved' then
    update public.marketplace_products
       set moderation_status = 'approved', content_status = 'published',
           visible = true, approved_at = now(), approved_by = auth.uid(),
           updated_at = now()
     where id = v_s.product_id;

    if v_s.version_id is not null then
      update public.marketplace_product_versions
         set status = 'published', published_at = now()
       where id = v_s.version_id;
    end if;

  elsif p_to = 'rejected' then
    update public.marketplace_products
       set moderation_status = 'rejected', content_status = 'draft',
           visible = false, updated_at = now()
     where id = v_s.product_id;

  elsif p_to = 'suspended' then
    update public.marketplace_products
       set moderation_status = 'suspended', content_status = 'draft',
           visible = false, updated_at = now()
     where id = v_s.product_id;

  elsif p_to = 'changes_requested' then
    update public.marketplace_products
       set moderation_status = 'changes_requested', updated_at = now()
     where id = v_s.product_id;

  elsif p_to = 'verifying' then
    update public.marketplace_products
       set moderation_status = 'under_review', updated_at = now()
     where id = v_s.product_id;

  elsif p_to = 'archived' then
    update public.marketplace_products
       set moderation_status = 'archived', content_status = 'archived',
           visible = false, updated_at = now()
     where id = v_s.product_id;
  end if;

  perform public.mm_submission_risk_refresh(p_id);

  v_role := case when public.has_role(auth.uid(),'boss') then 'boss'
                 when public.has_role(auth.uid(),'admin') then 'admin'
                 else 'marketplace_manager' end;

  insert into public.author_approval_history
    (submission_id, revision, action, from_status, to_status,
     actor_id, actor_role, reason, comment)
  values (p_id, (v_after->>'revision')::int,
          case when p_override then 'override:' || p_to else p_to end,
          v_s.status, p_to, auth.uid(), v_role,
          nullif(btrim(p_reason),''), nullif(btrim(p_comment),''));

  perform public.mm_audit(
    case when p_override then 'submission.override' else 'submission.' || p_to end,
    'author_submission', p_id::text, to_jsonb(v_s), v_after, p_reason);

  -- The author is told, through the notification engine, if the rule says so.
  select coalesce((select enabled from public.author_approval_rules
                    where key='notify_author_on_change'), true) into v_notify;
  select s.owner_user_id into v_owner
    from public.marketplace_sellers s where s.id = v_s.seller_id;

  if v_owner is not null and (v_notify or p_to in ('approved','rejected','suspended')) then
    perform public.mm_notify(
      'submission.' || p_to,
      case p_to
        when 'approved' then 'Your product has been approved and is live'
        when 'rejected' then 'Your submission was not accepted'
        when 'changes_requested' then 'Changes are needed before approval'
        when 'verifying' then 'Verification has started on your submission'
        when 'suspended' then 'Your product has been suspended'
        when 'archived' then 'Your submission has been archived'
        else 'Your submission status changed' end,
      coalesce(p_reason, format('%s is now %s.', v_after->>'submission_no', p_to)),
      v_owner, null, '/author-manager', 'Open', 5,
      case p_to when 'approved' then 'success'
                when 'rejected' then 'warning'
                when 'changes_requested' then 'warning'
                when 'suspended' then 'danger' else 'info' end);
  end if;

  return jsonb_build_object('ok', true, 'submission', v_after,
    'published', p_to = 'approved');
end;
$$;

/* ----------------------------------------------------------- 16. the SLA */

-- Find what has breached, and escalate it once.
--
-- Everything is measured from the submission's own timestamps against the
-- configured hours, so changing the policy changes the answer immediately and
-- nothing is hardcoded. Escalating writes an alert to the operators and stamps
-- the row, so a breach is not re-reported every time this runs.
create or replace function public.mm_approval_sla_run()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_sla record; v_due integer := 0; v_breached integer := 0; v_stale integer := 0; r record;
begin
  if not public.mm_reseller_operator() and not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  select * into v_sla from public.author_approval_sla where id;

  -- Approaching: a reminder, not an alarm.
  select count(*) into v_due from public.author_submissions
   where status in ('pending_review','verifying')
     and sla_due_at between now() and now() + interval '4 hours';

  for r in
    select * from public.author_submissions
     where status in ('pending_review','verifying')
       and escalate_at <= now() and escalated_at is null
  loop
    v_breached := v_breached + 1;
    update public.author_submissions set escalated_at = now(), updated_at = now()
     where id = r.id;

    perform public.mm_notify(
      'submission.sla_breached',
      format('%s has passed its escalation window', r.submission_no),
      format('Submitted %s and still %s. The %s hour escalation window has passed.',
             to_char(r.submitted_at,'DD Mon HH24:MI'), r.status, v_sla.escalate_hours),
      null, array['admin','boss'], '/marketplace-manager', 'Review', 60, 'danger');

    insert into public.author_approval_history
      (submission_id, revision, action, from_status, to_status, actor_role, reason)
    values (r.id, r.revision, 'sla_escalated', r.status, r.status, 'system',
            format('No decision within the configured %s hour escalation window.',
                   v_sla.escalate_hours));
  end loop;

  -- Stale drafts are reported, never auto-rejected. Section 8 says a score may
  -- not decide anything on its own, and neither should a clock.
  select count(*) into v_stale from public.author_submissions
   where status = 'draft'
     and created_at <= now() - (v_sla.stale_draft_days || ' days')::interval;

  return jsonb_build_object('ok', true,
    'response_hours', v_sla.response_hours,
    'escalate_hours', v_sla.escalate_hours,
    'stale_draft_days', v_sla.stale_draft_days,
    'due_soon', v_due, 'escalated', v_breached, 'stale_drafts', v_stale,
    'note','Stale drafts are reported for a person to decide on; nothing is auto-rejected.');
end;
$$;
