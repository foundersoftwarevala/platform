-- Atomicity, concurrency and reliability for the payment domain.
--
-- What existed before this file settled a payment as a sequence of separate
-- REST writes: claim the intent, insert the payment, update the order, post the
-- ledger, close the intent. Each write was individually idempotent, which is
-- why a replay was harmless — but the sequence as a whole was not atomic. A
-- process that died between the order update and the ledger post left money
-- taken, access granted, and nothing in the books.
--
-- Nothing new is invented here. The tables are the ones the platform already
-- has: finance_payment_intents, finance_payments, finance_payment_events,
-- finance_provider_transactions, finance_reconciliation_records,
-- finance_ledger_entries, finance_transactions and marketplace_orders. What is
-- added is:
--
--   1. delivery state on finance_payment_events, so the table this platform
--      already uses as its payment event log becomes the transactional outbox
--      as well — rather than a second queue being created beside it;
--   2. a state machine on the intent, so an illegal transition fails in the
--      database instead of depending on which code path happened to run;
--   3. one canonical settlement function that does every database-local write
--      of a settlement inside a single transaction, with the order and the
--      intent rows locked;
--   4. a queue claim that uses FOR UPDATE SKIP LOCKED, so two workers cannot
--      take the same event;
--   5. a rate-limit counter that is atomic in the database rather than per
--      process;
--   6. composite indexes for the queries the payment path actually runs.
--
-- No table is dropped. No column is renamed. No row is deleted. Every statement
-- is idempotent so the file can be re-applied safely.

-- ---------------------------------------------------------------------------
-- 1. The transactional outbox
-- ---------------------------------------------------------------------------
--
-- finance_payment_events already records every payment event with a unique
-- event_key. Giving it delivery state turns it into the outbox: the event is
-- written in the same transaction as the payment, and a consumer picks it up
-- afterwards. That is what makes "payment settled" and "entitlement activated"
-- impossible to lose — the event is committed with the money or not at all.

ALTER TABLE public.finance_payment_events
  ADD COLUMN IF NOT EXISTS status         text        NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS attempts       integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS available_at   timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS processed_at   timestamptz,
  ADD COLUMN IF NOT EXISTS last_error     text,
  ADD COLUMN IF NOT EXISTS correlation_id text,
  ADD COLUMN IF NOT EXISTS order_id       uuid REFERENCES public.marketplace_orders(id) ON DELETE SET NULL;

ALTER TABLE public.finance_payment_events
  DROP CONSTRAINT IF EXISTS finance_payment_events_status_check;
ALTER TABLE public.finance_payment_events
  ADD CONSTRAINT finance_payment_events_status_check
  CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'dead'));

