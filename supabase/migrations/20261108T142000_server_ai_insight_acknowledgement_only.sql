-- Keep AI recommendations advisory: authenticated users may only acknowledge
-- or dismiss an existing insight. Insight creation remains server-side.
REVOKE ALL PRIVILEGES ON TABLE public.server_ai_insights
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.server_ai_insights TO authenticated;
GRANT UPDATE (status) ON TABLE public.server_ai_insights TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.server_ai_insights TO service_role;

DROP POLICY IF EXISTS server_ai_insights_write ON public.server_ai_insights;
DROP POLICY IF EXISTS server_ai_insights_acknowledgement_only ON public.server_ai_insights;

CREATE POLICY server_ai_insights_acknowledgement_only
  ON public.server_ai_insights
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.server_instances AS server
      WHERE server.id = server_ai_insights.server_id
        AND (server.owner_id = auth.uid() OR public.server_is_operator())
    )
    OR (
      server_id IS NULL
      AND public.server_is_operator()
    )
  )
  WITH CHECK (
    (
      EXISTS (
        SELECT 1
        FROM public.server_instances AS server
        WHERE server.id = server_ai_insights.server_id
          AND (server.owner_id = auth.uid() OR public.server_is_operator())
      )
      OR (
        server_id IS NULL
        AND public.server_is_operator()
      )
    )
    AND status IN ('acknowledged', 'dismissed')
  );
