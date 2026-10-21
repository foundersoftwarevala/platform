-- Read-only consistency checks for the fresh canonical tasks table.
-- Expected result: every query returns zero rows.

-- 1. Verified tasks must have a verification timestamp.
SELECT id, status, verified_at
  FROM public.tasks
 WHERE status = 'verified'
   AND verified_at IS NULL;

-- 2. Paid tasks must have a paid timestamp.
SELECT id, status, paid_at
  FROM public.tasks
 WHERE status = 'paid'
   AND paid_at IS NULL;

-- 3. Verified payment state must have a seven-day due timestamp.
SELECT id, payment_status, verified_at, due_at
  FROM public.tasks
 WHERE payment_status = 'verified'
   AND due_at IS NULL;

-- 4. Paid payment state must have a paid timestamp.
SELECT id, payment_status, paid_at
  FROM public.tasks
 WHERE payment_status = 'paid'
   AND paid_at IS NULL;

-- 5. Every task must have a continuous audit status history, beginning with
-- its insert event and ending in the task's current status.
WITH ordered_status_events AS (
  SELECT
    t.id AS task_id,
    t.status::text AS current_status,
    al.id AS audit_id,
    al.before_status,
    al.after_status,
    lag(al.after_status) OVER (
      PARTITION BY t.id
      ORDER BY al.occurred_at, al.id
    ) AS previous_after_status,
    row_number() OVER (
      PARTITION BY t.id
      ORDER BY al.occurred_at, al.id
    ) AS event_number,
    count(al.id) OVER (PARTITION BY t.id) AS event_count
  FROM public.tasks t
  LEFT JOIN public.audit_logs al
    ON al.entity_type = 'task'
   AND al.entity_id = t.id::text
   AND al.action = 'task.status_changed'
)
SELECT DISTINCT task_id, current_status
  FROM ordered_status_events
 WHERE audit_id IS NULL
    OR (
      event_number = 1
      AND (before_status IS NOT NULL OR after_status IS DISTINCT FROM 'assigned')
    )
    OR (
      event_number > 1
      AND before_status IS DISTINCT FROM previous_after_status
    )
    OR (
      event_number = event_count
      AND after_status IS DISTINCT FROM current_status
    );
