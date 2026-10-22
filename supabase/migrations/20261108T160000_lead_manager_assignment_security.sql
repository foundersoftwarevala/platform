-- Keep the existing Lead Manager schema and add an authenticated owner
-- boundary instead of creating a parallel leads table.

ALTER TYPE public.lead_status_type ADD VALUE IF NOT EXISTS 'qualified';
ALTER TYPE public.lead_status_type ADD VALUE IF NOT EXISTS 'proposal';

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

UPDATE public.leads l
   SET assigned_to = u.id
  FROM public.lead_agents a
  JOIN auth.users u ON lower(u.email) = lower(a.email)
 WHERE l.assigned_agent_id = a.id
    AND l.assigned_to IS NULL
    AND EXISTS (
      SELECT 1
        FROM public.user_roles ur
       WHERE ur.user_id = u.id AND ur.role::text = 'sales'
    );

CREATE INDEX IF NOT EXISTS leads_assigned_to_status_created_idx
  ON public.leads (assigned_to, status, created_at DESC);

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL,
  action text NOT NULL CHECK (length(btrim(action)) > 0),
  note text,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_activities_lead_created_idx
  ON public.lead_activities (lead_id, created_at DESC, id DESC);

ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lead_activities FROM anon, authenticated;
GRANT SELECT ON public.lead_activities TO authenticated;

CREATE OR REPLACE FUNCTION public.is_lead_manager_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.user_roles ur
     WHERE ur.user_id = _user_id
       AND ur.role::text IN (
         'admin', 'super_admin', 'boss', 'boss_owner', 'founder',
         'sales_support_manager', 'support', 'marketing'
       )
  );
$$;