-- The consumer's only query: what is due now, oldest first.
CREATE INDEX IF NOT EXISTS finance_payment_events_due_idx
  ON public.finance_payment_events (available_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS finance_payment_events_order_idx
  ON public.finance_payment_events (order_id);

-- A reconciliation exception does not always have a provider transaction to
-- hang off. "The provider called back about a reference we do not hold" and
-- "this order is paid but nothing was posted to the ledger" are both exceptions
-- with nothing on the provider's side to point at, and while this column was
-- NOT NULL neither of them could be written down at all — so the mismatch that
-- most needed recording was the one that silently vanished.
ALTER TABLE public.finance_reconciliation_records
  ALTER COLUMN provider_transaction_id DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. The intent state machine
-- ---------------------------------------------------------------------------
--
-- A payment intent may only move along a legal edge. Enforced by a trigger, so
-- it holds for every writer — the settlement function, a recovery sweep, an
-- operator with a REST client — rather than only for the code that remembers to
-- check. An illegal move raises, which rolls back whatever tried it.

CREATE OR REPLACE FUNCTION public.finance_payment_intent_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  legal text[];
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  legal := CASE OLD.status
    -- Offered, not yet taken.
    WHEN 'pending'            THEN ARRAY['processing','requires_action','requires_review','failed','expired','cancelled']
    -- Waiting on the customer: 3-D Secure, a bank app, an OTP.
    WHEN 'requires_action'    THEN ARRAY['pending','processing','requires_review','failed','expired','cancelled']
    -- Claimed by exactly one settler.
    WHEN 'processing'         THEN ARRAY['succeeded','failed','requires_review','requires_action','pending']
    -- A person has to look at it. It can still go either way.
    WHEN 'requires_review'    THEN ARRAY['succeeded','failed','processing','refunded','partially_refunded','cancelled']
    -- Money taken. From here it can only be given back.
    WHEN 'succeeded'          THEN ARRAY['refunded','partially_refunded','requires_review']
    -- A failure is not final: the customer may try the same intent again.
    WHEN 'failed'             THEN ARRAY['pending','processing','cancelled','expired','requires_review']
    -- Ran out of time. Reviewable, because a late payment still settles.
    WHEN 'expired'            THEN ARRAY['requires_review','succeeded','pending']
    WHEN 'partially_refunded' THEN ARRAY['refunded','requires_review']
    -- Terminal.
    WHEN 'refunded'           THEN ARRAY['requires_review']
    WHEN 'cancelled'          THEN ARRAY['requires_review']
    ELSE NULL
  END;

  -- An unrecognised current status is not silently trusted, but neither is it a
  -- reason to strand a live payment: it is allowed through and left visible.
  IF legal IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT (NEW.status = ANY (legal)) THEN
    RAISE EXCEPTION
      'illegal payment intent transition % -> % (intent %)',
      OLD.status, NEW.status, OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS finance_payment_intent_transition_guard ON public.finance_payment_intents;
CREATE TRIGGER finance_payment_intent_transition_guard
  BEFORE UPDATE OF status ON public.finance_payment_intents
  FOR EACH ROW EXECUTE FUNCTION public.finance_payment_intent_transition();

-- A paid order may never quietly go back to unpaid. Every other order
-- transition on this table is left exactly as it was.
CREATE OR REPLACE FUNCTION public.marketplace_order_payment_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'paid'
     AND NEW.status IN ('pending_payment','pending','payment_failed','payment_expired') THEN
    RAISE EXCEPTION
      'a paid order cannot return to % (order %)', NEW.status, OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketplace_order_payment_status_guard ON public.marketplace_orders;
CREATE TRIGGER marketplace_order_payment_status_guard
  BEFORE UPDATE OF status ON public.marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_order_payment_guard();

-- ---------------------------------------------------------------------------
-- 3. Settlement, in one transaction
-- ---------------------------------------------------------------------------
--
-- Everything a settlement writes to this database, written together or not at
-- all. The provider has already been asked and has already answered before this
-- is called: no gateway, mail provider or external service is contacted from
-- inside it, so a transaction is never held open across a network call.
--
-- What it deliberately leaves outside: issuing the licence, granting the
-- entitlement and telling the customer. Those are committed here as an outbox
-- event and performed after the commit, because a payment must never be undone
-- by a failure to send an email.

CREATE OR REPLACE FUNCTION public.finance_settle_payment(
  p_reference           text,
  p_provider            text,
  p_provider_payment_id text    DEFAULT NULL,
  p_provider_status     text    DEFAULT NULL,
  p_observed_amount     numeric DEFAULT NULL,
  p_observed_currency   text    DEFAULT NULL,
  p_last4               text    DEFAULT NULL,
  p_brand               text    DEFAULT NULL,
  p_event_key           text    DEFAULT NULL,
  p_correlation_id      text    DEFAULT NULL,
  p_buyer_name          text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order           public.marketplace_orders%ROWTYPE;
  v_intent          public.finance_payment_intents%ROWTYPE;
  v_rail_id         uuid;
  v_payment_id      uuid;
  v_invoice_id      uuid;
  v_invoice_no      text;
  v_provider_txn_id uuid;
  v_charged         numeric;
  v_currency        text;
  v_base_amount     numeric;
  v_base_currency   text;
  v_fx_rate         numeric;
  v_now             timestamptz := now();
  v_name            text;
BEGIN
  IF p_reference IS NULL OR p_reference = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'No payment reference', 'status', 400);
  END IF;

  -- ---- the order, locked -------------------------------------------------
  SELECT * INTO v_order
    FROM public.marketplace_orders
   WHERE txnid = p_reference
   LIMIT 1
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Unknown transaction', 'status', 404);
  END IF;

  v_charged       := COALESCE(v_order.amount_charged, v_order.amount_inr, v_order.total, 0);
  v_currency      := upper(COALESCE(v_order.currency_charged, v_order.currency, 'USD'));
  v_base_amount   := COALESCE(v_order.amount_usd, v_order.total, 0);
  v_base_currency := upper(COALESCE(v_order.currency, 'USD'));
  v_fx_rate       := COALESCE(NULLIF(v_order.fx_rate, 0), 1);
  v_name          := COALESCE(NULLIF(btrim(p_buyer_name), ''), v_order.order_number);

  -- Already settled. Say so; do none of it twice.
  IF v_order.status = 'paid' THEN
    RETURN jsonb_build_object(
      'ok', true, 'replay', true, 'order_id', v_order.id, 'payment_id', NULL);
  END IF;

  SELECT id INTO v_rail_id FROM public.finance_payment_rails WHERE code = p_provider LIMIT 1;

  -- ---- what the provider reported, as its own transaction ----------------
  IF p_provider_payment_id IS NOT NULL AND p_provider_payment_id <> '' THEN
    INSERT INTO public.finance_provider_transactions
      (rail_id, provider_transaction_id, reference, amount, currency, network, status, observed_at)
    VALUES
      (v_rail_id, p_provider_payment_id, p_reference,
       COALESCE(p_observed_amount, v_charged), COALESCE(upper(p_observed_currency), v_currency),
       p_provider, 'settled', v_now)
    ON CONFLICT (rail_id, provider_transaction_id) DO UPDATE
      SET reference = EXCLUDED.reference, observed_at = EXCLUDED.observed_at
    RETURNING id INTO v_provider_txn_id;
  END IF;

  -- ---- the amount and the currency, against the order --------------------
  IF p_observed_currency IS NOT NULL AND upper(p_observed_currency) <> v_currency THEN
    UPDATE public.finance_payment_intents
       SET status = 'requires_review'
     WHERE client_reference = p_reference
       AND status NOT IN ('succeeded','refunded','partially_refunded','requires_review');
    INSERT INTO public.finance_reconciliation_records
      (provider_transaction_id, order_id, rail_code, reference, matching_status,
       expected_amount, observed_amount, expected_currency, observed_currency, detail)
    VALUES
      (v_provider_txn_id, v_order.id, p_provider, p_reference, 'currency_mismatch',
       v_charged, p_observed_amount, v_currency, upper(p_observed_currency),
       'The provider settled in a different currency than the order was priced in.')
    ON CONFLICT (provider_transaction_id) DO UPDATE
      SET matching_status = EXCLUDED.matching_status, detail = EXCLUDED.detail;
    RETURN jsonb_build_object('ok', false, 'reason', 'Currency mismatch', 'status', 409);
  END IF;

  IF p_observed_amount IS NOT NULL AND v_charged > 0
     AND abs(p_observed_amount - v_charged) > 0.01 THEN
    UPDATE public.finance_payment_intents
       SET status = 'requires_review'
     WHERE client_reference = p_reference
       AND status NOT IN ('succeeded','refunded','partially_refunded','requires_review');
    INSERT INTO public.finance_reconciliation_records
      (provider_transaction_id, order_id, rail_code, reference, matching_status,
       expected_amount, observed_amount, expected_currency, observed_currency, detail)
    VALUES
      (v_provider_txn_id, v_order.id, p_provider, p_reference, 'amount_mismatch',
       v_charged, p_observed_amount, v_currency, COALESCE(upper(p_observed_currency), v_currency),
       'The provider settled a different amount than the order was for.')
    ON CONFLICT (provider_transaction_id) DO UPDATE
      SET matching_status = EXCLUDED.matching_status, detail = EXCLUDED.detail;
    RETURN jsonb_build_object('ok', false, 'reason', 'Amount mismatch', 'status', 409);
  END IF;

  -- ---- the invoice, issued once ------------------------------------------
  v_invoice_no := 'INV-' || v_order.order_number;
  SELECT id INTO v_invoice_id
    FROM public.finance_invoices WHERE invoice_no = v_invoice_no LIMIT 1;
  IF v_invoice_id IS NULL THEN
    INSERT INTO public.finance_invoices
      (invoice_no, doc_type, client_name, client_type, issue_date, due_date,
       subtotal, tax_amount, total, status, paid_at, auto_generated, line_items)
    VALUES
      (v_invoice_no, 'invoice', v_name, 'customer', v_now::date, v_now::date,
       v_charged, 0, v_charged, 'paid', v_now, true,
       jsonb_build_array(jsonb_build_object(
         'description', 'Order ' || v_order.order_number, 'qty', 1, 'rate', v_charged)))
    RETURNING id INTO v_invoice_id;
  END IF;

  -- ---- the intent, created if missing, then claimed ----------------------
  --
  -- An order started before the canonical intent existed has none, and so does
  -- one whose intent write lost a race. Settlement creates it rather than
  -- refusing money the provider has already taken.
  SELECT * INTO v_intent
    FROM public.finance_payment_intents
   WHERE client_reference = p_reference
   LIMIT 1
     FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.finance_payment_intents
      (invoice_id, rail_id, idempotency_key, client_reference, amount, currency,
       status, expires_at, order_id, user_id, gateway_code,
       base_amount, base_currency, fx_rate)
    VALUES
      (v_invoice_id, v_rail_id, p_reference, p_reference, v_charged, v_currency,
       'pending', COALESCE(v_order.intent_expires_at, v_now), v_order.id,
       COALESCE(v_order.user_id, v_order.buyer_id), p_provider,
       v_base_amount, v_base_currency, v_fx_rate)
    ON CONFLICT (client_reference) DO NOTHING;

    SELECT * INTO v_intent
      FROM public.finance_payment_intents
     WHERE client_reference = p_reference
     LIMIT 1
       FOR UPDATE;
  END IF;

  IF v_intent.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'No payment intent', 'status', 409);
  END IF;

  IF v_intent.status = 'succeeded' THEN
    RETURN jsonb_build_object(
      'ok', true, 'replay', true, 'order_id', v_order.id, 'payment_id', NULL);
  END IF;

  -- Both rows are held under this transaction's locks, which is the whole of
  -- the concurrency control: whichever transaction holds them is the one that
  -- settles, and every other one waits and then finds the work already done.
  IF v_intent.status NOT IN ('pending','requires_action','processing') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', format('That payment intent is %s and cannot be settled.', v_intent.status),
      'status', 409);
  END IF;

  -- The intent's own amount is checked too: the order could in principle have
  -- been re-priced after the customer was quoted.
  IF abs(COALESCE(v_intent.amount, 0) - v_charged) > 0.01 THEN
    UPDATE public.finance_payment_intents SET status = 'requires_review' WHERE id = v_intent.id;
    INSERT INTO public.finance_reconciliation_records
      (provider_transaction_id, order_id, rail_code, reference, matching_status,
       expected_amount, observed_amount, expected_currency, observed_currency, detail)
    VALUES
      (v_provider_txn_id, v_order.id, p_provider, p_reference, 'amount_mismatch',
       v_intent.amount, v_charged, v_intent.currency, v_currency,
       'The order amount no longer matches the intent the customer was quoted.')
    ON CONFLICT (provider_transaction_id) DO UPDATE
      SET matching_status = EXCLUDED.matching_status, detail = EXCLUDED.detail;
    RETURN jsonb_build_object('ok', false, 'reason', 'Intent amount mismatch', 'status', 409);
  END IF;

  IF v_intent.status <> 'processing' THEN
    UPDATE public.finance_payment_intents SET status = 'processing' WHERE id = v_intent.id;
  END IF;

  -- ---- the payment -------------------------------------------------------
  INSERT INTO public.finance_payments
    (intent_id, invoice_id, rail_id, amount, currency, status,
     provider_transaction_id, provider_reference, confirmed_at)
  VALUES
    (v_intent.id, v_invoice_id, COALESCE(v_rail_id, v_intent.rail_id), v_charged, v_currency,
     'succeeded', p_provider_payment_id, p_reference, v_now)
  ON CONFLICT (intent_id) DO UPDATE SET status = 'succeeded', confirmed_at = v_now
  RETURNING id INTO v_payment_id;

  IF v_payment_id IS NULL THEN
    SELECT id INTO v_payment_id
      FROM public.finance_payments WHERE intent_id = v_intent.id LIMIT 1;
  END IF;

  -- ---- the order ---------------------------------------------------------
  UPDATE public.marketplace_orders
     SET status              = 'paid',
         payment_gateway     = p_provider,
         provider_payment_id = COALESCE(p_provider_payment_id, provider_payment_id),
         provider_status     = COALESCE(p_provider_status, provider_status),
         payment_verified_at = v_now,
         amount_charged      = COALESCE(amount_charged, v_charged),
         card_last4          = COALESCE(NULLIF(right(p_last4, 4), ''), card_last4),
         card_brand          = COALESCE(NULLIF(left(p_brand, 40), ''), card_brand),
         updated_at          = v_now
   WHERE id = v_order.id;

  -- ---- the books ---------------------------------------------------------
  --
  -- Two records, because this platform keeps two and they answer different
  -- questions: finance_transactions is the operating ledger every Finance
  -- Manager screen reads, finance_ledger_entries is the immutable per-payment
  -- record reconciliation points at.
  INSERT INTO public.finance_transactions
    (txn_code, direction, amount, counterparty, counterparty_type, category,
     gateway, method, status, occurred_at, notes)
  SELECT
    p_reference, 'credit', v_charged, v_name, 'customer', 'sale',
    p_provider, 'card', 'completed', v_now,
    format('Order %s settled through %s (%s %s, base %s %s at %s).',
           v_order.order_number, p_provider, v_currency, v_charged,
           v_base_currency, v_base_amount, v_fx_rate)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.finance_transactions WHERE txn_code = p_reference);

  IF v_payment_id IS NOT NULL THEN
    INSERT INTO public.finance_ledger_entries
      (payment_id, invoice_id, entry_type, amount, currency, account_code, immutable_payload)
    VALUES
      (v_payment_id, v_invoice_id, 'payment_received', v_charged, v_currency,
       'revenue.marketplace',
       jsonb_build_object(
         'reference', p_reference,
         'provider', p_provider,
         'provider_payment_id', p_provider_payment_id,
         'order_id', v_order.id,
         'order_number', v_order.order_number,
         'base_amount', v_base_amount,
         'base_currency', v_base_currency,
         'fx_rate', v_fx_rate,
         'correlation_id', p_correlation_id,
         'settled_at', v_now))
    ON CONFLICT (payment_id, entry_type) DO NOTHING;
  END IF;

  -- ---- the outbox --------------------------------------------------------
  --
  -- Committed with the money. Entitlement activation, the licence email and
  -- anything else downstream is driven from here, so a failure out there can
  -- never roll back a payment the customer has already made.
  INSERT INTO public.finance_payment_events
    (event_key, event_type, intent_id, payment_id, order_id, payload,
     status, available_at, correlation_id)
  VALUES
    (COALESCE(NULLIF(p_event_key, ''), 'settle:' || p_reference),
     'payment.settled', v_intent.id, v_payment_id, v_order.id,
     jsonb_build_object(
       'reference', p_reference,
       'provider', p_provider,
       'order_id', v_order.id,
       'order_number', v_order.order_number,
       'amount', v_charged,
       'currency', v_currency),
     'pending', v_now, p_correlation_id)
  ON CONFLICT (event_key) DO NOTHING;

  -- ---- close the intent and reconcile ------------------------------------
  UPDATE public.finance_payment_intents
     SET status             = 'succeeded',
         provider_reference = COALESCE(p_provider_payment_id, provider_reference),
         settled_at         = v_now
   WHERE id = v_intent.id;

  IF v_provider_txn_id IS NOT NULL THEN
    INSERT INTO public.finance_reconciliation_records
      (provider_transaction_id, payment_id, order_id, rail_code, reference, matching_status,
       expected_amount, observed_amount, expected_currency, observed_currency, detail)
    VALUES
      (v_provider_txn_id, v_payment_id, v_order.id, p_provider, p_reference, 'matched',
       v_charged, p_observed_amount, v_currency, COALESCE(upper(p_observed_currency), v_currency),
       format('Settled and posted to the ledger as %s.', p_reference))
    ON CONFLICT (provider_transaction_id) DO UPDATE
      SET matching_status = 'matched',
          payment_id      = EXCLUDED.payment_id,
          detail          = EXCLUDED.detail;
  END IF;

  -- Mark the provider's webhook processed, where one carried this event.
  IF p_event_key IS NOT NULL AND p_event_key <> '' AND v_rail_id IS NOT NULL THEN
    UPDATE public.finance_payment_webhooks
       SET processed_at = v_now
     WHERE rail_id = v_rail_id AND event_key = p_event_key;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'replay', false,
    'order_id', v_order.id,
    'payment_id', v_payment_id,
    'invoice_id', v_invoice_id,
    'intent_id', v_intent.id,
    'amount', v_charged,
    'currency', v_currency);
