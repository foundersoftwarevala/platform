-- Influencer payout and influencer-table access, as real accounts, inside one
-- transaction that is rolled back.
--
--   node scripts/ops/db.mjs --file scripts/ops/influencer-payout-access-verify.sql
--
-- For each identity: how many payouts it sees and how many belong to someone
-- else, whether it can mark another influencer's payout paid, whether it can
-- create a 999,999 payout, and - for the influencer - whether its own portal
-- data is still readable. Expected after 20261107T218000: influencer,
-- developer and marketing see no one else's rows and write nothing; finance
-- reads but writes nothing; admin keeps full access.
\set ON_ERROR_STOP off
begin;
create temp table res (who text, k text, v text) on commit drop;
grant all on res to authenticated;
create temp table ids (who text, uid uuid) on commit drop;
grant all on ids to authenticated;
insert into ids select distinct on (r.role::text) r.role::text, r.user_id from user_roles r
 where r.role::text in ('influencer', 'developer', 'marketing', 'finance', 'admin')
   and not exists (select 1 from user_roles r2 where r2.user_id = r.user_id and r2.role::text in ('admin', 'boss') and r.role::text <> 'admin')
 order by r.role::text, r.user_id;
-- the influencer under test is one that has a profile, so "own data" is meaningful
update ids set uid = (select p.user_id from influencer_profiles p join user_roles r on r.user_id = p.user_id and r.role::text = 'influencer' order by p.created_at limit 1)
 where who = 'influencer';
grant select on influencer_profiles to authenticated;

create or replace function pg_temp.probe(p_who text) returns void language plpgsql as $$
declare v_uid uuid; v_profile uuid; v_other uuid; v_n int; v_total int;
begin
  select uid into v_uid from ids where who = p_who;
  select id into v_profile from influencer_profiles where user_id = v_uid limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*), count(*) filter (where profile_id is distinct from v_profile) into v_total, v_n from influencer_payouts;
  insert into res values (p_who, 'payouts visible / of others', v_total || ' / ' || v_n);

  select id into v_other from influencer_payouts where profile_id is distinct from v_profile and status = 'pending' limit 1;
  begin
    update influencer_payouts set status = 'paid', provider_reference = 'PROBE' where id = v_other;
    get diagnostics v_n = row_count;
    insert into res values (p_who, 'mark another''s payout paid (rows)', v_n::text);
  exception when others then insert into res values (p_who, 'mark another''s payout paid', 'REFUSED: ' || left(sqlerrm, 60)); end;

  begin
    insert into influencer_payouts (profile_id, idempotency_key, amount, currency, status)
    values (coalesce(v_profile, (select id from influencer_profiles limit 1)), 'probe-' || gen_random_uuid(), 999999, 'USD', 'pending');
    insert into res values (p_who, 'create a 999,999 payout', 'ALLOWED');
  exception when others then insert into res values (p_who, 'create a 999,999 payout', 'REFUSED: ' || left(sqlerrm, 60)); end;

  begin
    update influencer_earnings set status = 'approved' where status <> 'approved' and profile_id is distinct from v_profile;
    get diagnostics v_n = row_count;
    insert into res values (p_who, 'approve another''s earnings (rows)', v_n::text);
  exception when others then insert into res values (p_who, 'approve another''s earnings', 'REFUSED: ' || left(sqlerrm, 60)); end;

  select count(*) into v_n from influencer_compensation_rules;
  insert into res values (p_who, 'compensation rules visible', v_n::text);

  if p_who = 'influencer' then
    insert into res select p_who, 'own portal: social / assignments / agreements / invoices / activity / earnings / payouts',
      (select count(*) from influencer_social_accounts where profile_id = v_profile) || ' / ' ||
      (select count(*) from influencer_campaign_assignments where profile_id = v_profile) || ' / ' ||
      (select count(*) from influencer_agreements where profile_id = v_profile) || ' / ' ||
      (select count(*) from influencer_invoices where profile_id = v_profile) || ' / ' ||
      (select count(*) from influencer_activity a where a.assignment_id in (select id from influencer_campaign_assignments where profile_id = v_profile)) || ' / ' ||
      (select count(*) from influencer_earnings where profile_id = v_profile) || ' / ' ||
      (select count(*) from influencer_payouts where profile_id = v_profile);
    insert into res select p_who, 'others'' rows visible: social / assignments / agreements / invoices',
      (select count(*) from influencer_social_accounts where profile_id is distinct from v_profile) || ' / ' ||
      (select count(*) from influencer_campaign_assignments where profile_id is distinct from v_profile) || ' / ' ||
      (select count(*) from influencer_agreements where profile_id is distinct from v_profile) || ' / ' ||
      (select count(*) from influencer_invoices where profile_id is distinct from v_profile);
  end if;
  execute 'reset role';
end $$;

-- The real totals, read as the database owner, so each line can be compared.
insert into res select '(table)', 'own-profile totals: social / assignments / agreements / invoices / activity / earnings / payouts',
  (select count(*) from influencer_social_accounts s where s.profile_id = (select p.id from influencer_profiles p where p.user_id = (select uid from ids where who = 'influencer'))) || ' / ' ||
  (select count(*) from influencer_campaign_assignments s where s.profile_id = (select p.id from influencer_profiles p where p.user_id = (select uid from ids where who = 'influencer'))) || ' / ' ||
  (select count(*) from influencer_agreements s where s.profile_id = (select p.id from influencer_profiles p where p.user_id = (select uid from ids where who = 'influencer'))) || ' / ' ||
  (select count(*) from influencer_invoices s where s.profile_id = (select p.id from influencer_profiles p where p.user_id = (select uid from ids where who = 'influencer'))) || ' / ' ||
  (select count(*) from influencer_activity a where a.assignment_id in (select id from influencer_campaign_assignments where profile_id = (select p.id from influencer_profiles p where p.user_id = (select uid from ids where who = 'influencer')))) || ' / ' ||
  (select count(*) from influencer_earnings s where s.profile_id = (select p.id from influencer_profiles p where p.user_id = (select uid from ids where who = 'influencer'))) || ' / ' ||
  (select count(*) from influencer_payouts s where s.profile_id = (select p.id from influencer_profiles p where p.user_id = (select uid from ids where who = 'influencer')));
insert into res select '(table)', 'payouts in total', count(*)::text from influencer_payouts;

select pg_temp.probe('influencer');
select pg_temp.probe('developer');
select pg_temp.probe('marketing');
select pg_temp.probe('finance');
select pg_temp.probe('admin');
select who, k, v from res order by case who when '(table)' then 0 when 'influencer' then 1 when 'developer' then 2 when 'marketing' then 3 when 'finance' then 4 else 5 end, k;
rollback;
