import { Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
import "@/styles/marketplace-home.css";
import HomeIndex from "@/components/marketplace-home/HomeIndex";
import { getHomeCatalog, type HomeCatalogSeed } from "@/lib/marketplace/home-catalog.functions";
import { absoluteUrl } from "@/lib/seo/site-url";

export const Route = createFileRoute("/")({
  /**
   * Fetch the first rows before the page is sent, so the HTML that leaves the
   * server carries real category and product links. Without this the front
   * door of the catalogue was an empty document and nothing below it could be
   * followed. A failure here returns nothing and the browser asks for the rows
   * itself, exactly as it did before.
   */
  loader: async (): Promise<{ seed: HomeCatalogSeed }> => {
    try {
      return { seed: await getHomeCatalog() };
    } catch {
      return { seed: null };
    }
  },

  head: () => ({
    links: [{ rel: "canonical", href: absoluteUrl("/") }],
    meta: [
      { title: "Software Vala — 12,000+ Software Solutions Marketplace" },
      {
        name: "description",
        content:
          "Browse 12,000+ ready-to-deploy software solutions across 80+ master categories with live demos, full source code and lifetime access.",
      },
      { property: "og:title", content: "Software Vala — 12,000+ Software Solutions Marketplace" },
      {
        property: "og:description",
        content:
          "One fixed price — $249 one-time for lifetime access. Live demos, full source code and 1 year free support across 80+ categories.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const HomeLoading = () => (
  <div className="min-h-screen w-full flex items-center justify-center bg-[#0a1526]">
    <div className="h-10 w-10 rounded-full border-2 border-white/20 border-t-cyan-400 animate-spin" />
  </div>
);

function Index() {
  return (
    <div className="mpc-home">
      <Suspense fallback={<HomeLoading />}>
        <HomeIndex />
      </Suspense>
    </div>
  );
}
