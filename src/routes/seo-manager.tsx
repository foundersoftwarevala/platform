import { createFileRoute } from "@tanstack/react-router";

import { PageShell } from "@/components/creator/PageShell";
import { SeoWorkspace } from "@/components/seo-manager/SeoWorkspace";

export const Route = createFileRoute("/seo-manager")({
  head: () => ({
    meta: [
      { title: "SEO Manager — Software Vala Control Panel" },
      {
        name: "description",
        content:
          "Run SEO end to end: meta and schema, keyword research, rankings, backlinks, redirects, sitemaps and AI content.",
      },
      { property: "og:title", content: "SEO Manager — Software Vala" },
      {
        property: "og:description",
        content: "On-page SEO, keyword clusters, rankings, technical SEO and AI writing in one console.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <SeoWorkspace />,
  errorComponent: ({ error }) => (
    <div className="creator-theme min-h-screen">
      <PageShell>
        <div className="bento-card py-16 text-center">
          <h2 className="text-lg font-semibold">SEO Manager unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        </div>
      </PageShell>
    </div>
  ),
});