-- Two things the first version of these functions got wrong about the audit
-- table it reads and writes.
--
-- marketplace_audit_logs.entity_id is a uuid. mm_layout_restore inserted
-- p_audit_id::text into it, which the database refused:
--
--   400  42804  column "entity_id" is of type uuid but expression is of
--                type text
--
-- So the restore never completed, and because the insert was in the same
-- statement as the work, nothing was restored either. The cast was the whole
-- bug: p_audit_id is already a uuid.
--
-- And section.enable and section.disable leave entity_id null, putting the
-- section key in metadata->>'entity_ref' instead. mm_layout_history read
-- entity_id as the section key, so every enable and disable in the panel
-- showed no section at all. The key comes from metadata now, with entity_id as
-- the fallback for the rows that do carry one.

-- ----------------------------------------------------------------- history
CREATE OR REPLACE FUNCTION public.mm_layout_history(p_limit integer DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_rows jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Not permitted to read the homepage layout history'
      USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(jsonb_agg(row_to_json(h) ORDER BY h.created_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT
        l.id,
        l.action,
        l.created_at,
        l.actor_id,
        (SELECT u.email FROM auth.users u WHERE u.id = l.actor_id) AS actor_email,
        -- Where the section key actually lives. An enable or a disable leaves
        -- entity_id null and records the key under metadata.entity_ref; only
        -- some rows carry a uuid there at all.
        coalesce(l.metadata->>'entity_ref', l.entity_id::text) AS section_key,
        l.before_state,
        l.after_state,
        (l.action = 'section.reorder'
          AND jsonb_typeof(l.before_state) = 'array') AS restorable
      FROM public.marketplace_audit_logs l
      WHERE l.action IN ('section.reorder', 'section.enable', 'section.disable', 'layout.restore')
      ORDER BY l.created_at DESC
      LIMIT greatest(1, least(coalesce(p_limit, 20), 100))
    ) h;

  RETURN jsonb_build_object('ok', true, 'entries', v_rows);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.mm_layout_history(integer) TO authenticated;

-- ----------------------------------------------------------------- restore
CREATE OR REPLACE FUNCTION public.mm_layout_restore(p_audit_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_entry public.marketplace_audit_logs%ROWTYPE;
  v_moved jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Not permitted to change the homepage layout'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_entry FROM public.marketplace_audit_logs WHERE id = p_audit_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No such layout change: %', p_audit_id USING ERRCODE = '22023';
  END IF;

  IF v_entry.action <> 'section.reorder' OR jsonb_typeof(v_entry.before_state) <> 'array' THEN
    RAISE EXCEPTION 'That change does not carry a layout to restore'
      USING ERRCODE = '22023';
  END IF;

  -- Through the existing reorder, not beside it: the same validation, the same
  -- single-statement renumbering, and its own section.reorder entry.
  v_moved := to_jsonb(public.mm_sections_reorder(v_entry.before_state));

  -- entity_id is a uuid and p_audit_id already is one. Casting it to text is
  -- what made this fail.
  INSERT INTO public.marketplace_audit_logs
    (actor_id, action, entity_type, entity_id, before_state, after_state, module, reason)
  VALUES
    (auth.uid(), 'layout.restore', 'homepage_layout', p_audit_id,
     v_entry.after_state, v_entry.before_state, 'layout-order',
     format('restored the layout as it was before %s', v_entry.created_at));

  RETURN jsonb_build_object('ok', true, 'restored_from', p_audit_id, 'moved', v_moved);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.mm_layout_restore(uuid) TO authenticated;
