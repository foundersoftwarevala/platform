-- Durable alert delivery state. Email is handed to the existing email_outbox;
-- webhooks use one operator-configured HTTPS endpoint, never a tenant URL.
ALTER TABLE public.email_outbox
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

CREATE UNIQUE INDEX IF NOT EXISTS email_outbox_idempotency_key_unique
  ON public.email_outbox (idempotency_key);

CREATE TABLE IF NOT EXISTS public.server_alert_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.server_alerts(id) ON DELETE CASCADE,
  owner_id uuid,
  channel text NOT NULL CHECK (channel IN ('email', 'webhook')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'queued', 'sent', 'failed', 'skipped')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  email_outbox_id uuid REFERENCES public.email_outbox(id) ON DELETE SET NULL,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  claimed_until timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alert_id, channel)
);

CREATE INDEX IF NOT EXISTS server_alert_deliveries_due_idx
  ON public.server_alert_deliveries (status, next_attempt_at, created_at);

ALTER TABLE public.server_alert_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS server_alert_deliveries_anon_denied ON public.server_alert_deliveries;
CREATE POLICY server_alert_deliveries_anon_denied
  ON public.server_alert_deliveries AS RESTRICTIVE FOR ALL TO anon
  USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS server_alert_deliveries_owner_read ON public.server_alert_deliveries;
CREATE POLICY server_alert_deliveries_owner_read
  ON public.server_alert_deliveries FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.server_is_operator());
REVOKE ALL ON public.server_alert_deliveries FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.server_alert_deliveries TO authenticated;
GRANT ALL ON public.server_alert_deliveries TO service_role;

CREATE OR REPLACE FUNCTION public.server_queue_alert_deliveries()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  IF coalesce(auth.role(), '') NOT IN ('service_role', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.server_id IS NOT NULL THEN
    SELECT owner_id INTO v_owner_id
    FROM public.server_instances
    WHERE id = NEW.server_id;
  END IF;

  INSERT INTO public.server_alert_deliveries (alert_id, owner_id, channel)
  VALUES (NEW.id, v_owner_id, 'email'), (NEW.id, v_owner_id, 'webhook')
  ON CONFLICT (alert_id, channel) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS server_alert_queue_delivery ON public.server_alerts;
CREATE TRIGGER server_alert_queue_delivery
  AFTER INSERT ON public.server_alerts
  FOR EACH ROW EXECUTE FUNCTION public.server_queue_alert_deliveries();

CREATE OR REPLACE FUNCTION public.server_claim_alert_deliveries(p_limit integer DEFAULT 25)
RETURNS TABLE (
  delivery_id uuid,
  alert_id uuid,
  owner_id uuid,
  channel text,
  attempt integer,
  recipient_email text,
  alert_type text,
  severity text,
  message text,
  created_at timestamptz,
  server_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Delivery batch must be from 1 to 100' USING ERRCODE = '22023';
  END IF;

  UPDATE public.server_alert_deliveries AS delivery
  SET status = 'failed',
      last_error = 'Delivery retry limit reached',
      updated_at = now()
  WHERE delivery.attempts >= 8
    AND (
      (delivery.status = 'pending' AND delivery.next_attempt_at <= now())
      OR (delivery.status = 'processing' AND delivery.claimed_until < now())
    );

  RETURN QUERY
  WITH due AS (
    SELECT delivery.id
    FROM public.server_alert_deliveries AS delivery
    WHERE delivery.attempts < 8
      AND (
        (delivery.status = 'pending' AND delivery.next_attempt_at <= now())
        OR (delivery.status = 'processing' AND delivery.claimed_until < now())
      )
    ORDER BY delivery.created_at, delivery.id
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  ),
  claimed AS (
    UPDATE public.server_alert_deliveries AS delivery
    SET status = 'processing',
        attempts = delivery.attempts + 1,
        claimed_until = now() + interval '2 minutes',
        updated_at = now()
    FROM due
    WHERE delivery.id = due.id
    RETURNING delivery.id, delivery.alert_id, delivery.owner_id,
      delivery.channel, delivery.attempts
  )
  SELECT
    claimed.id,
    alert.id,
    claimed.owner_id,
    claimed.channel,
    claimed.attempts,
    CASE WHEN auth_user.email_confirmed_at IS NOT NULL THEN auth_user.email ELSE NULL END,
    alert.alert_type,
    alert.severity,
    alert.message,
    alert.created_at,
    server.server_name
  FROM claimed
  JOIN public.server_alerts AS alert ON alert.id = claimed.alert_id
  LEFT JOIN public.server_instances AS server ON server.id = alert.server_id
  LEFT JOIN auth.users AS auth_user ON auth_user.id = claimed.owner_id;
END;
$$;

REVOKE ALL ON FUNCTION public.server_queue_alert_deliveries() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.server_claim_alert_deliveries(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.server_claim_alert_deliveries(integer) TO service_role;
