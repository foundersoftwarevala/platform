import { createFileRoute } from "@tanstack/react-router";

import { requireInternalOperator } from "@/lib/auth/internal-guard";
import { generateTagsForSlot } from "@/lib/seo/tag-generation.server";

/**
 * Keywords for one card slot, asked for from the SEO Manager.
 *
 * Behind the Generate button on the Card SEO screen. The work is done by the
 * SEO tag service, which goes through AI API Manager and nowhere else, so
 * every call is measured against the registry's quota, cost and audit trail.
 *
 * Only an internal operator may ask. A visitor triggering keyword generation
 * would be spending the platform's provider budget, and the answer is written
 * back onto a live card slot.
 *
 * The state is returned as the service reported it - GENERATED, REJECTED,
 * NOT_CONFIGURED or PROVIDER_ERROR - with HTTP 200 in every case, because all
 * four are real answers to a question that was asked properly. A 500 here
 * would say the request failed, which is a different and untrue thing to say
 * about "no provider is configured yet".
 */
export const Route = createFileRoute("/api/seo/generate-tags")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        let body: { slotUrl?: unknown; dryRun?: unknown };
        try {
          body = (await request.json()) as { slotUrl?: unknown; dryRun?: unknown };
        } catch {
          // i18n-ignore: a JSON diagnostic, never shown to anyone as copy.
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        const slotUrl = typeof body.slotUrl === "string" ? body.slotUrl.trim() : "";
        if (!slotUrl) {
          // i18n-ignore: names a request field, not something a person reads.
          return Response.json({ error: "slotUrl is required" }, { status: 400 });
        }

        try {
          const result = await generateTagsForSlot({
            slotUrl,
            dryRun: body.dryRun === true,
          });
          return Response.json(result);
        } catch (error) {
          // A fault in this route, as opposed to a state the service reported.
          console.error("[seo tags]", error);
          return Response.json(
            {
              // i18n-ignore: a state code the console matches on, not copy.
              state: "PROVIDER_ERROR",
              reason: error instanceof Error ? error.message : String(error),
              slot_url: slotUrl,
              stored: false,
              findings: [],
              tags: null,
              provider: null,
              model: null,
            },
            { status: 200 },
          );
        }
      },
    },
  },
});
