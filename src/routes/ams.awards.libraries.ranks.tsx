import { createFileRoute } from "@tanstack/react-router";
import { LibraryPage } from "@/components/ams/shared/LibraryPage";

export const Route = createFileRoute("/ams/awards/libraries/ranks")({
  head: () => ({
    meta: [
      { title: "Rank Library — AMS" },
      { name: "description", content: "Persistent tiers. Rank-up celebrations are full-screen by default." },
      { property: "og:title", content: "Rank Library — AMS" },
      { property: "og:description", content: "Persistent tiers. Rank-up celebrations are full-screen by default." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <LibraryPage type="rank" kicker="Library" title="Ranks" description="Persistent tiers. Rank-up celebrations are full-screen by default." />,
});
