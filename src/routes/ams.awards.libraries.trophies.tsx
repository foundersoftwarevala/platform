import { createFileRoute } from "@tanstack/react-router";
import { LibraryPage } from "@/components/ams/shared/LibraryPage";

export const Route = createFileRoute("/ams/awards/libraries/trophies")({
  head: () => ({
    meta: [
      { title: "Trophy Library — AMS" },
      { name: "description", content: "Top-tier awards. Full-screen unlocks, premium 3D models, gold gradients." },
      { property: "og:title", content: "Trophy Library — AMS" },
      { property: "og:description", content: "Top-tier awards. Full-screen unlocks, premium 3D models, gold gradients." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <LibraryPage type="trophy" kicker="Library" title="Trophies" description="Top-tier awards. Full-screen unlocks, premium 3D models, gold gradients." />,
});
