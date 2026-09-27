import { createFileRoute } from "@tanstack/react-router";

import AICEOMorning from "@/components/ai-ceo/sections/AICEOMorning";

export const Route = createFileRoute("/ai-ceo/morning")({
  head: () => ({
    meta: [
      { title: "Morning AI — AI CEO" },
      {
        name: "description",
        content:
          "The operational day: what changed overnight, what needs attention, and the order the company should work in.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AICEOMorning,
});
