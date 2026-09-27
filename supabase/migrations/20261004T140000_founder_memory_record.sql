-- Recording a memory, atomically.
--
-- One active memory per subject is the guarantee the whole layer rests on,
-- and it makes recording a two-step act: supersede what is there, then write
-- what replaces it. Over a REST API those are two requests, and a failure
-- between them leaves the subject with no current memory at all — the
-- guarantee turned into a way to lose facts.
--
-- So it happens here, in one statement, inside one transaction. The new row's
-- id is generated first because the old row has to point at it, and the
-- constraint that a superseded memory must name its replacement is the reason
-- that ordering is forced rather than chosen.
--
-- Returns the new memory's id, and whether anything was superseded, so the
-- caller can tell "this is new" from "this replaced something" without
-- guessing.

-- The supersession pointer has to be deferrable.
--
-- Recording a memory means the outgoing row points at its replacement, and
-- the replacement does not exist until the insert that follows. Checked
-- immediately, that ordering is impossible; checked at commit, it is exactly
-- right, because by then both rows exist and the pointer is valid.
ALTER TABLE public.founder_memory
  DROP CONSTRAINT IF EXISTS founder_memory_superseded_by_fkey;
ALTER TABLE public.founder_memory
  ADD CONSTRAINT founder_memory_superseded_by_fkey
  FOREIGN KEY (superseded_by) REFERENCES public.founder_memory(id) ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

CREATE OR REPLACE FUNCTION public.founder_memory_record(
  p_scope          founder_memory_scope,
  p_subject        text,
  p_statement      text,
  p_source_system  text,
  p_detail         text DEFAULT NULL,
  p_source_ref     text DEFAULT NULL,
  p_recorded_by    uuid DEFAULT NULL,
  p_actor_kind     founder_actor DEFAULT 'AI',
  p_confidence     founder_confidence DEFAULT 'UNKNOWN',
  p_verified_at    timestamptz DEFAULT NULL,
  p_valid_until    timestamptz DEFAULT NULL,
  p_allowed_roles  text[] DEFAULT '{}',
  p_supersede_reason text DEFAULT NULL
)
RETURNS TABLE (memory_id uuid, superseded_id uuid, replaced boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_id uuid := gen_random_uuid();
  v_old_id uuid;
BEGIN
  IF p_statement IS NULL OR length(btrim(p_statement)) = 0 THEN
    RAISE EXCEPTION 'a memory needs a statement' USING ERRCODE = 'check_violation';
  END IF;

  -- What is currently held about this subject, locked so two callers cannot
  -- both decide they are the one replacing it.
  SELECT id INTO v_old_id
    FROM public.founder_memory
   WHERE scope = p_scope AND subject = p_subject AND status = 'ACTIVE'
   FOR UPDATE;

  IF v_old_id IS NOT NULL THEN
    -- Replacing something requires saying why. A caller that did not think
    -- it was replacing anything is told, rather than silently overwriting.
    IF p_supersede_reason IS NULL OR length(btrim(p_supersede_reason)) = 0 THEN
      RAISE EXCEPTION
        'a memory about % already exists; recording a new one requires a reason for replacing it',
        p_subject USING ERRCODE = 'check_violation';
    END IF;

    UPDATE public.founder_memory
       SET status = 'SUPERSEDED',
           superseded_by = v_new_id,
           superseded_at = now(),
           supersede_reason = p_supersede_reason
     WHERE id = v_old_id;
  END IF;

  INSERT INTO public.founder_memory
    (id, scope, subject, statement, detail, source_system, source_ref, recorded_by,
     actor_kind, confidence, verified_at, valid_until, allowed_roles)
  VALUES
    (v_new_id, p_scope, p_subject, p_statement, p_detail, p_source_system, p_source_ref,
     p_recorded_by, p_actor_kind, p_confidence, p_verified_at, p_valid_until, p_allowed_roles);

  RETURN QUERY SELECT v_new_id, v_old_id, (v_old_id IS NOT NULL);
END $$;

COMMENT ON FUNCTION public.founder_memory_record IS
  'Records a memory and supersedes whatever it replaces, in one transaction. Replacing an existing memory requires a reason.';

REVOKE ALL ON FUNCTION public.founder_memory_record FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.founder_memory_record TO service_role;

-- Retiring a memory without replacing it.
--
-- Separate from recording, because "this is no longer true" and "this is now
-- true instead" are different acts and conflating them loses the difference.
CREATE OR REPLACE FUNCTION public.founder_memory_retract(
  p_memory_id uuid,
  p_reason    text,
  p_actor     uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'retracting a memory requires a reason' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.founder_memory
     SET status = 'RETRACTED', retracted_reason = p_reason, recorded_by = coalesce(p_actor, recorded_by)
   WHERE id = p_memory_id AND status = 'ACTIVE';

  RETURN FOUND;
END $$;

REVOKE ALL ON FUNCTION public.founder_memory_retract FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.founder_memory_retract TO service_role;
