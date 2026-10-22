CREATE TABLE IF NOT EXISTS public.server_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  server_id uuid NOT NULL REFERENCES public.server_instances(id) ON DELETE RESTRICT,
  plan text NOT NULL CHECK (length(btrim(plan)) BETWEEN 1 AND 100),
  amount_minor bigint NOT NULL CHECK (amount_minor BETWEEN 1 AND 9007199254740991),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expiring', 'suspended', 'cancelled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  grace_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > started_at),
  CHECK (grace_until >= expires_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS server_subscriptions_one_open_per_server
  ON public.server_subscriptions (server_id)
  WHERE status IN ('active', 'expiring', 'suspended');
CREATE INDEX IF NOT EXISTS server_subscriptions_lifecycle_idx
  ON public.server_subscriptions (status, expires_at, grace_until);

ALTER TABLE public.server_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS server_subscriptions_anon_denied ON public.server_subscriptions;
CREATE POLICY server_subscriptions_anon_denied
  ON public.server_subscriptions AS RESTRICTIVE FOR ALL TO anon
  USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS server_subscriptions_owner_read ON public.server_subscriptions;
CREATE POLICY server_subscriptions_owner_read
  ON public.server_subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.server_is_operator());
REVOKE ALL ON public.server_subscriptions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.server_subscriptions TO authenticated;
GRANT ALL ON public.server_subscriptions TO service_role;

CREATE TABLE IF NOT EXISTS public.server_subscription_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.server_subscriptions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  event_key text NOT NULL CHECK (event_key IN ('expiry_7d', 'expiry_3d', 'expiry_1d', 'suspended', 'cancelled')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'queued', 'sent', 'failed', 'skipped')),
  email_outbox_id uuid REFERENCES public.email_outbox(id) ON DELETE SET NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  claimed_until timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, event_key)
);

CREATE INDEX IF NOT EXISTS server_subscription_notifications_due_idx
  ON public.server_subscription_notifications (status, next_attempt_at, created_at);
ALTER TABLE public.server_subscription_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS server_subscription_notifications_anon_denied ON public.server_subscription_notifications;
CREATE POLICY server_subscription_notifications_anon_denied
  ON public.server_subscription_notifications AS RESTRICTIVE FOR ALL TO anon
  USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS server_subscription_notifications_owner_read ON public.server_subscription_notifications;
CREATE POLICY server_subscription_notifications_owner_read
  ON public.server_subscription_notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.server_is_operator());
REVOKE ALL ON public.server_subscription_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.server_subscription_notifications TO authenticated;
GRANT ALL ON public.server_subscription_notifications TO service_role;

ALTER TABLE public.server_invoices
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES public.server_subscriptions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS amount_minor bigint,
  ADD COLUMN IF NOT EXISTS pdf_storage_path text,
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'server_invoices'
      AND column_name = 'amount'
      AND (numeric_precision < 20 OR numeric_scale < 4)
  ) THEN
    ALTER TABLE public.server_invoices
      ALTER COLUMN amount TYPE numeric(20, 4)
      USING amount::numeric(20, 4);
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS server_invoices_subscription_period_unique
  ON public.server_invoices (subscription_id, period_start, period_end)
  WHERE subscription_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS server_invoices_owner_idempotency_unique
  ON public.server_invoices (owner_id, idempotency_key)
  WHERE owner_id IS NOT NULL AND idempotency_key IS NOT NULL;

ALTER TABLE public.server_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS server_invoices_read ON public.server_invoices;
DROP POLICY IF EXISTS server_invoices_write ON public.server_invoices;
DROP POLICY IF EXISTS server_invoices_owner_read ON public.server_invoices;
CREATE POLICY server_invoices_owner_read
  ON public.server_invoices FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.server_is_operator());
