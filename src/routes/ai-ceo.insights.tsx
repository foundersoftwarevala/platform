import { createFileRoute } from "@tanstack/react-router";

import { InsightsFeed } from "@/components/ai-ceo/ops/Registers";

export const Route = createFileRoute("/ai-ceo/insights")({
  head: () => ({
    meta: [
      { title: "AI insights — AI CEO" },
      {
        name: "description",
        content: "What the platform AI has concluded, with the action it proposed.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: InsightsFeed,
});
