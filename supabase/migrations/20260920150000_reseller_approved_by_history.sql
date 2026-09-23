-- Keep who approved a reseller, and let their account be deleted.
--
-- resellers.approved_by referenced auth.users with ON DELETE SET NULL. Once a
-- reseller record is terminated, its history is frozen (see
-- reseller_terminated_is_final), so deleting the staff account that had
-- approved that reseller failed: the foreign key's SET NULL is exactly the
-- change the freeze refuses. Nulling it would also erase who approved.
--
-- The approver's id stays on the row as a plain value, as the marketplace
-- audit log already does for its actor. resellers.user_id keeps its
-- ON DELETE SET NULL: the link to a deleted account is cleared, and the freeze
-- allows that one change.

alter table public.resellers
  drop constraint if exists resellers_approved_by_fkey;

comment on column public.resellers.approved_by is
  'auth.users id of the operator who approved this reseller; kept after that account is deleted.';
