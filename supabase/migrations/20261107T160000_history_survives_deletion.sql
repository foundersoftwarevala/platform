-- Financial and audit history must outlive the row it belongs to.
--
-- These foreign keys deleted history together with its parent: deleting an
-- order erased its lines, licence, payment log, status history and referral
-- attribution; deleting a user erased their payment-blacklist entry (undoing a
-- fraud control) and their AMS record; deleting a wallet or an invoice erased
-- its transactions or lines. Each now RESTRICTs: the parent cannot be deleted
-- while history hangs off it, and the error says so. The platform's own
-- deletions are unaffected - nothing deletes orders, wallets, invoices or
-- users; the product purge already keeps any product with orders or licences;
-- a reseller with membership orders is now refused instead of erased.
--
-- H9: the AMS ledger and activity events are append-only, so a cascade from
-- a user deletion already failed deep inside the ledger's guard. RESTRICT
-- makes that refusal explicit at the user and covers the rest of the AMS
-- record (certificates, passports, awards earned, XP history, reward claims).
-- A user with AMS history is deactivated, not deleted.
--
-- Deliberately left as CASCADE (operational, configuration or personal data,
-- where deleting with the parent is the intended behaviour): commission
-- rules and payout schedules (configuration; every commission keeps a
-- rule_snapshot), payment_methods (personal data), user_xp and reward_wallets
-- (running totals rebuilt from the history above), ticket comments, chat and
-- attachments, server/bot/demo/lead/developer logs, time logs, URL and brand
-- histories, the promise ledger (the Promise Tracker deletes a promise with
-- its own trail by design), Founder memory history, auth internals.

begin;

do $$
declare
  c record;
  def text;
begin
  for c in
    select con.conname, con.conrelid::regclass as child
      from pg_constraint con
     where con.contype = 'f'
       and con.confdeltype = 'c'
       and con.conname in (
         'marketplace_order_items_order_id_fkey',
         'marketplace_order_status_history_order_id_fkey',
         'marketplace_order_attributions_order_id_fkey',
         'licenses_order_id_fkey',
         'payment_logs_order_id_fkey',
         'entitlements_product_id_fkey',
         'finance_wallet_transactions_wallet_id_fkey',
         'wallet_transactions_wallet_id_fkey',
         'finance_invoice_items_invoice_id_fkey',
         'payment_blacklist_user_id_fkey',
         'sales_commissions_member_id_fkey',
         'reseller_membership_orders_reseller_id_fkey',
         'reseller_membership_entitlements_membership_id_fkey',
         'author_approval_history_submission_id_fkey',
         'trust_audit_logs_badge_key_fkey',
         'ams_award_ledger_user_id_fkey',
         'ams_activity_events_user_id_fkey',
         'ams_certificates_user_id_fkey',
         'ams_passports_user_id_fkey',
         'user_awards_user_id_fkey',
         'user_awards_award_id_fkey',
         'xp_transactions_user_id_fkey',
         'claims_user_id_fkey')
  loop
    def := pg_get_constraintdef(
      (select oid from pg_constraint where conname = c.conname and conrelid = c.child));
    if position('ON DELETE CASCADE' in def) = 0 then
      raise exception '% no longer has the expected shape: %', c.conname, def;
    end if;
    execute format('alter table %s drop constraint %I', c.child, c.conname);
    execute format('alter table %s add constraint %I %s', c.child, c.conname,
                   replace(def, 'ON DELETE CASCADE', 'ON DELETE RESTRICT'));
  end loop;
end $$;

commit;
