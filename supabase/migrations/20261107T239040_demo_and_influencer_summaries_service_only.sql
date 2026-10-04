-- Demo health/analytics and the influencer programme summary: service role only.
--
-- All four are SECURITY DEFINER and none checks its caller:
--
--   mm_demo_health(integer)           every demo's real address (`url`), status
--                                     and uptime - executable by authenticated
--   mm_demo_click_analytics(integer)  demo opens by region, device and demo
--                                     - executable by authenticated
--   mm_demo_uptime_series(integer)    uptime and response-time series
--                                     - executable by anon and authenticated
--   influencer_programme_summary()    programme earnings, payouts and commission
--                                     totals - executable by anon and authenticated
--
-- So any signed-in account (and, for the last two, anyone holding the
-- publishable key) could POST /rest/v1/rpc/<name> and read them. The demo
-- address is the one thing the demo gateway exists to keep out of a browser.
--
-- The server functions in front of them now check the caller in code
-- (requireOperator, with the demo consoles' `developer` role for the demo ones)
-- and call them with the service key:
--   src/lib/marketplace-demo.functions.ts   listDemoHealth, getDemoUptimeSeries,
--                                           getDemoClickAnalytics
--   src/lib/influencer/programme.functions.ts  getInfluencerProgramme
--   src/lib/creator/repository.server.ts       influencer analytics tiles
-- Nothing else in the codebase calls these functions, so closing them to
-- anon and authenticated changes no screen. Bodies are unchanged.

REVOKE EXECUTE ON FUNCTION public.mm_demo_health(integer) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mm_demo_click_analytics(integer) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mm_demo_uptime_series(integer) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.influencer_programme_summary() FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.mm_demo_health(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.mm_demo_click_analytics(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.mm_demo_uptime_series(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.influencer_programme_summary() TO service_role;
