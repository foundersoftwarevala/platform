-- Server purchases cannot be marked paid from the browser.
--
-- server_purchases_write lets the owner of a server, and any infrastructure
-- operator, insert and update purchase rows directly through PostgREST. Nothing
-- stopped a caller from inserting a purchase with status 'paid' / 'completed',
-- or flipping their own pending order to paid, without any payment having been
-- verified. The Buy Server screen now refuses to place an order unless Finance
-- has a payment rail switched on, but that is a UI check; this is the server
-- side of it.
--
-- Rules for browser callers (the authenticated / anon roles):
--   * a new purchase starts 'pending' — the one exception is an operator
--     registering an already-invoiced server through Add Server
--     (payment_method 'invoice', status 'completed'), which is how that screen
--     records infrastructure bought outside the platform;
--   * the money fields (amount, payment_method, purchase_code) never change
--     after insert;
--   * the only status change a browser caller may make is pending -> cancelled.
-- Marking a purchase paid / completed belongs to the server-side payment
-- verification (service role), which this trigger does not restrict.

CREATE OR REPLACE FUNCTION public.server_purchases_payment_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'pending' AND NEW.completed_at IS NULL THEN
      RETURN NEW;
    END IF;
    IF NEW.status = 'completed'
       AND NEW.payment_method = 'invoice'
       AND public.server_is_operator() THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'A server purchase starts pending; it is marked paid only after the payment is verified'
      USING ERRCODE = '42501';
  END IF;

  -- UPDATE
  IF NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
     OR NEW.purchase_code IS DISTINCT FROM OLD.purchase_code THEN
    RAISE EXCEPTION 'The amount, payment method and code of a purchase cannot be changed'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (OLD.status = 'pending' AND NEW.status = 'cancelled') THEN
      RAISE EXCEPTION 'A purchase can only be cancelled here; payment confirmation sets its status'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  IF NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
    RAISE EXCEPTION 'completed_at is set by payment confirmation'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.server_purchases_payment_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS server_purchases_payment_guard ON public.server_purchases;
CREATE TRIGGER server_purchases_payment_guard
  BEFORE INSERT OR UPDATE ON public.server_purchases
  FOR EACH ROW EXECUTE FUNCTION public.server_purchases_payment_guard();
