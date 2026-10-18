-- Enabling an archived section moved the toggle and drew nothing.
--
-- shop-by-category sits in the registry with status 'archived', archived_at
-- set, and a config that says exactly why:
--
--   superseded_by:   category-slider
--   archived_reason: duplicate of category-slider; both describe CategorySlider
--
-- Both rows name the same component, and only category-slider is in the
-- renderer's node map, so the archived one has nothing to draw.
--
-- Measured on the live site before changing anything: enabling it succeeded,
-- the row became enabled = true with status still 'archived', and
-- mm_homepage_sections reported enabled true with live_now FALSE. So the public
-- page was never at risk - live_now already folds status in, and the renderer
-- honours live_now.
--
-- What was wrong is what the operator is shown. Layout Order draws its ON/OFF
-- from enabled, so the screen would say ON for a section that is not live and
-- cannot render. That is the "ON in the database, nothing on the page" state
-- worth refusing.
--
-- The row is not deleted, the archive is not removed, category-slider is not
-- touched, and nothing about the homepage changes. This adds one guard to the
-- function that already refuses an unknown key, in the same shape and with the
-- same error code; the definition below is otherwise the one already
-- installed, copied verbatim.
--
-- shop-by-category is the only archived section in the registry today.

CREATE OR REPLACE FUNCTION public.mm_section_set_enabled(p_key text, p_enabled boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
declare
  v_before jsonb;
  v_after  jsonb;
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Not permitted to change the homepage layout'
      using errcode = '42501';
  end if;

  select to_jsonb(s) into v_before
    from public.marketplace_homepage_sections s
   where s.key = p_key;

  if v_before is null then
    raise exception 'Unknown homepage section: %', p_key
      using errcode = '22023';
  end if;

  -- An archived section cannot be switched on.
  --
  -- shop-by-category is archived and superseded by category-slider; both rows
  -- name the same component and only category-slider is in the renderer's map,
  -- so enabling the archived one moves the toggle and draws nothing.
  --
  -- The page was never at risk: live_now already folds status in, so an
  -- archived section reads live_now false however the toggle sits. What was
  -- wrong is what the operator is told - Layout Order draws its ON/OFF from
  -- enabled, so it would show ON for a section that is not live and has no
  -- component. Refusing is the honest answer, and it is the same shape as the
  -- refusal above it.
  --
  -- This traps nothing: un-archiving through mm_row_set_status makes the
  -- section enableable again, which is the deliberate route back.
  if p_enabled and (v_before->>'status') = 'archived' then
    raise exception 'Section % is archived (superseded by %). Restore it before enabling.',
      p_key, coalesce(v_before->'config'->>'superseded_by', 'another section')
      using errcode = '22023';
  end if;

  update public.marketplace_homepage_sections s
     set enabled = p_enabled,
         -- Switching a section on has to mean it appears. live_now folds
         -- status into the answer, so enabling a draft while leaving it a
         -- draft would move the toggle and change nothing on the page.
         status = case
                    when p_enabled and s.status = 'draft' then 'published'
                    else s.status
                  end,
         published_at = case
                          when p_enabled and s.published_at is null then now()
                          else s.published_at
                        end,
         updated_at = now()
   where s.key = p_key
  returning to_jsonb(s) into v_after;

  if v_after is null then
    raise exception 'Homepage section % could not be updated', p_key
      using errcode = '42501';
  end if;

  perform public.mm_audit(
    case when p_enabled then 'section.enable' else 'section.disable' end,
    'homepage_section', p_key, v_before, v_after, null
  );

  return v_after;
end;
$function$;
