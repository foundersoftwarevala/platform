-- The two real dropdowns in the header, moved into the registry that already
-- describes them.
--
-- The header has exactly two menus: Apply Now, with seven roles, and
-- Dashboards, with eleven. Both are arrays written into TopUtilityBar.tsx, so
-- adding a role, renaming one, reordering them or hiding one meant editing the
-- component. The module rows for them existed and carried nothing but a note
-- saying where the list lived.
--
-- The items now live in each module's own config, which means:
--
--   no new table        the registry already has a config column, and
--                       marketplace_topbar_modules is already the canonical
--                       owner of what the bar contains
--   no new request      TopUtilityBar already fetches these rows through
--                       mm_topbar_modules; the items arrive in the answer it
--                       is already waiting for
--   one source of truth the manager edits the same rows the header reads
--
-- The values below are the current constants, copied exactly, so the rendered
-- header does not change by a character. The component keeps its arrays as the
-- fallback for the case where the registry cannot be read — the bar has never
-- been allowed to depend on that call, and still does not.
--
-- Every key here resolves to a real route: /apply/$role accepts all seven and
-- answers 200, /dashboard/$role accepts all eleven. Checked against the live
-- site rather than against the route file.

UPDATE public.marketplace_topbar_modules
   SET config = config || jsonb_build_object(
         'source', 'This registry. The header reads the list below; the arrays '
                || 'in TopUtilityBar.tsx remain only as the fallback for a '
                || 'failed read.',
         'route_pattern', '/apply/$role',
         'items', jsonb_build_array(
           jsonb_build_object('key','vendor','label','Become Vendor','blurb','List your own software products'),
           jsonb_build_object('key','author','label','Become Author','blurb','Publish code, docs and templates'),
           jsonb_build_object('key','reseller','label','Become Reseller','blurb','Sell our catalog, keep the margin'),
           jsonb_build_object('key','affiliate','label','Become Affiliate','blurb','Earn per referred sale'),
           jsonb_build_object('key','franchise','label','Become Franchise','blurb','Run Software Vala in your city'),
           jsonb_build_object('key','influencer','label','Become Influencer','blurb','Collaborate on campaigns'),
           jsonb_build_object('key','employee','label','Become Employee','blurb','Full-time openings')))
 WHERE module_key = 'apply-now';

UPDATE public.marketplace_topbar_modules
   SET config = config || jsonb_build_object(
         'source', 'This registry. The header reads the list below; the arrays '
                || 'in TopUtilityBar.tsx remain only as the fallback for a '
                || 'failed read.',
         'route_pattern', '/dashboard/$role',
         'items', jsonb_build_array(
           jsonb_build_object('key','author','label','Author Dashboard','blurb','Products, downloads & royalties'),
           jsonb_build_object('key','vendor','label','Vendor Dashboard','blurb','Catalog, orders & payouts'),
           jsonb_build_object('key','reseller','label','Reseller Dashboard','blurb','Clients, licenses & pricing'),
           jsonb_build_object('key','affiliate','label','Affiliate Dashboard','blurb','Links, clicks & commissions'),
           jsonb_build_object('key','influencer','label','Influencer Dashboard','blurb','Campaigns & creatives'),
           jsonb_build_object('key','franchise','label','Franchise Dashboard','blurb','Branches, leads & revenue'),
           jsonb_build_object('key','seo','label','SEO Dashboard','blurb','Rankings, audits & backlinks'),
           jsonb_build_object('key','admin','label','Admin Dashboard','blurb','Platform-wide control'),
           jsonb_build_object('key','developer','label','Developer Dashboard','blurb','Tasks, bugs & releases'),
           jsonb_build_object('key','dev-manager','label','Developer Management','blurb','Team, sprints & delivery'),
           jsonb_build_object('key','promise-tracker','label','Promise Tracker','blurb','Commitments & follow-through')))
 WHERE module_key = 'dashboards';

-- ------------------------------------------------------------------- editing
-- Editing a dropdown is a different shape of change from flipping a status, so
-- it gets its own entry point rather than being squeezed into the patch
-- mm_topbar_configure takes. Same guard, same audit trail, same refusal
-- vocabulary.
--
-- It validates rather than trusts: every item needs a key and a label, keys
-- must be unique within the menu, and the list is capped so one bad paste
-- cannot put four hundred entries into a header dropdown.
CREATE OR REPLACE FUNCTION public.mm_topbar_items_set(p_key text, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_before jsonb;
  v_count int;
  v_distinct int;
BEGIN
  IF NOT public.mm_is_operator() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_permitted');
  END IF;

  SELECT to_jsonb(m) INTO v_before
    FROM public.marketplace_topbar_modules m
   WHERE m.module_key = p_key;
  IF v_before IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_module');
  END IF;

  IF jsonb_typeof(p_items) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_a_list',
      'message', 'The menu items must be a list.');
  END IF;

  v_count := jsonb_array_length(p_items);
  IF v_count > 40 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_many',
      'message', format('A header dropdown takes at most 40 items; %s were sent.', v_count));
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_items) i
     WHERE coalesce(btrim(i->>'key'), '') = ''
        OR coalesce(btrim(i->>'label'), '') = ''
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'incomplete_item',
      'message', 'Every item needs a key and a label.');
  END IF;

  SELECT count(DISTINCT i->>'key') INTO v_distinct
    FROM jsonb_array_elements(p_items) i;
  IF v_distinct <> v_count THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'duplicate_key',
      'message', 'Two items share a key; each key appears once in a menu.');
  END IF;

  UPDATE public.marketplace_topbar_modules
     SET config = config || jsonb_build_object('items', p_items),
         updated_by = auth.uid(), updated_at = now()
   WHERE module_key = p_key;

  PERFORM public.mm_audit('topbar_items_set', 'topbar_module', p_key,
    v_before->'config'->'items', p_items, 'top bar dropdown items changed');

  RETURN jsonb_build_object('ok', true, 'module', p_key, 'items', v_count);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.mm_topbar_items_set(text, jsonb) TO PUBLIC;

COMMENT ON FUNCTION public.mm_topbar_items_set(text, jsonb) IS
  'Replace the items of a header dropdown. Validates that each item has a key and a label, that keys are unique, and that the menu stays under forty entries. Guarded by mm_is_operator and audited like every other top bar change.';
