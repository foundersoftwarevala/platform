-- Author Approval Workflow, part four: what the console reads.

create or replace function public.mm_submissions(p_query jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text := nullif(p_query->>'status','');
  v_search text := nullif(btrim(coalesce(p_query->>'search','')),'');
  v_risk   text := nullif(p_query->>'risk','');
  v_type   text := nullif(p_query->>'type','');
  v_sort   text := coalesce(p_query->>'sort','newest');
  v_limit  integer := least(greatest(coalesce((p_query->>'limit')::int,100),1),500);
  v_sla record;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  select * into v_sla from public.author_approval_sla where id;

  return jsonb_build_object(
    'ok', true,

    -- The metric cards. Counted, never stored.
    'counts', jsonb_build_object(
      'draft',             (select count(*) from public.author_submissions where status='draft'),
      'pending_review',    (select count(*) from public.author_submissions where status='pending_review'),
      'verifying',         (select count(*) from public.author_submissions where status='verifying'),
      'changes_requested', (select count(*) from public.author_submissions where status='changes_requested'),
      'approved',          (select count(*) from public.author_submissions where status='approved'),
      'rejected',          (select count(*) from public.author_submissions where status='rejected'),
      'suspended',         (select count(*) from public.author_submissions where status='suspended'),
      'archived',          (select count(*) from public.author_submissions where status='archived')),

    'sla', jsonb_build_object(
      'response_hours', v_sla.response_hours,
      'escalate_hours', v_sla.escalate_hours,
      'stale_draft_days', v_sla.stale_draft_days,
      'breached', (select count(*) from public.author_submissions
                    where status in ('pending_review','verifying') and escalate_at <= now()),
      'due_soon', (select count(*) from public.author_submissions
                    where status in ('pending_review','verifying')
                      and sla_due_at between now() and now() + interval '4 hours')),

    'rules', coalesce((select jsonb_agg(to_jsonb(r) order by r.key)
                         from public.author_approval_rules r), '[]'::jsonb),

    -- Trusted authors, derived from what actually happened rather than a
    -- toggle. Author Manager stays the source of truth for status and identity.
    'trusted_authors', coalesce((
      select jsonb_agg(jsonb_build_object(
               'seller_id', s.id, 'name', s.display_name, 'kind', s.seller_kind,
               'status', s.status,
               'approved', (select count(*) from public.author_submissions x
                             where x.seller_id = s.id and x.status='approved'),
               'rejected', (select count(*) from public.author_submissions x
                             where x.seller_id = s.id and x.status='rejected'),
               'violations', (select count(*) from public.legal_violations v
                               where v.violator_id = s.id::text
                                 and coalesce(v.status,'open') not in ('resolved','dismissed')),
               'last_review', (select max(x.decided_at) from public.author_submissions x
                                where x.seller_id = s.id),
               'trust_level', case
                 when s.status <> 'approved' then 'untrusted'
                 when exists (select 1 from public.legal_violations v
                               where v.violator_id = s.id::text
                                 and coalesce(v.status,'open') not in ('resolved','dismissed'))
                   then 'flagged'
                 when (select count(*) from public.author_submissions x
                        where x.seller_id = s.id and x.status='approved') >= 3 then 'trusted'
                 when (select count(*) from public.author_submissions x
                        where x.seller_id = s.id and x.status='approved') >= 1 then 'known'
                 else 'new' end)
             order by s.display_name)
        from public.marketplace_sellers s), '[]'::jsonb),

    'total', (select count(*) from public.author_submissions),

    'submissions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', q.id, 'submission_no', q.submission_no,
               'product_id', q.product_id, 'product', q.product_name,
               'seller_id', q.seller_id, 'author', q.author_name,
               'type', q.submission_type, 'status', q.status,
               'revision', q.revision,
               'risk_score', q.risk_score, 'risk_level', q.risk_level,
               'risk_reasons', q.risk_reasons,
               'reviewer_id', q.reviewer_id,
               'submitted_at', q.submitted_at, 'decided_at', q.decided_at,
               'sla_due_at', q.sla_due_at, 'escalate_at', q.escalate_at,
               'escalated_at', q.escalated_at,
               'sla_state', case
                 when q.status not in ('pending_review','verifying') then 'n/a'
                 when q.escalate_at <= now() then 'breached'
                 when q.sla_due_at <= now() then 'overdue'
                 when q.sla_due_at <= now() + interval '4 hours' then 'due_soon'
                 else 'on_track' end,
               'last_action', q.last_action, 'last_reason', q.last_reason,
               'lock_version', q.lock_version,
               'history', (select count(*) from public.author_approval_history h
                            where h.submission_id = q.id))
             order by q.ord)
        from (
          select s.*, p.name as product_name, sel.display_name as author_name,
                 row_number() over (order by
                   case when v_sort='oldest' then s.submitted_at end asc,
                   case when v_sort='risk' then s.risk_score end desc,
                   case when v_sort='sla' then s.escalate_at end asc,
                   s.submitted_at desc) ord
            from public.author_submissions s
            left join public.marketplace_products p on p.id = s.product_id
            left join public.marketplace_sellers sel on sel.id = s.seller_id
           where (v_status is null or s.status = v_status)
             and (v_risk is null or s.risk_level = v_risk)
             and (v_type is null or s.submission_type = v_type)
             and (v_search is null
                  or s.submission_no ilike '%'||v_search||'%'
                  or coalesce(p.name,'') ilike '%'||v_search||'%'
                  or coalesce(sel.display_name,'') ilike '%'||v_search||'%'
                  or s.seller_id::text = v_search
                  or s.product_id::text = v_search)
           limit v_limit) q), '[]'::jsonb));
