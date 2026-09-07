-- Review, Trust and FAQ managers: the console's calls and the storefront's.

/* =================================================================== REVIEWS */

create or replace function public.mm_reviews(p_query jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tab    text := coalesce(p_query->>'tab','queue');
  v_search text := nullif(btrim(coalesce(p_query->>'search','')),'');
  v_limit  integer := least(greatest(coalesce((p_query->>'limit')::int,50),1),200);
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;

  return jsonb_build_object(
    'ok', true, 'tab', v_tab,

    -- Every figure counted, none stored.
    'total',      (select count(*) from public.marketplace_reviews),
    'pending',    (select count(*) from public.marketplace_reviews where status='pending'),
    'published',  (select count(*) from public.marketplace_reviews where status='published'),
    'rejected',   (select count(*) from public.marketplace_reviews where status='rejected'),
    'hidden',     (select count(*) from public.marketplace_reviews where status='hidden'),
    'reported',   (select count(*) from public.review_reports where status in ('open','investigating')),
    'replies',    (select count(*) from public.review_replies where status='published'),
    'video',      (select count(*) from public.marketplace_reviews where review_type='video'),

    'average_rating', (select round(avg(rating)::numeric,2) from public.marketplace_reviews
                        where status='published'),
    'distribution', coalesce((
      select jsonb_object_agg(rating::text, n)
        from (select rating, count(*) n from public.marketplace_reviews
               where status='published' group by rating) t), '{}'::jsonb),

    -- Every review is bound to an order line by the schema, so the verified
    -- share is always the whole of it. Stated rather than computed to look busy.
    'verified_note', 'marketplace_reviews.order_item_id is NOT NULL, so a review '
                     'cannot exist without the purchase behind it. Every review here '
                     'is a verified purchase by construction.',

    'response_rate', case
      when (select count(*) from public.marketplace_reviews where status='published') = 0 then null
      else round(100.0 * (select count(distinct review_id) from public.review_replies
                           where status='published')
                 / (select count(*) from public.marketplace_reviews where status='published'), 1)
      end,
    'approval_rate', case
      when (select count(*) from public.marketplace_reviews
             where status in ('published','rejected')) = 0 then null
      else round(100.0 * (select count(*) from public.marketplace_reviews where status='published')
                 / (select count(*) from public.marketplace_reviews
                     where status in ('published','rejected')), 1)
      end,

    'reviews', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'rating', r.rating, 'title', r.title, 'content', r.comment,
               'status', r.status, 'type', r.review_type,
               'helpful', r.helpful_count, 'reports', r.report_count,
               'created_at', r.created_at, 'published_at', r.published_at,
               'moderation_note', r.moderation_note,
               'buyer_id', r.buyer_id, 'product_id', r.product_id,
               'order_item_id', r.order_item_id,
               'verified_purchase', true,
               'product_name', (select p.name from public.marketplace_products p
                                 where p.id = r.product_id),
               'buyer', (select coalesce(pr.full_name, pr.email)
                           from public.profiles pr where pr.id = r.buyer_id),
               'replies', coalesce((select jsonb_agg(jsonb_build_object(
                                      'id', rp.id, 'role', rp.author_role,
                                      'content', rp.content, 'status', rp.status,
                                      'created_at', rp.created_at) order by rp.created_at)
                                     from public.review_replies rp
                                    where rp.review_id = r.id), '[]'::jsonb),
               'open_reports', coalesce((select jsonb_agg(jsonb_build_object(
                                      'id', rr.id, 'reason', rr.reason, 'detail', rr.detail,
                                      'status', rr.status, 'created_at', rr.created_at))
                                     from public.review_reports rr
                                    where rr.review_id = r.id
                                      and rr.status in ('open','investigating')), '[]'::jsonb),
               'media', coalesce((select jsonb_agg(jsonb_build_object(
                                      'id', m.id, 'kind', m.kind,
                                      'processing', m.processing_status,
                                      'moderation', m.moderation_status))
                                     from public.review_media m
                                    where m.review_id = r.id), '[]'::jsonb))
             order by r.created_at desc)
        from (select * from public.marketplace_reviews r2
               where (v_search is null
                      or coalesce(r2.title,'') ilike '%'||v_search||'%'
                      or r2.comment ilike '%'||v_search||'%')
                 and case v_tab
                       when 'queue'    then r2.status = 'pending'
                       when 'latest'   then true
                       when 'top'      then r2.status='published' and r2.rating >= 4
                       when 'video'    then r2.review_type = 'video'
                       when 'reported' then exists (select 1 from public.review_reports x
                                                     where x.review_id = r2.id
                                                       and x.status in ('open','investigating'))
                       when 'replies'  then exists (select 1 from public.review_replies x
                                                     where x.review_id = r2.id)
                       else true end
               order by case when v_tab='top' then r2.rating else 0 end desc,
                        r2.created_at desc
               limit v_limit) r), '[]'::jsonb));
end;
$$;

