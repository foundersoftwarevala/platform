-- Author Approval Workflow, part two: the checks, the risk, the gate.

/* ---------------------------------------------- 7. mandatory product checks */

-- What must be true before a product can be approved.
--
-- Returns every check with its result, so a reviewer sees the whole picture
-- rather than a single pass or fail. A failing mandatory check blocks approval;
-- an advisory one is reported and does not.
create or replace function public.mm_submission_checks(p_submission uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_s record; v_p record; v_checks jsonb := '[]'::jsonb; v_seller record;
begin
  select * into v_s from public.author_submissions where id = p_submission;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_submission');
  end if;
  select * into v_p from public.marketplace_products where id = v_s.product_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'product_missing',
      'blocking', true,
      'checks', jsonb_build_array(jsonb_build_object(
        'key','product_exists','label','The product still exists',
        'mandatory', true, 'passed', false,
        'detail','The product this submission refers to has been deleted.')));
  end if;

  select * into v_seller from public.marketplace_sellers where id = v_s.seller_id;

  v_checks := jsonb_build_array(
    jsonb_build_object('key','product_exists','label','Product record exists',
      'mandatory', true, 'passed', true, 'detail', v_p.name),

    jsonb_build_object('key','name','label','Product name',
      'mandatory', true, 'passed', coalesce(btrim(v_p.name),'') <> '',
      'detail', coalesce(v_p.name,'missing')),

    jsonb_build_object('key','description','label','Description',
      'mandatory', true, 'passed', length(coalesce(btrim(v_p.description),'')) >= 40,
      'detail', case when coalesce(btrim(v_p.description),'') = '' then 'missing'
                     else format('%s characters', length(btrim(v_p.description))) end),

    jsonb_build_object('key','category','label','Category assigned',
      'mandatory', true, 'passed', v_p.category_id is not null,
      'detail', coalesce((select name from public.marketplace_categories c
                           where c.id = v_p.category_id), 'no category')),

    jsonb_build_object('key','pricing','label','Price set',
      'mandatory', true, 'passed', coalesce(btrim(v_p.price_label),'') <> '',
      'detail', coalesce(nullif(btrim(v_p.price_label),''),'missing')),

    jsonb_build_object('key','license','label','Licence stated',
      'mandatory', true, 'passed', coalesce(btrim(v_p.license),'') <> '',
      'detail', coalesce(nullif(btrim(v_p.license),''),'missing')),

    jsonb_build_object('key','demo','label','Live demo',
      'mandatory', false, 'passed', coalesce(btrim(v_p.demo_url),'') <> '',
      'detail', coalesce(nullif(btrim(v_p.demo_url),''),'no demo URL')),

    jsonb_build_object('key','media','label','Product imagery',
      'mandatory', false,
      'passed', coalesce(btrim(v_p.thumbnail_url),'') <> ''
             or coalesce(btrim(v_p.cover_image),'') <> '',
      'detail', case when coalesce(btrim(v_p.thumbnail_url),'') <> ''
                       or coalesce(btrim(v_p.cover_image),'') <> ''
                     then 'present' else 'no thumbnail or cover image' end),

    -- Author Manager is the source of truth. This reads it; it never copies it.
    jsonb_build_object('key','author','label','Author record',
      'mandatory', false,
      'passed', v_seller.id is not null,
      'detail', case when v_seller.id is null
                     then 'No seller is attached — this is a first-party product.'
                     else format('%s (%s)', v_seller.display_name, v_seller.status) end),

    jsonb_build_object('key','author_approved','label','Author is approved',
      'mandatory', v_seller.id is not null,
      'passed', v_seller.id is null or v_seller.status = 'approved',
      'detail', case when v_seller.id is null then 'not applicable to a first-party product'
                     else format('seller status is %s', v_seller.status) end),

    -- Legal Manager decides this, not us. An unresolved violation or a failed
    -- binding blocks approval; both tables are read, never written.
    jsonb_build_object('key','legal','label','No blocking legal record',
      'mandatory', true,
      'passed', not exists (
        select 1 from public.legal_violations v
         where v.violator_id = v_p.id::text
           and coalesce(v.status,'open') not in ('resolved','dismissed')),
      'detail', case when exists (
          select 1 from public.legal_violations v
           where v.violator_id = v_p.id::text
             and coalesce(v.status,'open') not in ('resolved','dismissed'))
        then 'Legal Manager has an unresolved violation against this product.'
        else 'No unresolved violation recorded in Legal Manager.' end)
  );

  return jsonb_build_object(
    'ok', true,
    'checks', v_checks,
    'mandatory_failed', (select count(*) from jsonb_array_elements(v_checks) c
                          where (c->>'mandatory')::boolean and not (c->>'passed')::boolean),
    'advisory_failed', (select count(*) from jsonb_array_elements(v_checks) c
                         where not (c->>'mandatory')::boolean and not (c->>'passed')::boolean),
    'blocking', (select count(*) from jsonb_array_elements(v_checks) c
                  where (c->>'mandatory')::boolean and not (c->>'passed')::boolean) > 0);
end;
$$;

/* ------------------------------------------------------- 8. risk scoring */

