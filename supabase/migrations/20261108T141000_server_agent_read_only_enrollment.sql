-- Read-only agent enrollment and authenticated heartbeat ingestion.
-- Enrollment is owner-scoped; only the service role can submit agent telemetry.

ALTER TABLE public.server_instances
  ALTER COLUMN provider DROP NOT NULL,
  ALTER COLUMN region_code DROP NOT NULL,
  ALTER COLUMN region_name DROP NOT NULL,
  ALTER COLUMN cpu_cores DROP NOT NULL,
  ALTER COLUMN ram_gb DROP NOT NULL,
  ALTER COLUMN storage_gb DROP NOT NULL,
  ALTER COLUMN monthly_cost DROP NOT NULL,
  ALTER COLUMN cpu_usage DROP NOT NULL,
  ALTER COLUMN ram_usage DROP NOT NULL,
  ALTER COLUMN disk_usage DROP NOT NULL,
  ALTER COLUMN network_in_mbps DROP NOT NULL,
  ALTER COLUMN network_out_mbps DROP NOT NULL,
  ALTER COLUMN uptime_percent DROP NOT NULL,
  ALTER COLUMN sla_percent DROP NOT NULL,
  ALTER COLUMN response_time_ms DROP NOT NULL,
  ALTER COLUMN error_rate DROP NOT NULL,
  ALTER COLUMN health_score DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.server_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL UNIQUE REFERENCES public.server_instances(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  enrollment_key uuid NOT NULL,
  os text NOT NULL CHECK (os IN ('linux', 'windows', 'other')),
  status text NOT NULL DEFAULT 'pending_agent' CHECK (status IN ('pending_agent', 'connected', 'revoked')),
  last_seen timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, enrollment_key)
);

CREATE INDEX IF NOT EXISTS server_agents_owner_status_idx
  ON public.server_agents (owner_id, status);

ALTER TABLE public.server_agents ENABLE ROW LEVEL SECURITY;

-- Server profiles and metric snapshots are accepted only through server-side
-- enrollment/heartbeat functions, never direct browser mutations.
REVOKE ALL ON public.server_instances FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.server_instances TO authenticated;

DROP POLICY IF EXISTS server_agents_anon_denied ON public.server_agents;
CREATE POLICY server_agents_anon_denied
  ON public.server_agents AS RESTRICTIVE FOR ALL TO anon
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS server_agents_owner_read ON public.server_agents;
CREATE POLICY server_agents_owner_read
  ON public.server_agents FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.server_is_operator());

REVOKE ALL ON public.server_agents FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, server_id, owner_id, os, status, last_seen, created_at)
  ON public.server_agents TO authenticated;
GRANT ALL ON public.server_agents TO service_role;

ALTER TABLE public.server_metrics_history
  ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES public.server_agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS idempotency_key uuid,
  ADD COLUMN IF NOT EXISTS failed_logins integer,
  ADD COLUMN IF NOT EXISTS open_ports integer[],
  ADD COLUMN IF NOT EXISTS patch_status text,
  ADD COLUMN IF NOT EXISTS suspicious_process boolean,
  ADD COLUMN IF NOT EXISTS uptime_seconds bigint;

CREATE UNIQUE INDEX IF NOT EXISTS server_metrics_agent_idempotency_key
  ON public.server_metrics_history (agent_id, idempotency_key)
  WHERE agent_id IS NOT NULL AND idempotency_key IS NOT NULL;

DROP POLICY IF EXISTS server_metrics_history_write ON public.server_metrics_history;
REVOKE ALL ON public.server_metrics_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.server_metrics_history TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.server_metrics_history TO service_role;

