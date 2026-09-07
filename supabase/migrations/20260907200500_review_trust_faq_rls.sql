-- Row level security for the three modules.
--
-- Customers reach their own reviews, reports and votes and nothing else.
-- Operators moderate. Anonymous visitors read published FAQs and enabled trust
-- badges — both are storefront content — and can write nothing anywhere.

alter table public.review_media   enable row level security;
alter table public.review_replies enable row level security;
alter table public.review_reports enable row level security;
alter table public.review_votes   enable row level security;
alter table public.trust_badges       enable row level security;
alter table public.trust_audit_logs   enable row level security;
alter table public.faqs               enable row level security;
alter table public.faq_categories     enable row level security;
alter table public.faq_versions       enable row level security;

-- A published review's replies and media are storefront content.
drop policy if exists review_replies_public on public.review_replies;
create policy review_replies_public on public.review_replies
  for select to anon, authenticated
  using (status = 'published' and exists (
    select 1 from public.marketplace_reviews r
     where r.id = review_replies.review_id and r.status = 'published'));

drop policy if exists review_replies_operator on public.review_replies;
create policy review_replies_operator on public.review_replies
  for all to authenticated
  using (public.mm_is_operator()) with check (public.mm_is_operator());

drop policy if exists review_media_public on public.review_media;
create policy review_media_public on public.review_media
  for select to anon, authenticated
  using (moderation_status = 'approved' and exists (
    select 1 from public.marketplace_reviews r
     where r.id = review_media.review_id and r.status = 'published'));

drop policy if exists review_media_operator on public.review_media;
create policy review_media_operator on public.review_media
  for all to authenticated
  using (public.mm_is_operator()) with check (public.mm_is_operator());

-- A report is between its author and the moderators. Nobody else sees who
-- reported what.
drop policy if exists review_reports_own on public.review_reports;
create policy review_reports_own on public.review_reports
  for select to authenticated
  using (reporter_id = auth.uid() or public.mm_is_operator());

drop policy if exists review_reports_file on public.review_reports;
create policy review_reports_file on public.review_reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists review_reports_operator on public.review_reports;
create policy review_reports_operator on public.review_reports
  for all to authenticated
  using (public.mm_is_operator()) with check (public.mm_is_operator());

drop policy if exists review_votes_own on public.review_votes;
create policy review_votes_own on public.review_votes
  for all to authenticated
  using (user_id = auth.uid() or public.mm_is_operator())
  with check (user_id = auth.uid());

-- Badge definitions are public because the storefront renders them; only an
-- operator can change one.
drop policy if exists trust_badges_read on public.trust_badges;
create policy trust_badges_read on public.trust_badges
  for select to anon, authenticated using (enabled or public.mm_is_operator());

drop policy if exists trust_badges_write on public.trust_badges;
create policy trust_badges_write on public.trust_badges
  for all to authenticated
  using (public.mm_is_operator()) with check (public.mm_is_operator());

drop policy if exists trust_audit_read on public.trust_audit_logs;
create policy trust_audit_read on public.trust_audit_logs
  for select to authenticated using (public.mm_is_operator());

-- Published FAQs are the storefront. Drafts are not.
drop policy if exists faqs_public on public.faqs;
create policy faqs_public on public.faqs
  for select to anon, authenticated
  using (status = 'published' or public.mm_is_operator());

drop policy if exists faqs_operator on public.faqs;
create policy faqs_operator on public.faqs
  for all to authenticated
  using (public.mm_is_operator()) with check (public.mm_is_operator());

drop policy if exists faq_categories_public on public.faq_categories;
create policy faq_categories_public on public.faq_categories
  for select to anon, authenticated using (enabled or public.mm_is_operator());

drop policy if exists faq_categories_operator on public.faq_categories;
create policy faq_categories_operator on public.faq_categories
  for all to authenticated
  using (public.mm_is_operator()) with check (public.mm_is_operator());

-- History is for operators. It carries text that was deliberately unpublished.
drop policy if exists faq_versions_operator on public.faq_versions;
create policy faq_versions_operator on public.faq_versions
  for select to authenticated using (public.mm_is_operator());

-- Anonymous writes are refused on every one of these, restrictively, so no
-- later permissive policy can accidentally open one.
do $$
declare t text;
begin
  foreach t in array array['review_media','review_replies','review_reports','review_votes',
                           'trust_badges','trust_audit_logs','faqs','faq_categories',
                           'faq_versions'] loop
    execute format('drop policy if exists %I on public.%I', t||'_anon_write', t);
    execute format($f$create policy %I on public.%I as restrictive for insert to anon
                      with check (false)$f$, t||'_anon_write', t);
    execute format('drop policy if exists %I on public.%I', t||'_anon_update', t);
    execute format($f$create policy %I on public.%I as restrictive for update to anon
                      using (false) with check (false)$f$, t||'_anon_update', t);
    execute format('drop policy if exists %I on public.%I', t||'_anon_delete', t);
    execute format($f$create policy %I on public.%I as restrictive for delete to anon
                      using (false)$f$, t||'_anon_delete', t);
  end loop;
end;
$$;

grant select on public.faqs, public.faq_categories, public.trust_badges to anon;
