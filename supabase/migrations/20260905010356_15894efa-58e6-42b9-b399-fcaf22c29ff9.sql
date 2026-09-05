INSERT INTO public.profiles (id, email, username, handle, display_name)
SELECT u.id,
       u.email,
       COALESCE(NULLIF(split_part(COALESCE(u.email, ''), '@', 1), ''), 'user-' || substr(u.id::text, 1, 8)),
       COALESCE(NULLIF(split_part(COALESCE(u.email, ''), '@', 1), ''), 'user-' || substr(u.id::text, 1, 8)),
       COALESCE(NULLIF(split_part(COALESCE(u.email, ''), '@', 1), ''), 'user-' || substr(u.id::text, 1, 8))
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'customer'::public.app_role
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE ur.user_id IS NULL
ON CONFLICT DO NOTHING;