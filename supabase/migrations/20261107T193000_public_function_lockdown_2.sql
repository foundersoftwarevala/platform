-- Second sweep of database functions anyone on the internet could call.
--
-- A scan for SECURITY DEFINER functions that anon can execute, that write, and
-- that check no caller found these still open (the first sweep was
-- 20261107T120000):
--   founder_purge_check_decision / founder_purge_check_learning
--       delete Founder decision/learning rows matching a marker and briefly
--       disable an immutability trigger on the history. Their only callers are
--       scripts/ops/founder-decision-check.mjs and founder-brain-check.mjs,
--       which use the service-role key - the same as founder_purge_check_healing
--       already locked in the first sweep. -> service_role only.
--   log_safe_assist_ai_event / verify_safe_assist_connection
--       write to any Safe Assist session whose id is known. No route renders
--       the Safe Assist screens today; their hooks call these as a signed-in
--       user. -> anonymous access removed, signed-in access kept.
-- Left public by design, after reading each body: QR and short-link scan
-- tracking (mm_qr_scan, product_qr_register_scan, mm_short_link_resolve), the
-- demo sandbox heartbeat (mm_sandbox_activity), the storefront FAQ read that
-- publishes due scheduled FAQs (sf_faqs), and derived-score refreshes
-- (mm_product_rating_refresh, mm_submission_risk_refresh). The two finance
-- functions the scan listed check marketplace_is_finance() themselves.

begin;

revoke all on function public.founder_purge_check_decision(text) from public, anon, authenticated;
revoke all on function public.founder_purge_check_learning(text) from public, anon, authenticated;
grant execute on function public.founder_purge_check_decision(text) to service_role;
grant execute on function public.founder_purge_check_learning(text) to service_role;

revoke all on function public.log_safe_assist_ai_event(uuid, character varying, character varying, jsonb, character varying, boolean) from public, anon;
revoke all on function public.verify_safe_assist_connection(uuid, character varying, character varying, boolean) from public, anon;
grant execute on function public.log_safe_assist_ai_event(uuid, character varying, character varying, jsonb, character varying, boolean) to authenticated, service_role;
grant execute on function public.verify_safe_assist_connection(uuid, character varying, character varying, boolean) to authenticated, service_role;

commit;
