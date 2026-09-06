import { createFileRoute } from "@tanstack/react-router";
import AICEOReports from "@/components/ai-ceo/sections/AICEOReports";

export const Route = createFileRoute("/ai-ceo/reports")({
  head: () => ({
    meta: [
      { title: "AI Reports — Software Vala" },
      { name: "description", content: "Executive briefings and AI-generated reports ready for download." },
      { property: "og:title", content: "AI Reports — Software Vala" },
      { property: "og:description", content: "Executive briefings and AI-generated reports ready for download." },
    ],
  }),
  component: AICEOReports,
});
