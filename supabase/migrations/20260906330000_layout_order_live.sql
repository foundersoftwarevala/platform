-- Make the registry tell the truth before the homepage starts obeying it.
--
-- The eighteen sections HomeIndex renders were registered as drafts on purpose:
-- registering a section should not change the page. That was right at the time,
-- but it leaves the registry saying "not enabled" about sections that are
-- visibly on the front page right now.
--
-- The homepage is about to start honouring `enabled`, and if it did so against
-- the current rows every section except catalog-rows would disappear. So the
-- order of operations matters: correct the record first, wire second, verify
-- third. This statement changes no behaviour at all — it makes the database
-- agree with what the page already does.
--
-- The four curated product rows stay drafts, because they genuinely do not
-- render. Nothing here publishes something that is not already visible.

update public.marketplace_homepage_sections
set enabled = true,
    status = 'published',
    published_at = coalesce(published_at, now()),
    updated_at = now()
where key in (
  -- Exactly the sections HomeIndex.tsx renders, read from the file top to
  -- bottom rather than assumed.
  'utility-bar', 'offer-banner', 'feature-strip', 'hero-carousel',
  'shop-by-industry', 'category-slider', 'search-bar', 'catalog-rows',
  'ai-zone', 'success-stories', 'awards-champions', 'live-activity',
  'vala-tv', 'vala-academy', 'partner-ecosystem', 'faq',
  'enterprise-cta', 'footer'
);
-- Let the homepage read its own composition.
--
-- Two things kept the layout gate inert.
--
-- First, the same policy shape as the hero: marketplace_homepage_sections has a
-- permissive "sections public read" for SELECT on enabled = true, and a
-- restrictive anon_write_denied scoped to ALL. A restrictive policy covers every
-- command it names, so the read evaluated as false AND (...) and an anonymous
-- visitor got nothing at all.
--
-- Second, and less obvious: even repaired, that policy only exposes rows where
-- enabled = true. A gate that has to hide a disabled section can never see it,
-- so it would have stayed inert in a subtler way — quietly rendering everything
-- while appearing wired.
--
-- So the homepage reads through mm_homepage_sections() instead. It is SECURITY
-- DEFINER, it returns only the structure of a public page — which sections
-- exist, their order, and whether they are on — and nothing a visitor could not
-- already learn by scrolling. The table's own policies stay as they are for
-- direct access.

-- Scope the denial to writes, so it stops cancelling the read it was never
-- meant to affect. Anonymous still cannot change anything.
drop policy if exists anon_write_denied on public.marketplace_homepage_sections;

create policy anon_insert_denied on public.marketplace_homepage_sections
  as restrictive for insert to anon with check (false);
create policy anon_update_denied on public.marketplace_homepage_sections
  as restrictive for update to anon using (false) with check (false);
create policy anon_delete_denied on public.marketplace_homepage_sections
  as restrictive for delete to anon using (false);

-- The homepage renders for signed-out visitors, so the composition read has to
-- be available to them.
grant execute on function public.mm_homepage_sections() to anon;
