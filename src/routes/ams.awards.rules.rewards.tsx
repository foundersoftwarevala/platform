import { createFileRoute } from "@tanstack/react-router";
import { Gift } from "lucide-react";
import { LibraryShell } from "@/components/ams/shared/LibraryShell";

export const Route = createFileRoute("/ams/awards/rules/rewards")({
  head: () => ({
    meta: [
      { title: "Reward Rules — AMS" },
      { name: "description", content: "What reward is granted when an award unlocks — coins, monetary value, perks and claim flows." },
      { property: "og:title", content: "Reward Rules — AMS" },
      { property: "og:description", content: "What reward is granted when an award unlocks — coins, monetary value, perks and claim flows." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <LibraryShell
      kicker="Rules" title="Reward rules"
      description="What reward is granted when an award unlocks — coins, monetary value, perks and claim flows."

      helpIcon={<Gift className="h-6 w-6" />}
    />
  ),
});
