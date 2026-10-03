import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";

/**
 * Migrations are not applied over HTTP.
 *
 * This endpoint used to post the SQL of three migration files to
 * `${SUPABASE_URL}/rest/v1/sql`. PostgREST has no such endpoint, so every call
 * failed - and it only ever sent the first 200 characters of each file anyway.
 * The application has no way to run arbitrary SQL, and should not have one.
 *
 * Migrations are applied by an operator from the repository with
 * scripts/ops/db.mjs, which reaches the VPS database (sv_platform) and says
 * which database it reached. The endpoint stays, behind the operator gate, and
 * answers that honestly instead of pretending.
 */

function notImplemented() {
  return Response.json(
    {
      error: "Migrations cannot be applied through this endpoint.",
      reason:
        "There is no SQL execution endpoint on the database API (/rest/v1/sql does not exist), and the application does not run arbitrary SQL.",
      howToApply: "node scripts/ops/db.mjs --file supabase/migrations/<file>.sql (run from the repository; it reaches the VPS database sv_platform)",
    },
    { status: 501 },
  );
}

export const Route = createFileRoute("/api/internal/apply-migrations")({
  server: {
    handlers: {
      POST: async (request) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        return notImplemented();
      },

      GET: async (request) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        return notImplemented();
      },
    },
  },
});
