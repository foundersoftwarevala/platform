-- profiles: a signed-in account reads its own profile; staff read all.
--
-- "profiles_select_authenticated" (SELECT, true) let every signed-in account -
-- and anyone can sign up - read every user's e-mail address and phone number.
-- What the application reads: the user's own profile (select *, eq id), and
-- staff screens. The chat code asks for columns this table does not have
-- (handle, display_name, avatar_path, ...) and already fails, so nothing that
-- works today depends on reading other people's profiles.
--
-- Staff: the CRM/support/operator roles of public.is_crm_staff().

alter policy profiles_select_authenticated on public.profiles
  using (id = auth.uid() or public.is_crm_staff(auth.uid()));
