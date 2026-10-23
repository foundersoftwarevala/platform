BEGIN;

DO $master_role_preflight$
BEGIN
  IF to_regclass('public.user_roles') IS NULL OR to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'Master-role provisioning requires auth.users and public.user_roles';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public'
       AND t.typname = 'app_role'
       AND e.enumlabel = 'super_admin'
  ) OR NOT EXISTS (
    SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public'
       AND t.typname = 'app_role'
       AND e.enumlabel = 'marketplace-user'
  ) THEN
    RAISE EXCEPTION 'public.app_role must contain super_admin and marketplace-user';
  END IF;
END;
$master_role_preflight$;

CREATE OR REPLACE FUNCTION public.guard_master_super_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $guard$
DECLARE
  master_user_id uuid;
BEGIN
  SELECT id
    INTO master_user_id
    FROM auth.users
   WHERE lower(email) = 'bosssoftwarevala@gmail.com';

  IF master_user_id IS NULL THEN
    RAISE EXCEPTION 'The configured master owner account does not exist';
  END IF;

  IF NEW.role::text = 'super_admin'
     AND NEW.user_id <> master_user_id THEN
    RAISE EXCEPTION 'Only the master owner account may hold super_admin';
  END IF;

  RETURN NEW;
END;
$guard$;

REVOKE ALL ON FUNCTION public.guard_master_super_admin_role()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS user_roles_master_super_admin_guard ON public.user_roles;
CREATE TRIGGER user_roles_master_super_admin_guard
  BEFORE INSERT OR UPDATE OF user_id, role
  ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_master_super_admin_role();

DO $provision_master_and_marketplace$
DECLARE
  master_user_id uuid;
  marketplace_user_id uuid;
BEGIN
  SELECT id INTO master_user_id
    FROM auth.users
   WHERE lower(email) = 'bosssoftwarevala@gmail.com';
  IF master_user_id IS NULL THEN
    RAISE EXCEPTION 'The configured master owner account does not exist';
  END IF;

  SELECT id INTO marketplace_user_id
    FROM auth.users
   WHERE lower(email) = 'test.marketplace@softwarevala.test';
  IF marketplace_user_id IS NULL THEN
    RAISE EXCEPTION 'The marketplace test account does not exist';
  END IF;

  DELETE FROM public.user_roles
   WHERE role::text = 'super_admin'
     AND user_id <> master_user_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (master_user_id, 'super_admin'::public.app_role)
  ON CONFLICT DO NOTHING;

  DELETE FROM public.user_roles
   WHERE user_id = marketplace_user_id
     AND role::text IN ('admin', 'influencer');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (marketplace_user_id, 'marketplace-user'::public.app_role)
  ON CONFLICT DO NOTHING;
END;
$provision_master_and_marketplace$;

DO $master_role_assertions$
DECLARE
  master_user_id uuid;
  marketplace_user_id uuid;
BEGIN
  SELECT id INTO master_user_id
    FROM auth.users
   WHERE lower(email) = 'bosssoftwarevala@gmail.com';
  SELECT id INTO marketplace_user_id
    FROM auth.users
   WHERE lower(email) = 'test.marketplace@softwarevala.test';

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = master_user_id AND role::text = 'super_admin'
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE role::text = 'super_admin' AND user_id <> master_user_id
  ) THEN
    RAISE EXCEPTION 'The master owner must be the only super_admin';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = marketplace_user_id AND role::text = 'marketplace-user'
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = marketplace_user_id
       AND role::text IN ('admin', 'influencer')
  ) THEN
    RAISE EXCEPTION 'Marketplace test account role is not restricted to marketplace-user';
  END IF;
END;
$master_role_assertions$;

COMMIT;
