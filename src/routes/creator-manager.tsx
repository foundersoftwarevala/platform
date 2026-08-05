import { createFileRoute } from "@tanstack/react-router";

import { PageShell } from "@/components/creator/PageShell";
import { ManagerWorkspace } from "@/components/manager-suite/ManagerWorkspace";
import { buildModuleRegistry } from "@/components/creator/registry";
import { creatorConfig } from "@/components/creator/moduleConfigs";
import { moduleAnalyticsQueryOptions } from "@/lib/creator/analytics.functions";

const creatorRegistry = buildModuleRegistry(creatorConfig, creatorConfig.groups);

export const Route = createFileRoute("/creator-manager")({
  head: () => ({
    meta: [
      { title: "Creator Manager — Software Vala Control Panel" },
      {
        name: "description",
        content:
          "Creator Manager console: creator roster, campaigns, content, commissions, rank and AI — one command center.",
      },
      { property: "og:title", content: "Creator Manager — Software Vala" },
      {
        property: "og:description",
        content: "Manage creators, campaigns, payouts and performance from one console.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(moduleAnalyticsQueryOptions("creator", "7d")),
  component: () => (
    <ManagerWorkspace
      primary={creatorConfig.primary}
      groups={creatorConfig.groups}
      registry={creatorRegistry}
      brand={creatorConfig.brand}
      brandMark={creatorConfig.brandMark}
      initial={creatorConfig.defaultModule}
      role="creator"
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
