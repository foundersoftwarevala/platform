-- The Marketplace Manager revenue graph always failed.
--
-- marketplaceRevenueSeries (src/lib/marketplace-manager/homepage-rows.functions.ts)
-- calls mm_revenue_series as the signed-in user, because the function decides
-- who may see revenue with mm_is_operator(), which reads auth.uid(). But
-- 20261009T090000 revoked EXECUTE from authenticated and granted it only to
-- service_role - and as the service role auth.uid() is null, so the gate can
-- never pass. Every call was refused before the function ran, and the graph
-- showed "The revenue series could not be read."
--
-- The function is SECURITY DEFINER and returns {ok:false, reason:'not_permitted'}
-- to anyone who is not a marketplace operator, so it is safe to let signed-in
-- users call it; anon stays revoked.

GRANT EXECUTE ON FUNCTION public.mm_revenue_series(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.mm_revenue_series(text) FROM anon, public;
