-- demo-sync is built now, so its row stops saying it is not.
--
-- Its registry entry read "Not built. The relationship it would synchronise is
-- already canonical ... so what is missing is the revalidation and the
-- after-the-fact check, not the connection." That was accurate and is no
-- longer true: mm_demo_sync_check settles the database half and
-- scripts/demo_sync.py settles the HTTP half, and the pair ran through the
-- queue against the real demo — enqueued, refused a duplicate, claimed,
-- verified and completed, with verified: true and /demo/routemasterpt in the
-- job's result.
--
-- The reason the row keeps a blocked_reason at all is the honest remainder:
-- nothing schedules it yet. It runs when somebody runs it.
--
-- demo-health loses its blocked_reason entirely, because the thing that was
-- wrong with it has been fixed. It was writing to the wrong database — the
-- scheduled jobs read an environment file the application had stopped using —
-- and now the cron path writes to the VPS, proven by the row count moving from
-- 5,723 to 5,726 while the hosted count stayed at 5,937.

UPDATE public.ai_agents
   SET blocked_reason =
         'Built and proven end to end: enqueued, duplicate refused, claimed, '
      || 'verified and completed against the live demo. Nothing schedules it '
      || 'yet — it runs when somebody runs it.'
 WHERE agent_key = 'demo-sync';

UPDATE public.ai_agents
   SET blocked_reason = NULL
 WHERE agent_key = 'demo-health';

UPDATE public.ai_agents
   SET blocked_reason =
         'Implemented and proven: investigateDemo ran end to end on the live '
      || 'demo and identified RouteMasterPT at confidence 0.9 with nothing '
      || 'dropped as unfounded. Not yet driven from the queue.'
 WHERE agent_key = 'demo-scanner';

UPDATE public.ai_agents
   SET blocked_reason =
         'The canonical-identity half is live and proven: the same demo '
      || 'submitted with a www. prefix and a utm_ tail attached to the '
      || 'existing row instead of making a second one. The queued half needs a '
      || 'worker process; fa_enqueue now answers from the cron environment.'
 WHERE agent_key = 'demo-intake';
