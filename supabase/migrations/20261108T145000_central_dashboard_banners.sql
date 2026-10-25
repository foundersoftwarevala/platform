-- Extend the existing hero slide system to own role-targeted dashboard banners.
-- Existing rows remain Marketplace slides through the default value.

ALTER TABLE public.home_hero_slides
  ADD COLUMN IF NOT EXISTS banner_type text NOT NULL DEFAULT 'marketplace_slider',
  ADD COLUMN IF NOT EXISTS target_roles text[];

UPDATE public.home_hero_slides
   SET banner_type = 'marketplace_slider'
 WHERE banner_type IS NULL OR btrim(banner_type) = '';

ALTER TABLE public.home_hero_slides
  ALTER COLUMN banner_type SET DEFAULT 'marketplace_slider',
  ALTER COLUMN banner_type SET NOT NULL;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.home_hero_slides'::regclass
       AND conname = 'home_hero_slides_banner_type_check'
  ) THEN
    ALTER TABLE public.home_hero_slides
      ADD CONSTRAINT home_hero_slides_banner_type_check
      CHECK (banner_type IN (
        'marketplace_slider',
        'dashboard_welcome',
        'festival_wish',
        'officer_notice'
      ));
  END IF;
END
$migration$;

CREATE INDEX IF NOT EXISTS home_hero_slides_central_type_live_position_idx
  ON public.home_hero_slides (banner_type, position)
  WHERE visible = true;

CREATE INDEX IF NOT EXISTS home_hero_slides_target_roles_gin_idx
  ON public.home_hero_slides USING gin (target_roles);

COMMENT ON COLUMN public.home_hero_slides.banner_type IS
  'Central placement for the existing hero/banner content: marketplace slider, role dashboard welcome, festival wish, or officer notice.';
COMMENT ON COLUMN public.home_hero_slides.target_roles IS
  'Dashboard roles allowed to see this banner. NULL or an empty array means all roles.';
