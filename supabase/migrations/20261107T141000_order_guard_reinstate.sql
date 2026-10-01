-- Correction to 20261107T140000: an operator may reinstate a cancelled order.
--
-- The Marketplace Manager's order resource documents "an operator may cancel or
-- reinstate an order", and reinstating means the order is awaiting payment
-- again. The guard treated cancelled as final and refused it. Only that one
-- move is reopened: cancelled -> pending_payment. A paid, fulfilled or
-- refunded order still cannot return to pending_payment, refunded is still
-- final, and paid is still reached only from pending_payment or disputed.

begin;

create or replace function public.marketplace_order_status_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if new.status = 'pending_payment' and old.status <> 'cancelled' then
    raise exception 'order % cannot go back from % to pending_payment', old.id, old.status
      using errcode = 'check_violation';
  end if;
  if old.status = 'refunded'
     or (old.status = 'cancelled' and new.status <> 'pending_payment') then
    raise exception 'order % is %; it can only be reinstated to pending_payment', old.id, old.status
      using errcode = 'check_violation';
  end if;
  if new.status = 'paid' and old.status not in ('pending_payment', 'disputed') then
    raise exception 'order % cannot become paid from %', old.id, old.status
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

revoke all on function public.marketplace_order_status_guard() from public, anon, authenticated;

commit;
