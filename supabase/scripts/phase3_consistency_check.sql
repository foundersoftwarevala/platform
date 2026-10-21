-- Run only after the Phase 3 `tasks` table and audit trigger have been
-- installed in a local/development database. Each query lists violations;
-- expected result: zero rows from every query.

-- 1. Every canonical row must retain its source identity.
SELECT id, legacy_source, legacy_id
  FROM public.tasks
 WHERE legacy_source IS NULL
    OR legacy_id IS NULL;

-- 2. Verified rows must have the approval timestamp.
SELECT id, status, verified_at
  FROM public.tasks
 WHERE status = 'verified'
   AND verified_at IS NULL;

-- 3. Paid rows must have the paid timestamp.
SELECT id, status, paid_at
  FROM public.tasks
 WHERE status = 'paid'
   AND paid_at IS NULL;

-- 4. A verified payment starts the seven-day due window.
SELECT id, payment_status, verified_at, due_at
  FROM public.tasks
 WHERE payment_status = 'verified'
   AND due_at IS NULL;

-- 5. Paid payment rows must have the paid timestamp.
SELECT id, payment_status, paid_at
  FROM public.tasks
 WHERE payment_status = 'paid'
   AND paid_at IS NULL;

-- 6. For each non-initial current status, a matching audit event must exist.
-- This checks current-state coverage, not historical completeness before the
-- database trigger was installed; the append-only trigger enforces future
-- status-change event creation.
SELECT t.id, t.status, t.updated_at
  FROM public.tasks t
 WHERE t.status <> 'assigned'
   AND NOT EXISTS (
     SELECT 1
       FROM public.audit_logs al
      WHERE al.entity_type = 'task'
        AND al.entity_id = t.id::text
        AND al.action = 'task.status_changed'
        AND al.after_status = t.status::text
        AND al.before_status IS DISTINCT FROM al.after_status
        AND al.occurred_at >= t.updated_at - interval '60 seconds'
   );
