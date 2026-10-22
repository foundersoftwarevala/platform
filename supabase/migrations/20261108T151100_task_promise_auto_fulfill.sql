-- Automatically complete pending task promises with their canonical task.

DO $phase6_auto_fulfill_preflight$
BEGIN
  IF to_regclass('public.tasks') IS NULL
     OR to_regclass('public.task_promises') IS NULL THEN
    RAISE EXCEPTION 'Phase 6 auto-fulfillment requires public.tasks and public.task_promises';
  END IF;
END;
$phase6_auto_fulfill_preflight$;

CREATE OR REPLACE FUNCTION public.tasks_fulfill_pending_promises()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $function$
BEGIN
  UPDATE public.task_promises
     SET status = 'fulfilled'
   WHERE task_id = NEW.id
     AND status = 'pending';
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tasks_fulfill_pending_promises ON public.tasks;
CREATE TRIGGER tasks_fulfill_pending_promises
  AFTER UPDATE OF status ON public.tasks
  FOR EACH ROW
  WHEN (
    OLD.status IS DISTINCT FROM NEW.status
    AND NEW.status IN ('submitted', 'verified')
  )
  EXECUTE FUNCTION public.tasks_fulfill_pending_promises();
