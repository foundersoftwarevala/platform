import { createFileRoute } from "@tanstack/react-router";

import { RequireRole } from "@/components/auth/RequireRole";

import { PageShell } from "@/components/creator/PageShell";
import { ManagerWorkspace } from "@/components/manager-suite/ManagerWorkspace";
import { buildModuleRegistry } from "@/components/creator/registry";
import { InfluencerApplicationsQueue } from "@/components/applications/RoleApplicationsQueue";
import { influencerConfig } from "@/components/creator/moduleConfigs";
import { moduleAnalyticsQueryOptions } from "@/lib/creator/analytics.functions";
import { influencerGroups, influencerPrimary } from "@/components/influencer/navigation";
import { influencerRegistry as influencerSections } from "@/components/influencer/sectionRegistry";

/**
 * The sections this console renders.
 *
 * buildModuleRegistry gives every nav item a generic wall - name, owner, scope,
 * value, status - with no table behind it and no resource, so every list section
 * rendered an empty table while the programme held ten profiles, seven
 * applications, two assignments and six payouts. Nothing failed; the walls had
 * nothing to read.
 *
 * components/influencer/sectionRegistry exists for exactly this: a wall per
 * influencer table, with that table's own columns and the resource that serves
 * it. It was written and never wired in. It is the override now, and the generic
 * registry stays underneath so a nav item it does not cover keeps the section it
 * had rather than losing it.
 */
const influencerRegistry = {
  ...buildModuleRegistry(influencerConfig, influencerGroups),
  ...influencerSections,
  // The applications queue is its own screen, not a wall.
  Applications: InfluencerApplicationsQueue,
};

export const Route = createFileRoute("/influencer-manager")({
  head: () => ({
    meta: [
      { title: "Influencer Manager — Software Vala Control Panel" },
      {
        name: "description",
        content:
          "Influencer console: roster, applications, brand campaigns, content approval, commissions and payouts.",
      },
      { property: "og:title", content: "Influencer Manager — Software Vala" },
      {
        property: "og:description",
        content: "Manage influencers, brands, campaigns and commissions from one console.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(moduleAnalyticsQueryOptions("influencer", "7d")),
  // Operator console — it used to render in full to anonymous visitors.
  component: () => (
    <RequireRole role={["finance", "support", "sales_support_manager"]}>
      <ManagerWorkspace
        primary={influencerPrimary}
        groups={influencerGroups}
        registry={influencerRegistry}
        brand={influencerConfig.brand}
        brandMark={influencerConfig.brandMark}
        initial={influencerConfig.defaultModule}
        role="influencer"
      />
    </RequireRole>
  ),
  errorComponent: ({ error }) => (
    <div className="creator-theme min-h-screen">
      <PageShell>
        <div className="bento-card py-16 text-center">
          <h2 className="text-lg font-semibold">Analytics unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        </div>
      </PageShell>
    </div>
  ),
});
