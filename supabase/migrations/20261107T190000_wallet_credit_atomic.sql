-- M1: adding money to a manager wallet in one atomic step.
--
-- The wallet screen computed the new balance in the browser from the copy it
-- had loaded, then sent two separate writes: a transaction row and the
-- absolute new balance. Two quick top-ups both started from the same old
-- balance, so one was lost; and either write could succeed without the other.
-- This locks the wallet row, adds the amount to the balance the database
-- holds, and records the transaction with the resulting balance, together.
-- It mirrors finance_adjust_wallet_atomic for finance_wallets. Server only:
-- the manager data layer calls it after its own operator check.

begin;

create or replace function public.wallet_credit_atomic(
  p_wallet_id uuid, p_amount numeric, p_description text, p_reference text)
returns public.wallets
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_wallet public.wallets;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;
  select * into v_wallet from public.wallets where id = p_wallet_id for update;
  if not found then
    raise exception 'Wallet not found';
  end if;
  if v_wallet.status = 'locked' then
    raise exception 'A locked wallet cannot be credited';
  end if;

  update public.wallets
     set balance = balance + p_amount
   where id = p_wallet_id
  returning * into v_wallet;

  insert into public.wallet_transactions (wallet_id, type, amount, balance_after, description, reference)
  values (p_wallet_id, 'credit', p_amount, v_wallet.balance, p_description, p_reference);

  return v_wallet;
end $$;

revoke all on function public.wallet_credit_atomic(uuid, numeric, text, text) from public, anon, authenticated;
grant execute on function public.wallet_credit_atomic(uuid, numeric, text, text) to service_role;

commit;
