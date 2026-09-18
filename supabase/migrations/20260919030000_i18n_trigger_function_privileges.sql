-- Language system: trigger functions are not callable by clients.
--
-- i18n_translation_memory_guard and i18n_touch_updated_at only run as
-- triggers (on marketplace_translations, i18n_languages, i18n_glossary_terms,
-- i18n_translation_jobs). PostgreSQL checks EXECUTE on a trigger function when
-- the trigger is created, not when it fires, so taking the default grant away
-- from client roles changes nothing for the triggers and leaves nothing
-- callable that no client needs.

revoke execute on function public.i18n_translation_memory_guard() from public, anon, authenticated;
revoke execute on function public.i18n_touch_updated_at() from public, anon, authenticated;
