import { createFileRoute } from "@tanstack/react-router";

/**
 * Readiness. "Can this process serve a request end to end right now?"
 *
 * The difference from /health is the difference between a process that is alive
 * and a process that is useful. This one does depend on the things a request
 * needs, because that is the point: a server that cannot reach its database
 * should be taken out of rotation, not restarted.
 *
 * Exactly one dependency is checked, and it is the one every page needs — the
 * database. Nothing on this platform renders without it, and nothing else is a
 * hard requirement for serving traffic: a payment provider being unreachable
 * makes one checkout method unavailable, not the site. Putting providers in
 * here would take the whole storefront down because a card gateway was having a
 * bad afternoon. Provider health has its own place, behind an operator login,
 * at /api/internal/payment-health.
 *
 * What comes back is a verdict and nothing else. No hostnames, no project ids,
 * no URLs, no error text from the dependency, no version, no timings that could
 * map the infrastructure. This endpoint is public and unauthenticated, so the
 * body is deliberately two fields wide and the detail lives in the logs.
 */

/** Beyond this, a dependency is treated as unavailable rather than slow. */
const PROBE_TIMEOUT_MS = 3_000;

/**
 * Ask the database the cheapest question that still proves the whole path
 * works — network, TLS, gateway, authentication, and a real query. Reading zero
 * rows from a table that is always present does all of that and costs nothing.
 */
async function databaseReady(): Promise<boolean> {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  // Unconfigured is not ready. A server missing its credentials must never be
  // sent traffic on the grounds that it did not manage to check.
  if (!url || !key) return false;

  try {
    const response = await fetch(`${url}/rest/v1/finance_payment_rails?select=code&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/ready")({
  server: {
    handlers: {
      GET: async () => {
        const ready = await databaseReady();
        if (!ready) {
          // Logged rather than returned: an operator needs to know which
          // dependency, and an anonymous caller does not.
          console.error(
            JSON.stringify({
              ts: new Date().toISOString(),
              level: "error",
              component: "readiness",
              action: "probe",
              status: "error",
              errorCode: "database_unavailable",
            }),
          );
        }
        return new Response(JSON.stringify({ status: ready ? "ready" : "not_ready" }), {
          status: ready ? 200 : 503,
          headers: {
            "content-type": "application/json",
            "cache-control": "no-store, no-cache, must-revalidate",
          },
        });
      },

      HEAD: async () =>
        new Response(null, {
          status: (await databaseReady()) ? 200 : 503,
          headers: { "cache-control": "no-store, no-cache, must-revalidate" },
        }),
    },
  },
});
