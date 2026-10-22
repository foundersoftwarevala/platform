-- Restrict reseller application decisions to platform operators and make the
-- Reseller Manager's application queue read-only.

CREATE OR REPLACE FUNCTION public.application_boss()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
      FROM public.user_roles
     WHERE user_id = auth.uid()
       AND lower(role::text) IN ('admin', 'boss', 'super_admin', 'boss_owner', 'founder')
  );
$$;

REVOKE ALL ON FUNCTION public.application_boss() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.application_boss() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reseller_application_reader()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.application_boss() OR (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1
        FROM public.user_roles
       WHERE user_id = auth.uid()
         AND lower(role::text) IN ('finance', 'support', 'sales_support_manager')
    )
  );
$$;

REVOKE ALL ON FUNCTION public.reseller_application_reader() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reseller_application_reader() TO authenticated, service_role;

-- Preserve the installed status workflow while adding an authoritative
-- database-side gate and routing rejection notices to Support.
DO $$
DECLARE
  v_definition text;
  v_original text;
  v_marker text := '  if v_status = ''terminated'' then';
  v_replacement text :=
    '  if (p_to = ''rejected'' or (p_to = ''active'' and v_status in (''pending'', ''rejected''))) ' ||
    'and not public.application_boss() then' || E'\n' ||
    '    return jsonb_build_object(''ok'', false, ''reason'', ''boss_approval_required'',' || E'\n' ||
    '      ''message'', ''Only a platform operator can approve or reject a reseller application.'');' || E'\n' ||
    '  end if;' || E'\n\n' ||
    '  if v_status = ''terminated'' then';
  v_old_path text;
  v_new_path text;
BEGIN
  v_definition := pg_get_functiondef(
    'public.mm_reseller_status(uuid,text,text)'::regprocedure
  );
  v_original := v_definition;

  IF position('public.application_boss()' IN v_definition) = 0 THEN
    IF position(v_marker IN v_definition) = 0 THEN
      RAISE EXCEPTION 'mm_reseller_status differs from the reviewed definition; refusing to change approval access';
    END IF;
    v_definition := replace(v_definition, v_marker, v_replacement);
  END IF;

  IF position('case when p_to = ''rejected'' then ''/contact''' IN v_definition) = 0 THEN
    FOREACH v_old_path IN ARRAY ARRAY['/dashboard/reseller', '/reseller-manager']
    LOOP
      IF position(quote_literal(v_old_path) IN v_definition) > 0 THEN
        v_new_path :=
          'case when p_to = ''rejected'' then ''/contact'' else ' ||
          quote_literal(v_old_path) || ' end';
        v_definition := replace(v_definition, quote_literal(v_old_path), v_new_path);
        EXIT;
      END IF;
    END LOOP;

    IF v_definition = v_original THEN
      RAISE EXCEPTION 'mm_reseller_status notification route differs from the reviewed definition; refusing to change it';
    END IF;
  END IF;

  IF v_definition <> v_original THEN
    EXECUTE v_definition;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
