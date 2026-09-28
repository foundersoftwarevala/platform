-- Hero Banner Manager could read the homepage's slides and change nothing.
--
-- Proven against the live site, signed in as the control panel account:
--
--   POST /rest/v1/home_hero_slides
--   403  42501  new row violates row-level security policy for
--                table "home_hero_slides"
--
-- home_hero_slides carries a public read policy and three explicit anon
-- denials, and nothing else. There is no policy permitting an operator to
-- write, so every create, edit, delete and reorder in the manager fails; the
-- screen is read-only in practice while presenting itself as an editor.
--
-- Its sibling, marketplace_homepage_sections, is edited by the same console and
-- has exactly the policy this table is missing:
--
--   sections admin write   ALL   authenticated
--     USING      (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'boss'))
--     WITH CHECK (same)
--
-- So this is not a new access model. It is the one the homepage configuration
-- already uses, applied to the table it was never applied to.
--
-- The read policy is the second half of the same fault. It is
-- `USING (visible = true)` for authenticated as well as anon, so an operator
-- cannot see a draft or an archived slide at all — the Drafts and Archived tabs
-- can never show anything, whatever the manager does. All twenty slides are
-- visible today, which is why nobody has noticed.
--
-- Four columns are added, and each is here because something in the manager
-- already collects it and has nowhere to put it:
--
--   cta_secondary_link  the secondary CTA's address. The label is stored in
--                       cta_secondary; the address was dropped on save and read
--                       back as `r.cta_link` — the PRIMARY button's link — so
--                       both buttons went to the same place and whatever the
--                       operator typed was discarded.
--
--   archived_at         archiving sets visible=false, and statusOf checks
--                       `!visible` first and returns "draft". An archived slide
--                       therefore reads back as a draft, the Archived tab stays
--                       empty and Restore is unreachable. A draft and an
--                       archived slide are different things and need a column
--                       to say which.
--
--   created_by,         the manager's row type carries both and writes neither,
--   updated_by          so every audit question about a slide answers "null".
--
-- No image columns are added. The hero's design is a gradient panel with a
-- Lucide icon, not a photograph, and adding desktop/tablet/mobile image columns
-- that nothing renders would be inventing a capability rather than connecting
-- one. If the hero is ever meant to carry images, that is a design decision and
-- a separate change.
--
-- No new table, no hero audit table: marketplace_audit_logs already records
-- actor, actor_role, action, entity_type, entity_id, before_state, after_state,
-- metadata and module, which is exactly what a hero action needs.

-- ------------------------------------------------------------------ columns
ALTER TABLE public.home_hero_slides
  ADD COLUMN IF NOT EXISTS cta_secondary_link text,
  ADD COLUMN IF NOT EXISTS archived_at        timestamptz,
  ADD COLUMN IF NOT EXISTS created_by         uuid,
  ADD COLUMN IF NOT EXISTS updated_by         uuid;

COMMENT ON COLUMN public.home_hero_slides.cta_secondary_link IS
  'Where the secondary CTA goes. Before this existed the manager read the primary link back into it, so both buttons pointed at the same place.';
COMMENT ON COLUMN public.home_hero_slides.archived_at IS
  'Set when a slide is archived, so an archived slide can be told from a draft — both have visible = false.';

-- A slide that is already out of its window is not thereby archived; only an
-- explicit archive sets this. Nothing is backfilled, because no slide in the
-- table has been archived: all twenty are visible.

