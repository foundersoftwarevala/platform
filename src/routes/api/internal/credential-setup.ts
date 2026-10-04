import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { resolve } from "path";

export const Route = createFileRoute("/api/internal/credential-setup")({
  server: {
    handlers: {
      POST: async (req) => {
        const gate = await requireInternalOperator(req);
        if (!gate.ok) return gate.response;
        // Replacing the server's database credential is not a Control Panel
        // action: a signed-in developer account must not be able to repoint the
        // service key. Only the server's own INTERNAL_API_TOKEN may.
        if (gate.via !== "internal token") {
          return Response.json(
            // i18n-ignore: an internal operator API error; this API answers in English.
            { error: "This endpoint accepts the internal token only." },
            { status: 403 },
          );
        }

        try {
          const payload = await req.json();
          const { serviceRoleKey } = payload;

          if (!serviceRoleKey || typeof serviceRoleKey !== "string") {
            return Response.json({ error: "Invalid credential provided" }, { status: 400 });
          }

          // A JWT is base64url segments joined by dots. Anything else - a
          // newline above all - would be written verbatim into .env.local and
          // could add or override other settings there.
          if (!/^[A-Za-z0-9._-]+$/.test(serviceRoleKey)) {
            return Response.json(
              // i18n-ignore: an internal operator API error; this API answers in English.
              { error: "Invalid credential provided" },
              { status: 400 },
            );
          }

          if (serviceRoleKey.length < 50) {
            return Response.json(
              { error: "Credential appears too short (< 50 chars)" },
              { status: 400 },
            );
          }

          // Set in process.env for this session
          process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;

          // Also write to .env.local for persistence
          const envLocalPath = resolve(process.cwd(), ".env.local");
          if (existsSync(envLocalPath)) {
            let content = readFileSync(envLocalPath, "utf-8");
            content = content.replace(
              /SUPABASE_SERVICE_ROLE_KEY=.*/,
              () => `SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`,
            );
            writeFileSync(envLocalPath, content, "utf-8");
          }

          // Test the connection
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { data, error, count } = await supabaseAdmin
              .from("resellers")
              .select("id", { count: "exact" })
              .limit(1);

            if (error) {
              return Response.json(
                {
                  success: false,
                  message: "Credential set but database connection failed",
                  error: error.message,
                },
                { status: 200 },
              );
            }

            return Response.json({
              success: true,
              message: "✓ Credential loaded and database connection verified",
              rowCount: count ?? 0,
              ready: true,
            });
          } catch (testError) {
            return Response.json({
              success: false,
              message: "Credential set to .env.local but connection test failed",
              error: testError instanceof Error ? testError.message : String(testError),
              note: "Dev server may need restart to use new credential",
            });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return Response.json({ error: message }, { status: 500 });
        }
      },

      GET: async (request) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        return Response.json({
          message: "Credential Setup Endpoint",
          method: "POST to this endpoint with { serviceRoleKey: '...' }",
          example: {
            url: "POST /api/internal/credential-setup",
            body: {
              serviceRoleKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            },
          },
        });
      },
    },
  },
});
