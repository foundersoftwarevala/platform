import { createFileRoute } from "@tanstack/react-router";

import { PageShell } from "@/components/creator/PageShell";
import { ManagerWorkspace } from "@/components/manager-suite/ManagerWorkspace";
import { resellerGroups, resellerPrimary } from "@/components/reseller/navigation";
import { resellerRegistry } from "@/components/reseller/sectionRegistry";
import { moduleAnalyticsQueryOptions } from "@/lib/creator/analytics.functions";

export const Route = createFileRoute("/reseller-manager")({
  head: () => ({
    meta: [
      { title: "Reseller Manager — Software Vala Control Panel" },
      {
        name: "description",
        content:
          "Reseller command center: partner directory, deal registration, orders, renewals, commission ledger and payouts.",
      },
      { property: "og:title", content: "Reseller Manager — Software Vala" },
      {
        property: "og:description",
        content: "Run the whole partner channel — deals, orders, renewals and commission — in one console.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(moduleAnalyticsQueryOptions("reseller", "7d")),
  component: () => (
    <ManagerWorkspace
      primary={resellerPrimary}
      groups={resellerGroups}
      registry={resellerRegistry}
      brand="Reseller Manager"
      brandMark="RS"
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
