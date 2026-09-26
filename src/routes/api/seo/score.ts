import { createFileRoute } from "@tanstack/react-router";

import { requireInternalOperator } from "@/lib/auth/internal-guard";
import { scoreCrawledPages } from "@/lib/seo/score.server";

/**
 * Score a batch of crawled pages.
 *
 * Only an internal operator may ask: this writes a judgement onto every page
 * it touches, and the judgement is what the SEO console then reports.
 *
 * It takes a batch and returns where to carry on from, so the caller walks the
 * table rather than asking for all of it. That is the only shape that still
 * works when the catalogue is larger than it is today.
 */
export const Route = createFileRoute("/api/seo/score")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        let body: { limit?: unknown; offset?: unknown } = {};
        try {
          body = (await request.json()) as { limit?: unknown; offset?: unknown };
        } catch {
          // An empty body is a whole first batch, which is a reasonable ask.
        }

        try {
          const result = await scoreCrawledPages({
            limit: typeof body.limit === "number" ? body.limit : undefined,
            offset: typeof body.offset === "number" ? body.offset : undefined,
          });
          return Response.json(result);
        } catch (error) {
          console.error("[seo score]", error);
          return Response.json(
            // i18n-ignore: a diagnostic in a JSON body, not copy anyone reads.
            { error: error instanceof Error ? error.message : String(error) },
            { status: 500 },
          );
        }
      },
    },
  },
});
