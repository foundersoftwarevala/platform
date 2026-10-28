-- Decision Engine records and immutable operational audit for Self-Healing.
--
-- AI decisions are tied to the existing Founder decision lifecycle and to
-- self-healing recovery attempts. Human review updates a separate status and
-- is audited; it never rewrites the recommendation that was made.

ALTER TABLE public.ai_decision_logs
  ADD COLUMN IF NOT EXISTS decision_type text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'deferred',
  ADD COLUMN IF NOT EXISTS human_action text,
  ADD COLUMN IF NOT EXISTS human_action_by uuid,
  ADD COLUMN IF NOT EXISTS founder_decision_id uuid
    REFERENCES public.founder_decisions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_key text;

UPDATE public.ai_decision_logs
   SET status = CASE lower(outcome)
     WHEN 'accepted' THEN 'accepted'
     WHEN 'deferred' THEN 'deferred'
     WHEN 'pending' THEN 'deferred'
     WHEN 'overridden' THEN 'overridden'
     WHEN 'rejected' THEN 'overridden'
     WHEN 'escalated' THEN 'escalated'
     ELSE 'deferred'
   END
 WHERE status IS NULL OR status NOT IN ('accepted','deferred','overridden','escalated');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.ai_decision_logs'::regclass
       AND conname = 'ai_decision_logs_status_valid'
  ) THEN
    ALTER TABLE public.ai_decision_logs
      ADD CONSTRAINT ai_decision_logs_status_valid
      CHECK (status IN ('accepted','deferred','overridden','escalated'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ai_decision_logs_founder_decision_unique
  ON public.ai_decision_logs (founder_decision_id)
  WHERE founder_decision_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ai_decision_logs_source_key_unique
  ON public.ai_decision_logs (source_key)
  WHERE source_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.founder_healing_rebalance_task(p_task_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_task public.tm_tasks%ROWTYPE;
  v_candidate record;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' OR auth.uid() IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'service_role_required');
  END IF;

  SELECT * INTO v_task
    FROM public.tm_tasks
   WHERE id = p_task_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'task_not_found');
  END IF;
  IF v_task.status NOT IN ('new', 'routed', 'available_for_claim') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'task_not_eligible', 'status', v_task.status);
  END IF;

  SELECT c.role, c.score, c.load_percent
    INTO v_candidate
    FROM public.tm_assignment_candidates(p_task_id) c
   WHERE c.available
     AND c.role IS NOT NULL
     AND c.role <> v_task.assigned_role
     AND c.load_percent < 100
   ORDER BY c.score DESC, c.load_percent ASC, c.full_name ASC
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_better_role_available');
  END IF;

  UPDATE public.tm_tasks
     SET assigned_role = v_candidate.role,
         status = CASE
           WHEN status IN ('new', 'routed') THEN 'available_for_claim'
           ELSE status
         END,
         buzzer_active = true,
         updated_at = now()
   WHERE id = p_task_id;

  INSERT INTO public.tm_activity
    (task_id, actor_name, actor_role, action, action_type, from_value, to_value, details)
  VALUES
    (p_task_id, 'Self-Healing', 'system', 'Task role rebalanced', 'routing',
     coalesce(v_task.assigned_role, 'unrouted'), v_candidate.role,
     format('Selected available role at %s%% load with score %s',
       v_candidate.load_percent, v_candidate.score));

  RETURN jsonb_build_object('ok', true, 'role', v_candidate.role,
    'load_percent', v_candidate.load_percent, 'score', v_candidate.score);
END;
$$;

REVOKE ALL ON FUNCTION public.founder_healing_rebalance_task(uuid) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.founder_healing_rebalance_task(uuid) FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.founder_healing_rebalance_task(uuid) FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.founder_healing_rebalance_task(uuid) TO service_role';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.founder_audit_healing_incident()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_action text;
  event_metadata jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    event_action := 'self_healing_detected';
    event_metadata := jsonb_build_object(
      'failure_class', NEW.failure_class,
      'severity', NEW.severity,
      'domain', NEW.domain,
      'title', NEW.title,
      'detail', NEW.detail,
      'source_system', NEW.source_system,
      'entity_type', NEW.entity_type,
      'entity_id', NEW.entity_id,
      'event_id', NEW.event_id,
      'agent_run_id', NEW.agent_run_id,
      'root_cause_hypothesis', NEW.root_cause_hypothesis,
      'diagnosis_evidence', NEW.diagnosis_evidence,
      'correlation_key', NEW.correlation_key,
      'state', NEW.state
    );
  ELSIF NEW.state IS DISTINCT FROM OLD.state THEN
    event_action := CASE WHEN NEW.state::text = 'ESCALATED'
      THEN 'self_healing_escalated' ELSE 'self_healing_state_transition' END;
    event_metadata := jsonb_build_object(
      'failure_class', NEW.failure_class,
      'severity', NEW.severity,
      'title', NEW.title,
      'entity_type', NEW.entity_type,
      'entity_id', NEW.entity_id,
      'from_state', OLD.state,
      'to_state', NEW.state,
      'attempts', NEW.attempts,
      'circuit_open', NEW.circuit_open,
      'recovery_blocked', NEW.recovery_blocked,
      'escalation_reason', NEW.escalation_reason,
      'circuit_reason', NEW.circuit_reason
    );
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.audit_logs
    (occurred_at, actor, action, entity_type, entity_id, severity, metadata)
  VALUES
    (now(), 'self-healing', event_action, 'founder_incident', NEW.id::text,
     CASE WHEN NEW.severity::text IN ('HIGH','CRITICAL') THEN 'warning' ELSE 'info' END,
     event_metadata);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS founder_incidents_audit_append ON public.founder_incidents;
CREATE TRIGGER founder_incidents_audit_append
  AFTER INSERT OR UPDATE OF state ON public.founder_incidents
  FOR EACH ROW EXECUTE FUNCTION public.founder_audit_healing_incident();

CREATE OR REPLACE FUNCTION public.founder_audit_recovery_attempt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs
    (occurred_at, actor, action, entity_type, entity_id, severity, metadata)
  VALUES
    (now(), coalesce(NEW.executed_by, 'self-healing'), 'self_healing_recovery_attempt',
     'founder_recovery_attempt', NEW.id::text,
     CASE WHEN NEW.result::text = 'FAILED' THEN 'error'
          WHEN NEW.verified THEN 'info' ELSE 'warning' END,
     jsonb_build_object(
       'incident_id', NEW.incident_id,
       'attempt_number', NEW.attempt_number,
       'action', NEW.action,
       'chosen_because', NEW.chosen_because,
       'result', NEW.result,
       'outcome', NEW.outcome,
       'error', NEW.error,
       'verification_method', NEW.verification_method,
       'verified', NEW.verified,
       'verified_at', NEW.verified_at,
       'verification_detail', NEW.verification_detail,
       'executed_by', NEW.executed_by,
       'scope_rows', NEW.scope_rows,
       'scope_description', NEW.scope_description,
       'previous_state', NEW.previous_state,
       'reversible', NEW.reversible
     ));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS founder_recovery_attempts_audit_append ON public.founder_recovery_attempts;
CREATE TRIGGER founder_recovery_attempts_audit_append
  AFTER INSERT ON public.founder_recovery_attempts
  FOR EACH ROW EXECUTE FUNCTION public.founder_audit_recovery_attempt();

CREATE OR REPLACE FUNCTION public.founder_decision_to_ai_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recommended text;
BEGIN
  IF NEW.state::text NOT IN ('RECOMMENDATION_READY','ESCALATED')
     OR NEW.state IS NOT DISTINCT FROM OLD.state THEN
    RETURN NEW;
  END IF;

  SELECT concat_ws('. ', o.title, o.description) INTO recommended
    FROM public.founder_decision_options o
   WHERE o.id = NEW.recommended_option_id;

  INSERT INTO public.ai_decision_logs
    (agent_id, decision, confidence, input_summary, output_summary, outcome,
     decision_type, status, founder_decision_id, source_key)
  VALUES
    (NULL, NEW.title, coalesce(NEW.confidence_score, 0),
     left(NEW.description, 2000), left(coalesce(recommended, NEW.description), 2000),
     CASE WHEN NEW.state::text = 'ESCALATED' THEN 'escalated' ELSE 'deferred' END,
     NEW.decision_type,
     CASE WHEN NEW.state::text = 'ESCALATED' THEN 'escalated' ELSE 'deferred' END,
     NEW.id, 'founder_decision:' || NEW.id::text)
  ON CONFLICT (founder_decision_id) WHERE founder_decision_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS founder_decisions_ai_log ON public.founder_decisions;
CREATE TRIGGER founder_decisions_ai_log
  AFTER UPDATE OF state ON public.founder_decisions
  FOR EACH ROW EXECUTE FUNCTION public.founder_decision_to_ai_log();

CREATE OR REPLACE FUNCTION public.ai_decision_logs_audit_append()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_action text;
  event_metadata jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    event_action := 'ai_decision_recorded';
    event_metadata := jsonb_build_object(
      'decision_type', NEW.decision_type,
      'decision', NEW.decision,
      'confidence', NEW.confidence,
      'status', NEW.status,
      'source_key', NEW.source_key,
      'founder_decision_id', NEW.founder_decision_id
    );
  ELSIF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.human_action IS DISTINCT FROM OLD.human_action THEN
    event_action := 'ai_decision_reviewed';
    event_metadata := jsonb_build_object(
      'decision_type', NEW.decision_type,
      'decision', NEW.decision,
      'from_status', OLD.status,
      'to_status', NEW.status,
      'human_action', NEW.human_action,
      'human_action_by', NEW.human_action_by,
      'source_key', NEW.source_key
    );
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.audit_logs
    (occurred_at, actor, action, entity_type, entity_id, severity, metadata)
  VALUES
    (now(), coalesce(NEW.human_action_by::text, 'ai-decision-engine'), event_action,
     'ai_decision_log', NEW.id::text,
     CASE WHEN NEW.status = 'escalated' THEN 'warning' ELSE 'info' END,
     event_metadata);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS ai_decision_logs_audit_append ON public.ai_decision_logs;
CREATE TRIGGER ai_decision_logs_audit_append
  AFTER INSERT OR UPDATE OF status, human_action ON public.ai_decision_logs
  FOR EACH ROW EXECUTE FUNCTION public.ai_decision_logs_audit_append();
