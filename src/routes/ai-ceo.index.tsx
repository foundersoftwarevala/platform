import { createFileRoute } from "@tanstack/react-router";
import AICEODashboardMain from "@/components/ai-ceo/sections/AICEODashboardMain";

export const Route = createFileRoute("/ai-ceo/")({
  head: () => ({
    meta: [
      { title: "AI CEO Dashboard — Software Vala" },
      { name: "description", content: "Executive AI overview: ecosystem metrics, AI observations, live activity and suggestions." },
      { property: "og:title", content: "AI CEO Dashboard — Software Vala" },
      { property: "og:description", content: "Executive AI overview: ecosystem metrics, AI observations, live activity and suggestions." },
    ],
  }),
  component: AICEODashboardMain,
});