CREATE OR REPLACE FUNCTION public.server_agent_enroll(
  p_server_name text,
  p_os text,
  p_provider text,
  p_region text,
  p_enrollment_key uuid,
  p_token_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_server_id uuid;
  v_agent_id uuid;
  v_server_code text;
  v_user_id uuid := auth.uid();
  v_existing public.server_agents%ROWTYPE;
  v_existing_server public.server_instances%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_server_name IS NULL OR length(btrim(p_server_name)) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Server name must be between 1 and 100 characters' USING ERRCODE = '22023';
  END IF;
  IF p_os IS NULL OR p_os NOT IN ('linux', 'windows', 'other') THEN
    RAISE EXCEPTION 'Unsupported operating system' USING ERRCODE = '22023';
  END IF;
  IF p_provider IS NOT NULL AND length(p_provider) > 100 THEN
    RAISE EXCEPTION 'Provider must be 100 characters or fewer' USING ERRCODE = '22023';
  END IF;
  IF p_region IS NOT NULL AND length(p_region) > 100 THEN
    RAISE EXCEPTION 'Region must be 100 characters or fewer' USING ERRCODE = '22023';
  END IF;
  IF p_enrollment_key IS NULL OR p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid enrollment credentials' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text), hashtext(p_enrollment_key::text));

  SELECT * INTO v_existing
  FROM public.server_agents
  WHERE owner_id = v_user_id AND enrollment_key = p_enrollment_key;
  IF FOUND THEN
    SELECT * INTO v_existing_server
    FROM public.server_instances
    WHERE id = v_existing.server_id;
    IF v_existing.token_hash <> p_token_hash
       OR v_existing.os <> p_os
       OR v_existing_server.server_name <> btrim(p_server_name)
       OR v_existing_server.provider IS DISTINCT FROM coalesce(nullif(btrim(p_provider), ''), 'unspecified')
       OR v_existing_server.region_code IS DISTINCT FROM nullif(btrim(p_region), '') THEN
      RAISE EXCEPTION 'Enrollment request key was already used' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object(
      'server_id', v_existing.server_id,
      'agent_id', v_existing.id,
      'status', v_existing.status
    );
  END IF;

  v_server_code := 'SRV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));
  INSERT INTO public.server_instances (
    server_code, server_name, server_type, workload, provider, region_code, region_name,
    os_type, status, health_status, cpu_cores, ram_gb, storage_gb, cpu_usage, ram_usage,
    disk_usage, network_in_mbps, network_out_mbps, uptime_percent, sla_percent,
    response_time_ms, error_rate, health_score, monthly_cost, backup_status,
    security_risk_level, os_patch_status, app_patch_status, last_health_check, owner_id
  )
  VALUES (
    v_server_code, btrim(p_server_name), 'customer-managed', 'monitoring-only',
    coalesce(nullif(btrim(p_provider), ''), 'unspecified'),
    nullif(btrim(p_region), ''), nullif(btrim(p_region), ''),
    p_os, 'pending_agent', 'unknown', NULL, NULL, NULL, NULL, NULL,
    NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'not_configured',
    'unknown', 'unknown', 'unknown', NULL, v_user_id
  )
  RETURNING id INTO v_server_id;

  INSERT INTO public.server_agents (server_id, owner_id, token_hash, enrollment_key, os)
  VALUES (v_server_id, v_user_id, p_token_hash, p_enrollment_key, p_os)
  RETURNING id INTO v_agent_id;

  INSERT INTO public.server_audit_logs (server_id, action, actor, result, risk_level, details)
  VALUES (
    v_server_id, 'agent_enrollment_created', 'customer', 'success', 'low',
    'Read-only agent enrollment created; no server credentials or commands were received.'
  );

  RETURN jsonb_build_object(
    'server_id', v_server_id,
    'agent_id', v_agent_id,
    'status', 'pending_agent'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.server_agent_enroll(text, text, text, text, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.server_agent_enroll(text, text, text, text, uuid, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.server_agent_receive_heartbeat(
  p_token_hash text,
  p_idempotency_key uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_agent public.server_agents%ROWTYPE;
  v_recorded_at timestamptz;
  v_metric_id uuid;
  v_port jsonb;
  v_subscription_suspended boolean;
  v_allowed_keys text[] := ARRAY[
    'cpu_usage', 'ram_usage', 'disk_usage', 'network_in_mbps', 'network_out_mbps',
    'uptime_seconds', 'failed_logins', 'open_ports', 'patch_status',
    'suspicious_process', 'timestamp'
  ];
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$'
     OR p_idempotency_key IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Invalid heartbeat request' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_payload) AS payload_keys(field_name)
    WHERE field_name <> ALL(v_allowed_keys)
  ) OR (SELECT count(*) FROM jsonb_object_keys(p_payload)) <> cardinality(v_allowed_keys) THEN
    RAISE EXCEPTION 'Heartbeat fields do not match the supported contract' USING ERRCODE = '22023';
  END IF;

  IF (SELECT bool_and(jsonb_typeof(p_payload -> field_name) = 'number')
      FROM unnest(ARRAY['cpu_usage', 'ram_usage', 'disk_usage', 'network_in_mbps',
        'network_out_mbps', 'uptime_seconds']) AS fields(field_name)) IS DISTINCT FROM true
     OR (p_payload -> 'failed_logins' <> 'null'::jsonb AND jsonb_typeof(p_payload -> 'failed_logins') <> 'number')
     OR (p_payload -> 'open_ports' <> 'null'::jsonb AND jsonb_typeof(p_payload -> 'open_ports') <> 'array')
     OR jsonb_typeof(p_payload -> 'patch_status') <> 'string'
     OR (p_payload -> 'suspicious_process' <> 'null'::jsonb AND jsonb_typeof(p_payload -> 'suspicious_process') <> 'boolean')
     OR jsonb_typeof(p_payload -> 'timestamp') <> 'string' THEN
    RAISE EXCEPTION 'Heartbeat fields have invalid types' USING ERRCODE = '22023';
  END IF;

  IF (p_payload ->> 'cpu_usage')::numeric NOT BETWEEN 0 AND 100
     OR (p_payload ->> 'ram_usage')::numeric NOT BETWEEN 0 AND 100
     OR (p_payload ->> 'disk_usage')::numeric NOT BETWEEN 0 AND 100
     OR (p_payload ->> 'network_in_mbps')::numeric NOT BETWEEN 0 AND 99999999.99
     OR (p_payload ->> 'network_out_mbps')::numeric NOT BETWEEN 0 AND 99999999.99
     OR (p_payload ->> 'uptime_seconds')::numeric NOT BETWEEN 0 AND 9007199254740991
     OR trunc((p_payload ->> 'uptime_seconds')::numeric) <> (p_payload ->> 'uptime_seconds')::numeric
     OR (p_payload -> 'failed_logins' <> 'null'::jsonb AND
       ((p_payload ->> 'failed_logins')::numeric NOT BETWEEN 0 AND 2147483647
        OR trunc((p_payload ->> 'failed_logins')::numeric) <> (p_payload ->> 'failed_logins')::numeric))
     OR (p_payload -> 'open_ports' <> 'null'::jsonb AND jsonb_array_length(p_payload -> 'open_ports') > 1024)
     OR p_payload ->> 'patch_status' NOT IN ('unknown', 'up_to_date', 'updates_available')
  THEN
    RAISE EXCEPTION 'Heartbeat values are outside the supported range' USING ERRCODE = '22023';
  END IF;

  FOR v_port IN SELECT value FROM jsonb_array_elements(coalesce(p_payload -> 'open_ports', '[]'::jsonb)) AS ports(value) LOOP
    IF jsonb_typeof(v_port) <> 'number'
       OR (v_port #>> '{}') !~ '^[0-9]{1,5}$'
       OR (v_port #>> '{}')::integer NOT BETWEEN 1 AND 65535 THEN
      RAISE EXCEPTION 'Heartbeat contains an invalid port' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  BEGIN
    v_recorded_at := (p_payload ->> 'timestamp')::timestamptz;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Heartbeat timestamp is invalid' USING ERRCODE = '22023';
  END;
  IF v_recorded_at < now() - interval '10 minutes' OR v_recorded_at > now() + interval '30 seconds' THEN
    RAISE EXCEPTION 'Heartbeat timestamp is outside the accepted window' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_agent
  FROM public.server_agents
  WHERE token_hash = p_token_hash AND status IN ('pending_agent', 'connected')
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('accepted', false);
  END IF;
  EXECUTE
    'SELECT EXISTS (
       SELECT 1 FROM public.server_subscriptions
       WHERE server_id = $1 AND status IN (''suspended'', ''cancelled'')
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.server_subscriptions
       WHERE server_id = $1 AND status IN (''active'', ''expiring'')
     )'
    INTO v_subscription_suspended
    USING v_agent.server_id;
  IF v_subscription_suspended THEN
    RETURN jsonb_build_object('accepted', false, 'suspended', true);
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.server_metrics_history
    WHERE agent_id = v_agent.id AND idempotency_key = p_idempotency_key
  ) THEN
    RETURN jsonb_build_object('accepted', true, 'duplicate', true);
  END IF;
  IF v_agent.last_seen IS NOT NULL AND v_agent.last_seen > now() - interval '5 seconds' THEN
    RETURN jsonb_build_object('accepted', false, 'rate_limited', true);
  END IF;

  INSERT INTO public.server_metrics_history (
    server_id, agent_id, idempotency_key, cpu_usage, ram_usage, disk_usage,
    network_in_mbps, network_out_mbps, recorded_at, failed_logins, open_ports,
    patch_status, suspicious_process, uptime_seconds
  )
  VALUES (
    v_agent.server_id, v_agent.id, p_idempotency_key,
    (p_payload ->> 'cpu_usage')::numeric, (p_payload ->> 'ram_usage')::numeric,
    (p_payload ->> 'disk_usage')::numeric, (p_payload ->> 'network_in_mbps')::numeric,
    (p_payload ->> 'network_out_mbps')::numeric, v_recorded_at,
    (p_payload ->> 'failed_logins')::integer,
    CASE WHEN p_payload -> 'open_ports' = 'null'::jsonb THEN NULL ELSE
      ARRAY(SELECT (value #>> '{}')::integer FROM jsonb_array_elements(p_payload -> 'open_ports') AS ports(value)) END,
    p_payload ->> 'patch_status', (p_payload ->> 'suspicious_process')::boolean,
    (p_payload ->> 'uptime_seconds')::bigint
  )
  ON CONFLICT (agent_id, idempotency_key) WHERE agent_id IS NOT NULL AND idempotency_key IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_metric_id;

  IF v_metric_id IS NULL THEN
    RETURN jsonb_build_object('accepted', true, 'duplicate', true);
  END IF;

  UPDATE public.server_agents
  SET status = 'connected', last_seen = now()
  WHERE id = v_agent.id;

  UPDATE public.server_instances
  SET status = 'connected', health_status = 'unknown',
      cpu_usage = (p_payload ->> 'cpu_usage')::numeric,
      ram_usage = (p_payload ->> 'ram_usage')::numeric,
      disk_usage = (p_payload ->> 'disk_usage')::numeric,
      network_in_mbps = (p_payload ->> 'network_in_mbps')::numeric,
      network_out_mbps = (p_payload ->> 'network_out_mbps')::numeric
  WHERE id = v_agent.server_id;

  RETURN jsonb_build_object(
    'accepted', true,
    'duplicate', false,
    'agent_id', v_agent.id,
    'recorded_at', v_recorded_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.server_agent_receive_heartbeat(text, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.server_agent_receive_heartbeat(text, uuid, jsonb)
  TO service_role;
