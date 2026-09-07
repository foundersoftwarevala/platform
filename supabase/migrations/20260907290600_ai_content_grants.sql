-- 41/49. Close two functions that were left executable by anonymous callers.
--
-- Postgres grants EXECUTE to PUBLIC on a new function by default, and every
-- function in this module is SECURITY DEFINER, so a default grant is a hole
-- rather than a convenience. The audit that found this listed exactly two:
--
--   mm_ai_usage_record  — writes the usage counters. An anonymous caller could
--                         have inflated the figures the console reports, which
--                         is the one thing a usage table must not allow.
--   mm_ai_context_hash  — reads a product's fact fingerprint. Harmless in
--                         itself, but it runs as the owner and nothing outside
--                         the staleness trigger has any business calling it.
--
-- Everything else in the module was revoked explicitly when it was created.
-- The trigger and the module's own functions are unaffected: a SECURITY DEFINER
-- function calls them as the owner, which needs no grant.

revoke all on function public.mm_ai_usage_record(text, text, text, jsonb) from public, anon;
grant execute on function public.mm_ai_usage_record(text, text, text, jsonb) to service_role;

revoke all on function public.mm_ai_context_hash(uuid) from public, anon;
grant execute on function public.mm_ai_context_hash(uuid) to service_role;

-- Restated so a future migration that replaces a function cannot silently
-- reopen the default grant without this failing loudly in the same run.
do $$
declare v text;
begin
  select coalesce(string_agg(p.proname, ', '), '') into v
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname like 'mm\_ai%'
     and has_function_privilege('anon', p.oid, 'execute');
  if v <> '' then
    raise exception 'These AI content functions are still callable anonymously: %', v;
  end if;
end;
$$;
