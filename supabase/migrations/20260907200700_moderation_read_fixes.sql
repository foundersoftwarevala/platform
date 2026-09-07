-- Three corrections found by the end-to-end run.

-- 1. A moderator could not read the moderation queue.
--
-- The only SELECT policy was status='published', so the pending reviews a
-- moderator exists to look at were invisible to any direct query. mm_reviews
-- worked because it is SECURITY DEFINER, which meant the gap was hidden rather
-- than absent. A buyer also gains sight of their own review before it is live.
drop policy if exists marketplace_reviews_operator_read on public.marketplace_reviews;
create policy marketplace_reviews_operator_read on public.marketplace_reviews
  for select to authenticated
  using (public.mm_is_operator() or buyer_id = auth.uid());

drop policy if exists marketplace_reviews_operator_write on public.marketplace_reviews;
create policy marketplace_reviews_operator_write on public.marketplace_reviews
  for all to authenticated
  using (public.mm_is_operator()) with check (public.mm_is_operator());

-- 2. A restrictive ALL policy was cancelling the public read.
--
-- anon_write_denied was meant to stop anonymous writes, but ALL includes
-- SELECT, so it also cancelled marketplace_reviews_public_read and no visitor
-- could ever see a published review. Replaced with the same denial applied to
-- the three writing commands, leaving reads to the permissive policy.
drop policy if exists anon_write_denied on public.marketplace_reviews;
create policy marketplace_reviews_anon_insert on public.marketplace_reviews
  as restrictive for insert to anon with check (false);
create policy marketplace_reviews_anon_update on public.marketplace_reviews
  as restrictive for update to anon using (false) with check (false);
create policy marketplace_reviews_anon_delete on public.marketplace_reviews
  as restrictive for delete to anon using (false);

grant select on public.marketplace_reviews, public.review_replies to anon;

-- 3. The scheduled-publish path did not clear the AI flag.
--
-- mm_faq_transition clears ai_generated when a person publishes, because at
-- that point a human has taken responsibility for the text. The automatic
-- publish of a scheduled FAQ skipped it, so an approved FAQ could go live still
-- labelled as machine-written. It is the same act of publication, so it does
-- the same thing.
create or replace function public.sf_faqs()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  update public.faqs
     set status = 'published',
         published_at = coalesce(published_at, now()),
         ai_generated = false,
         updated_at = now()
   where status = 'scheduled' and scheduled_for <= now();

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', f.id, 'question', f.question, 'answer', f.answer,
             'category', coalesce(c.name,'General'), 'slug', f.slug,
             'seo_title', f.seo_title, 'seo_description', f.seo_description)
           order by c.position, f.position)
      from public.faqs f
      left join public.faq_categories c on c.id = f.category_id
     where f.status='published' and f.language='en'), '[]'::jsonb);
end;
$$;

grant execute on function public.sf_faqs() to anon, authenticated;
