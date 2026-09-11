-- Prerequisite for 20260909040000_card_payment_rails.sql and
-- 20260909050000_payment_atomicity_and_reliability.sql.
--
-- Why those two were never applied to production. Probed on 2026-09-11 with
-- rows that carried a foreign key to a random id (so a CHECK answered and
-- nothing was written):
--
--   finance_payment_rails.code       admits only wise, upi, bank_transfer,
--                                    binance. 040000 inserts payu, stripe,
--                                    flutterwave and paystack, so the whole
--                                    migration rolls back at that INSERT.
--   finance_payment_intents.status   refuses succeeded, requires_action and
--                                    requires_review — the values 050000's
--                                    finance_settle_payment writes.
--   finance_payments.status          refuses succeeded, which 050000 writes.
--   marketplace_orders.status        refuses pending, payment_failed and
--                                    payment_expired, which the payment code
--                                    writes on every failure and expiry.
--   finance_payment_intents.invoice_id and finance_payments.invoice_id are
--                                    NOT NULL, but an intent exists before any
--                                    invoice does.
--
-- Everything here only WIDENS what is accepted. Every value that is valid today
-- stays valid, no row is changed, no column is dropped, no data is deleted.
-- Replacing a CHECK constraint is done as drop-and-add inside this one
-- transaction, which is the only way Postgres offers to widen one.
--
-- Apply order: this file, then 20260909040000, then 20260909050000, then
-- 20260911100000_marketplace_security_and_indexes.sql.

BEGIN;

-- 1. Rails: the card gateways and PayU need a row, like every other rail.
ALTER TABLE public.finance_payment_rails
  DROP CONSTRAINT IF EXISTS finance_payment_rails_code_check;
ALTER TABLE public.finance_payment_rails
  ADD CONSTRAINT finance_payment_rails_code_check
  CHECK (code = ANY (ARRAY[
    'wise', 'upi', 'bank_transfer', 'binance',
    'payu', 'stripe', 'flutterwave', 'paystack'
  ]::text[]));

-- 2. Intent statuses: the lifecycle the settlement function and its transition
--    guard (050000) use, plus every value accepted today.
ALTER TABLE public.finance_payment_intents
  DROP CONSTRAINT IF EXISTS finance_payment_intents_status_check;
ALTER TABLE public.finance_payment_intents
  ADD CONSTRAINT finance_payment_intents_status_check
  CHECK (status = ANY (ARRAY[
    'pending', 'processing', 'paid', 'failed', 'expired', 'cancelled',
    'requires_action', 'requires_review', 'succeeded',
    'refunded', 'partially_refunded'
  ]::text[]));

-- 3. Payment statuses.
ALTER TABLE public.finance_payments
  DROP CONSTRAINT IF EXISTS finance_payments_status_check;
ALTER TABLE public.finance_payments
  ADD CONSTRAINT finance_payments_status_check
  CHECK (status = ANY (ARRAY[
    'pending', 'processing', 'paid', 'failed', 'expired', 'cancelled', 'refunded',
    'succeeded', 'partially_refunded'
  ]::text[]));

-- 4. Order statuses: what a failed or expired payment is recorded as.
ALTER TABLE public.marketplace_orders
  DROP CONSTRAINT IF EXISTS marketplace_orders_status_check;
ALTER TABLE public.marketplace_orders
  ADD CONSTRAINT marketplace_orders_status_check
  CHECK (status = ANY (ARRAY[
    'pending_payment', 'paid', 'processing', 'fulfilled', 'completed',
    'cancelled', 'refunded', 'disputed',
    'pending', 'payment_failed', 'payment_expired'
  ]::text[]));

-- 5. An intent exists before its invoice is final. The application binds a
--    draft invoice today; this lets the database stop requiring one.
ALTER TABLE public.finance_payment_intents ALTER COLUMN invoice_id DROP NOT NULL;
ALTER TABLE public.finance_payments        ALTER COLUMN invoice_id DROP NOT NULL;

COMMIT;