REVOKE ALL ON FUNCTION public.is_lead_manager_manager(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_lead_manager_manager(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS staff_manage_leads ON public.leads;
DROP POLICY IF EXISTS marketplace_lead_intake ON public.leads;
DROP POLICY IF EXISTS lead_manager_read_scope ON public.leads;
DROP POLICY IF EXISTS lead_manager_update_scope ON public.leads;

CREATE POLICY lead_manager_read_scope ON public.leads
  FOR SELECT TO authenticated
  USING (
    public.is_lead_manager_manager(auth.uid())
    OR assigned_to = auth.uid()
  );

CREATE POLICY lead_manager_update_scope ON public.leads
  FOR UPDATE TO authenticated
  USING (
    public.is_lead_manager_manager(auth.uid())
    OR assigned_to = auth.uid()
  )
  WITH CHECK (
    public.is_lead_manager_manager(auth.uid())
    OR assigned_to = auth.uid()
  );

DROP POLICY IF EXISTS lead_activities_read_scope ON public.lead_activities;
CREATE POLICY lead_activities_read_scope ON public.lead_activities
  FOR SELECT TO authenticated
  USING (
    public.is_lead_manager_manager(auth.uid())
    OR EXISTS (
      SELECT 1
        FROM public.leads l
       WHERE l.id = lead_id
         AND l.assigned_to = auth.uid()
    )
  );

REVOKE ALL ON public.leads FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.leads FROM authenticated;
GRANT SELECT ON public.leads TO authenticated;
DO $$
DECLARE
  v_columns text;
BEGIN
  SELECT string_agg(format('%I', column_name), ', ' ORDER BY ordinal_position)
    INTO v_columns
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'leads'
     AND column_name NOT IN (
       'id', 'created_at', 'status', 'assigned_agent_id', 'assigned_at', 'assigned_to'
     );

  IF v_columns IS NOT NULL THEN
    EXECUTE format('GRANT UPDATE (%s) ON public.leads TO authenticated', v_columns);
  END IF;
END;
$$;
REVOKE ALL ON public.lead_activities FROM anon;

CREATE OR REPLACE FUNCTION public.lead_manager_activity_is_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Lead activity is append-only; record a new activity instead'
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS lead_activities_append_only ON public.lead_activities;
CREATE TRIGGER lead_activities_append_only
  BEFORE UPDATE OR DELETE ON public.lead_activities
  FOR EACH ROW EXECUTE FUNCTION public.lead_manager_activity_is_append_only();

CREATE OR REPLACE FUNCTION public.lead_manager_log_activity(
  p_lead_id uuid,
  p_action text,
  p_note text,
  p_before jsonb,
  p_after jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.lead_activities
    (lead_id, actor_id, action, note, before_state, after_state)
  VALUES
    (p_lead_id, auth.uid(), p_action, nullif(btrim(p_note), ''), p_before, p_after);

  INSERT INTO public.audit_logs
    (actor, actor_id, action, entity_type, entity_id, severity, metadata)
  VALUES
    (auth.uid()::text, auth.uid(), p_action, 'lead', p_lead_id::text, 'info',
     jsonb_build_object('before', p_before, 'after', p_after, 'note', nullif(btrim(p_note), '')));
END;
$$;

CREATE OR REPLACE FUNCTION public.lead_manager_create_lead(
  p_name text,
  p_email text,
  p_phone text,
  p_company text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_source text DEFAULT 'manual',
  p_sub_source text DEFAULT 'Manual Entry',
  p_priority text DEFAULT 'medium',
  p_deal_value numeric DEFAULT 0,
  p_requirements text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead public.leads%ROWTYPE;
  v_actor uuid := auth.uid();
  v_agent_id uuid;
BEGIN
  IF v_actor IS NULL OR NOT (
    public.is_lead_manager_manager(v_actor)
    OR EXISTS (
      SELECT 1 FROM public.user_roles
       WHERE user_id = v_actor AND role::text = 'sales'
    )
  ) THEN
    RAISE EXCEPTION 'Lead Manager access is required' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF length(btrim(p_name)) NOT BETWEEN 1 AND 200
     OR length(btrim(p_email)) NOT BETWEEN 3 AND 320
     OR length(btrim(p_phone)) NOT BETWEEN 7 AND 40
     OR p_deal_value < 0 THEN
    RAISE EXCEPTION 'Lead details are invalid' USING ERRCODE = 'check_violation';
  END IF;

  IF NOT public.is_lead_manager_manager(v_actor) THEN
    SELECT a.id INTO v_agent_id
      FROM public.lead_agents a
      JOIN auth.users u ON lower(u.email) = lower(a.email)
     WHERE u.id = v_actor;
    IF v_agent_id IS NULL THEN
      RAISE EXCEPTION 'Your sales account is not linked to a Lead Manager agent profile'
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;

  INSERT INTO public.leads
    (name, email, phone, company, city, state, source, sub_source, priority,
     deal_value, requirements, assigned_agent_id, assigned_at, assigned_to)
  VALUES
    (btrim(p_name), lower(btrim(p_email)), btrim(p_phone), nullif(btrim(p_company), ''),
     nullif(btrim(p_city), ''), nullif(btrim(p_state), ''),
     p_source::public.lead_source_type, coalesce(nullif(btrim(p_sub_source), ''), 'Manual Entry'),
     p_priority::public.lead_priority, p_deal_value, nullif(btrim(p_requirements), ''),
     v_agent_id, CASE WHEN v_agent_id IS NULL THEN NULL ELSE now() END,
     CASE WHEN public.is_lead_manager_manager(v_actor) THEN NULL ELSE v_actor END)
  RETURNING * INTO v_lead;

  PERFORM public.lead_manager_log_activity(
    v_lead.id, 'created', 'Lead created from Lead Manager',
    NULL, jsonb_build_object('status', v_lead.status, 'assigned_to', v_lead.assigned_to)
  );
  RETURN v_lead.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.lead_manager_update_status(
  p_lead_id uuid,
  p_status text,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_before public.leads%ROWTYPE;
  v_after public.leads%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication is required' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_status NOT IN (
    'new', 'contacted', 'qualified', 'proposal', 'interested',
    'follow_up', 'negotiation', 'won', 'lost', 'spam'
  ) THEN
    RAISE EXCEPTION 'Unsupported lead status' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_before
    FROM public.leads
   WHERE id = p_lead_id
     AND (public.is_lead_manager_manager(v_actor) OR assigned_to = v_actor)
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead was not found or is not assigned to you' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_before.status::text = p_status THEN
    RETURN p_lead_id;
  END IF;

  UPDATE public.leads
     SET status = p_status::public.lead_status_type,
         closed_at = CASE WHEN p_status IN ('won', 'lost') THEN now() ELSE NULL END,
         lost_reason = CASE WHEN p_status = 'lost' AND nullif(btrim(p_note), '') IS NOT NULL
                            THEN btrim(p_note) ELSE lost_reason END,
         spam_reason = CASE WHEN p_status = 'spam' AND nullif(btrim(p_note), '') IS NOT NULL
                            THEN btrim(p_note) ELSE spam_reason END,
         updated_at = now()
   WHERE id = p_lead_id
  RETURNING * INTO v_after;

  PERFORM public.lead_manager_log_activity(
    p_lead_id, 'status_changed', p_note,
    jsonb_build_object('status', v_before.status),
    jsonb_build_object('status', v_after.status)
  );
  RETURN p_lead_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.lead_manager_assign_lead(
  p_lead_id uuid,
  p_agent_id uuid,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_assignee uuid;
  v_before public.leads%ROWTYPE;
  v_after public.leads%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT public.is_lead_manager_manager(v_actor) THEN
    RAISE EXCEPTION 'Manager access is required to assign leads'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT u.id INTO v_assignee
    FROM public.lead_agents a
    JOIN auth.users u ON lower(u.email) = lower(a.email)
   WHERE a.id = p_agent_id;
  IF v_assignee IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = v_assignee AND role::text = 'sales'
  ) THEN
    RAISE EXCEPTION 'The selected agent has no linked sales account'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  SELECT * INTO v_before FROM public.leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead was not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_before.assigned_agent_id = p_agent_id THEN
    RETURN p_lead_id;
  END IF;

  UPDATE public.leads
     SET assigned_agent_id = p_agent_id,
         assigned_to = v_assignee,
         assigned_at = now(),
         updated_at = now()
   WHERE id = p_lead_id
  RETURNING * INTO v_after;

  PERFORM public.lead_manager_log_activity(
    p_lead_id, 'assigned', p_note,
    jsonb_build_object('assigned_agent_id', v_before.assigned_agent_id,
                       'assigned_to', v_before.assigned_to),
    jsonb_build_object('assigned_agent_id', v_after.assigned_agent_id,
                       'assigned_to', v_after.assigned_to)
  );
  RETURN p_lead_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.lead_manager_get_activities(p_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.is_lead_manager_manager(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.leads
       WHERE id = p_lead_id AND assigned_to = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Lead was not found or is not assigned to you'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC, a.id DESC)
      FROM (
        SELECT id, lead_id, actor_id, action, note, before_state, after_state, created_at
          FROM public.lead_activities
         WHERE lead_id = p_lead_id
         ORDER BY created_at DESC, id DESC
         LIMIT 100
      ) a
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.lead_manager_can_assign()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND public.is_lead_manager_manager(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.lead_manager_assignable_agents()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_lead_manager_manager(auth.uid()) THEN
    RAISE EXCEPTION 'Manager access is required to list assignable agents'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(
      jsonb_build_object('id', a.id, 'name', a.name, 'team', a.team, 'status', a.status)
      ORDER BY a.name, a.id
    )
      FROM public.lead_agents a
      JOIN auth.users u ON lower(u.email) = lower(a.email)
      JOIN public.user_roles ur ON ur.user_id = u.id AND ur.role::text = 'sales'
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.lead_manager_log_activity(uuid, text, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lead_manager_create_lead(text, text, text, text, text, text, text, text, text, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lead_manager_update_status(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lead_manager_assign_lead(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lead_manager_get_activities(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lead_manager_can_assign() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lead_manager_assignable_agents() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.lead_manager_create_lead(text, text, text, text, text, text, text, text, text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lead_manager_update_status(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lead_manager_assign_lead(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lead_manager_get_activities(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lead_manager_can_assign() TO authenticated;
GRANT EXECUTE ON FUNCTION public.lead_manager_assignable_agents() TO authenticated;

COMMENT ON COLUMN public.leads.assigned_to IS
  'Authenticated account that owns this lead for Lead Manager RLS; assigned_agent_id remains the CRM roster link.';
COMMENT ON TABLE public.lead_activities IS
  'Append-only, actor-stamped Lead Manager events. Mutations are written atomically by the Lead Manager security-definer RPCs.';
