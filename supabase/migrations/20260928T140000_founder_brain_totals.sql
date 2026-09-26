-- Totals for the Company Brain screens, computed by the database.
--
-- The learning log and the reports register both draw headline figures — how
-- many decisions are on record, how many recommendations a person accepted,
-- how many reports found nothing. Those figures were previously counted from
-- whatever page of rows the screen happened to have fetched, which is wrong
-- the moment the register outgrows one page, and every page here is capped.
--
-- These two views push the counting into SQL so the figures stay right at any
-- size. They add nothing and remove nothing: every underlying table, column
-- and row is untouched.

CREATE OR REPLACE VIEW public.founder_learning_totals
WITH (security_invoker = true) AS
SELECT
  (SELECT count(*) FROM public.founder_learning) AS learning_records,

  (SELECT count(*) FROM public.founder_learning WHERE stage = 'PATTERN') AS patterns_recorded,

  -- A decision is "on record" once a person could have answered it. Anything
  -- still being detected or analysed has not reached anybody yet.
  (SELECT count(*) FROM public.founder_decisions
    WHERE state IN ('APPROVED', 'REJECTED', 'EXECUTING', 'VERIFICATION',
                    'VERIFIED', 'FAILED', 'CLOSED')) AS decisions_on_record,

  -- Overridden means a person picked an option other than the recommended one.
  (SELECT count(*) FROM public.founder_decisions d
    WHERE d.selected_option_id IS NOT NULL
      AND d.recommended_option_id IS NOT NULL
      AND d.selected_option_id <> d.recommended_option_id) AS overridden,

  -- Answered counts approvals a person actually decided. Accepted counts the
  -- subset where they approved without swapping the option. The two are kept
  -- apart so a share can be shown as "of those answered" rather than implying
  -- every open request was a refusal.
  (SELECT count(*) FROM public.founder_approvals
    WHERE state IN ('APPROVED', 'REJECTED')) AS recommendations_answered,

  (SELECT count(*) FROM public.founder_approvals a
    JOIN public.founder_decisions d ON d.id = a.decision_id
    WHERE a.state = 'APPROVED'
      AND (d.selected_option_id IS NULL
           OR d.recommended_option_id IS NULL
           OR d.selected_option_id = d.recommended_option_id)) AS recommendations_accepted,

  (SELECT count(*) FROM public.founder_decisions
    WHERE outcome IS NOT NULL) AS outcomes_recorded;

COMMENT ON VIEW public.founder_learning_totals IS
  'Server-side counts for the System Learning Log. No figure here is measured from a fetched page.';

-- The reports register is role-scoped, so its totals must be too: a reader
-- restricted to a subset of reports must not be handed a count that includes
-- the ones they cannot open. A view cannot take the reader's roles, so this is
-- a function. An earlier draft of this same, unreleased migration created a
-- view of this name; it is dropped here because nothing has ever referenced it.
DROP VIEW IF EXISTS public.founder_report_totals;

CREATE OR REPLACE FUNCTION public.founder_report_totals(p_roles text[])
RETURNS TABLE (
  total             bigint,
  generated         bigint,
  failed            bigint,
  insufficient_data bigint,
  with_findings     bigint
)
LANGUAGE sql
STABLE
AS $fn$
  SELECT
    count(*),
    count(*) FILTER (WHERE r.status = 'generated'),
    count(*) FILTER (WHERE r.status = 'failed'),
    count(*) FILTER (WHERE r.insufficient_data),
    count(*) FILTER (WHERE jsonb_array_length(r.findings) > 0)
  FROM public.founder_reports r
  WHERE r.status <> 'archived'
    AND (r.allowed_roles = '{}'::text[] OR r.allowed_roles && coalesce(p_roles, '{}'::text[]));
$fn$;

COMMENT ON FUNCTION public.founder_report_totals(text[]) IS
  'Server-side counts for the AI Reports register, scoped to the reader roles.';

GRANT SELECT ON public.founder_learning_totals TO service_role;
GRANT EXECUTE ON FUNCTION public.founder_report_totals(text[]) TO service_role;
