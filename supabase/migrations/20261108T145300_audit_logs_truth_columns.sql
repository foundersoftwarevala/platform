-- Adds truthful task-audit fields and protects audit_logs from row rewrites.
-- Existing columns are checked before any migration changes are made.

DO $preflight$
DECLARE
  required_column record;
  existing_column record;
BEGIN
  FOR required_column IN
    SELECT *
    FROM (VALUES
      ('actor_id', 'uuid'),
      ('before_state', 'jsonb'),
      ('after_state', 'jsonb'),
      ('before_status', 'text'),
      ('after_status', 'text'),
      ('before_payment', 'text'),
      ('after_payment', 'text'),
      ('request_id', 'text'),
      ('hash', 'text')
    ) AS required(name, expected_type)
  LOOP
    SELECT c.udt_name, c.is_nullable
      INTO existing_column
      FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name = 'audit_logs'
       AND c.column_name = required_column.name;

    IF FOUND
       AND existing_column.udt_name <> required_column.expected_type THEN
      RAISE EXCEPTION 'public.audit_logs.% has type %, expected %',
        required_column.name,
        existing_column.udt_name,
        required_column.expected_type;
    END IF;

    IF FOUND AND existing_column.is_nullable <> 'YES' THEN
      RAISE EXCEPTION 'public.audit_logs.% exists but is NOT NULL; expected NULL allowed',
        required_column.name;
    END IF;
  END LOOP;
END
$preflight$;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS actor_id uuid,
  ADD COLUMN IF NOT EXISTS before_state jsonb,
  ADD COLUMN IF NOT EXISTS after_state jsonb,
  ADD COLUMN IF NOT EXISTS before_status text,
  ADD COLUMN IF NOT EXISTS after_status text,
  ADD COLUMN IF NOT EXISTS before_payment text,
  ADD COLUMN IF NOT EXISTS after_payment text,
  ADD COLUMN IF NOT EXISTS request_id text,
  ADD COLUMN IF NOT EXISTS hash text;

WITH matching_users AS (
  SELECT al.id AS audit_id, u.id AS user_id
    FROM public.audit_logs al
    JOIN auth.users u
      ON u.email = al.actor
      OR u.raw_user_meta_data ->> 'name' = al.actor
   WHERE al.actor_id IS NULL
     AND al.actor IS NOT NULL
),
unique_matches AS (
  SELECT audit_id, min(user_id::text)::uuid AS user_id
    FROM matching_users
   GROUP BY audit_id
  HAVING count(DISTINCT user_id) = 1
)
UPDATE public.audit_logs al
   SET actor_id = matches.user_id
  FROM unique_matches matches
 WHERE al.id = matches.audit_id
   AND al.actor_id IS NULL;

DO $actor_fk_preflight$
DECLARE
  invalid_actor_count bigint;
BEGIN
  SELECT count(*)
    INTO invalid_actor_count
    FROM public.audit_logs al
   WHERE al.actor_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
         FROM auth.users u
        WHERE u.id = al.actor_id
     );

  IF invalid_actor_count > 0 THEN
    RAISE EXCEPTION 'public.audit_logs.actor_id contains % values not present in auth.users',
      invalid_actor_count;
  END IF;
END
$actor_fk_preflight$;

DO $actor_fk$
DECLARE
  actor_attnum smallint;
  existing_fk record;
BEGIN
  SELECT a.attnum
    INTO actor_attnum
    FROM pg_attribute a
   WHERE a.attrelid = 'public.audit_logs'::regclass
     AND a.attname = 'actor_id'
     AND NOT a.attisdropped;

  SELECT c.conname, c.confrelid
    INTO existing_fk
    FROM pg_constraint c
   WHERE c.conrelid = 'public.audit_logs'::regclass
     AND c.contype = 'f'
     AND actor_attnum = ANY (c.conkey)
   LIMIT 1;

  IF FOUND AND existing_fk.confrelid <> 'auth.users'::regclass THEN
    RAISE EXCEPTION 'public.audit_logs.actor_id already references %, expected auth.users',
      existing_fk.confrelid::regclass;
  ELSIF NOT FOUND THEN
    ALTER TABLE public.audit_logs
      ADD CONSTRAINT audit_logs_actor_id_fkey
      FOREIGN KEY (actor_id) REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END
$actor_fk$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.audit_logs_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $function$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$function$;

DROP TRIGGER IF EXISTS audit_logs_append_only ON public.audit_logs;
CREATE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_logs_guard();

CREATE OR REPLACE FUNCTION public.audit_logs_hash_chain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $function$
DECLARE
  previous_hash text;
BEGIN
  PERFORM pg_advisory_xact_lock(725202611081453::bigint);

  SELECT al.hash
    INTO previous_hash
    FROM public.audit_logs al
   WHERE al.hash IS NOT NULL
   ORDER BY al.occurred_at DESC, al.id DESC
   LIMIT 1;

  NEW.hash := encode(
    digest(
      coalesce(previous_hash, '')
      || NEW.id::text
      || NEW.action
      || coalesce(NEW.entity_id, '')
      || NEW.occurred_at::text,
      'sha256'
    ),
    'hex'
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS audit_logs_hash_chain ON public.audit_logs;
CREATE TRIGGER audit_logs_hash_chain
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_logs_hash_chain();

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_phase3_read ON public.audit_logs;
CREATE POLICY audit_logs_phase3_read
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.tm_is_operator() OR actor_id = auth.uid());

DROP POLICY IF EXISTS audit_logs_phase3_insert_deny ON public.audit_logs;
CREATE POLICY audit_logs_phase3_insert_deny
  ON public.audit_logs
  AS RESTRICTIVE
  FOR INSERT
  TO PUBLIC
  WITH CHECK (false);

DROP POLICY IF EXISTS audit_logs_phase3_update_deny ON public.audit_logs;
CREATE POLICY audit_logs_phase3_update_deny
  ON public.audit_logs
  AS RESTRICTIVE
  FOR UPDATE
  TO PUBLIC
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS audit_logs_phase3_delete_deny ON public.audit_logs;
CREATE POLICY audit_logs_phase3_delete_deny
  ON public.audit_logs
  AS RESTRICTIVE
  FOR DELETE
  TO PUBLIC
  USING (false);
