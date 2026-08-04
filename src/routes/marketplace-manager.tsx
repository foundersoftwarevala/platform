import { createFileRoute } from "@tanstack/react-router";

import { MarketplaceWorkspace } from "@/components/marketplace-manager/MarketplaceWorkspace";
import { PageShell } from "@/components/creator/PageShell";

export const Route = createFileRoute("/marketplace-manager")({
  head: () => ({
    meta: [
      { title: "Marketplace Manager — Software Vala Control Panel" },
      {
        name: "description",
        content:
          "Run the marketplace end to end: homepage layout, catalog, products, orders, payments, growth, governance and operations.",
      },
      { property: "og:title", content: "Marketplace Manager — Software Vala" },
      {
        property: "og:description",
        content:
          "Homepage builder, catalog, commerce, growth and governance for the Software Vala marketplace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) =>
  component: () => <MarketplaceWorkspace />,
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
