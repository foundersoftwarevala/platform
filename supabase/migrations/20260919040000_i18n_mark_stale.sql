-- Keyed messages (src/lib/i18n/messages) are translated in their module's
-- context. When a message's English changes, the translation of the old
-- English is no longer looked up (memory is keyed by the source hash), but it
-- would still be listed for review and in coverage. This marks such rows
-- `stale` ("source changed, not served").
--
-- Only unreviewed rows are touched: a verified or rejected row is a person's
-- decision and stays as it is. Called by the application's catalogue sync
-- (syncMessageCatalogue in src/lib/i18n/jobs.server.ts) with the source hashes
-- the catalogue currently has for one context.

create or replace function public.i18n_mark_stale(
  p_namespace text,
  p_context text,
  p_current_hashes text[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_context is null or length(p_context) = 0 then
    raise exception 'p_context is required: rows without a context are page text, not keyed messages';
  end if;
  update public.marketplace_translations
     set status = 'stale'
   where namespace = p_namespace
     and context = p_context
     and status in ('machine', 'needs_review')
     and not (source_hash = any (coalesce(p_current_hashes, '{}')));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.i18n_mark_stale(text, text, text[]) from public, anon, authenticated;
grant execute on function public.i18n_mark_stale(text, text, text[]) to service_role;
