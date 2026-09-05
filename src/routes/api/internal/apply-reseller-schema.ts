import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";
import { readFileSync } from "fs";
import { resolve } from "path";

const MIGRATIONS = [
  "supabase/migrations/20260815_reseller_tables.sql",
  "supabase/migrations/20260815_reseller_user_mapping_and_rls.sql",
];

async function applySqlToSupabase(
  supabaseUrl: string,
  serviceRoleKey: string,
  sql: string,
) {
  const url = new URL("/rest/v1/sql", supabaseUrl).toString();

  const headers = new Headers({
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  });

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ query: sql }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Supabase migration execution failed (${response.status}): ${responseText}`,
    );
  }

  return {
    ok: true,
    status: response.status,
    responseText,
  };
}

export const Route = createFileRoute("/api/internal/apply-reseller-schema")({
  server: {
    handlers: {
      POST: async (request) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        const supabaseUrl = process.env.SUPABASE_URL;
        const serviceRoleKey =
          process.env.SUPABASE_SERVICE_ROLE_KEY ||
          process.env.SUPABASE_SECRET_KEY;

        if (!supabaseUrl || !serviceRoleKey) {
          return Response.json(
            {
              success: false,
              reason: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
            },
            { status: 400 },
          );
        }

        try {
          const sqlParts = MIGRATIONS.map((relativePath) =>
            readFileSync(resolve(process.cwd(), relativePath), "utf-8"),
          );
          const probeResult = await applySqlToSupabase(
            supabaseUrl,
            serviceRoleKey,
            "SELECT 1 as ok;",
          );

          const combinedSql = sqlParts.join("\n\n");

          const result = await applySqlToSupabase(
            supabaseUrl,
            serviceRoleKey,
            combinedSql,
          );

          return Response.json({
            success: true,
            probe: probeResult,
            applied: true,
            migrations: MIGRATIONS,
            status: result.status,
            response: result.responseText,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          return Response.json(
            {
              success: false,
              error: message,
            },
            { status: 500 },
          );
        }
      },

      GET: async (request) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        return Response.json({
          message: "Apply the reseller migration to the active Supabase testing project.",
          migrations: MIGRATIONS,
          method: "POST",
        });
      },
    },
  },
});