-- ------------------------------------------------------------------- order
-- Reordering wrote one row at a time from the browser, so an interrupted
-- reorder left some slides renumbered and some not, and two slides could hold
-- the same position. This renumbers the whole set in one statement: either
-- every position moves or none does.
CREATE OR REPLACE FUNCTION public.mm_hero_reorder(p_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_moved int;
BEGIN
  IF NOT public.mm_is_operator() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_permitted');
  END IF;

  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_ids');
  END IF;

  -- Every id must exist, or the caller is working from a stale list and the
  -- renumbering would leave gaps.
  IF (SELECT count(*) FROM public.home_hero_slides WHERE id = ANY (p_ids)) <> array_length(p_ids, 1) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_slide_in_list');
  END IF;

  WITH ordered AS (
    SELECT id, (ordinality * 10)::int AS position
      FROM unnest(p_ids) WITH ORDINALITY AS t(id, ordinality)
  )
  UPDATE public.home_hero_slides s
     SET position = ordered.position,
         updated_at = now(),
         updated_by = auth.uid()
    FROM ordered
   WHERE s.id = ordered.id
     AND s.position IS DISTINCT FROM ordered.position;

  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'moved', v_moved, 'total', array_length(p_ids, 1));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.mm_hero_reorder(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.mm_hero_reorder(uuid[]) IS
  'Renumbers every hero slide position in one statement, so an interrupted reorder cannot leave two slides sharing a position.';

-- -------------------------------------------------------------- attribution
-- Set by the database, not by the caller. The manager's row type has carried
-- created_by and updated_by all along and written neither, so every audit
-- question about a slide answered "null". Asking the browser to send them would
-- mean trusting it to say who it is; auth.uid() is the session the database
-- already verified.
CREATE OR REPLACE FUNCTION public.mm_hero_attribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
  ELSE
    -- Never reassigned: who created a slide does not change when it is edited.
    NEW.created_by := OLD.created_by;
  END IF;
  NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS mm_hero_attribution ON public.home_hero_slides;
CREATE TRIGGER mm_hero_attribution
  BEFORE INSERT OR UPDATE ON public.home_hero_slides
  FOR EACH ROW EXECUTE FUNCTION public.mm_hero_attribution();

-- -------------------------------------------------------------------- audit
-- Straight into marketplace_audit_logs, which the rest of the console already
-- writes to. Recorded by a trigger rather than by the browser, so an action
-- cannot be performed without the record being written beside it.
CREATE OR REPLACE FUNCTION public.mm_hero_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_action text;
  v_before jsonb;
  v_after  jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'hero.slide.created';
    v_after  := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'hero.slide.deleted';
    v_before := to_jsonb(OLD);
  ELSE
    v_before := to_jsonb(OLD);
    v_after  := to_jsonb(NEW);
    -- Name the change rather than logging every update as "updated": the
    -- questions asked of this log are "when did this go live" and "who
    -- archived it", and an undifferentiated stream cannot answer either.
    v_action := CASE
      WHEN OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL THEN 'hero.slide.archived'
      WHEN OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL THEN 'hero.slide.restored'
      WHEN OLD.visible IS DISTINCT FROM NEW.visible AND NEW.visible THEN 'hero.slide.published'
      WHEN OLD.visible IS DISTINCT FROM NEW.visible AND NOT NEW.visible THEN 'hero.slide.unpublished'
      WHEN OLD.position IS DISTINCT FROM NEW.position THEN 'hero.slide.reordered'
      WHEN OLD.published_at IS DISTINCT FROM NEW.published_at
        OR OLD.unpublish_at IS DISTINCT FROM NEW.unpublish_at THEN 'hero.slide.scheduled'
      ELSE 'hero.slide.edited'
    END;
  END IF;

  INSERT INTO public.marketplace_audit_logs
    (actor_id, action, entity_type, entity_id, before_state, after_state, module)
  VALUES
    (auth.uid(), v_action, 'home_hero_slide',
     COALESCE(NEW.id, OLD.id), v_before, v_after, 'hero-banner');

  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS mm_hero_audit ON public.home_hero_slides;
CREATE TRIGGER mm_hero_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.home_hero_slides
  FOR EACH ROW EXECUTE FUNCTION public.mm_hero_audit();

-- ----------------------------------------------------------------- policies
-- The same pair marketplace_homepage_sections carries, and for the same
-- reason: the homepage's configuration is an operator's to change and nobody
-- else's. The public read policy is left exactly as it is, so what an
-- anonymous visitor may see does not change by one row.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'home_hero_slides'
       AND policyname = 'hero admin read'
  ) THEN
    CREATE POLICY "hero admin read" ON public.home_hero_slides
      FOR SELECT TO authenticated
      USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'boss'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'home_hero_slides'
       AND policyname = 'hero admin write'
  ) THEN
    CREATE POLICY "hero admin write" ON public.home_hero_slides
      FOR ALL TO authenticated
      USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'boss'::app_role))
      WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'boss'::app_role));
  END IF;
END $$;
