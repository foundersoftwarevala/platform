-- Who may see and change what.
--
-- The source granted SELECT, INSERT, UPDATE and DELETE on every one of these
-- tables to anon as well as authenticated, and then gave each table a single
-- policy reading USING (true) WITH CHECK (true). In practice that is no
-- security at all: an anonymous caller could list every commitment the business
-- had made, rewrite any fine, flip the settings, and delete the audit trail.
--
-- Section 27 asks for three shapes of access, and they are what is built here.
-- An owner sees the promises they made. A receiver sees the promises made to
-- them. A manager sees their teams' and may escalate. An operator has the run
-- of the module. Anonymous callers get nothing anywhere.
--
-- Section 22 additionally requires the audit history to be immutable. The
-- policies allow inserting and reading it and nothing else, and a trigger
-- refuses UPDATE and DELETE outright so the rule holds even for a role that
-- bypasses policies.

-- Nothing on this module is reachable without signing in.
revoke all on public.promise_categories    from anon;
revoke all on public.promise_subcategories from anon;
revoke all on public.promises              from anon;
revoke all on public.promise_links         from anon;
revoke all on public.promise_escalations   from anon;
revoke all on public.promise_ledger        from anon;
revoke all on public.promise_rules         from anon;
revoke all on public.promise_ai_insights   from anon;
revoke all on public.promise_audit_logs    from anon;
revoke all on public.promise_settings      from anon;
revoke all on public.promise_health_events from anon;

grant select, insert, update, delete on public.promise_categories    to authenticated;
grant select, insert, update, delete on public.promise_subcategories to authenticated;
grant select, insert, update, delete on public.promises              to authenticated;
grant select, insert, update, delete on public.promise_links         to authenticated;
grant select, insert, update, delete on public.promise_escalations   to authenticated;
grant select, insert, update, delete on public.promise_ledger        to authenticated;
grant select, insert, update, delete on public.promise_rules         to authenticated;
grant select, insert, update, delete on public.promise_ai_insights   to authenticated;
grant select, insert                 on public.promise_audit_logs    to authenticated;
grant select, insert, update, delete on public.promise_settings      to authenticated;
grant select, insert                 on public.promise_health_events to authenticated;

alter table public.promise_categories    enable row level security;
alter table public.promise_subcategories enable row level security;
alter table public.promises              enable row level security;
alter table public.promise_links         enable row level security;
alter table public.promise_escalations   enable row level security;
alter table public.promise_ledger        enable row level security;
alter table public.promise_rules         enable row level security;
alter table public.promise_ai_insights   enable row level security;
alter table public.promise_audit_logs    enable row level security;
alter table public.promise_settings      enable row level security;
alter table public.promise_health_events enable row level security;

-- Is this promise mine to see? Used by every child table so the rule is
-- written once and cannot drift between them.
create or replace function public.pt_can_see_promise(p_promise_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.promises p
    where p.id = p_promise_id
      and (
        public.pt_is_operator()
        or public.pt_is_manager()
        or p.owner_user_id = auth.uid()
        or p.receiver_user_id = auth.uid()
        or p.created_by = auth.uid()
      )
  );
$$;

-- ---------------------------------------------------------------- promises --
drop policy if exists pt_promises_all on public.promises;
drop policy if exists promises_anon_denied on public.promises;
create policy promises_anon_denied on public.promises for all to anon using (false) with check (false);

drop policy if exists promises_read on public.promises;
create policy promises_read on public.promises
for select to authenticated
using (
  public.pt_is_operator()
  or public.pt_is_manager()
  or owner_user_id = auth.uid()
  or receiver_user_id = auth.uid()
  or created_by = auth.uid()
);

drop policy if exists promises_insert on public.promises;
create policy promises_insert on public.promises
for insert to authenticated
with check (public.pt_is_operator() or public.pt_is_manager() or created_by = auth.uid());

drop policy if exists promises_update on public.promises;
create policy promises_update on public.promises
for update to authenticated
using (
  public.pt_is_operator()
  or public.pt_is_manager()
  -- An owner may progress their own promise, but a locked one is closed to
  -- everybody except an operator (section 18).
  or (owner_user_id = auth.uid() and not is_locked)
)
with check (public.pt_is_operator() or public.pt_is_manager() or owner_user_id = auth.uid());

drop policy if exists promises_delete on public.promises;
create policy promises_delete on public.promises
for delete to authenticated
using (public.pt_is_operator());

-- ------------------------------------------------- categories and settings --
-- Everyone signed in needs to read the vocabulary to file a promise at all;
-- only operators may change it.
drop policy if exists pt_categories_all on public.promise_categories;
drop policy if exists promise_categories_read on public.promise_categories;
create policy promise_categories_read on public.promise_categories
for select to authenticated using (true);
drop policy if exists promise_categories_write on public.promise_categories;
create policy promise_categories_write on public.promise_categories
for all to authenticated using (public.pt_is_operator()) with check (public.pt_is_operator());

