import { createFileRoute } from "@tanstack/react-router";

import { requireInternalOperator } from "@/lib/auth/internal-guard";
import {
  CatalogueAuditError,
  latestCatalogueAudit,
  runCatalogueAudit,
} from "@/lib/seo/catalogue-audit.server";

/**
 * A real SEO audit of the real marketplace.
 *
 * The SEO Manager reads `seo_audits` and `seo_issues`, which is the right
 * architecture — but the only rows in them were seeded, and `seo_pages` holds
 * sixteen records for a catalogue of 5,525 visible products. Fifteen of those
 * sixteen point at URLs that return 404 on this site (`/products/pos`,
 * `/pricing`, `/about`, `/blog/…`), because the real product route is
 * `/marketplace/product/$slug`. So the dashboard was reporting on a site that
 * does not exist.
 *
 * The scan itself now lives in `@/lib/seo/catalogue-audit.server`, because the
 * SEO Manager's own `runSiteAudit` server function needed the same audit and
 * had been fabricating one instead. This route is the operator-facing door
 * onto it and behaves exactly as it did before.
 *
 *   POST /api/internal/seo-audit          -> run and persist an audit
 *   GET  /api/internal/seo-audit          -> the latest audit, without re-running
 */
export const Route = createFileRoute("/api/internal/seo-audit")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        return Response.json({ latest: await latestCatalogueAudit() });
      },

      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        try {
          return Response.json(await runCatalogueAudit());
        } catch (problem) {
          if (problem instanceof CatalogueAuditError) {
            return Response.json(
              problem.detail
                ? { error: problem.message, detail: problem.detail }
                : { error: problem.message },
              { status: problem.status },
            );
          }
          throw problem;
        }
      },
    },
  },
});
