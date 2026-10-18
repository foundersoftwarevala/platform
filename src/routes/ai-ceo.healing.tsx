import { createFileRoute } from "@tanstack/react-router";

import AICEOHealing from "@/components/ai-ceo/sections/AICEOHealing";

export const Route = createFileRoute("/ai-ceo/healing")({
  head: () => ({
    meta: [
      { title: "Self-Healing — AI CEO" },
      {
        name: "description",
        content:
          "What the self-healing engine has detected, attempted, verified and escalated — and what it is not yet allowed to do.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AICEOHealing,
});