drop policy if exists pt_subcategories_all on public.promise_subcategories;
drop policy if exists promise_subcategories_read on public.promise_subcategories;
create policy promise_subcategories_read on public.promise_subcategories
for select to authenticated using (true);
drop policy if exists promise_subcategories_write on public.promise_subcategories;
create policy promise_subcategories_write on public.promise_subcategories
for all to authenticated using (public.pt_is_operator()) with check (public.pt_is_operator());

drop policy if exists pt_settings_all on public.promise_settings;
drop policy if exists promise_settings_read on public.promise_settings;
create policy promise_settings_read on public.promise_settings
for select to authenticated using (true);
drop policy if exists promise_settings_write on public.promise_settings;
create policy promise_settings_write on public.promise_settings
for all to authenticated using (public.pt_is_operator()) with check (public.pt_is_operator());

-- Rules decide money, so they are operator-only to change and readable by
-- anyone who needs to understand why they were fined.
drop policy if exists pt_rules_all on public.promise_rules;
drop policy if exists promise_rules_read on public.promise_rules;
create policy promise_rules_read on public.promise_rules
for select to authenticated using (true);
drop policy if exists promise_rules_write on public.promise_rules;
create policy promise_rules_write on public.promise_rules
for all to authenticated using (public.pt_is_operator()) with check (public.pt_is_operator());

-- ------------------------------------------------------------ child tables --
drop policy if exists promise_links_read on public.promise_links;
create policy promise_links_read on public.promise_links
for select to authenticated using (public.pt_can_see_promise(promise_id));
drop policy if exists promise_links_write on public.promise_links;
create policy promise_links_write on public.promise_links
for all to authenticated
using (public.pt_is_operator() or public.pt_is_manager())
with check (public.pt_is_operator() or public.pt_is_manager());

drop policy if exists promise_escalations_read on public.promise_escalations;
create policy promise_escalations_read on public.promise_escalations
for select to authenticated using (public.pt_can_see_promise(promise_id));
drop policy if exists promise_escalations_write on public.promise_escalations;
create policy promise_escalations_write on public.promise_escalations
for all to authenticated
using (public.pt_is_operator() or public.pt_is_manager())
with check (public.pt_is_operator() or public.pt_is_manager());

-- A person may read what they were fined or paid; only an operator may write it.
drop policy if exists promise_ledger_read on public.promise_ledger;
create policy promise_ledger_read on public.promise_ledger
for select to authenticated using (public.pt_can_see_promise(promise_id));
drop policy if exists promise_ledger_write on public.promise_ledger;
create policy promise_ledger_write on public.promise_ledger
for all to authenticated using (public.pt_is_operator()) with check (public.pt_is_operator());

drop policy if exists pt_insights_all on public.promise_ai_insights;
drop policy if exists promise_insights_read on public.promise_ai_insights;
create policy promise_insights_read on public.promise_ai_insights
for select to authenticated using (public.pt_can_see_promise(promise_id));
drop policy if exists promise_insights_write on public.promise_ai_insights;
create policy promise_insights_write on public.promise_ai_insights
for all to authenticated
using (public.pt_is_operator() or public.pt_is_manager())
with check (public.pt_is_operator() or public.pt_is_manager());

-- --------------------------------------------------------------- audit log --
drop policy if exists pt_logs_all on public.promise_audit_logs;
drop policy if exists promise_audit_read on public.promise_audit_logs;
create policy promise_audit_read on public.promise_audit_logs
for select to authenticated
using (
  public.pt_is_operator()
  or public.pt_is_manager()
  or (promise_id is not null and public.pt_can_see_promise(promise_id))
);

drop policy if exists promise_audit_insert on public.promise_audit_logs;
create policy promise_audit_insert on public.promise_audit_logs
for insert to authenticated with check (true);

-- No UPDATE policy and no DELETE policy exist, and this refuses both even for a
-- role that bypasses policies. Section 22: history is never silently rewritten.
create or replace function public.pt_audit_is_append_only()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'the promise audit log is append-only; % is not permitted', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists promise_audit_no_rewrite on public.promise_audit_logs;
create trigger promise_audit_no_rewrite
before update or delete on public.promise_audit_logs
for each row execute function public.pt_audit_is_append_only();

-- ------------------------------------------------------------ health events --
drop policy if exists pt_health_all on public.promise_health_events;
drop policy if exists promise_health_read on public.promise_health_events;
create policy promise_health_read on public.promise_health_events
for select to authenticated using (public.pt_is_operator() or public.pt_is_manager());
drop policy if exists promise_health_insert on public.promise_health_events;
create policy promise_health_insert on public.promise_health_events
for insert to authenticated with check (true);

-- ------------------------------------------------------------------ grants --
revoke all on function public.pt_is_operator()          from public, anon;
revoke all on function public.pt_is_manager()           from public, anon;
revoke all on function public.pt_can_see_promise(uuid)  from public, anon;
grant execute on function public.pt_is_operator()         to authenticated;
grant execute on function public.pt_is_manager()          to authenticated;
grant execute on function public.pt_can_see_promise(uuid) to authenticated;