REVOKE ALL ON public.server_invoices FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.server_invoices TO authenticated;
GRANT ALL ON public.server_invoices TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('server-invoices', 'server-invoices', false, 5242880, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['application/pdf'];

CREATE OR REPLACE FUNCTION public.server_sweep_subscription_lifecycle()
RETURNS TABLE (
  notification_id uuid,
  subscription_id uuid,
  user_id uuid,
  email text,
  event_key text,
  plan text,
  currency text,
  amount_minor bigint,
  expires_at timestamptz,
  server_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  WITH changed AS (
    UPDATE public.server_subscriptions AS subscription
    SET status = CASE
          WHEN subscription.status IN ('active', 'expiring')
            AND subscription.expires_at <= now() THEN 'suspended'
          WHEN subscription.status IN ('active', 'expiring')
            AND subscription.expires_at <= now() + interval '7 days' THEN 'expiring'
          WHEN subscription.status = 'suspended'
            AND subscription.grace_until <= now() THEN 'cancelled'
          ELSE subscription.status
        END,
        updated_at = now()
    WHERE (
      (subscription.status IN ('active', 'expiring') AND subscription.expires_at <= now() + interval '7 days')
      OR (subscription.status = 'suspended' AND subscription.grace_until <= now())
    )
      AND subscription.status IS DISTINCT FROM CASE
        WHEN subscription.status IN ('active', 'expiring')
          AND subscription.expires_at <= now() THEN 'suspended'
        WHEN subscription.status IN ('active', 'expiring')
          AND subscription.expires_at <= now() + interval '7 days' THEN 'expiring'
        WHEN subscription.status = 'suspended'
          AND subscription.grace_until <= now() THEN 'cancelled'
        ELSE subscription.status
      END
    RETURNING subscription.id, subscription.user_id, subscription.server_id, subscription.status
  ),
  notifications AS (
    INSERT INTO public.server_subscription_notifications (subscription_id, user_id, event_key)
    SELECT changed.id, changed.user_id, changed.status
    FROM changed
    WHERE changed.status IN ('suspended', 'cancelled')
    ON CONFLICT (subscription_id, event_key) DO NOTHING
    RETURNING id
  )
  INSERT INTO public.server_audit_logs (server_id, action, actor, result, risk_level, details)
  SELECT
    changed.server_id,
    'subscription_status_changed',
    'system',
    'success',
    'medium',
    format('Subscription %s transitioned to %s', changed.id, changed.status)
  FROM changed;

  UPDATE public.server_instances AS server
  SET health_status = 'unknown',
      updated_at = now()
  FROM public.server_subscriptions AS subscription
  WHERE server.id = subscription.server_id
    AND subscription.status IN ('suspended', 'cancelled')
    AND server.health_status IS DISTINCT FROM 'unknown';

  UPDATE public.server_subscription_notifications AS notification
  SET status = 'failed',
      last_error = 'Notification retry limit reached',
      claimed_until = NULL,
      updated_at = now()
  WHERE notification.attempts >= 8
    AND (
      (notification.status = 'pending' AND notification.next_attempt_at <= now())
      OR (notification.status = 'processing' AND notification.claimed_until < now())
    );

  INSERT INTO public.server_subscription_notifications (subscription_id, user_id, event_key)
  SELECT subscription.id, subscription.user_id, reminder.event_key
  FROM public.server_subscriptions AS subscription
  CROSS JOIN (VALUES
    ('expiry_7d'::text, interval '7 days', interval '3 days'),
    ('expiry_3d'::text, interval '3 days', interval '1 day'),
    ('expiry_1d'::text, interval '1 day', interval '0 days')
  ) AS reminder(event_key, upper_window, lower_window)
  WHERE subscription.status IN ('active', 'expiring')
    AND subscription.expires_at <= now() + reminder.upper_window
    AND subscription.expires_at > now() + reminder.lower_window
  ON CONFLICT (subscription_id, event_key) DO NOTHING;

  RETURN QUERY
  WITH due AS (
    SELECT notification.id
    FROM public.server_subscription_notifications AS notification
    WHERE notification.attempts < 8
      AND (
        (notification.status = 'pending' AND notification.next_attempt_at <= now())
        OR (notification.status = 'processing' AND notification.claimed_until < now())
      )
    ORDER BY notification.created_at, notification.id
    FOR UPDATE SKIP LOCKED
    LIMIT 100
  ),
  claimed AS (
    UPDATE public.server_subscription_notifications AS notification
    SET status = 'processing',
        attempts = notification.attempts + 1,
        claimed_until = now() + interval '2 minutes',
        updated_at = now()
    FROM due
    WHERE notification.id = due.id
    RETURNING notification.id, notification.subscription_id, notification.user_id,
      notification.event_key, notification.attempts
  )
  SELECT
    claimed.id,
    subscription.id,
    claimed.user_id,
    CASE WHEN auth_user.email_confirmed_at IS NOT NULL THEN auth_user.email ELSE NULL END,
    claimed.event_key,
    subscription.plan,
    subscription.currency,
    subscription.amount_minor,
    subscription.expires_at,
    server.server_name
  FROM claimed
  JOIN public.server_subscriptions AS subscription ON subscription.id = claimed.subscription_id
  JOIN public.server_instances AS server ON server.id = subscription.server_id
  LEFT JOIN auth.users AS auth_user ON auth_user.id = claimed.user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.server_currency_minor_digits(p_currency text)
RETURNS smallint
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_currency = ANY (ARRAY[
      'BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW',
      'PYG', 'RWF', 'UGX', 'UYI', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'
    ]) THEN 0
    WHEN p_currency = ANY (ARRAY['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND']) THEN 3
    WHEN p_currency = ANY (ARRAY['CLF', 'UYW']) THEN 4
    ELSE 2
  END::smallint
$$;

REVOKE ALL ON FUNCTION public.server_currency_minor_digits(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.server_create_invoice(
  p_owner_id uuid,
  p_subscription_id uuid,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_subscription public.server_subscriptions%ROWTYPE;
  v_invoice public.server_invoices%ROWTYPE;
  v_created boolean := false;
  v_period_start date := date_trunc('month', now() AT TIME ZONE 'UTC')::date;
  v_period_end date := (date_trunc('month', now() AT TIME ZONE 'UTC') + interval '1 month' - interval '1 day')::date;
  v_invoice_id uuid := gen_random_uuid();
BEGIN
  IF p_owner_id IS NULL OR p_subscription_id IS NULL OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Invoice owner, subscription and idempotency key are required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_subscription
  FROM public.server_subscriptions
  WHERE id = p_subscription_id AND user_id = p_owner_id
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_subscription.status NOT IN ('active', 'expiring') THEN
    RAISE EXCEPTION 'Invoice is unavailable for this subscription status' USING ERRCODE = '22023';
  END IF;
  IF v_subscription.started_at::date > v_period_end
     OR v_subscription.expires_at::date < v_period_start THEN
    RAISE EXCEPTION 'Subscription does not cover the current invoice period' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_invoice
  FROM public.server_invoices
  WHERE owner_id = p_owner_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_invoice.subscription_id IS DISTINCT FROM p_subscription_id THEN
      RAISE EXCEPTION 'Idempotency key was already used for a different subscription' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object(
      'id', v_invoice.id,
      'invoice_code', v_invoice.invoice_code,
      'period_label', v_invoice.period_label,
      'period_start', v_invoice.period_start,
      'period_end', v_invoice.period_end,
      'amount_minor', v_invoice.amount_minor,
      'currency', v_invoice.currency,
      'status', v_invoice.status,
      'server_name', (SELECT server_name FROM public.server_instances WHERE id = v_subscription.server_id),
      'plan', v_subscription.plan,
      'pdf_storage_path', v_invoice.pdf_storage_path
    );
  END IF;

  SELECT * INTO v_invoice
  FROM public.server_invoices
  WHERE subscription_id = v_subscription.id
    AND period_start = v_period_start
    AND period_end = v_period_end;

  IF NOT FOUND THEN
    INSERT INTO public.server_invoices (
      id, invoice_code, period_label, period_start, period_end, amount, currency,
      status, issued_at, owner_id, subscription_id, amount_minor, idempotency_key
    )
    VALUES (
      v_invoice_id,
      'SV-' || to_char(v_period_start, 'YYYYMM') || '-' || upper(substr(replace(v_invoice_id::text, '-', ''), 1, 8)),
      to_char(v_period_start, 'Mon YYYY'),
      v_period_start,
      v_period_end,
      (
        v_subscription.amount_minor::numeric
        / power(10::numeric, public.server_currency_minor_digits(v_subscription.currency))
      )::numeric(20, 4),
      v_subscription.currency,
      'issued',
      (now() AT TIME ZONE 'UTC')::date,
      p_owner_id,
      v_subscription.id,
      v_subscription.amount_minor,
      p_idempotency_key
    )
    ON CONFLICT (subscription_id, period_start, period_end)
      WHERE subscription_id IS NOT NULL
    DO NOTHING
    RETURNING * INTO v_invoice;

    v_created := FOUND;
    IF NOT v_created THEN
      SELECT * INTO v_invoice
      FROM public.server_invoices
      WHERE subscription_id = v_subscription.id
        AND period_start = v_period_start
        AND period_end = v_period_end;
    END IF;
  END IF;

  IF v_invoice.owner_id IS DISTINCT FROM p_owner_id THEN
    RAISE EXCEPTION 'Invoice owner mismatch' USING ERRCODE = '42501';
  END IF;

  IF v_created THEN
    INSERT INTO public.server_audit_logs (server_id, action, actor, result, risk_level, details)
    VALUES (
      v_subscription.server_id,
      'invoice_issued',
      'customer',
      'success',
      'low',
      format('Issued invoice %s for %s minor units %s', v_invoice.invoice_code, v_invoice.amount_minor, v_invoice.currency)
    );
  END IF;

  RETURN jsonb_build_object(
    'id', v_invoice.id,
    'invoice_code', v_invoice.invoice_code,
    'period_label', v_invoice.period_label,
    'period_start', v_invoice.period_start,
    'period_end', v_invoice.period_end,
    'amount_minor', v_invoice.amount_minor,
    'currency', v_invoice.currency,
    'status', v_invoice.status,
    'server_name', (SELECT server_name FROM public.server_instances WHERE id = v_subscription.server_id),
    'plan', v_subscription.plan,
    'pdf_storage_path', v_invoice.pdf_storage_path
  );
END;
$$;

REVOKE ALL ON FUNCTION public.server_sweep_subscription_lifecycle() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.server_sweep_subscription_lifecycle() TO service_role;
REVOKE ALL ON FUNCTION public.server_create_invoice(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.server_create_invoice(uuid, uuid, uuid) TO service_role;
