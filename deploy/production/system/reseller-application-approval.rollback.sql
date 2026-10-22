BEGIN;

DO $$
DECLARE
  v_definition text;
  v_before text;
  v_guard text :=
    '  if (p_to = ''rejected'' or (p_to = ''active'' and v_status in (''pending'', ''rejected''))) ' ||
    'and not public.application_boss() then' || E'\n' ||
    '    return jsonb_build_object(''ok'', false, ''reason'', ''boss_approval_required'',' || E'\n' ||
    '      ''message'', ''Only a platform operator can approve or reject a reseller application.'');' || E'\n' ||
    '  end if;' || E'\n\n';
  v_current_path text;
  v_old_path text;
BEGIN
  v_definition := pg_get_functiondef(
    'public.mm_reseller_status(uuid,text,text)'::regprocedure
  );
  v_before := v_definition;
  v_definition := replace(v_definition, v_guard, '');

  FOREACH v_old_path IN ARRAY ARRAY['/dashboard/reseller', '/reseller-manager']
  LOOP
    v_current_path :=
      'case when p_to = ''rejected'' then ''/contact'' else ' ||
      quote_literal(v_old_path) || ' end';
    v_definition := replace(v_definition, v_current_path, quote_literal(v_old_path));
  END LOOP;

  IF v_definition <> v_before THEN
    EXECUTE v_definition;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.reseller_application_reader();
DROP FUNCTION IF EXISTS public.application_boss();

COMMIT;
