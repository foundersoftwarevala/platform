-- A notification belongs to a user who exists.
--
-- user_notifications.user_id had no foreign key, and 35 of 71 rows point at
-- ten accounts that no longer exist. All 35 were written on 2026-09-19 by an
-- end-to-end run (applications submitted/rejected, reseller active/terminated,
-- membership orders) whose test accounts were later removed; none of those ten
-- ids has a profile. They are reported, not deleted here.
--
-- The key is added NOT VALID: every row inserted, or whose user_id changes,
-- from now on must name a real user, while the 35 existing rows are left as
-- they are. ON DELETE CASCADE because a notification is the user's own
-- personal data and goes with the account. Once the 35 test rows are removed
-- (a separate, approved step), `alter table ... validate constraint` makes the
-- key cover every row.

begin;

alter table public.user_notifications
  add constraint user_notifications_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade
  not valid;

commit;
