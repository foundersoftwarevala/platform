import { createFileRoute } from "@tanstack/react-router";
import AICEOApprovals from "@/components/ai-ceo/sections/AICEOApprovals";

export const Route = createFileRoute("/ai-ceo/approvals")({
  head: () => ({
    meta: [
      { title: "Approval Suggestions — Software Vala" },
      { name: "description", content: "AI-generated approval recommendations awaiting executive review." },
      { property: "og:title", content: "Approval Suggestions — Software Vala" },
      { property: "og:description", content: "AI-generated approval recommendations awaiting executive review." },
    ],
  }),
  component: AICEOApprovals,
});
