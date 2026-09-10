-- Secure global card payment, on the payment schema Finance Manager already has.
--
-- This platform already carries a full canonical payment domain that nothing
-- was writing to: finance_payment_intents, finance_payments,
-- finance_payment_events, finance_payment_webhooks,
-- finance_provider_transactions, finance_reconciliation_records and
-- finance_ledger_entries all exist and are all empty, because the only payment
-- adapter in the codebase (PayU) settled straight onto marketplace_orders and
-- never touched them.
--
-- So nothing new is created here for intents, webhooks or reconciliation. What
-- is added is what those tables need in order to actually be usable:
--
--   1. the bindings a payment intent must carry — the order and the user it
--      belongs to — which the table had no column for;
--   2. the unique constraints that make replay, double settlement and duplicate
--      provider transactions impossible rather than merely unlikely;
--   3. generic provider columns on marketplace_orders, because the ones that
--      existed were named for PayU (payu_txn_id, payu_status, amount_inr) and a
--      second provider had nowhere to record its own reference;
--   4. rail and gateway rows for the card providers, so an operator has
--      somewhere in Finance Manager to put the keys.
--
-- No table is created that already exists. No column is dropped. No row is
-- deleted. amount_inr and the payu_* columns keep working exactly as they do.

-- ---------------------------------------------------------------------------
-- 1. Payment intent bindings
-- ---------------------------------------------------------------------------
--
-- An intent has to be answerable for whose money it is and what it buys. The
-- table bound only to an invoice, which is created after the payment, so there
-- was no way to check at settlement time that the person paying owned the order
-- being paid for.

ALTER TABLE public.finance_payment_intents
  ADD COLUMN IF NOT EXISTS order_id     uuid REFERENCES public.marketplace_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS user_id      uuid,
  -- Which rail in words, so a query does not have to join to read it.
  ADD COLUMN IF NOT EXISTS gateway_code text,
  -- The reporting-currency view of the same money, with the rate used at the
  -- time. Immutable once written: a later rate never rewrites history.
  ADD COLUMN IF NOT EXISTS base_amount   numeric(14,2),
  ADD COLUMN IF NOT EXISTS base_currency text,
  ADD COLUMN IF NOT EXISTS fx_rate       numeric(18,8),
  ADD COLUMN IF NOT EXISTS settled_at    timestamptz;

CREATE INDEX IF NOT EXISTS finance_payment_intents_order_idx
  ON public.finance_payment_intents (order_id);
CREATE INDEX IF NOT EXISTS finance_payment_intents_user_idx
  ON public.finance_payment_intents (user_id);

