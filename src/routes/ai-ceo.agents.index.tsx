import { createFileRoute } from "@tanstack/react-router";

import { AgentDirectory } from "@/components/ai-ceo/ops/AgentDirectory";

export const Route = createFileRoute("/ai-ceo/agents/")({
  head: () => ({
    meta: [
      { title: "Agents — AI CEO" },
      {
        name: "description",
        content:
          "Every AI agent registered on the platform, with the model it runs on and the work it has done.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AgentDirectory,
});
