import { createFileRoute } from "@tanstack/react-router";
import SupportDashboard from "@/components/salespages/SupportDashboard";
import { RequireRole } from "@/components/auth/RequireRole";

export const Route = createFileRoute("/support")({
  // Dashboard UI is live/interactive; skip SSR so timers and live data hydrate cleanly.
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    section: typeof search.section === "string" ? search.section : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Support Operations Center | Software Vala" },
      {
        name: "description",
        content:
          "Omni-channel support operations: ticket inbox, priority queue, SLA management, Customer 360, wiki, automation and quality audits.",
      },
      { property: "og:title", content: "Support Operations Center | Software Vala" },
      {
        property: "og:description",
        content:
          "Tickets, SLA, escalations, Customer 360 and support analytics in the Software Vala support console.",
      },
    ],
  }),
  component: () => <RequireRole role="support"><SupportDashboard /></RequireRole>,
});
