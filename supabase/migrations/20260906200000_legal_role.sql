-- A legal role, so Legal Manager can be granted without handing somebody
-- full Control Panel rights. Additive: the enum gains a value and nothing
-- is removed or renamed.
alter type public.app_role add value if not exists 'legal';
