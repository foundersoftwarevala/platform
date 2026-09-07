-- Upload Security Scanner, part two: the pipeline.

/* -------------------------------------------------- 6/28. provider status */

-- Whether a malware engine is actually usable.
--
-- Enabled is not the same as working. A provider counts only when it is
-- enabled, names the environment variable that holds its credential, and has
-- passed a live test scan. Anything short of that is reported as
-- SCANNER_NOT_CONFIGURED, because section 6 forbids showing "0 threats
-- detected" for a file nothing scanned.
create or replace function public.mm_security_provider_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_ready integer;
begin
  select count(*) into v_ready from public.security_provider_configs
   where kind='malware' and enabled and verified;

  return jsonb_build_object(
    'malware_scanning', case when v_ready > 0 then 'CONNECTED' else 'SCANNER_NOT_CONFIGURED' end,
    'ready_providers', v_ready,
    -- Static analysis needs no third party and runs regardless.
    'static_analysis', 'CONNECTED',
    'providers', coalesce((select jsonb_agg(jsonb_build_object(
                   'slug', slug, 'label', label, 'kind', kind,
                   'enabled', enabled, 'verified', verified,
                   'credential_env', credential_env,
                   'last_error', last_error,
                   'state', case when enabled and verified then 'CONNECTED'
                                 when enabled and not verified then 'REQUIRES_CONFIGURATION'
                                 else 'DISABLED' end)
                 order by kind, slug) from public.security_provider_configs), '[]'::jsonb),
    'note', case when v_ready > 0 then null
      else 'No malware engine is configured, so no file has been scanned for malware. '
        || 'Uploads still go through file validation, hashing, static analysis and '
        || 'duplicate detection, and a malware verdict is reported as pending rather than clean.' end);
end;
$$;

/* ------------------------------------------------------------ 26. the job */

create or replace function public.mm_security_scan_start(
  p_asset uuid, p_reuse boolean default true)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_a record; v_settings record; v_job jsonb; v_prev record; v_attempt integer;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;
  select * into v_a from public.security_assets where id = p_asset;
  if not found then return jsonb_build_object('ok', false, 'reason','unknown_asset'); end if;

  select * into v_settings from public.security_scanner_settings where id;

  -- 35. An identical, immutable file already scanned inside the freshness
  -- window does not need scanning again.
  if p_reuse and v_a.sha256 is not null and v_settings.result_freshness_days > 0 then
    select j.* into v_prev
      from public.security_scan_jobs j
      join public.security_assets a2 on a2.id = j.asset_id
     where a2.sha256 = v_a.sha256 and a2.id <> p_asset
       and j.status in ('completed','flagged','blocked')
       and j.completed_at >= now() - (v_settings.result_freshness_days || ' days')::interval
     order by j.completed_at desc limit 1;
    if found then
      return jsonb_build_object('ok', true, 'reused', true,
        'job_id', v_prev.id, 'status', v_prev.status,
        'risk_score', v_prev.risk_score, 'risk_level', v_prev.risk_level,
        'note', format('An identical file (same SHA-256) was scanned within the last %s days; that verdict was reused.',
                       v_settings.result_freshness_days));
    end if;
  end if;

  select coalesce(max(attempt),0)+1 into v_attempt
    from public.security_scan_jobs where asset_id = p_asset;

  insert into public.security_scan_jobs (asset_id, status, attempt, started_at)
  values (p_asset, 'scanning', v_attempt, now())
  returning to_jsonb(security_scan_jobs) into v_job;

  update public.security_assets set status='scanning', updated_at=now() where id = p_asset;

  insert into public.security_events (asset_id, job_id, product_id, event, actor_id, new_state)
  values (p_asset, (v_job->>'id')::uuid, v_a.product_id, 'scan.started', auth.uid(), 'scanning');

  return jsonb_build_object('ok', true, 'reused', false, 'job', v_job);
end;
$$;

