import { createFileRoute } from "@tanstack/react-router";

import { requireInternalOperator } from "@/lib/auth/internal-guard";
import { allSearchProviders } from "@/lib/seo/search-performance.server";

/**
 * Where search-performance data stands.
 *
 * Returns the state of each webmaster provider the registry knows about, and
 * why it is in that state: not registered, no endpoint, not active, or active
 * with no credential. Those are fixed by different people in different places,
 * so they are reported as different things.
 *
 * No figures are returned while no provider is configured. An empty list of
 * numbers would be drawn by a screen as "measured, and there was nothing".
 */
export const Route = createFileRoute("/api/seo/search-performance")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        try {
          const providers = await allSearchProviders();
          return Response.json({
            providers,
            configured: providers.filter((p) => p.configured).length,
            total: providers.length,
          });
        } catch (error) {
          console.error("[seo search performance]", error);
          // i18n-ignore: a diagnostic in a JSON body, not copy anyone reads.
          return Response.json({ error: String(error) }, { status: 500 });
        }
      },
    },
  },
});
