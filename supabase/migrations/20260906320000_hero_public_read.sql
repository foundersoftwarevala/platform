-- Let the public read the hero slides it is explicitly allowed to read.
--
-- home_hero_slides carries two policies:
--
--   home_hero_public_read  PERMISSIVE  SELECT  anon, authenticated  visible = true
--   anon_write_denied      RESTRICTIVE ALL     anon                 false
--
-- The intent is obvious and correct: anonymous visitors may read a visible
-- slide and may not write anything. But the restrictive policy is scoped to
-- ALL, and a restrictive policy applies to every command it names — including
-- SELECT. So the read is evaluated as `false AND (visible = true)`, which is
-- always false, and an anonymous visitor sees nothing. All twenty slides are
-- visible and none of them were reachable.
--
-- Scoping the denial to the write commands preserves the intent exactly —
-- anonymous still cannot insert, update or delete — while restoring the read
-- the other policy was written to grant.

drop policy if exists anon_write_denied on public.home_hero_slides;

create policy anon_insert_denied on public.home_hero_slides
  as restrictive for insert to anon with check (false);

create policy anon_update_denied on public.home_hero_slides
  as restrictive for update to anon using (false) with check (false);

create policy anon_delete_denied on public.home_hero_slides
  as restrictive for delete to anon using (false);
