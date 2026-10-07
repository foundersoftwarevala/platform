-- Connect Chat: what a new account gets when it signs up.
--
-- Found by tracing signup -> profile -> role -> chat permission:
--
--   * handle_new_user (the live version, built from 20260809100007) creates a
--     profile row and nothing else. It does not give the account a role, and it
--     does not fill handle / display_name, which the chat reads. A person who
--     signs up therefore has no role, so has_permission(..., 'message.send') is
--     false and they cannot send a single message. 20260905010356 repaired the
--     accounts that existed that day; accounts created since were not repaired.
--   * The other handle_new_user (20260902035917), which does assign a role, takes
--     it from raw_user_meta_data->>'role', a value the person signing up writes
--     themselves. This migration never reads it: the role is always 'customer'.
--
-- What is added is a separate AFTER INSERT trigger on auth.users, named so it
-- runs after on_auth_user_created (the profile) and
-- on_auth_user_created_bootstrap_admin (the first admin keeps the admin role):
--
--   * chat fields on the profile, collision-safe, only where empty;
--   * the 'customer' role, only for an account that has no role at all.
--
-- handle_new_user itself is not touched. The trigger can never fail a sign-up:
-- any error is a warning and the sign-up proceeds. 'customer' holds only the
-- participant-level chat permissions (message.send/react/reply/bookmark,
-- attachment.*, conversation.create, mention.use, search.messages); it holds no
-- chat.manage / chat.assign / chat.moderate / conversation.manage, which are
-- granted to staff roles only.
--
-- IMPORTANT (found on the VPS): sign-in and sign-up are served by the hosted auth
-- project (nginx sends /auth/v1 there), so an accounts INSERT trigger on this
-- database fires only for accounts created here. The server therefore also calls
-- chat_ensure_account(uid) when a person opens Chat; it does the same work for the
-- caller only, from the verified token, and never trusts a client-supplied id.
--
-- The one-time backfill at the end does for accounts created since 20260905 what
-- that migration did for the ones before.

begin;

create or replace function public.chat_handle_for(p_id uuid, p_wanted text)
returns text
language plpgsql stable
set search_path = public
as $$
declare
  v_base text := coalesce(nullif(btrim(p_wanted), ''), 'user-' || substr(p_id::text, 1, 8));
  v_try text := v_base;
begin
  if exists (select 1 from public.profiles where handle = v_try and id <> p_id) then
    v_try := v_base || '-' || substr(p_id::text, 1, 6);
  end if;
  if exists (select 1 from public.profiles where handle = v_try and id <> p_id) then
    v_try := 'user-' || replace(p_id::text, '-', '');
  end if;
  return v_try;
end;
$$;
revoke all on function public.chat_handle_for(uuid, text) from public, anon, authenticated;

create or replace function public.chat_provision_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  begin
    update public.profiles p
       set handle = coalesce(p.handle, public.chat_handle_for(p.id, p.username)),
           display_name = coalesce(p.display_name, p.full_name, p.username, 'Member')
     where p.id = new.id
       and (p.handle is null or p.display_name is null);

    if not exists (select 1 from public.user_roles where user_id = new.id) then
      insert into public.user_roles (user_id, role) values (new.id, 'customer')
      on conflict do nothing;
    end if;
  exception when others then
    raise warning 'chat provisioning for % skipped: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;
revoke all on function public.chat_provision_new_user() from public, anon, authenticated;

drop trigger if exists zz_chat_provision_user on auth.users;
create trigger zz_chat_provision_user after insert on auth.users
  for each row execute function public.chat_provision_new_user();

-- Backfill: profiles without chat fields, accounts without any role.
update public.profiles p
   set handle = coalesce(p.handle, public.chat_handle_for(p.id, p.username)),
       display_name = coalesce(p.display_name, p.full_name, p.username, 'Member')
 where p.handle is null or p.display_name is null;

insert into public.user_roles (user_id, role)
select u.id, 'customer'::public.app_role
  from auth.users u
 where not exists (select 1 from public.user_roles ur where ur.user_id = u.id)
on conflict do nothing;

-- Same provisioning for ONE account, called by the server (service role) after it
-- has verified the caller's token. Fails (foreign key) if the account does not exist
-- in this database; the caller reports that instead of pretending it worked.
create or replace function public.chat_ensure_account(p_user uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_role boolean := false;
begin
  if p_user is null then
    raise exception 'user required';
  end if;
  insert into public.profiles (id, email)
    select u.id, u.email from auth.users u where u.id = p_user
  on conflict (id) do nothing;
  update public.profiles p
     set handle = coalesce(p.handle, public.chat_handle_for(p.id, p.username)),
         display_name = coalesce(p.display_name, p.full_name, p.username, 'Member')
   where p.id = p_user and (p.handle is null or p.display_name is null);
  if not exists (select 1 from public.user_roles where user_id = p_user) then
    insert into public.user_roles (user_id, role) values (p_user, 'customer') on conflict do nothing;
    v_role := true;
  end if;
  return jsonb_build_object('role_granted', v_role);
end;
$$;
revoke all on function public.chat_ensure_account(uuid) from public, anon, authenticated;
grant execute on function public.chat_ensure_account(uuid) to service_role;

commit;
