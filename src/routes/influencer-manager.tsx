import { createFileRoute } from "@tanstack/react-router";

import { PageShell } from "@/components/creator/PageShell";
import { ManagerWorkspace } from "@/components/manager-suite/ManagerWorkspace";
import { buildModuleRegistry } from "@/components/creator/registry";
import { influencerConfig } from "@/components/creator/moduleConfigs";
import { moduleAnalyticsQueryOptions } from "@/lib/creator/analytics.functions";
import { influencerGroups, influencerPrimary } from "@/components/influencer/navigation";

const influencerRegistry = buildModuleRegistry(influencerConfig, influencerGroups);

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
  component: () => (
    <ManagerWorkspace
      primary={influencerPrimary}
      groups={influencerGroups}
      registry={influencerRegistry}
      brand={influencerConfig.brand}
      brandMark={influencerConfig.brandMark}
      initial={influencerConfig.defaultModule}
      role="influencer"
    />
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
