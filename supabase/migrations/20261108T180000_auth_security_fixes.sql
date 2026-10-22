-- Signup grants only the ordinary customer role; privileged role changes are
-- limited by RLS to an already provisioned super-admin.
DO $auth_security_preflight$
DECLARE
  required_column text;
BEGIN
  IF to_regclass('public.user_roles') IS NULL
     OR to_regclass('public.profiles') IS NULL
     OR to_regclass('public.developer_tasks') IS NULL THEN
    RAISE EXCEPTION 'Auth security fixes require user_roles, profiles, and developer_tasks';
  END IF;

  IF to_regtype('public.app_role') IS NULL
     OR NOT EXISTS (
       SELECT 1
         FROM pg_enum e
         JOIN pg_type t ON t.oid = e.enumtypid
         JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
          AND t.typname = 'app_role'
          AND e.enumlabel = 'customer'
     ) THEN
    RAISE EXCEPTION 'public.app_role must contain the customer default role';
  END IF;

  FOREACH required_column IN ARRAY ARRAY[
    'status', 'progress_percent', 'progress_note', 'links',
    'attachments', 'tech_stack', 'delivery_notes',
    'developer_id', 'task_amount'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
        FROM pg_attribute
       WHERE attrelid = 'public.developer_tasks'::regclass
         AND attname = required_column
         AND attnum > 0
         AND NOT attisdropped
    ) THEN
      RAISE EXCEPTION 'public.developer_tasks is missing required column %', required_column;
    END IF;
  END LOOP;
END;
$auth_security_preflight$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, username, phone)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    COALESCE(
      NEW.raw_user_meta_data ->> 'username',
      split_part(COALESCE(NEW.email, ''), '@', 1)
    ),
    NEW.phone
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer'::public.app_role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Remove the signup-triggered administrator bootstrap. A trusted database
-- operator must provision the first super-admin out of band.
DROP TRIGGER IF EXISTS on_auth_user_created_bootstrap_admin ON auth.users;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS user_roles_super_admin_manage ON public.user_roles;
DROP POLICY IF EXISTS user_roles_super_admin_insert_guard ON public.user_roles;
DROP POLICY IF EXISTS user_roles_super_admin_update_guard ON public.user_roles;
DROP POLICY IF EXISTS user_roles_super_admin_delete_guard ON public.user_roles;

CREATE POLICY user_roles_super_admin_manage
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

DO $remove_other_role_write_policies$
DECLARE
  existing_policy record;
BEGIN
  FOR existing_policy IN
    SELECT polname
      FROM pg_policy
     WHERE polrelid = 'public.user_roles'::regclass
       AND polpermissive
       AND polcmd IN ('*', 'a', 'w', 'd')
       AND polname <> 'user_roles_super_admin_manage'
  LOOP
    EXECUTE format(
      'DROP POLICY %I ON public.user_roles',
      existing_policy.polname
    );
  END LOOP;
END;
$remove_other_role_write_policies$;

-- Restrictive policies prevent another permissive policy from widening access.
CREATE POLICY user_roles_super_admin_insert_guard
  ON public.user_roles
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY user_roles_super_admin_update_guard
  ON public.user_roles
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY user_roles_super_admin_delete_guard
  ON public.user_roles
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- Keep role discovery read-only for users; row policies authorize super-admin
-- writes. Column grants prevent changing a user's identity or creation time.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_roles FROM PUBLIC, anon, authenticated;
DO $revoke_role_column_writes$
DECLARE
  role_column text;
BEGIN
  FOR role_column IN
    SELECT attname
      FROM pg_attribute
     WHERE attrelid = 'public.user_roles'::regclass
       AND attnum > 0
       AND NOT attisdropped
  LOOP
    EXECUTE format(
      'REVOKE INSERT (%1$I), UPDATE (%1$I) ON TABLE public.user_roles FROM PUBLIC, anon, authenticated',
      role_column
    );
  END LOOP;
END;
$revoke_role_column_writes$;
GRANT SELECT ON TABLE public.user_roles TO authenticated;
GRANT INSERT (user_id, role), UPDATE (role), DELETE
  ON TABLE public.user_roles TO authenticated;

ALTER TABLE public.developer_tasks ENABLE ROW LEVEL SECURITY;

-- RLS controls which task row a developer may update; column privileges limit
-- what they can change within that row. Keep only progress and submission data.
REVOKE UPDATE ON TABLE public.developer_tasks FROM PUBLIC, anon, authenticated;
DO $revoke_task_column_updates$
DECLARE
  task_column text;
BEGIN
  FOR task_column IN
    SELECT attname
      FROM pg_attribute
     WHERE attrelid = 'public.developer_tasks'::regclass
       AND attnum > 0
       AND NOT attisdropped
  LOOP
    EXECUTE format(
      'REVOKE UPDATE (%I) ON TABLE public.developer_tasks FROM PUBLIC, anon, authenticated',
      task_column
    );
  END LOOP;
