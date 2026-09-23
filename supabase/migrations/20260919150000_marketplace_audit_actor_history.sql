-- Marketplace audit log: keep the actor id as history, not as a live reference.
--
-- marketplace_audit_logs.actor_id referenced auth.users with ON DELETE SET NULL,
-- but the table is append-only (mm_audit_is_append_only refuses every UPDATE).
-- Deleting any account that had ever acted in the Marketplace Manager therefore
-- failed: the foreign key's SET NULL is an UPDATE, which the guard rejects, so
-- the auth delete returned 500. Nulling the actor would also have erased who
-- made the decision.
--
-- The audit row keeps the actor's id as a plain value. The log stays
-- append-only and still records who acted after that account is removed.

alter table public.marketplace_audit_logs
  drop constraint if exists marketplace_audit_logs_actor_id_fkey;

comment on column public.marketplace_audit_logs.actor_id is
  'auth.users id of the actor at the time of the action; kept after the account is deleted.';
