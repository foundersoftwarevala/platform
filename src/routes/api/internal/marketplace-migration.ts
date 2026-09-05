import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";

const FOUNDATION_TABLES = [
  "marketplace_categories",
  "marketplace_products",
  "marketplace_vendors",
  "marketplace_homepage_sections",
  "product_demo_urls",
  "demo_url_audit_log",
  "home_hero_slides",
  "feature_strip_items",
] as const;

export const Route = createFileRoute("/api/internal/marketplace-migration")({
  server: {
    handlers: {
      GET: async (request) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const tables: Record<string, { exists: boolean; status?: number; rowCount?: number }> = {};

          for (const table of FOUNDATION_TABLES) {
            const { count, error } = await (supabaseAdmin as any)
              .from(table)
              .select("id", { count: "exact", head: true });
            tables[table] = error
              ? { exists: false, status: error.status ?? 500 }
              : { exists: true, rowCount: count ?? 0 };
          }

          return Response.json({
            verified: Object.values(tables).every((table) => table.exists),
            project: process.env.SUPABASE_URL?.match(/^https:\/\/([^.]+)/)?.[1] ?? "unknown",
            tables,
          });
        } catch (error) {
          return Response.json({
            verified: false,
            error: error instanceof Error ? error.message : String(error),
          }, { status: 503 });
        }
      },
      POST: async () => Response.json({
        success: false,
        error: "DDL execution is disabled on the application server. Apply reviewed migrations through Supabase CLI, SQL Editor, or a direct Postgres connection.",
      }, { status: 405 }),
    },
  },
});