end;
$$;

-- The full review packet for one submission, so a reviewer sees everything
-- before deciding rather than approving from a row in a list.
create or replace function public.mm_submission_detail(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_s record; v_p jsonb; v_seller jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  select * into v_s from public.author_submissions where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_submission');
  end if;

  select jsonb_build_object(
           'id', p.id, 'name', p.name, 'slug', p.slug, 'version', p.version,
           'description', p.description, 'price_label', p.price_label,
           'license', p.license, 'demo_url', p.demo_url,
           'thumbnail_url', p.thumbnail_url, 'cover_image', p.cover_image,
           'tech_stack', p.tech_stack, 'features', p.features,
           'category', (select c.name from public.marketplace_categories c
                         where c.id = p.category_id),
           'moderation_status', p.moderation_status, 'content_status', p.content_status,
           'visible', p.visible, 'public_repo_url', p.public_repo_url)
    into v_p from public.marketplace_products p where p.id = v_s.product_id;

  -- Read from Author Manager. Never copied here.
  select jsonb_build_object(
           'id', s.id, 'name', s.display_name, 'slug', s.slug,
           'status', s.status, 'kind', s.seller_kind,
           'approved_at', s.approved_at, 'owner_user_id', s.owner_user_id,
           'previous_approved', (select count(*) from public.author_submissions x
                                  where x.seller_id = s.id and x.status='approved'),
           'previous_rejected', (select count(*) from public.author_submissions x
                                  where x.seller_id = s.id and x.status='rejected'),
           'open_violations', (select count(*) from public.legal_violations v
                                where v.violator_id = s.id::text
                                  and coalesce(v.status,'open') not in ('resolved','dismissed')))
    into v_seller from public.marketplace_sellers s where s.id = v_s.seller_id;

  return jsonb_build_object(
    'ok', true,
    'submission', to_jsonb(v_s),
    'product', v_p,
    'author', v_seller,
    'checks', public.mm_submission_checks(p_id),
    'risk', public.mm_submission_risk(p_id),

    'versions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', v.id, 'version', v.version, 'status', v.status,
               'release_notes', v.release_notes, 'published_at', v.published_at)
             order by v.created_at desc)
        from public.marketplace_product_versions v
       where v.product_id = v_s.product_id), '[]'::jsonb),

    'evidence', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id, 'kind', e.kind, 'label', e.label,
               'url', e.url, 'has_file', e.storage_path is not null,
               'detail', e.detail, 'created_at', e.created_at)
             order by e.created_at desc)
        from public.author_approval_evidence e where e.submission_id = p_id), '[]'::jsonb),

    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
               'revision', h.revision, 'action', h.action,
               'from', h.from_status, 'to', h.to_status,
               'actor', h.actor_id, 'role', h.actor_role,
               'reason', h.reason, 'comment', h.comment,
               'ai', h.ai_recommendation, 'at', h.created_at)
             order by h.created_at desc)
        from public.author_approval_history h where h.submission_id = p_id), '[]'::jsonb));
end;
$$;

