-- Part 1 MEDIUM findings that are enforced in the database.
--
-- M9  mm_notify deduplicates by checking for a recent notification of the same
--     event for the person and then inserting; two simultaneous sends both saw
--     none and both inserted. The check is now taken under a transaction lock
--     for that person and event, so concurrent sends deduplicate too.
-- M11 ams_claim_award read claimed_at, then set it and wrote a 'claimed'
--     ledger line; two simultaneous claims both wrote one (the ledger's
--     once-only index deliberately leaves 'claimed' lines out). The claim is
--     now a conditional update - only the call that actually moves claimed_at
--     from NULL writes the ledger line - and a unique index keeps one
--     'claimed' line per person and award.
--     A task bridged between Developer Manager and Task Manager reached AMS
--     twice on completion: once from developer_tasks (as the developer) and
--     once from the mirrored tm_tasks row, under different keys. For a
--     bridged task the developer side is the record of the work, so the
--     tm_tasks trigger no longer records its completion; approval, which only
--     Task Manager records, is unchanged.
-- M12 Licence issuance fired when an order was inserted already paid, but the
--     ledger entry, reseller and influencer commissions and AMS did not, so
--     such an order was half-processed. Those four triggers now fire on
--     INSERT as well as UPDATE; each already tests "became paid" with
--     coalesce(old.status, ''), which is correct when there is no old row.
-- M15 The AMS leaderboard embeds profiles(...) from leaderboard_entries, which
--     had no foreign key to profiles, so PostgREST refused the whole query
--     (PGRST200). leaderboard_entries is empty, so the key is added validated.

begin;

do $$
declare
  def text;
  changed text;
begin
  -- M9: serialise the dedupe check per person and event.
  def := pg_get_functiondef('public.mm_notify(text,text,text,uuid,text[],text,text,integer,text)'::regprocedure);
  if position('mm_notify:' in def) = 0 then
    changed := regexp_replace(def,
      '(foreach v_target in array v_targets loop\s*\n)',
      E'\\1    -- Concurrent sends to one person for one event deduplicate too.\n    perform pg_advisory_xact_lock(hashtextextended(''mm_notify:'' || v_target::text || '':'' || p_event, 0));\n');
    if changed = def then raise exception 'mm_notify no longer has the expected shape'; end if;
    execute changed;
  end if;

  -- M11: only the claim that moves claimed_at writes the ledger line.
  def := pg_get_functiondef('public.ams_claim_award(text)'::regprocedure);
  if position('claimed_at is null' in def) = 0 then
    changed := regexp_replace(def,
      'update public\.user_awards set claimed_at = now\(\)\s*\n\s*where id = v_row\.id;',
      E'update public.user_awards set claimed_at = now()\n   where id = v_row.id and claimed_at is null;\n   -- Another claim got there first: it wrote the ledger line.\n   if not found then\n     return jsonb_build_object(''ok'', true, ''already_claimed'', true);\n   end if;');
    if changed = def then raise exception 'ams_claim_award no longer has the expected shape'; end if;
    execute changed;
  end if;

  -- M11: a bridged task's completion is recorded once, from developer_tasks.
  def := pg_get_functiondef('public.ams_on_task()'::regprocedure);
  if position('bridged' in def) = 0 then
    changed := regexp_replace(def,
      E'(if new\\.status::text = ''completed'' and coalesce\\(old\\.status::text,''''\\) is distinct from ''completed'')( then)',
      E'\\1\n       -- bridged: Developer Manager records this completion for the developer\n       and not exists (select 1 from public.developer_tasks d where d.tm_task_id = new.id)\\2');
    if changed = def then raise exception 'ams_on_task no longer has the expected shape'; end if;
    execute changed;
  end if;
end $$;

-- M11: one 'claimed' ledger line per person and award.
create unique index if not exists ams_award_ledger_claimed_once
  on public.ams_award_ledger (user_id, asset_kind, asset_slug)
  where reason = 'claimed';

-- M12: the paid-order triggers fire for an order inserted already paid.
drop trigger if exists ams_order_paid on public.marketplace_orders;
create trigger ams_order_paid after insert or update on public.marketplace_orders
  for each row execute function public.ams_on_order_paid();
drop trigger if exists marketplace_order_paid_ledger on public.marketplace_orders;
create trigger marketplace_order_paid_ledger after insert or update on public.marketplace_orders
  for each row execute function public.marketplace_order_paid_ledger();
drop trigger if exists reseller_commission_on_paid on public.marketplace_orders;
create trigger reseller_commission_on_paid after insert or update on public.marketplace_orders
  for each row execute function public.reseller_on_order_paid();
drop trigger if exists influencer_commission_on_paid on public.marketplace_orders;
create trigger influencer_commission_on_paid after insert or update on public.marketplace_orders
  for each row execute function public.influencer_on_order_paid();

-- M15: leaderboard entries belong to a profile, so profiles(...) can be embedded.
alter table public.leaderboard_entries
  add constraint leaderboard_entries_user_id_profiles_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

commit;
