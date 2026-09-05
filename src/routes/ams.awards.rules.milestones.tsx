import { createFileRoute } from "@tanstack/react-router";
import { Crown } from "lucide-react";
import { LibraryShell } from "@/components/ams/shared/LibraryShell";

export const Route = createFileRoute("/ams/awards/rules/milestones")({
  head: () => ({
    meta: [
      { title: "Milestone Rules — AMS" },
      { name: "description", content: "Threshold-based events: first sale, 100 sales, 1k followers — with bespoke celebrations." },
      { property: "og:title", content: "Milestone Rules — AMS" },
      { property: "og:description", content: "Threshold-based events: first sale, 100 sales, 1k followers — with bespoke celebrations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <LibraryShell
      kicker="Rules" title="Milestone rules"
      description="Threshold-based events: first sale, 100 sales, 1k followers — with bespoke celebrations."

      helpIcon={<Crown className="h-6 w-6" />}
    />
  ),
});
