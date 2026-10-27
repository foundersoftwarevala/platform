-- Keep element creation on the authenticated manager caller's permissions.
revoke all on function public.sf_floating_create(text, text, text, text, text)
  from public, anon, service_role;
grant execute on function public.sf_floating_create(text, text, text, text, text)
  to authenticated;

notify pgrst, 'reload schema';
