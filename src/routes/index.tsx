import { Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
import "@/styles/marketplace-home.css";
import HomeIndex from "@/components/marketplace-home/HomeIndex";
import { HomeBoundary, HomeShellFallback } from "@/components/marketplace-home/SectionBoundary";
import {
  loadHomeRouteData,
  type HomeRouteData,
} from "@/lib/marketplace/home-route-data";
import { absoluteUrl } from "@/lib/seo/site-url";

export const Route = createFileRoute("/")({
  /**
   * Fetch the first rows before the page is sent. The body lives in
   * home-route-data so /marketplace/, which renders the same component, runs
   * exactly the same loader rather than a copy of it.
   */
  loader: async (): Promise<HomeRouteData> => loadHomeRouteData(),

  head: () => ({
    links: [{ rel: "canonical", href: absoluteUrl("/") }],
    meta: [
      { title: "Software Vala™ — The Name of Trust" },
      {
        name: "description",
        content:
          "Browse 12,000+ ready-to-deploy software solutions across 80+ master categories with live demos, full source code and lifetime access.",
      },
      { property: "og:title", content: "Software Vala™ — The Name of Trust" },
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
  // `/` is a protected production route. Even if the router or the loader
  // fails, visitors must land on Software Vala — never on a blank page or the
  // generic "this page didn't load" card from the root boundary.
  errorComponent: () => <HomeShellFallback />,
});

const HomeLoading = () => (
  <div className="min-h-screen w-full flex items-center justify-center bg-[#0a1526]">
    <div className="h-10 w-10 rounded-full border-2 border-white/20 border-t-cyan-400 animate-spin" />
  </div>
);

function Index() {
  return (
    <div className="mpc-home">
      <HomeBoundary>
        <Suspense fallback={<HomeLoading />}>
          <HomeIndex />
        </Suspense>
      </HomeBoundary>
    </div>
  );
}