-- Approve, reject, hide or restore a review.
--
-- Nothing publishes itself: a review reaches 'published' only through this
-- call, made by a person. The product's rating is then recomputed from
-- published reviews alone.
create or replace function public.mm_review_moderate(
  p_id uuid, p_to text, p_note text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_before jsonb; v_after jsonb; v_product uuid; v_buyer uuid;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if p_to not in ('pending','published','rejected','removed','hidden','archived') then
    return jsonb_build_object('ok', false, 'reason', 'unknown_status');
  end if;

  select to_jsonb(r), r.product_id, r.buyer_id into v_before, v_product, v_buyer
    from public.marketplace_reviews r where r.id = p_id;
  if v_before is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_review');
  end if;

  -- Rejecting or hiding someone's words is a decision that needs a reason on
  -- the record, not a silent disappearance.
  if p_to in ('rejected','hidden') and coalesce(btrim(p_note),'') = '' then
    return jsonb_build_object('ok', false, 'reason', 'note_required',
      'message', 'Say why this review is being rejected or hidden. It is recorded and the author is told.');
  end if;

  update public.marketplace_reviews
     set status = p_to,
         moderated_by = auth.uid(), moderated_at = now(),
         moderation_note = coalesce(nullif(btrim(p_note),''), moderation_note),
         published_at = case when p_to='published' then coalesce(published_at, now())
                             else published_at end,
         updated_at = now()
   where id = p_id returning to_jsonb(marketplace_reviews) into v_after;

  perform public.mm_product_rating_refresh(v_product);
  perform public.mm_audit('review.'||p_to, 'marketplace_review', p_id::text,
                          v_before, v_after, p_note);

  if v_buyer is not null and p_to in ('published','rejected') then
    perform public.mm_notify('review.'||p_to,
      case p_to when 'published' then 'Your review is live'
                else 'Your review was not published' end,
      coalesce(p_note,''), v_buyer, null, '/account/reviews', 'View', 5,
      case p_to when 'published' then 'success' else 'warning' end);
  end if;

  return jsonb_build_object('ok', true, 'review', v_after);
end;
$$;

-- A product's rating, recomputed from published reviews only.
--
-- With no published review the rating is set to zero rather than left at
-- whatever it was, because a stale average is worse than none.
create or replace function public.mm_product_rating_refresh(p_product uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_avg numeric; v_n integer;
begin
  if p_product is null then
    return jsonb_build_object('ok', false, 'reason', 'no_product');
  end if;

  select round(avg(rating)::numeric,2), count(*) into v_avg, v_n
    from public.marketplace_reviews
   where product_id = p_product and status = 'published';

  update public.marketplace_products
     set rating = coalesce(v_avg, 0), updated_at = now()
   where id = p_product;

  return jsonb_build_object('ok', true, 'rating', coalesce(v_avg,0), 'reviews', v_n);
end;
$$;

create or replace function public.mm_review_reply(
  p_review uuid, p_content text, p_role text default 'official')
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_row jsonb; v_buyer uuid;
begin
  if not public.mm_is_operator() then
    return jsonb_build_object('ok', false, 'reason', 'not_permitted');
  end if;
  if p_role not in ('official','vendor','author','reseller') then
    return jsonb_build_object('ok', false, 'reason', 'unknown_role');
  end if;
  if coalesce(btrim(p_content),'') = '' then
    return jsonb_build_object('ok', false, 'reason', 'empty_reply');
  end if;

  select buyer_id into v_buyer from public.marketplace_reviews where id = p_review;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_review');
  end if;

  insert into public.review_replies (review_id, author_id, author_role, content, status)
  values (p_review, auth.uid(), p_role, btrim(p_content), 'published')
  returning to_jsonb(review_replies) into v_row;

  perform public.mm_audit('review.replied', 'marketplace_review', p_review::text,
                          null, v_row, null);

  if v_buyer is not null then
    perform public.mm_notify('review.reply', 'Someone replied to your review',
      left(btrim(p_content), 160), v_buyer, null, '/account/reviews', 'Read', 5, 'info');
  end if;

  return jsonb_build_object('ok', true, 'reply', v_row);
end;
$$;

create or replace function public.mm_review_report_resolve(
  p_report uuid, p_to text, p_resolution text)
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
  if p_to not in ('investigating','upheld','dismissed') then
    return jsonb_build_object('ok', false, 'reason', 'unknown_status');
  end if;
  if p_to in ('upheld','dismissed') and coalesce(btrim(p_resolution),'') = '' then
    return jsonb_build_object('ok', false, 'reason', 'resolution_required',
      'message', 'Record the finding. A report is closed with a reason, not silently.');
  end if;

  select to_jsonb(r) into v_before from public.review_reports r where r.id = p_report;
  if v_before is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_report');
  end if;

  update public.review_reports
     set status = p_to, resolution = p_resolution,
         resolved_by = case when p_to in ('upheld','dismissed') then auth.uid() else resolved_by end,
         resolved_at = case when p_to in ('upheld','dismissed') then now() else resolved_at end
   where id = p_report returning to_jsonb(review_reports) into v_after;

  perform public.mm_audit('review.report_'||p_to, 'review_report', p_report::text,
                          v_before, v_after, p_resolution);
  return jsonb_build_object('ok', true, 'report', v_after);
end;
$$;

-- Keep report_count honest rather than letting the UI count for itself.
create or replace function public.review_report_count_sync()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_review uuid := coalesce(new.review_id, old.review_id);
begin
  update public.marketplace_reviews
     set report_count = (select count(*) from public.review_reports
                          where review_id = v_review and status in ('open','investigating')),
         status = case
           -- A reported review comes off the storefront while it is looked at.
           when tg_op = 'INSERT' and status = 'published' then 'reported'
           else status end,
         updated_at = now()
   where id = v_review;
  perform public.mm_product_rating_refresh(
    (select product_id from public.marketplace_reviews where id = v_review));
  return coalesce(new, old);
end;
$$;

drop trigger if exists review_reports_count on public.review_reports;
create trigger review_reports_count
  after insert or update or delete on public.review_reports
  for each row execute function public.review_report_count_sync();
