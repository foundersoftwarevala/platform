-- The application server's Chat database path (owner-approved, option A).
--
-- The server reaches sv_platform as sv_app, which holds no privilege on any
-- Chat table or function. The server already holds the service-role key, which
-- PostgREST turns into service_role through authenticator. sv_app gets the same
-- SET ROLE path and nothing else: no inherited privileges, so outside a
-- transaction that explicitly sets the role it can do exactly what it could
-- before. The Chat database layer (src/lib/chat/manager-db.server.ts) sets the
-- role per transaction; authorization stays in the server functions and in the
-- SECURITY DEFINER functions, against auth.uid() from the verified token.
--
-- Reversal: revoke service_role from sv_app;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'sv_app')
     and exists (select 1 from pg_roles where rolname = 'service_role')
     and not exists (
       select 1 from pg_auth_members m
        where m.member = (select oid from pg_roles where rolname = 'sv_app')
          and m.roleid = (select oid from pg_roles where rolname = 'service_role')
     ) then
    execute 'grant service_role to sv_app with inherit false, set true';
  end if;
end $$;
