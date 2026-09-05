import { createFileRoute } from "@tanstack/react-router";
import { Zap } from "lucide-react";
import { LibraryShell } from "@/components/ams/shared/LibraryShell";

export const Route = createFileRoute("/ams/awards/rules/xp")({
  head: () => ({
    meta: [
      { title: "XP Rules — AMS" },
      { name: "description", content: "Define how XP is granted across modules — base actions, multipliers, decay and caps." },
      { property: "og:title", content: "XP Rules — AMS" },
      { property: "og:description", content: "Define how XP is granted across modules — base actions, multipliers, decay and caps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <LibraryShell
      kicker="Rules" title="XP rules"
      description="Define how XP is granted across modules — base actions, multipliers, decay and caps."

      helpIcon={<Zap className="h-6 w-6" />}
    />
  ),
});
