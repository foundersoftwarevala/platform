import { Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
import "@/styles/marketplace-home.css";
import HomeIndex from "@/components/marketplace-home/HomeIndex";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Software Vala — 147 Software Solutions Marketplace" },
      {
        name: "description",
        content:
          "Browse 147 ready-to-deploy software solutions across 20 master categories with live demos, full source code and lifetime access.",
      },
      { property: "og:title", content: "Software Vala — 147 Software Solutions Marketplace" },
      {
        property: "og:description",
        content:
          "Live demos, full source code, 1 year free support and lifetime access across 20 master categories.",
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
