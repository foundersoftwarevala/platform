import { createFileRoute } from "@tanstack/react-router";

import { PageShell } from "@/components/creator/PageShell";
import { SeoWorkspace } from "@/components/seo-manager/SeoWorkspace";


export const Route = createFileRoute("/seo-manager")({
  // The console's sections were state-only, so nothing could link to one and a
  // section could not be shared or bookmarked. ?module=<id> addresses them.
  // An unknown id is not an error worth failing a page load over — it lands on
  // the dashboard, which is where a bare /seo-manager lands anyway.
  validateSearch: (search: Record<string, unknown>) => ({
    module: typeof search.module === "string" ? search.module : undefined,
  }),
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
  component: SeoManagerRoute,
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

function SeoManagerRoute() {
  const { module } = Route.useSearch();
  return <SeoWorkspace initialModule={module} />;
}
