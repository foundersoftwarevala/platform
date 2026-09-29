import { createFileRoute } from "@tanstack/react-router";

import { requireInternalOperator } from "@/lib/auth/internal-guard";

/**
 * The Demo Operations Center's overview, read on the server.
 *
 * The hook called mm_demo_ops through the browser Supabase client, which is
 * built against the hosted project - where that function does not exist. So the
 * call failed and every panel showed its empty state: "nothing is waiting",
 * "no demo has a product". Indistinguishable, on screen, from a quiet estate.
 *
 * Read here instead, against the VPS, which is where the demos are.
 *
 *   GET /api/demo/ops?days=30
 */
export const Route = createFileRoute("/api/demo/ops")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        const base = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
        if (!base || !key) {
          return Response.json({ error: "The database is not configured on this server." }, { status: 503 });
        }

        const days = Number(new URL(request.url).searchParams.get("days") ?? 30);
        const response = await fetch(`${base}/rest/v1/rpc/mm_demo_ops`, {
          method: "POST",
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ p_days: Number.isFinite(days) ? days : 30 }),
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          return Response.json(
            { error: `The overview could not be read: ${response.status} ${detail.slice(0, 160)}` },
            { status: 502 },
          );
        }
        return Response.json(await response.json());
      },
    },
  },
});
