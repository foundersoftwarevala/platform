-- Phase 12: harden the existing canonical AMS records for server-owned writes.
-- The established AMS schema is role-scoped; do not introduce parallel XP or wallet tables.

begin;

do $$
begin
  if to_regclass('public.user_xp') is null
     or to_regclass('public.achievements') is null
     or to_regclass('public.user_achievements') is null
     or to_regclass('public.reward_wallets') is null
     or to_regclass('public.xp_transactions') is null
     or to_regclass('public.ams_award_ledger') is null
     or to_regclass('public.levels') is null
     or to_regclass('public.ranks') is null
     or to_regclass('public.user_roles') is null
     or to_regprocedure('public.ams_is_operator()') is null
     or to_regprocedure('public.ams_resolve_role(uuid, text)') is null
     or to_regclass('public.audit_logs') is null then
    raise exception 'AMS Phase 12 requires the existing progression, wallet, and audit tables';
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'user_xp' and column_name = 'role'
  ) or not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'xp_transactions' and column_name = 'role'
  ) then
    raise exception 'AMS Phase 12 requires role-scoped user_xp and xp_transactions';
  end if;
end
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.ams_resolve_role(uuid, text) to service_role;
  end if;
end
$$;

create index if not exists user_xp_leaderboard_idx
  on public.user_xp (total_xp desc, current_level desc, user_id, role)
  include (current_rank);
create index if not exists user_xp_level_idx
  on public.user_xp (current_level desc, user_id);
create index if not exists user_achievements_user_idx
  on public.user_achievements (user_id);
create index if not exists user_achievements_user_achievement_idx
  on public.user_achievements (user_id, achievement_id, unlocked_at desc);
create index if not exists reward_wallets_user_kind_idx
  on public.reward_wallets (user_id, kind);
create index if not exists xp_transactions_user_role_created_idx
  on public.xp_transactions (user_id, role, created_at desc);
create index if not exists ams_award_ledger_xp_total_idx
  on public.ams_award_ledger (user_id, role) include (xp_awarded)
  where asset_kind = 'xp';

alter table public.user_xp enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.reward_wallets enable row level security;
alter table public.xp_transactions enable row level security;
alter table public.ams_award_ledger enable row level security;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and tablename in (
         'user_xp', 'user_achievements', 'reward_wallets',
         'xp_transactions', 'ams_award_ledger'
       )
  loop
    execute format('drop policy %I on %I.%I',
                   policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;

  for policy_row in
    select schemaname, tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and tablename = 'achievements'
       and cmd in ('SELECT', 'ALL')
  loop
    execute format('drop policy %I on %I.%I',
                   policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end
$$;

create policy ams_user_xp_read_own_or_operator
  on public.user_xp for select to authenticated
  using (user_id = auth.uid() or public.ams_is_operator());
create policy ams_user_achievements_read_own_or_operator
  on public.user_achievements for select to authenticated
  using (user_id = auth.uid() or public.ams_is_operator());
create policy ams_reward_wallets_read_own_or_operator
  on public.reward_wallets for select to authenticated
  using (user_id = auth.uid() or public.ams_is_operator());
create policy ams_xp_transactions_read_own_or_operator
  on public.xp_transactions for select to authenticated
  using (user_id = auth.uid() or public.ams_is_operator());
create policy ams_award_ledger_read_own_or_operator
  on public.ams_award_ledger for select to authenticated
  using (user_id = auth.uid() or public.ams_is_operator());
create policy ams_achievements_catalogue_read
  on public.achievements for select to authenticated
  using (
    is_secret = false
    or public.ams_is_operator()
    or exists (
      select 1
        from public.user_achievements ua
       where ua.achievement_id = achievements.id
         and ua.user_id = auth.uid()
         and ua.unlocked_at is not null
    )
  );

create or replace function public.ams_audit_user_xp_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  actor_user_id uuid := auth.uid();
begin
  if tg_op = 'UPDATE'
     and old.total_xp = new.total_xp
     and old.current_level = new.current_level
     and old.current_rank = new.current_rank then
    return new;
  end if;

  insert into public.audit_logs (
    actor_id, actor, action, entity_type, entity_id, severity,
    before_state, after_state, metadata
  ) values (
    actor_user_id,
    coalesce(actor_user_id::text, 'ams_engine'),
    'ams.xp.changed',
    'user_xp',
    new.user_id::text,
    'info',
    case when tg_op = 'UPDATE' then jsonb_build_object(
      'role', old.role,
      'total_xp', old.total_xp,
      'level', old.current_level,
      'rank', old.current_rank
    ) else null end,
    jsonb_build_object(
      'role', new.role,
      'total_xp', new.total_xp,
      'level', new.current_level,
      'rank', new.current_rank
    ),
    jsonb_build_object('source', 'ams.user_xp.trigger')
  );
  return new;
end
$$;

drop trigger if exists ams_user_xp_audit on public.user_xp;
create trigger ams_user_xp_audit
  after insert or update of total_xp, current_level, current_rank on public.user_xp
  for each row execute function public.ams_audit_user_xp_change();

revoke all on table public.user_xp, public.achievements,
  public.user_achievements, public.reward_wallets,
  public.xp_transactions, public.ams_award_ledger
  from anon, authenticated;
grant select on table public.user_xp, public.achievements,
  public.user_achievements, public.reward_wallets,
  public.xp_transactions, public.ams_award_ledger
  to authenticated;

commit;
