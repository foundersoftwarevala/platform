import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/finance/reseller-membership")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
        const authorization = request.headers.get("authorization");
        if (!url || !key || !authorization) return Response.json({ error: "Authenticated Supabase session required" }, { status: 401 });
        try {
          const body = await request.json() as { action?: string; orderId?: string; status?: string; providerReference?: string };
          if (body.action !== "verify") return Response.json({ error: "Unsupported action" }, { status: 400 });
          const response = await fetch(`${url}/rest/v1/rpc/verify_reseller_membership_payment`, {
            method: "POST",
            headers: { apikey: key, Authorization: authorization, "Content-Type": "application/json" },
            body: JSON.stringify({ p_order_id: body.orderId, p_status: body.status, p_provider_reference: body.providerReference ?? null }),
          });
          const result = await response.text();
          return new Response(result, { status: response.status, headers: { "Content-Type": "application/json" } });
        } catch (error) {
          return Response.json({ error: error instanceof Error ? error.message : "Verification failed" }, { status: 500 });
        }
      },
    },
  },
});
