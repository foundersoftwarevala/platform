import { createFileRoute } from "@tanstack/react-router";

import { ModuleDashboard } from "@/components/creator/ModuleDashboard";
import { PageShell } from "@/components/creator/PageShell";
import { resellerConfig } from "@/components/creator/moduleConfigs";
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
  component: () => <ModuleDashboard config={resellerConfig} />,
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
