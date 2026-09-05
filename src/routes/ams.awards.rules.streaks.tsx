import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { LibraryShell } from "@/components/ams/shared/LibraryShell";

export const Route = createFileRoute("/ams/awards/rules/streaks")({
  head: () => ({
    meta: [
      { title: "Streak Rules — AMS" },
      { name: "description", content: "Daily/weekly streak windows, freeze rules, reset behavior and streak bonuses." },
      { property: "og:title", content: "Streak Rules — AMS" },
      { property: "og:description", content: "Daily/weekly streak windows, freeze rules, reset behavior and streak bonuses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <LibraryShell
      kicker="Rules" title="Streak rules"
      description="Daily/weekly streak windows, freeze rules, reset behavior and streak bonuses."

      helpIcon={<Sparkles className="h-6 w-6" />}
    />
  ),
});
