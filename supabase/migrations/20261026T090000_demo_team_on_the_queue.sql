-- The Demo Operations team is on the queue now, so the roster stops saying it
-- is not.
--
-- Three of the four rows still carried a blocked_reason that ended "Not yet
-- driven from the queue" or "The queued half needs a worker process". All four
-- are now cron-driven through fa_jobs, each records an ai_agent_runs row, and
-- the reasons are replaced with what was actually proven rather than removed
-- silently.
--
-- demo-intake keeps the honest remainder. It has no enqueue stage on a timer,
-- because there is nothing periodic for one to notice: a demo.intake job is
-- created when somebody submits an address, and the worker drains the queue on
-- every cron pass.

UPDATE public.ai_agents
   SET blocked_reason =
         'On the queue. The application takes the address in through '
      || 'POST /api/demo/process {action:"intake"}, which reuses demoIdentity '
      || 'and findByIdentity rather than repeating them, and leaves the row at '
      || 'unprocessed for the scanner. Proven: the same demo submitted with a '
      || 'www. prefix, a trailing slash and a utm_ tail came back "already '
      || 'known" without creating a row, and 169.254.169.254 was refused by '
      || 'the existing SSRF guard and dead-lettered on the first attempt. '
      || 'Nothing enqueues on a timer, because submission is the trigger.'
 WHERE agent_key = 'demo-intake';

UPDATE public.ai_agents
   SET blocked_reason =
         'On the queue, driven by cron every fifteen minutes. It decides when '
      || 'a scan happens; investigateDemo still decides what a scan is. It '
      || 'stops at review and does not activate, because publishing a demo to '
      || 'the storefront is an operator''s decision.'
 WHERE agent_key = 'demo-scanner';

UPDATE public.ai_agents
   SET blocked_reason =
         'On the queue, driven by cron every fifteen minutes, verifying that '
      || 'each live demo is still reachable from the marketplace by the route '
      || 'a visitor takes.'
 WHERE agent_key = 'demo-sync';
