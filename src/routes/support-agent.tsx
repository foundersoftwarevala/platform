import { createFileRoute } from "@tanstack/react-router";
import SupportAgentDashboard from "@/components/salespages/SupportAgentDashboard";

export const Route = createFileRoute("/support-agent")({
  // Dashboard UI is live/interactive; skip SSR so timers and live data hydrate cleanly.
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    section: typeof search.section === "string" ? search.section : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Support Agent Workspace | Software Vala" },
      {
        name: "description",
        content:
          "Agent workspace for assigned tickets, live chats, response times and personal support performance metrics.",
      },
      { property: "og:title", content: "Support Agent Workspace | Software Vala" },
      {
        property: "og:description",
        content: "Assigned tickets, live chats and personal support performance for agents.",
      },
    ],
  }),
  component: SupportAgentDashboard,
});
