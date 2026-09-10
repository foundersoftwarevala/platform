import { createFileRoute } from "@tanstack/react-router";

/**
 * Liveness. "Is this process running and able to answer?"
 *
 * That is the whole question, and answering anything more would make it the
 * wrong check. Liveness is what a supervisor uses to decide whether to restart
 * the process, so it must not depend on anything the process cannot fix by
 * restarting. If this returned 503 because Supabase was briefly unreachable,
 * PM2 would restart a perfectly healthy server in a loop while the real problem
 * was somewhere else entirely — the classic way a health check turns a
 * dependency's bad minute into an outage of your own.
 *
 * Whether the platform can actually *serve* is a different question, and it is
 * answered by /ready.
 *
 * Nothing here reveals anything about the machine: no version, no host, no
 * paths, no dependency names, no counts. It is public and unauthenticated by
 * necessity, so it says only what a load balancer needs and not one word more.
 */

export const Route = createFileRoute("/health")({
  server: {
    handlers: {
      GET: () =>
        new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: {
            "content-type": "application/json",
            // A cached liveness answer is a lie waiting to happen.
            "cache-control": "no-store, no-cache, must-revalidate",
          },
        }),

      // A load balancer that probes with HEAD gets the same verdict.
      HEAD: () =>
        new Response(null, {
          status: 200,
          headers: { "cache-control": "no-store, no-cache, must-revalidate" },
        }),
    },
  },
});
