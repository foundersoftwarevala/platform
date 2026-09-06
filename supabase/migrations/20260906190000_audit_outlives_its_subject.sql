-- An audit row has to outlive the thing it describes.
--
-- tm_activity.actor_id carried a foreign key into tm_members with ON DELETE SET
-- NULL. Once the task audit log was genuinely append-only, that combination
-- stopped meaning "forget who did it" and started meaning "a member can never
-- be deleted": removing one made Postgres try to UPDATE the audit log, and the
-- trigger refused. Nobody would have found that until the first person left the
-- team.
--
-- The same trap was already fixed on promise_audit_logs for the same reason.
-- This is the last table carrying it. The reference survives as a value:
-- actor_id and actor_name both stay on the row and both stay readable after the
-- member is gone, which is how an audit trail is supposed to refer to people.
alter table public.tm_activity
  drop constraint if exists tm_activity_actor_id_fkey;
