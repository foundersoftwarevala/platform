BEGIN;
SET LOCAL ROLE service_role;

DO $promise_fine_tier_test$
BEGIN
  IF public.task_promise_fine_percentage(0) <> 5
     OR public.task_promise_fine_percentage(1) <> 7
     OR public.task_promise_fine_percentage(2) <> 10
     OR public.task_promise_fine_percentage(12) <> 10 THEN
    RAISE EXCEPTION 'Promise fine percentage tiers failed';
  END IF;

  IF public.task_promise_fine_cents(10000, 0) <> 500
     OR public.task_promise_fine_cents(10000, 1) <> 700
     OR public.task_promise_fine_cents(10000, 2) <> 1000 THEN
    RAISE EXCEPTION 'Promise fine amount calculations failed';
  END IF;

  BEGIN
    PERFORM public.task_promise_fine_percentage(-1);
    RAISE EXCEPTION 'Negative previous-break count was accepted';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM = 'Negative previous-break count was accepted' THEN
        RAISE;
      END IF;
  END;

  BEGIN
    PERFORM public.task_promise_fine_cents(0, 0);
    RAISE EXCEPTION 'Nonpositive task amount was accepted';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM = 'Nonpositive task amount was accepted' THEN
        RAISE;
      END IF;
  END;
END;
$promise_fine_tier_test$;

ROLLBACK;
