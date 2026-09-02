REVOKE ALL ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.block_message_mutation() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_conversation() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.is_participant(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_participant(uuid, uuid) TO authenticated;