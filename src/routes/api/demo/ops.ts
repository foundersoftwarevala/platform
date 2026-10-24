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
 *   GET /api/demo/ops?days=30&page=0&page_size=50
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
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json(
            {
              error: "The database is not configured on this server." /* i18n-ignore: API error */,
            },
            { status: 503 },
          );
        }

        const params = new URL(request.url).searchParams;
        const days = Number(params.get("days") ?? 30);
        const requestedPage = Number(params.get("page") ?? 0);
        const requestedPageSize = Number(params.get("page_size") ?? 50);
        const page = Number.isSafeInteger(requestedPage)
          ? Math.max(0, Math.min(1_000_000, requestedPage))
          : 0;
        const pageSize = Number.isSafeInteger(requestedPageSize)
          ? Math.max(1, Math.min(50, requestedPageSize))
          : 50;
        let response: Response;
        try {
          response = await fetch(`${base}/rest/v1/rpc/mm_demo_ops_page`, {
            method: "POST",
            headers: {
              apikey: key,
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              p_days: Number.isFinite(days) ? days : 30,
              p_page: page,
              p_page_size: pageSize,
            }),
            signal: AbortSignal.timeout(10_000),
          });
        } catch (error) {
          const timedOut = error instanceof Error && error.name === "TimeoutError";
          return Response.json(
            {
              error: timedOut
                ? "The overview request timed out."
                : "The overview could not be read.",
            },
            { status: timedOut ? 504 : 502 },
          );
        }

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
