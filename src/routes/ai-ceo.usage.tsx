import { createFileRoute } from "@tanstack/react-router";

import { UsageWorkspace } from "@/components/ai-ceo/ops/Registers";

export const Route = createFileRoute("/ai-ceo/usage")({
  head: () => ({
    meta: [
      { title: "API usage and spend — AI CEO" },
      {
        name: "description",
        content: "What the platform spent on paid providers, by day and service.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: UsageWorkspace,
});
