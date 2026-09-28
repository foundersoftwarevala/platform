-- Looking at what the layout used to be, and putting it back.
--
-- The brief asks for "Reset to Default Layout". There is no default to reset
-- to: no migration, table or constant records a canonical homepage order, and
-- the seed simply inserted the sections in the order somebody chose at the
-- time. Inventing one would mean deciding for the owner what the right
-- homepage order is, which is a design decision and not mine.
--
-- What does exist is the real thing to restore from. Every reorder already
-- writes its complete before and after state into marketplace_audit_logs as
-- [{key, sort_order}, ...] — the whole layout, not a diff. So instead of a
-- fabricated default, an operator can look at the changes that were actually
-- made and put any of them back.
--
-- That is also what section 30 of the brief asks for: inspect the previous
-- layout, the current one, who changed it and when, and restore with the
-- restore itself audited.
--
-- Neither function adds a table and neither adds a second ordering path:
-- restore calls mm_sections_reorder, so the same validation, the same
-- single-statement renumbering and the same audit entry apply.

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
        -- The email rather than a uuid, because "who changed this" is a
        -- question about a person.
        (SELECT u.email FROM auth.users u WHERE u.id = l.actor_id) AS actor_email,
        l.entity_id AS section_key,
        l.before_state,
        l.after_state,
        -- Only a reorder carries a whole layout worth putting back. An enable
        -- or a disable is one section, and restoring it is just toggling it.
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

COMMENT ON FUNCTION public.mm_layout_history(integer) IS
  'Recent homepage layout changes with actor, timestamp and the complete before/after order, so an operator can see what the layout was before a change and put it back.';

-- ----------------------------------------------------------------- restore
CREATE OR REPLACE FUNCTION public.mm_layout_restore(p_audit_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_entry  public.marketplace_audit_logs%ROWTYPE;
  v_moved  jsonb;
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

  -- Through the existing reorder, not beside it. Every check it makes - an
  -- unknown key, a repeated key, the single-statement renumbering - applies
  -- here too, and it writes its own section.reorder entry, so the restore
  -- leaves the same trail any other reorder would.
  v_moved := to_jsonb(public.mm_sections_reorder(v_entry.before_state));

  -- And a record of the restore itself, which is a different fact from the
  -- reorder it performed: it says somebody deliberately went back.
  INSERT INTO public.marketplace_audit_logs
    (actor_id, action, entity_type, entity_id, before_state, after_state, module, reason)
  VALUES
    (auth.uid(), 'layout.restore', 'homepage_layout', p_audit_id::text,
     v_entry.after_state, v_entry.before_state, 'layout-order',
     format('restored the layout as it was before %s', v_entry.created_at));

  RETURN jsonb_build_object('ok', true, 'restored_from', p_audit_id, 'moved', v_moved);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.mm_layout_restore(uuid) TO authenticated;

COMMENT ON FUNCTION public.mm_layout_restore(uuid) IS
  'Puts the homepage layout back to the order recorded before a given change. Goes through mm_sections_reorder so the same validation and audit apply, and records the restore itself.';