-- Record one finding. Called by the analysis running on the server, which is
-- where the bytes are; nothing here invents a result.
create or replace function public.mm_security_finding_add(
  p_job uuid, p_category text, p_result text, p_title text,
  p_evidence jsonb default '[]'::jsonb, p_severity text default 'low',
  p_source text default 'static', p_confidence numeric default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_job record; v_row jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;
  select * into v_job from public.security_scan_jobs where id = p_job;
  if not found then return jsonb_build_object('ok', false, 'reason','unknown_job'); end if;

  -- A finding that claims something was detected has to say what was seen.
  if p_result in ('flagged','blocked')
     and (p_evidence is null or jsonb_array_length(p_evidence) = 0) then
    return jsonb_build_object('ok', false, 'reason','evidence_required',
      'message','A flagged or blocked finding must carry the evidence for it.');
  end if;

  -- AI may describe and may recommend; it may not deliver a scanner verdict.
  if p_source = 'ai' and p_result = 'blocked' then
    return jsonb_build_object('ok', false, 'reason','ai_cannot_block',
      'message','AI is advisory. It can flag for human review but cannot block an asset on its own.');
  end if;

  insert into public.security_findings
    (job_id, asset_id, category, result, severity, title, evidence, source, confidence)
  values (p_job, v_job.asset_id, p_category, p_result, p_severity, p_title,
          coalesce(p_evidence,'[]'::jsonb), p_source, p_confidence)
  returning to_jsonb(security_findings) into v_row;

  insert into public.security_events (asset_id, job_id, event, actor_id, detail)
  values (v_job.asset_id, p_job, 'finding.'||p_category, auth.uid(),
          jsonb_build_object('result', p_result, 'severity', p_severity, 'source', p_source));

  return jsonb_build_object('ok', true, 'finding', v_row);
end;
$$;

/* -------------------------------------------------------- 18. risk engine */

-- Score the job from the findings actually recorded against it.
--
-- The absence of a malware finding is never treated as a pass. If no malware
-- engine reported, the malware category stays pending and the asset cannot
-- reach 'clean'.
create or replace function public.mm_security_scan_finish(p_job uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_job record; v_a record; v_settings record; v_provider jsonb;
  v_score integer := 0; v_level text; v_status text; v_asset_status text;
  v_blocked integer; v_flagged integer; v_malware_verdict text; v_after jsonb;
  v_owner uuid; v_categories jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;
  select * into v_job from public.security_scan_jobs where id = p_job for update;
  if not found then return jsonb_build_object('ok', false, 'reason','unknown_job'); end if;
  select * into v_a from public.security_assets where id = v_job.asset_id;
  select * into v_settings from public.security_scanner_settings where id;
  v_provider := public.mm_security_provider_status();

  select count(*) filter (where result='blocked'),
         count(*) filter (where result='flagged')
    into v_blocked, v_flagged
    from public.security_findings where job_id = p_job;

  -- Weighted from the real findings.
  select coalesce(sum(case
           when result = 'blocked' then case severity
             when 'critical' then 60 when 'high' then 40 when 'medium' then 25 else 15 end
           when result = 'flagged' then case severity
             when 'critical' then 40 when 'high' then 25 when 'medium' then 15 else 8 end
           else 0 end), 0)::int
    into v_score from public.security_findings where job_id = p_job;
  v_score := least(v_score, 100);

  -- The malware category, stated honestly.
  select f.result into v_malware_verdict
    from public.security_findings f
   where f.job_id = p_job and f.category='malware' and f.source='provider'
   order by f.created_at desc limit 1;

  if v_malware_verdict is null then
    v_malware_verdict := 'pending';
    -- Record it as pending rather than leaving the category silently absent.
    insert into public.security_findings
      (job_id, asset_id, category, result, severity, title, evidence, source)
    values (p_job, v_job.asset_id, 'malware', 'pending', 'low',
            'Not scanned for malware',
            jsonb_build_array(jsonb_build_object('note', v_provider->>'note')), 'static')
    on conflict do nothing;
  end if;

  v_level := case when v_score >= 70 then 'critical'
                  when v_score >= 45 then 'high'
                  when v_score >= 20 then 'medium' else 'low' end;

  v_status := case when v_blocked > 0 then 'blocked'
                   when v_flagged > 0 then 'flagged'
                   else 'completed' end;

  -- The rule that matters. A job with no provider verdict may complete, but the
  -- asset is never called clean — it is left awaiting the malware stage.
  v_asset_status := case
    when v_blocked > 0 then 'blocked'
    when v_flagged > 0 then 'flagged'
    when v_malware_verdict = 'pass' then 'clean'
    else 'scanning' end;

  update public.security_scan_jobs
     set status = v_status, completed_at = now(),
         risk_score = v_score, risk_level = v_level,
         provider = coalesce(provider, 'sv-static'),
         stages = jsonb_build_object(
           'validation','ran', 'hashing', case when v_a.sha256 is not null then 'ran' else 'skipped' end,
           'static_analysis','ran',
           'malware', case when v_malware_verdict='pending' then 'not_configured' else 'ran' end,
           'duplicate','ran')
   where id = p_job returning to_jsonb(security_scan_jobs) into v_after;

  update public.security_assets set status = v_asset_status, updated_at = now()
   where id = v_job.asset_id;

  -- 13/14. A blocked asset is isolated, and a flagged one too when the setting
  -- says so.
  if v_blocked > 0 or (v_flagged > 0 and v_settings.auto_quarantine_flagged) then
    insert into public.security_quarantine (asset_id, job_id, reason, quarantined_by)
    values (v_job.asset_id, p_job,
            format('%s blocking and %s flagged finding(s) on scan %s.',
                   v_blocked, v_flagged, left(p_job::text,8)),
            auth.uid())
    on conflict do nothing;
    update public.security_assets set status='quarantined', updated_at=now()
     where id = v_job.asset_id;

    insert into public.security_events (asset_id, job_id, product_id, event, actor_id, new_state, reason)
    values (v_job.asset_id, p_job, v_a.product_id, 'quarantined', auth.uid(), 'quarantined',
            'Automatic isolation after the scan.');
  end if;

  -- 16. A copyright finding reaches the DMCA queue when enabled.
  if v_settings.send_copyright_to_dmca then
    insert into public.security_dmca_queue (asset_id, product_id, finding_id, sha256, evidence)
    select v_job.asset_id, v_a.product_id, f.id, v_a.sha256, f.evidence
      from public.security_findings f
     where f.job_id = p_job and f.category='copyright' and f.result in ('flagged','blocked');
  end if;

  select jsonb_object_agg(category, result) into v_categories
    from (select distinct on (category) category, result
            from public.security_findings where job_id = p_job
           order by category, created_at desc) t;

  insert into public.security_events (asset_id, job_id, product_id, event, actor_id, new_state, detail)
  values (v_job.asset_id, p_job, v_a.product_id, 'scan.completed', auth.uid(), v_status,
          jsonb_build_object('risk', v_score, 'level', v_level, 'categories', v_categories));

  -- 40. The uploader is told when their file is rejected, if that is configured.
  select s.owner_user_id into v_owner
    from public.marketplace_sellers s where s.id = v_a.seller_id;
  if v_owner is not null and v_blocked > 0 and v_settings.notify_author_on_rejection then
    perform public.mm_notify('security.blocked','An upload was blocked',
      format('%s did not pass the security scan and has been quarantined.', v_a.file_name),
      v_owner, null, '/author-manager', 'Open', 5, 'danger');
  end if;

  return jsonb_build_object('ok', true, 'job', v_after,
    'categories', coalesce(v_categories,'{}'::jsonb),
    'asset_status', v_asset_status,
    'malware', v_malware_verdict,
    'provider_status', v_provider->>'malware_scanning',
    'note', case when v_asset_status = 'scanning'
      then 'This asset is not marked clean. Nothing scanned it for malware, so the malware stage is pending rather than passed.'
      else null end);
end;
$$;

-- 27. A provider failure is never a clean result.
create or replace function public.mm_security_scan_error(
  p_job uuid, p_category text, p_detail text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_job record; v_after jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;
  select * into v_job from public.security_scan_jobs where id = p_job;
  if not found then return jsonb_build_object('ok', false, 'reason','unknown_job'); end if;

  update public.security_scan_jobs
     set status='error', error_category = p_category, error_detail = p_detail,
         completed_at = now()
   where id = p_job returning to_jsonb(security_scan_jobs) into v_after;

  -- The asset goes to scan_error, never to clean.
  update public.security_assets set status='scan_error', updated_at=now()
   where id = v_job.asset_id;

  insert into public.security_events (asset_id, job_id, event, actor_id, new_state, reason)
  values (v_job.asset_id, p_job, 'scan.error', auth.uid(), 'scan_error', p_detail);

  return jsonb_build_object('ok', true, 'job', v_after,
    'note','The asset is marked scan_error and is not publishable. An authorised retry can run the scan again.');
end;
$$;

/* ------------------------------------------------------ 13. quarantine */

create or replace function public.mm_security_quarantine_decide(
  p_asset uuid, p_to text, p_reason text, p_discard_payload boolean default false)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_q record; v_after jsonb;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason','not_permitted');
  end if;
  if p_to not in ('under_review','released','rejected','purged') then
    return jsonb_build_object('ok', false, 'reason','unknown_state');
  end if;
  if coalesce(btrim(p_reason),'') = '' then
    return jsonb_build_object('ok', false, 'reason','reason_required',
      'message','Releasing or rejecting a quarantined file is a security decision. Say why.');
  end if;

  select * into v_q from public.security_quarantine
   where asset_id = p_asset and state in ('quarantined','under_review')
   order by quarantined_at desc limit 1 for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason','not_quarantined');
  end if;

  -- Releasing a file that a provider blocked is refused. A human may overrule a
  -- flag, not a malware detection.
  if p_to = 'released' and exists (
      select 1 from public.security_findings f
       where f.asset_id = p_asset and f.category='malware'
         and f.result='blocked' and f.source='provider') then
    return jsonb_build_object('ok', false, 'reason','malware_cannot_be_released',
      'message','A malware engine blocked this file. It cannot be released back into the marketplace.');
  end if;

  update public.security_quarantine
     set state = p_to, decided_by = auth.uid(), decided_at = now(),
         decision_reason = btrim(p_reason),
         payload_retained = case when p_to='purged' or p_discard_payload then false
                                 else payload_retained end
   where id = v_q.id returning to_jsonb(security_quarantine) into v_after;

  update public.security_assets
     set status = case p_to when 'released' then 'released'
                            when 'rejected' then 'rejected'
                            when 'purged' then 'purged'
                            else 'quarantined' end,
         -- 14. The payload is discarded while the hash and the evidence stay.
         storage_path = case when p_to='purged' or p_discard_payload then null else storage_path end,
         updated_at = now()
   where id = p_asset;

  insert into public.security_events (asset_id, job_id, event, actor_id,
                                      previous_state, new_state, reason)
  values (p_asset, v_q.job_id, 'quarantine.'||p_to, auth.uid(), v_q.state, p_to, btrim(p_reason));

  return jsonb_build_object('ok', true, 'quarantine', v_after,
    'note', case when p_to='purged' or p_discard_payload
      then 'The file itself was discarded. Its hash, findings and evidence are kept.'
      else null end);
end;
$$;
