-- Signup metadata is user-controlled, so it must never assign an application role.
-- The bootstrap admin is granted only to the first account in an otherwise empty
-- auth system. The advisory lock serializes simultaneous first-signup transactions.

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_handle text;
begin
  base_handle := coalesce(
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'handle',
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'user-' || substr(new.id::text, 1, 8)
  );

  insert into public.profiles
    (id, email, full_name, username, phone, handle, display_name, job_title)
  values
    (new.id, new.email, new.raw_user_meta_data ->> 'full_name', base_handle, new.phone,
     base_handle, coalesce(new.raw_user_meta_data ->> 'full_name', base_handle),
     new.raw_user_meta_data ->> 'job_title')
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'customer'::public.app_role)
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.bootstrap_first_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('platform.bootstrap_first_admin', 0));

  if not exists (select 1 from auth.users u where u.id <> new.id)
     and not exists (select 1 from public.user_roles ur where ur.user_id <> new.id) then
    insert into public.user_roles (user_id, role)
    values (new.id, 'admin'::public.app_role)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.bootstrap_first_admin() from public, anon, authenticated;

drop policy if exists "Admins manage all roles" on public.user_roles;
drop policy if exists "Super admins manage all roles" on public.user_roles;
create policy "Super admins manage all roles"
  on public.user_roles
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'super_admin'::public.app_role));

commit;