create or replace function public.mm_approval_rule_set(p_key text, p_patch jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_before jsonb; v_after jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  select to_jsonb(r) into v_before from public.author_approval_rules r where r.key = p_key;
  if v_before is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_rule');
  end if;

  update public.author_approval_rules set
    enabled = coalesce((p_patch->>'enabled')::boolean, enabled),
    config = coalesce(p_patch->'config', config),
    updated_by = auth.uid(), updated_at = now()
  where key = p_key returning to_jsonb(author_approval_rules) into v_after;

  perform public.mm_audit('approval.rule_changed','author_approval_rule', p_key,
                          v_before, v_after, nullif(p_patch->>'reason',''));
  return jsonb_build_object('ok', true, 'rule', v_after);
end;
$$;

create or replace function public.mm_approval_sla_set(p_patch jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_before jsonb; v_after jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  select to_jsonb(s) into v_before from public.author_approval_sla s where s.id;

  update public.author_approval_sla set
    response_hours = coalesce((p_patch->>'response_hours')::int, response_hours),
    escalate_hours = coalesce((p_patch->>'escalate_hours')::int, escalate_hours),
    stale_draft_days = coalesce((p_patch->>'stale_draft_days')::int, stale_draft_days),
    updated_by = auth.uid(), updated_at = now()
  where id returning to_jsonb(author_approval_sla) into v_after;

  perform public.mm_audit('approval.sla_changed','author_approval_sla','sla',
                          v_before, v_after, null);
  return jsonb_build_object('ok', true, 'sla', v_after);
end;
$$;

create or replace function public.mm_submission_evidence_add(
  p_submission uuid, p_kind text, p_label text,
  p_url text default null, p_detail text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_row jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if not exists (select 1 from public.author_submissions where id = p_submission) then
    return jsonb_build_object('ok', false, 'reason', 'unknown_submission');
  end if;
  if coalesce(btrim(p_label),'') = '' then
    return jsonb_build_object('ok', false, 'reason', 'label_required');
  end if;
  if coalesce(btrim(p_url),'') = '' and coalesce(btrim(p_detail),'') = '' then
    return jsonb_build_object('ok', false, 'reason', 'nothing_to_record',
      'message', 'Evidence needs a link or a note. An empty entry proves nothing.');
  end if;

  insert into public.author_approval_evidence
    (submission_id, kind, label, url, detail, added_by)
  values (p_submission, p_kind, btrim(p_label),
          nullif(btrim(p_url),''), nullif(btrim(p_detail),''), auth.uid())
  returning to_jsonb(author_approval_evidence) into v_row;

  perform public.mm_audit('submission.evidence_added','author_submission',
                          p_submission::text, null, v_row, null);
  return jsonb_build_object('ok', true, 'evidence', v_row);
end;
$$;

/* ------------------------------------------------------- 14. bulk actions */

-- Bulk approve, validating each one on its own.
--
-- Nothing is waved through: every submission goes through the same transition
-- as a single approval, so a failing mandatory check stops that one and leaves
-- the rest to proceed. The result says exactly what happened to each.
create or replace function public.mm_submissions_bulk(
  p_ids uuid[], p_to text, p_reason text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid; v_res jsonb; v_out jsonb := '[]'::jsonb;
        v_done integer := 0; v_skipped integer := 0;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if p_ids is null or array_length(p_ids,1) is null then
    return jsonb_build_object('ok', false, 'reason', 'nothing_selected');
  end if;
  if array_length(p_ids,1) > 100 then
    return jsonb_build_object('ok', false, 'reason', 'too_many',
      'message','Bulk actions are limited to 100 submissions at a time.');
  end if;

  foreach v_id in array p_ids loop
    -- No lock is passed: a bulk action reads and acts in one statement, so
    -- there is nothing stale to guard against here.
    v_res := public.mm_submission_transition(v_id, p_to, p_reason, null, null, false);
    if (v_res->>'ok')::boolean then v_done := v_done + 1;
    else v_skipped := v_skipped + 1; end if;
    v_out := v_out || jsonb_build_object(
      'id', v_id, 'ok', (v_res->>'ok')::boolean,
      'reason', v_res->>'reason', 'message', v_res->>'message');
  end loop;

  perform public.mm_audit('submission.bulk_'||p_to,'author_submission', null, null,
                          jsonb_build_object('applied', v_done, 'skipped', v_skipped),
                          p_reason);

  return jsonb_build_object('ok', true, 'applied', v_done, 'skipped', v_skipped,
                            'results', v_out);
end;
$$;
