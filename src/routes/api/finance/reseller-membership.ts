import { createFileRoute } from "@tanstack/react-router";
import { bearerToken, userFromBearerToken } from "@/lib/auth/bearer-user.server";

const FINANCE_ROLES = new Set(["admin", "boss", "finance"]);

export const Route = createFileRoute("/api/finance/reseller-membership")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = process.env.SUPABASE_URL?.trim();
        const key =
          process.env.SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim();
        const authorization = request.headers.get("authorization");
        const token = bearerToken(authorization);
        if (!url || !key) {
          return Response.json(
            { error: "Finance verification is not configured" },
            { status: 503 },
          );
        }
        if (!authorization || !token) {
          return Response.json(
            { error: "Authenticated Supabase session required" },
            { status: 401 },
          );
        }

        try {
          const caller = await userFromBearerToken(token);
          if (!caller) {
            return Response.json(
              { error: "Authenticated Supabase session required" },
              { status: 401 },
            );
          }

          const rolesResponse = await fetch(
            `${url}/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(caller.id)}`,
            { headers: { apikey: key, Authorization: authorization } },
          );
          if (!rolesResponse.ok) {
            console.error("[reseller membership] role lookup failed", rolesResponse.status);
            return Response.json({ error: "Could not verify finance access" }, { status: 503 });
          }
          const roles: unknown = await rolesResponse.json();
          if (!Array.isArray(roles)) {
            console.error("[reseller membership] role lookup returned invalid data");
            return Response.json({ error: "Could not verify finance access" }, { status: 503 });
          }
          const hasFinanceAccess = roles.some(
            (row: { role?: unknown }) =>
              typeof row?.role === "string" && FINANCE_ROLES.has(row.role.trim().toLowerCase()),
          );
          if (!hasFinanceAccess) {
            return Response.json({ error: "Finance access required" }, { status: 403 });
          }

          const body = (await request.json()) as {
            action?: string;
            orderId?: string;
            status?: string;
            providerReference?: string;
          };
          if (body.action !== "verify")
            return Response.json({ error: "Unsupported action" }, { status: 400 });
          const response = await fetch(`${url}/rest/v1/rpc/verify_reseller_membership_payment`, {
            method: "POST",
            headers: {
              apikey: key,
              Authorization: authorization,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              p_order_id: body.orderId,
              p_status: body.status,
              p_provider_reference: body.providerReference ?? null,
            }),
          });
          const result = await response.text();
          return new Response(result, {
            status: response.status,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Verification failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
