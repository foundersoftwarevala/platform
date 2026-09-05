import { createFileRoute } from "@tanstack/react-router";
import { LibraryPage } from "@/components/ams/shared/LibraryPage";

export const Route = createFileRoute("/ams/awards/libraries/achievements")({
  head: () => ({
    meta: [
      { title: "Achievement Library — AMS" },
      { name: "description", content: "In-product milestones that trigger XP, coins and celebrations." },
      { property: "og:title", content: "Achievement Library — AMS" },
      { property: "og:description", content: "In-product milestones that trigger XP, coins and celebrations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <LibraryPage type="achievement" kicker="Library" title="Achievements" description="In-product milestones that trigger XP, coins and celebrations." />,
});
