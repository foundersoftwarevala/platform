import { createFileRoute } from "@tanstack/react-router";

import AICEOAyra from "@/components/ai-ceo/sections/AICEOAyra";

export const Route = createFileRoute("/ai-ceo/ayra")({
  head: () => ({
    meta: [
      { title: "AYRA — AI CEO" },
      {
        name: "description",
        content:
          "The Founder's executive secretary: what she is connected to, what she is not, and what she has been asked to do.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AICEOAyra,
});
