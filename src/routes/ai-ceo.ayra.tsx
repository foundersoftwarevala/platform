import { createFileRoute } from "@tanstack/react-router";

import { RequireRole } from "@/components/auth/RequireRole";
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
  component: AyraPage,
});

function AyraPage() {
  return (
    <RequireRole role={["boss", "admin"]} allowOperators={false}>
      <AICEOAyra />
    </RequireRole>
  );
}
