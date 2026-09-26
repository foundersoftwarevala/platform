import { createFileRoute } from "@tanstack/react-router";

import { AgentDetail } from "@/components/ai-ceo/ops/AgentDirectory";

export const Route = createFileRoute("/ai-ceo/agents/$agentId")({
  head: () => ({
    meta: [
      { title: "Agent — AI CEO" },
      { name: "description", content: "Everything the agent register records about one agent." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Page,
});

function Page() {
  const { agentId } = Route.useParams();
  return <AgentDetail agentId={agentId} />;
}
