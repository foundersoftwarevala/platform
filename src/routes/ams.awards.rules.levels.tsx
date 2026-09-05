import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpCircle } from "lucide-react";
import { LibraryShell } from "@/components/ams/shared/LibraryShell";

export const Route = createFileRoute("/ams/awards/rules/levels")({
  head: () => ({
    meta: [
      { title: "Level Rules — AMS" },
      { name: "description", content: "XP thresholds, level perks, level-up rewards and level-bound visibility." },
      { property: "og:title", content: "Level Rules — AMS" },
      { property: "og:description", content: "XP thresholds, level perks, level-up rewards and level-bound visibility." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <LibraryShell
      kicker="Rules" title="Level rules"
      description="XP thresholds, level perks, level-up rewards and level-bound visibility."

      helpIcon={<ArrowUpCircle className="h-6 w-6" />}
    />
  ),
});
