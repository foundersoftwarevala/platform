-- Run only against a local/development database after applying the audit
-- columns migration. The insert/update/delete probes are rolled back.

SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'audit_logs'
   AND column_name IN (
     'actor_id',
     'before_state',
     'after_state',
     'before_status',
     'after_status',
     'before_payment',
     'after_payment',
     'request_id',
     'hash'
   )
 ORDER BY column_name;

SELECT t.tgname AS trigger_name,
       pg_get_triggerdef(t.oid) AS trigger_definition,
       t.tgenabled AS enabled
  FROM pg_trigger t
 WHERE t.tgrelid = 'public.audit_logs'::regclass
   AND NOT t.tgisinternal
   AND t.tgname IN ('audit_logs_append_only', 'audit_logs_hash_chain')
 ORDER BY t.tgname;

SELECT p.polname AS policy_name,
       p.polcmd AS command,
       p.polpermissive AS permissive,
       p.polroles::regrole[] AS roles
  FROM pg_policy p
 WHERE p.polrelid = 'public.audit_logs'::regclass
   AND p.polname LIKE 'audit_logs_phase3_%'
 ORDER BY p.polname;

SELECT count(*) AS total_rows,
       count(*) FILTER (WHERE actor_id IS NOT NULL) AS mapped_actor_rows,
       count(*) FILTER (WHERE actor_id IS NULL) AS unmapped_actor_rows
  FROM public.audit_logs;

SELECT e.extname AS extension_name,
       n.nspname AS extension_schema
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
 WHERE e.extname = 'pgcrypto';

BEGIN;

DO $probe$
DECLARE
  test_id uuid;
  test_time timestamptz;
  test_hash text;
  previous_hash text;
BEGIN
  PERFORM pg_advisory_xact_lock(725202611081453::bigint);

  SELECT al.hash
    INTO previous_hash
    FROM public.audit_logs al
   WHERE al.hash IS NOT NULL
   ORDER BY al.occurred_at DESC, al.id DESC
   LIMIT 1;

  INSERT INTO public.audit_logs (actor, action, entity_type, entity_id)
  VALUES ('phase-a-verification', 'audit_logs.test_insert', 'audit_logs',
          'phase-a-' || gen_random_uuid()::text)
  RETURNING id, occurred_at, hash
       INTO test_id, test_time, test_hash;

  IF test_hash IS NULL OR test_hash <>
     encode(
       digest(
         coalesce(previous_hash, '')
         || test_id::text
         || 'audit_logs.test_insert'
         || (SELECT entity_id FROM public.audit_logs WHERE id = test_id)
         || test_time::text,
         'sha256'
       ),
       'hex'
     ) THEN
    RAISE EXCEPTION 'audit_logs hash-chain probe failed';
  END IF;

  BEGIN
    UPDATE public.audit_logs
       SET action = action
     WHERE id = test_id;
    RAISE EXCEPTION 'audit_logs UPDATE was not blocked';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM <> 'audit_logs is append-only' THEN
        RAISE;
      END IF;
  END;

  BEGIN
    DELETE FROM public.audit_logs WHERE id = test_id;
    RAISE EXCEPTION 'audit_logs DELETE was not blocked';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM <> 'audit_logs is append-only' THEN
        RAISE;
      END IF;
  END;
END;
$probe$;

ROLLBACK;