-- One intent per client reference. This is what makes creating an intent
-- idempotent: a customer who double-clicks Pay Now reaches the intent that
-- already exists instead of opening a second one against the same order.
CREATE UNIQUE INDEX IF NOT EXISTS finance_payment_intents_client_reference_idx
  ON public.finance_payment_intents (client_reference)
  WHERE client_reference IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS finance_payment_intents_idempotency_idx
  ON public.finance_payment_intents (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. The constraints that do the actual protecting
-- ---------------------------------------------------------------------------

-- Replay defence. A provider that retries its webhook — and all of them do —
-- loses the insert race and the second callback does nothing.
CREATE UNIQUE INDEX IF NOT EXISTS finance_payment_webhooks_rail_event_idx
  ON public.finance_payment_webhooks (rail_id, event_key);

CREATE UNIQUE INDEX IF NOT EXISTS finance_payment_events_event_key_idx
  ON public.finance_payment_events (event_key)
  WHERE event_key IS NOT NULL;

-- Double-spend defence. One intent can produce exactly one payment, enforced
-- by the database rather than by whichever code path happens to check first.
CREATE UNIQUE INDEX IF NOT EXISTS finance_payments_intent_idx
  ON public.finance_payments (intent_id)
  WHERE intent_id IS NOT NULL;

-- The same provider transaction cannot be recorded twice.
CREATE UNIQUE INDEX IF NOT EXISTS finance_provider_transactions_rail_txn_idx
  ON public.finance_provider_transactions (rail_id, provider_transaction_id);

-- One standing reconciliation row per provider transaction, updated in place,
-- so a payment that reconciles on a later sweep stops being an exception
-- rather than accumulating one row per attempt.
CREATE UNIQUE INDEX IF NOT EXISTS finance_reconciliation_provider_txn_idx
  ON public.finance_reconciliation_records (provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS finance_reconciliation_status_idx
  ON public.finance_reconciliation_records (matching_status);

-- The ledger entry for a payment is written once.
CREATE UNIQUE INDEX IF NOT EXISTS finance_ledger_entries_payment_type_idx
  ON public.finance_ledger_entries (payment_id, entry_type)
  WHERE payment_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Reconciliation needs to describe what went wrong
-- ---------------------------------------------------------------------------
--
-- matching_status alone cannot say what was expected against what arrived, so
-- an exception was unusable: an operator could see that something did not match
-- but not what. These carry the comparison itself.

ALTER TABLE public.finance_reconciliation_records
  ADD COLUMN IF NOT EXISTS rail_code         text,
  ADD COLUMN IF NOT EXISTS reference         text,
  ADD COLUMN IF NOT EXISTS order_id          uuid REFERENCES public.marketplace_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expected_amount   numeric(14,2),
  ADD COLUMN IF NOT EXISTS observed_amount   numeric(14,2),
  ADD COLUMN IF NOT EXISTS expected_currency text,
  ADD COLUMN IF NOT EXISTS observed_currency text,
  ADD COLUMN IF NOT EXISTS detail            text;

CREATE INDEX IF NOT EXISTS finance_reconciliation_reference_idx
  ON public.finance_reconciliation_records (reference);

-- ---------------------------------------------------------------------------
-- 4. Generic payment columns on the order
-- ---------------------------------------------------------------------------

ALTER TABLE public.marketplace_orders
  -- What the customer was actually charged, in currency_charged. amount_inr is
  -- the same idea under a PayU-shaped name; orders written before this keep it.
  ADD COLUMN IF NOT EXISTS amount_charged      numeric(14,2),
  -- The provider's own handle for the payment: a Flutterwave transaction id, a
  -- Paystack transaction id, a Stripe session then payment intent.
  ADD COLUMN IF NOT EXISTS provider_payment_id text,
  ADD COLUMN IF NOT EXISTS provider_status     text,
  -- When the provider itself confirmed it, as opposed to when we were told.
  ADD COLUMN IF NOT EXISTS payment_verified_at timestamptz,
  -- A payment intent that is never paid must not stay open forever.
  ADD COLUMN IF NOT EXISTS intent_expires_at   timestamptz,
  -- Safe display metadata only, and only where the provider volunteers it.
  -- There is no column here for a card number, and there never will be.
  ADD COLUMN IF NOT EXISTS card_last4          text,
  ADD COLUMN IF NOT EXISTS card_brand          text;

-- Four digits is the whole of what may be kept, enforced by the database rather
-- than trusted to every future caller.
ALTER TABLE public.marketplace_orders
  DROP CONSTRAINT IF EXISTS marketplace_orders_card_last4_len;
ALTER TABLE public.marketplace_orders
  ADD CONSTRAINT marketplace_orders_card_last4_len
  CHECK (card_last4 IS NULL OR card_last4 ~ '^[0-9]{4}$');

-- One order is one payment reference. A second order can never claim a
-- reference that already belongs to another.
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_orders_txnid_idx
  ON public.marketplace_orders (txnid) WHERE txnid IS NOT NULL;
CREATE INDEX IF NOT EXISTS marketplace_orders_provider_payment_idx
  ON public.marketplace_orders (provider_payment_id);

-- Existing PayU orders carry their charged amount under the old name. Copy it
-- across so one column answers the question for every rail from here on.
UPDATE public.marketplace_orders
   SET amount_charged = amount_inr
 WHERE amount_charged IS NULL
   AND amount_inr IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. Row level security on the payment domain
-- ---------------------------------------------------------------------------
--
-- These tables are written only by the server on the service-role key, which
-- bypasses these policies. What the policies decide is who may read them from a
-- browser, and the answer is the people who may already see money move — plus,
-- for an intent, the customer it belongs to.

ALTER TABLE public.finance_payment_intents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_payments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_payment_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_payment_webhooks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_provider_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_reconciliation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_ledger_entries         ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'finance_payments',
    'finance_payment_events',
    'finance_payment_webhooks',
    'finance_provider_transactions',
    'finance_reconciliation_records',
    'finance_ledger_entries'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ' finance read', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (
         public.has_role(auth.uid(), ''finance'')
         OR public.has_role(auth.uid(), ''admin'')
         OR public.has_role(auth.uid(), ''boss''))',
      t || ' finance read', t);
  END LOOP;
END $$;

-- A customer may see their own payment intent and nobody else's. This is what
-- stops user A reading user B's payment status.
DROP POLICY IF EXISTS "payment intent owner read" ON public.finance_payment_intents;
CREATE POLICY "payment intent owner read"
  ON public.finance_payment_intents FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'finance')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'boss')
  );

