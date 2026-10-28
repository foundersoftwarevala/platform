-- VPS-only Footer Column creation and server-role execution for the
-- operator-guarded floating-element RPC.
-- The application transaction sets request JWT claims, verifies mm_is_operator,
-- and then runs both definer functions as service_role. The functions still
-- perform their own operator checks before writing.

CREATE OR REPLACE FUNCTION public.sf_footer_column_create(
  p_key text,
  p_heading text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_position integer;
  v_after jsonb;
BEGIN
  IF NOT public.mm_is_operator() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_permitted');
  END IF;

  IF p_key IS NULL OR p_key !~ '^[a-z0-9][a-z0-9_-]{0,39}$'
     OR nullif(btrim(p_heading), '') IS NULL OR length(p_heading) > 80 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_config');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('storefront_footer_columns_position'));
  SELECT coalesce(max(position), 0) + 1
    INTO v_position
    FROM public.storefront_footer_columns;
  IF v_position > 20 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'column_limit_reached');
  END IF;

  INSERT INTO public.storefront_footer_columns AS c
    (key, heading, position, enabled, created_by, updated_by)
  VALUES
    (p_key, btrim(p_heading), v_position, true, auth.uid(), auth.uid())
  RETURNING to_jsonb(c.*) INTO v_after;

  PERFORM public.mm_audit(
    'footer.column.create', 'storefront_footer_column', p_key, NULL, v_after, NULL
  );

  RETURN jsonb_build_object('ok', true, 'column', v_after);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'duplicate_key');
END;
$$;

REVOKE ALL ON FUNCTION public.sf_footer_column_create(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sf_footer_column_create(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sf_floating_create(text, text, text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