END;
$$;

REVOKE ALL ON FUNCTION public.finance_settle_payment(
  text, text, text, text, numeric, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_settle_payment(
  text, text, text, text, numeric, text, text, text, text, text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Claiming outbox events
-- ---------------------------------------------------------------------------
--
-- FOR UPDATE SKIP LOCKED is what lets more than one worker run without two of
-- them taking the same event. The attempt count and the backoff are advanced in
-- the same statement that claims, so a worker that dies mid-event leaves the
-- event retryable rather than locked forever.

CREATE OR REPLACE FUNCTION public.finance_claim_payment_events(
  p_limit        integer DEFAULT 20,
  p_max_attempts integer DEFAULT 8,
  p_backoff_base integer DEFAULT 30
)
RETURNS SETOF public.finance_payment_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT e.id
      FROM public.finance_payment_events e
     WHERE e.status = 'pending'
       AND e.available_at <= now()
       AND e.attempts < GREATEST(p_max_attempts, 1)
     ORDER BY e.available_at
     LIMIT GREATEST(p_limit, 1)
       FOR UPDATE SKIP LOCKED
  )
  UPDATE public.finance_payment_events e
     SET attempts     = e.attempts + 1,
         status       = 'processing',
         -- Exponential backoff, so a consumer that never returns still leaves
         -- the event to be retried later rather than immediately.
         available_at = now() + make_interval(
                          secs => LEAST((p_backoff_base * power(2, e.attempts))::int, 3600))
    FROM due
   WHERE e.id = due.id
  RETURNING e.*;
END;
$$;

REVOKE ALL ON FUNCTION public.finance_claim_payment_events(integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_claim_payment_events(integer, integer, integer) TO service_role;

-- Anything that has used up its attempts stops being retried and becomes
-- something a person is told about, rather than a job that spins forever.
CREATE OR REPLACE FUNCTION public.finance_retire_dead_payment_events(
  p_max_attempts integer DEFAULT 8
)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH dead AS (
    UPDATE public.finance_payment_events
       SET status = 'dead'
     WHERE status IN ('pending','processing')
       AND attempts >= GREATEST(p_max_attempts, 1)
       AND available_at <= now()
    RETURNING 1)
  SELECT count(*)::int FROM dead;
$$;

REVOKE ALL ON FUNCTION public.finance_retire_dead_payment_events(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_retire_dead_payment_events(integer) TO service_role;

-- ---------------------------------------------------------------------------
-- 5. Rate limiting that holds across processes
-- ---------------------------------------------------------------------------
--
-- The application already counted failed attempts per order. That is a wall
-- against card testing on one order and no wall at all against the same person
-- or address working through many. This counter is keyed on whatever the caller
-- decides the subject is — a user, an address, an endpoint — and the increment
-- is a single atomic upsert, so two concurrent requests cannot both see the
-- last remaining slot.
--
-- It is a counter, not a log: a bucket key and a tally, never a card, never a
-- credential, and nothing that outlives its window by more than an hour.

CREATE TABLE IF NOT EXISTS public.payment_rate_counters (
  bucket_key   text        NOT NULL,
  window_start timestamptz NOT NULL,
  hits         integer     NOT NULL DEFAULT 0,
  expires_at   timestamptz NOT NULL,
  PRIMARY KEY (bucket_key, window_start)
);

CREATE INDEX IF NOT EXISTS payment_rate_counters_expiry_idx
  ON public.payment_rate_counters (expires_at);

-- Written only by the server on the service-role key, which bypasses policies.
-- Enabling RLS with no policy is what makes it unreadable from a browser.
ALTER TABLE public.payment_rate_counters ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.payment_rate_take(
  p_key            text,
  p_window_seconds integer,
  p_limit          integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window integer := GREATEST(COALESCE(p_window_seconds, 60), 1);
  v_limit  integer := GREATEST(COALESCE(p_limit, 1), 1);
  v_start  timestamptz;
  v_hits   integer;
BEGIN
  IF p_key IS NULL OR p_key = '' THEN
    RETURN jsonb_build_object('allowed', true, 'remaining', v_limit, 'retry_after', 0);
  END IF;

  v_start := to_timestamp(floor(extract(epoch FROM now()) / v_window) * v_window);

  INSERT INTO public.payment_rate_counters (bucket_key, window_start, hits, expires_at)
  VALUES (p_key, v_start, 1, v_start + make_interval(secs => v_window * 2))
  ON CONFLICT (bucket_key, window_start) DO UPDATE
    SET hits = public.payment_rate_counters.hits + 1
  RETURNING hits INTO v_hits;

  -- Housekeeping, cheaply and only now and then: this is ephemeral data and
  -- deleting an expired counter loses nothing.
  IF random() < 0.01 THEN
    DELETE FROM public.payment_rate_counters WHERE expires_at < now() - interval '1 hour';
  END IF;

  RETURN jsonb_build_object(
    'allowed',     v_hits <= v_limit,
    'hits',        v_hits,
    'limit',       v_limit,
    'remaining',   GREATEST(v_limit - v_hits, 0),
    'retry_after', GREATEST(
      ceil(extract(epoch FROM (v_start + make_interval(secs => v_window)) - now()))::int, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.payment_rate_take(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.payment_rate_take(text, integer, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- 6. Indexes for the queries the payment path actually runs
-- ---------------------------------------------------------------------------
--
-- Each of these answers a query that exists in the code, not a column that
-- happens to look important.

-- failedAttempts() and recentlyAttempted() in the payment routes: events of a
-- given type for one order, newest first.
CREATE INDEX IF NOT EXISTS payment_logs_order_event_idx
  ON public.payment_logs (order_id, event_type, created_at DESC);
-- The health and alerting queries: what happened across all orders lately.
CREATE INDEX IF NOT EXISTS payment_logs_event_created_idx
  ON public.payment_logs (event_type, created_at DESC);

-- The consistency sweep: orders that are still waiting, oldest first.
CREATE INDEX IF NOT EXISTS marketplace_orders_pending_payment_idx
  ON public.marketplace_orders (status, updated_at)
  WHERE status IN ('pending_payment','pending');
CREATE INDEX IF NOT EXISTS marketplace_orders_paid_idx
  ON public.marketplace_orders (status, payment_verified_at DESC)
  WHERE status = 'paid';

-- Intents that have run out of time.
CREATE INDEX IF NOT EXISTS finance_payment_intents_status_expiry_idx
  ON public.finance_payment_intents (status, expires_at);

-- Entitlement checks after settlement, and the "paid but not fulfilled" sweep.
CREATE INDEX IF NOT EXISTS licenses_order_idx     ON public.licenses (order_id);
CREATE INDEX IF NOT EXISTS entitlements_order_idx ON public.entitlements (order_id);

-- Payments by provider reference, which is how a refund traces back to a sale.
CREATE INDEX IF NOT EXISTS finance_payments_provider_reference_idx
  ON public.finance_payments (provider_reference);
CREATE INDEX IF NOT EXISTS finance_payments_status_confirmed_idx
  ON public.finance_payments (status, confirmed_at DESC);
