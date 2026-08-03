import { createFileRoute } from "@tanstack/react-router";

import { ModuleDashboard } from "@/components/creator/ModuleDashboard";
import { PageShell } from "@/components/creator/PageShell";
import { franchiseConfig } from "@/components/creator/moduleConfigs";
import { moduleAnalyticsQueryOptions } from "@/lib/creator/analytics.functions";

export const Route = createFileRoute("/franchise-manager")({
  head: () => ({
    meta: [
      { title: "Franchise Manager — Software Vala Control Panel" },
      {
        name: "description",
        content:
          "Global franchise command: applications, licensing, territories, royalty, compliance and regional performance.",
      },
      { property: "og:title", content: "Franchise Manager — Software Vala" },
      {
        property: "og:description",
        content: "Run franchises, countries, regions, licenses and royalty from one console.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(moduleAnalyticsQueryOptions("franchise", "7d")),
  component: () => <ModuleDashboard config={franchiseConfig} />,
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
