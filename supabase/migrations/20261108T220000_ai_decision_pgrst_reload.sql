-- Refresh PostgREST after the AI decision and healing RPC changes.
NOTIFY pgrst, 'reload schema';