END;
$revoke_task_column_updates$;
GRANT UPDATE (
  status,
  progress_percent,
  progress_note,
  links,
  attachments,
  tech_stack,
  delivery_notes
) ON TABLE public.developer_tasks TO authenticated;

DO $auth_security_assertions$
DECLARE
  signup_definition text;
  allowed_column text;
  protected_column text;
  allowed_columns text[] := ARRAY[
    'status', 'progress_percent', 'progress_note', 'links',
    'attachments', 'tech_stack', 'delivery_notes'
  ];
  protected_columns text[] := ARRAY[
    'developer_id', 'assigned_by', 'client_id', 'task_amount',
    'title', 'description', 'priority', 'deadline',
    'estimated_hours', 'completed_at'
  ];
BEGIN
  signup_definition := pg_get_functiondef('public.handle_new_user()'::regprocedure);
  IF signup_definition ~* 'raw_user_meta_data[[:space:]]*->[>][[:space:]]*''role'''
     OR signup_definition !~ '''customer''::public[.]app_role' THEN
    RAISE EXCEPTION 'handle_new_user must assign customer and must not read a caller-supplied role';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'auth'
       AND c.relname = 'users'
       AND t.tgname = 'on_auth_user_created_bootstrap_admin'
       AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'Signup-triggered administrator bootstrap must be removed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_policy p
     WHERE p.polrelid = 'public.user_roles'::regclass
       AND p.polname = 'user_roles_super_admin_manage'
       AND p.polcmd = '*'
       AND pg_get_expr(p.polqual, p.polrelid) LIKE '%super_admin%'
       AND pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%super_admin%'
  ) THEN
    RAISE EXCEPTION 'Super-admin role-management policy was not installed';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_policy p
     WHERE p.polrelid = 'public.user_roles'::regclass
       AND p.polpermissive
       AND p.polcmd IN ('*', 'a', 'w', 'd')
       AND p.polname <> 'user_roles_super_admin_manage'
  ) THEN
    RAISE EXCEPTION 'A non-super-admin role-management policy must not remain';
  END IF;

  IF NOT has_column_privilege('authenticated', 'public.user_roles', 'user_id', 'INSERT')
     OR NOT has_column_privilege('authenticated', 'public.user_roles', 'role', 'INSERT')
     OR has_column_privilege('authenticated', 'public.user_roles', 'user_id', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.user_roles', 'created_at', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.user_roles', 'role', 'UPDATE') THEN
    RAISE EXCEPTION 'Role-table column grants do not match super-admin role management';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_attribute a
     WHERE a.attrelid = 'public.user_roles'::regclass
       AND a.attnum > 0
       AND NOT a.attisdropped
       AND a.attname NOT IN ('user_id', 'role')
       AND (
         has_column_privilege('authenticated', 'public.user_roles', a.attname, 'INSERT')
         OR has_column_privilege('authenticated', 'public.user_roles', a.attname, 'UPDATE')
       )
  ) THEN
    RAISE EXCEPTION 'Authenticated role-table column writes exceed user_id and role';
  END IF;

  FOREACH allowed_column IN ARRAY allowed_columns LOOP
    IF NOT has_column_privilege('authenticated', 'public.developer_tasks', allowed_column, 'UPDATE') THEN
      RAISE EXCEPTION 'Authenticated task updates are missing allowed column %', allowed_column;
    END IF;
  END LOOP;

  FOREACH protected_column IN ARRAY protected_columns LOOP
    IF has_column_privilege('authenticated', 'public.developer_tasks', protected_column, 'UPDATE') THEN
      RAISE EXCEPTION 'Authenticated task updates still include protected column %', protected_column;
    END IF;
  END LOOP;

  IF has_table_privilege('anon', 'public.developer_tasks', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.developer_tasks', 'UPDATE') THEN
    RAISE EXCEPTION 'Anonymous/authenticated table-wide developer_tasks UPDATE remains';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_attribute a
     WHERE a.attrelid = 'public.developer_tasks'::regclass
       AND a.attnum > 0
       AND NOT a.attisdropped
       AND a.attname <> ALL (allowed_columns)
       AND (
         has_column_privilege('anon', 'public.developer_tasks', a.attname, 'UPDATE')
         OR has_column_privilege('authenticated', 'public.developer_tasks', a.attname, 'UPDATE')
       )
  ) THEN
    RAISE EXCEPTION 'Unexpected developer_tasks column UPDATE privilege remains';
  END IF;

  IF NOT has_table_privilege('service_role', 'public.developer_tasks', 'UPDATE') THEN
    RAISE EXCEPTION 'service_role must retain developer_tasks UPDATE for server operations';
  END IF;
END;
$auth_security_assertions$;
