import { createFileRoute } from "@tanstack/react-router";

import { rest as serviceRest } from "@/lib/affiliate/core";
import { APPLICATION_KINDS, listApplications, type ApplicationKind } from "@/lib/applications/registry.server";
import { controlPanelCaller } from "@/lib/control-panel/access.server";

/**
 * The partner programmes at a glance, for Marketplace Manager's Partners page.
 *
 *   GET /api/control-panel/partners
 *
 * Nothing new is stored: each programme is counted where it already lives.
 * Live partners are the rows each programme's own table marks as live - the
 * same status the application registry writes when it approves one - and open
 * applications come from the registry itself, which owns what "open" means.
 */

/** Where each programme's live partners are, and the status that means live. */
const LIVE: Record<ApplicationKind, string> = {
  reseller: "resellers?status=eq.active",
  vendor: "marketplace_sellers?seller_kind=eq.vendor&status=eq.approved",
  author: "marketplace_sellers?seller_kind=eq.author&status=eq.approved",
  affiliate: "marketplace_affiliate_partners?status=eq.approved",
  influencer: "influencer_profiles?status=eq.active",
  franchise: "franchises?status=eq.active",
};

async function countOf(path: string): Promise<number | null> {
  const response = await serviceRest(`${path}&select=id&limit=1`, {
    headers: { Prefer: "count=exact" },
  });
  if (!response.ok) return null;
  const total = Number((response.headers.get("content-range") ?? "").split("/")[1]);
  return Number.isFinite(total) ? total : null;
}

export type PartnerProgramme = {
  kind: ApplicationKind;
  live: number | null;
  openApplications: number | null;
};

export const Route = createFileRoute("/api/control-panel/partners")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const access = await controlPanelCaller(request);
        if (!access.ok) return access.response;

        const open = await listApplications([...APPLICATION_KINDS], true).catch((error: unknown) => {
          console.error("[partners] applications unavailable", error);
          return null;
        });
        const programmes: PartnerProgramme[] = await Promise.all(
          APPLICATION_KINDS.map(async (kind) => ({
            kind,
            live: await countOf(LIVE[kind]),
            openApplications: open ? open.filter((a) => a.kind === kind).length : null,
          })),
        );
        return Response.json({ programmes }, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