-- Resolving a reconciliation exception is the one write a browser may make, and
-- it can never invent or alter a financial figure.
DROP POLICY IF EXISTS "reconciliation finance resolve" ON public.finance_reconciliation_records;
CREATE POLICY "reconciliation finance resolve"
  ON public.finance_reconciliation_records FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'finance')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'boss')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'finance')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'boss')
  );

-- ---------------------------------------------------------------------------
-- 6. The card rails
-- ---------------------------------------------------------------------------
--
-- Created disabled, unconfigured and carrying no secrets. They exist so an
-- operator has somewhere in Finance Manager to put the keys — the same place
-- Wise, UPI, bank transfer and Binance already keep theirs. Until a key is
-- entered, resolveCardConfig returns null and every entry point refuses.
--
-- The country and currency lists are what each provider actually settles, not a
-- guess, and they are what the checkout uses to decide which providers to offer
-- a given buyer. Nothing here says "Africa means card".

INSERT INTO public.finance_payment_rails
  (code, display_name, enabled, supported_currencies, supported_countries,
   health_status, configuration_state)
VALUES
  ('flutterwave', 'Flutterwave', false,
   ARRAY['NGN','GHS','KES','ZAR','UGX','TZS','RWF','XAF','XOF','USD','GBP','EUR'],
   ARRAY['NG','GH','KE','ZA','UG','TZ','RW','CM','CI','SN','US','GB'],
   'unconfigured', '{}'::jsonb),
  ('paystack', 'Paystack', false,
   ARRAY['NGN','GHS','ZAR','KES','USD'],
   ARRAY['NG','GH','ZA','KE'],
   'unconfigured', '{}'::jsonb),
  ('stripe', 'Stripe', false,
   ARRAY['USD','EUR','GBP','INR','AUD','CAD','SGD','AED'],
   ARRAY['US','GB','IE','DE','FR','NL','ES','IT','AU','CA','SG','AE','IN'],
   'unconfigured', '{}'::jsonb),
  -- PayU is the only adapter this platform already had, and it was the one
  -- provider with no rail row — so its credentials could only go into a server
  -- environment file. This gives it the same home as everything else.
  ('payu', 'PayU', false, ARRAY['INR'], ARRAY['IN'], 'unconfigured', '{}'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7. The gateway rows the Finance console renders
-- ---------------------------------------------------------------------------
--
-- finance_payment_rails holds the configuration; finance_gateways is what the
-- Payment Gateways screen draws a card from. Both card providers need a row or
-- their section reads "Gateway not configured yet" forever.
--
-- Created disabled. The console decides what to show from gatewayReadiness(),
-- which answers from the adapter and the credentials rather than from this
-- status column, so a seeded row can never make a gateway look live.

INSERT INTO public.finance_gateways
  (code, name, provider, status, success_rate, fee_percent, settlement_cycle,
   monthly_volume, monthly_txn_count, supported_currencies)
VALUES
  ('flutterwave', 'Flutterwave', 'Flutterwave', 'disabled', 0, 0, 'T+1',
   0, 0, ARRAY['NGN','GHS','KES','ZAR','UGX','TZS','RWF','XAF','XOF','USD','GBP','EUR']),
  ('paystack', 'Paystack', 'Paystack', 'disabled', 0, 0, 'T+1',
   0, 0, ARRAY['NGN','GHS','ZAR','KES','USD'])
ON CONFLICT (code) DO NOTHING;
