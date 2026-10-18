-- Reward claims, requested by the person and decided by an administrator.
--
-- The AMS Center's "Claim" button marked an offer claimed in the browser and
-- said "Reward added to your wallet"; nothing reached the database. The AMS
-- Claims screen, where those claims would be decided, was a table of three
-- invented rows. The tables were already here - rewards, claims,
-- reward_wallets - and their policies already said who may do what: a person
-- may file a claim for themselves, only an administrator may change a claim or
-- a wallet. These two functions are the steps between.
--
-- Nothing is debited when a claim is filed; the wallet is only checked, so a
-- person cannot file for something they cannot afford. Coins, tokens and stock
-- move when an administrator approves, under row locks, so two approvals can
-- never spend the same balance or the last item twice. A refusal needs a
-- reason. Every decision is written to the platform audit trail and the person
-- is told.

create or replace function public.ams_request_claim(p_reward uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_reward public.rewards;
  v_coins bigint;
  v_tokens bigint;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Please sign in to claim a reward' using errcode = '28000';
  end if;

  select * into v_reward from public.rewards where id = p_reward;
  if v_reward.id is null then
    raise exception 'That reward does not exist';
  end if;
  if v_reward.status <> 'active' then
    raise exception 'That reward is not available';
  end if;
  if v_reward.stock is not null and v_reward.stock <= 0 then
    raise exception 'That reward is out of stock';
  end if;
  if exists (select 1 from public.claims
              where user_id = v_uid and reward_id = p_reward and status = 'pending') then
    raise exception 'You already have a claim waiting for this reward';
  end if;

  select balance into v_coins from public.reward_wallets where user_id = v_uid and kind = 'coins';
  select balance into v_tokens from public.reward_wallets where user_id = v_uid and kind = 'tokens';
  if coalesce(v_coins, 0) < coalesce(v_reward.cost_coins, 0)
     or coalesce(v_tokens, 0) < coalesce(v_reward.cost_tokens, 0) then
    raise exception 'Your wallet does not hold enough for this reward';
  end if;

  insert into public.claims (user_id, reward_id, status, cost_coins, cost_tokens)
  values (v_uid, p_reward, 'pending', coalesce(v_reward.cost_coins, 0), coalesce(v_reward.cost_tokens, 0))
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create or replace function public.ams_decide_claim(p_claim uuid, p_decision text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_claim public.claims;
  v_reward public.rewards;
  v_coins bigint;
  v_tokens bigint;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if v_uid is null or not public.is_admin(v_uid) then
    raise exception 'Only an administrator can decide a claim' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected', 'fulfilled') then
    raise exception 'Unknown decision %', p_decision;
  end if;

  select * into v_claim from public.claims where id = p_claim for update;
  if v_claim.id is null then
    raise exception 'Claim not found';
  end if;
  if v_claim.user_id = v_uid then
    raise exception 'You cannot decide your own claim' using errcode = '42501';
  end if;

  if p_decision = 'fulfilled' then
    if v_claim.status <> 'approved' then
      raise exception 'Only an approved claim can be marked fulfilled (this one is %)', v_claim.status;
    end if;
    update public.claims
       set status = 'fulfilled', fulfilled_at = now(), updated_at = now(),
           notes = coalesce(v_note, notes)
     where id = p_claim;
  else
    if v_claim.status <> 'pending' then
      raise exception 'This claim has already been %', v_claim.status;
    end if;

    if p_decision = 'rejected' then
      if v_note is null then
        raise exception 'A claim is refused with a reason';
      end if;
      update public.claims
         set status = 'rejected', decided_by = v_uid, decided_at = now(), updated_at = now(), notes = v_note
       where id = p_claim;
    else
      select * into v_reward from public.rewards where id = v_claim.reward_id for update;
      if v_reward.stock is not null and v_reward.stock <= 0 then
        raise exception 'That reward is out of stock';
      end if;

      -- Both wallets are locked before either is read, always in the same
      -- order, so two approvals for one person cannot interleave.
      perform 1 from public.reward_wallets
       where user_id = v_claim.user_id and kind in ('coins', 'tokens')
       order by kind for update;
      select balance into v_coins from public.reward_wallets where user_id = v_claim.user_id and kind = 'coins';
      select balance into v_tokens from public.reward_wallets where user_id = v_claim.user_id and kind = 'tokens';
      if coalesce(v_coins, 0) < v_claim.cost_coins or coalesce(v_tokens, 0) < v_claim.cost_tokens then
        raise exception 'The wallet no longer holds enough for this claim';
      end if;

      if v_claim.cost_coins > 0 then
        update public.reward_wallets set balance = balance - v_claim.cost_coins, updated_at = now()
         where user_id = v_claim.user_id and kind = 'coins';
      end if;
      if v_claim.cost_tokens > 0 then
        update public.reward_wallets set balance = balance - v_claim.cost_tokens, updated_at = now()
         where user_id = v_claim.user_id and kind = 'tokens';
      end if;
      if v_reward.stock is not null then
        update public.rewards set stock = stock - 1, updated_at = now() where id = v_reward.id;
      end if;

      update public.claims
         set status = 'approved', decided_by = v_uid, decided_at = now(), updated_at = now(),
             notes = coalesce(v_note, notes)
       where id = p_claim;
    end if;
  end if;

  insert into public.audit_logs (actor, action, entity_type, entity_id, severity, metadata)
  values (v_uid::text, 'ams.claim.' || p_decision, 'claims', p_claim::text, 'info',
          jsonb_build_object('user_id', v_claim.user_id, 'reward_id', v_claim.reward_id,
                             'cost_coins', v_claim.cost_coins, 'cost_tokens', v_claim.cost_tokens,
                             'note', v_note));

  perform public.mm_notify('ams.claim_' || p_decision,
    case p_decision when 'approved' then 'Reward claim approved'
                    when 'fulfilled' then 'Reward on its way'
                    else 'Reward claim not approved' end,
    case p_decision when 'rejected' then 'Your reward claim was not approved. Reason: ' || v_note
                    when 'fulfilled' then 'Your reward claim has been fulfilled.'
                    else 'Your reward claim was approved and the cost taken from your wallet.' end,
    v_claim.user_id, null, null, null, 0,
    case p_decision when 'rejected' then 'warning' else 'success' end);

  return jsonb_build_object('ok', true, 'status', p_decision);
end;
$$;

revoke all on function public.ams_request_claim(uuid) from public, anon;
revoke all on function public.ams_decide_claim(uuid, text, text) from public, anon;
grant execute on function public.ams_request_claim(uuid) to authenticated;
grant execute on function public.ams_decide_claim(uuid, text, text) to authenticated;
