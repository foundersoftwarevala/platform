import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";

export const Route = createFileRoute("/api/internal/db-health")({
  server: {
    handlers: {
      GET: async (request) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        const url = process.env["SUPABASE_URL"];
        const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
        const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
        
        const hasUrl = !!url;
        const hasKey = !!serviceRoleKey;
        const hasPublishableKey = !!publishableKey;

        // Detailed diagnostics
        const diagnostics = {
          SUPABASE_URL: {
            available: hasUrl,
            value: hasUrl ? url : "not set",
          },
          SUPABASE_PUBLISHABLE_KEY: {
            available: hasPublishableKey,
            value: hasPublishableKey ? `${publishableKey.substring(0, 10)}...` : "not set",
          },
          SUPABASE_SERVICE_ROLE_KEY: {
            available: hasKey,
            hint: hasKey ? "Present in process.env" : "Missing - Add to .env.local or set as system env var",
          },
          environment_mode: process.env.NODE_ENV || "development",
        };

        if (!hasUrl || !hasKey) {
          console.warn("[db-health] Missing credentials:", { hasUrl, hasKey });
          return Response.json({
            connected: false,
            tableAccessible: false,
            rowCount: 0,
            diagnostics,
            message: "Service role key required for database access",
          });
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data, error, count } = await supabaseAdmin
            .from("resellers")
            .select("id", { count: "exact" })
            .limit(1);

          if (error) {
            console.error("[db-health] Database error:", error);
            return Response.json({
              connected: true,
              tableAccessible: false,
              rowCount: 0,
              diagnostics,
              error: error.message,
              code: (error as any).code,
            });
          }

          console.log("[db-health] ✓ Database connection successful");
          return Response.json({
            connected: true,
            tableAccessible: true,
            rowCount: typeof count === "number" ? count : Array.isArray(data) ? data.length : 0,
            diagnostics,
            message: "✓ Database connection successful - ready for E2E workflow",
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error("[db-health] Connection failed:", message);
          return Response.json({
            connected: false,
            tableAccessible: false,
            rowCount: 0,
            diagnostics,
            error: message,
            troubleshooting: [
              "1. Check that SUPABASE_SERVICE_ROLE_KEY is set",
              "2. Restart dev server: npm run dev",
              "3. Verify key is valid and hasn't expired",
            ],
          });
        }
      },
    },
  },
});
