import { timingSafeEqual } from "node:crypto";
import { translateApiMessage } from "@/lib/i18n/server-translate.server";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { runMarketplaceProductCountrySeoWorkerTick } from "@/lib/marketplace-product-seo.functions";
import { processResellerCountrySeoDraftBatch } from "@/lib/reseller-country-seo.server";

const tickInputSchema = z.object({
  loadAverage1m: z.number().finite().nonnegative(),
  cpuCount: z.number().int().positive(),
  availableMemoryBytes: z.number().int().nonnegative(),
});

function isAuthorized(request: Request): boolean {
  const configured = process.env.SEO_MARKETPLACE_WORKER_TOKEN?.trim();
  const supplied = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  if (!configured || !supplied) return false;
  const expectedBytes = Buffer.from(configured);
  const suppliedBytes = Buffer.from(supplied);
  return (
    expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes)
  );
}

export const Route = createFileRoute("/api/marketplace-product-country-seo-worker")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const translateText = translateApiMessage.bind(null, request);
        if (!isAuthorized(request)) {
          return Response.json({ error: await translateText("seo.api_unauthorized_740b831") }, { status: 401 });
        }

        let input: z.infer<typeof tickInputSchema>;
        try {
          input = tickInputSchema.parse(await request.json());
        } catch {
          return Response.json({ error: await translateText("seo.api_invalid_worker_metrics_f498524") }, { status: 400 });
        }

        try {
          const metrics = {
            loadAverage1m: input.loadAverage1m,
            cpuCount: input.cpuCount,
            availableMemoryBytes: input.availableMemoryBytes,
          };
          const result = await runMarketplaceProductCountrySeoWorkerTick(metrics);
          const resellerCountrySeo = await processResellerCountrySeoDraftBatch();
          return Response.json({ ...result, resellerCountrySeo });
        } catch (error) {
          console.error("[marketplace seo worker]", error);
          return Response.json({ error: await translateText("seo.api_marketplace_seo_worker_tick_failed_6ee8560") }, { status: 500 });
        }
      },
    },
  },
});
