-- Finance Manager: the atomic wallet adjustment the module calls.
--
-- lib/finance/finance.server.ts calls finance_adjust_wallet_atomic for every
-- wallet top-up and every deduction. The function does not exist in this
-- project's database — PostgREST answers PGRST202 — so both controls fail at
-- the moment they are used. This is the source module's own definition,
-- unchanged, so the semantics match what the console expects: a positive
-- amount, a valid entry type, a reason, a row lock on the wallet, a refusal on
-- a frozen wallet, a refusal that would take the balance below zero, and the
-- matching finance_wallet_transactions row written in the same transaction.
--
-- Nothing is dropped. CREATE OR REPLACE leaves any existing definition intact
-- if one appears later.

CREATE OR REPLACE FUNCTION public.finance_adjust_wallet_atomic(
  p_wallet_id uuid,
  p_amount numeric,
  p_entry_type text,
  p_reason text,
  p_actor text,
  p_reference text
) RETURNS public.finance_wallets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet public.finance_wallets;
  v_next_balance numeric;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be greater than zero'; END IF;
  IF p_entry_type NOT IN ('credit', 'debit') THEN RAISE EXCEPTION 'Invalid entry type'; END IF;
  IF btrim(p_reason) = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;

  SELECT * INTO v_wallet FROM public.finance_wallets WHERE id = p_wallet_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found'; END IF;
  IF v_wallet.status = 'frozen' THEN RAISE EXCEPTION 'Frozen wallets cannot be adjusted'; END IF;

  v_next_balance := v_wallet.balance + CASE WHEN p_entry_type = 'credit' THEN p_amount ELSE -p_amount END;
  IF v_next_balance < 0 THEN RAISE EXCEPTION 'Adjustment would push the wallet balance below zero'; END IF;

  UPDATE public.finance_wallets
  SET balance = v_next_balance, last_activity_at = now()
  WHERE id = p_wallet_id
  RETURNING * INTO v_wallet;

  INSERT INTO public.finance_wallet_transactions
    (wallet_id, entry_type, amount, balance_after, reference, note, status, performed_by)
  VALUES
    (p_wallet_id, p_entry_type, p_amount, v_next_balance, p_reference, p_reason, 'completed', p_actor);

  RETURN v_wallet;
END;
$$;
REVOKE ALL ON FUNCTION public.finance_adjust_wallet_atomic(uuid, numeric, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finance_adjust_wallet_atomic(uuid, numeric, text, text, text, text) TO service_role;