-- A risk score from evidence, with the reasons that produced it.
--
-- Every contribution names what it saw and where it came from, because a score
-- nobody can explain is not usable for a decision that stops someone earning.
-- It is advisory: nothing in this workflow approves anything because of it.
create or replace function public.mm_submission_risk(p_submission uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_s record; v_p record; v_seller record;
  v_score integer := 0; v_reasons jsonb := '[]'::jsonb;
  v_approved integer := 0; v_rejected integer := 0; v_violations integer := 0;
  v_checks jsonb;
begin
  select * into v_s from public.author_submissions where id = p_submission;
  if not found then return jsonb_build_object('ok', false, 'reason','unknown_submission'); end if;
  select * into v_p from public.marketplace_products where id = v_s.product_id;
  select * into v_seller from public.marketplace_sellers where id = v_s.seller_id;

  if v_s.seller_id is not null then
    select count(*) filter (where status='approved'),
           count(*) filter (where status='rejected')
      into v_approved, v_rejected
      from public.author_submissions where seller_id = v_s.seller_id and id <> p_submission;
    select count(*) into v_violations from public.legal_violations
     where violator_id = v_s.seller_id::text
       and coalesce(status,'open') not in ('resolved','dismissed');
  end if;

  if v_s.seller_id is not null and v_approved = 0 then
    v_score := v_score + 25;
    v_reasons := v_reasons || jsonb_build_object('factor','new_author','weight',25,
      'evidence','This seller has no previously approved submission.',
      'source','author_submissions');
  end if;

  if v_seller.id is not null and v_seller.status <> 'approved' then
    v_score := v_score + 30;
    v_reasons := v_reasons || jsonb_build_object('factor','author_not_verified','weight',30,
      'evidence', format('Author Manager has this seller as %s.', v_seller.status),
      'source','marketplace_sellers');
  end if;

  if v_rejected > 0 then
    v_score := v_score + least(v_rejected * 10, 25);
    v_reasons := v_reasons || jsonb_build_object('factor','previous_rejections',
      'weight', least(v_rejected * 10, 25),
      'evidence', format('%s previous submission(s) from this seller were rejected.', v_rejected),
      'source','author_submissions');
  end if;

  if v_violations > 0 then
    v_score := v_score + 30;
    v_reasons := v_reasons || jsonb_build_object('factor','open_violations','weight',30,
      'evidence', format('%s unresolved legal violation(s) against this seller.', v_violations),
      'source','legal_violations');
  end if;

  v_checks := public.mm_submission_checks(p_submission);
  if (v_checks->>'mandatory_failed')::int > 0 then
    v_score := v_score + 20;
    v_reasons := v_reasons || jsonb_build_object('factor','incomplete_submission','weight',20,
      'evidence', format('%s mandatory check(s) are failing.', v_checks->>'mandatory_failed'),
      'source','mm_submission_checks');
  end if;

  if coalesce(btrim(v_p.demo_url),'') = '' then
    v_score := v_score + 10;
    v_reasons := v_reasons || jsonb_build_object('factor','no_demo','weight',10,
      'evidence','No live demo, so the product cannot be inspected before approval.',
      'source','marketplace_products.demo_url');
  end if;

  -- Claims a reviewer should look at rather than take on trust.
  if v_p.description ~* '(guaranteed|100% secure|unlimited free|no risk|certified by)' then
    v_score := v_score + 15;
    v_reasons := v_reasons || jsonb_build_object('factor','unsupported_claims','weight',15,
      'evidence','The description contains an absolute claim that needs evidence.',
      'source','marketplace_products.description');
  end if;

  -- The same product text under a different name is a duplicate-listing signal.
  if v_p.description is not null and length(btrim(v_p.description)) > 40
     and exists (select 1 from public.marketplace_products x
                  where x.id <> v_p.id and x.description = v_p.description) then
    v_score := v_score + 15;
    v_reasons := v_reasons || jsonb_build_object('factor','duplicate_description','weight',15,
      'evidence','Another listing carries exactly this description.',
      'source','marketplace_products');
  end if;

  v_score := least(v_score, 100);

  return jsonb_build_object(
    'ok', true,
    'score', v_score,
    'level', case when v_score >= 70 then 'critical'
                  when v_score >= 45 then 'high'
                  when v_score >= 20 then 'medium' else 'low' end,
    'reasons', v_reasons,
    'author_history', jsonb_build_object(
      'approved', v_approved, 'rejected', v_rejected, 'open_violations', v_violations),
    'advisory', true,
    'note','Advisory only. Nothing in this workflow approves or rejects because of this score.');
end;
$$;

-- Keep the stored score in step with the evidence, so the queue can be sorted
-- and filtered by risk without recomputing it per row.
create or replace function public.mm_submission_risk_refresh(p_submission uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_r jsonb;
begin
  v_r := public.mm_submission_risk(p_submission);
  if not (v_r->>'ok')::boolean then return v_r; end if;
  update public.author_submissions
     set risk_score = (v_r->>'score')::int,
         risk_level = v_r->>'level',
         risk_reasons = v_r->'reasons',
         updated_at = now()
   where id = p_submission;
  return v_r;
end;
$$;
